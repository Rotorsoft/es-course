import {
  app,
  type AppActor,
  getAllUsers,
  getCartActivities,
  getInventoryItems,
  getOrders,
  getOrdersByActor,
  getUserByEmail,
  getUserByProviderId,
  systemActor,
  type UserProfile,
} from "@rotorsoft/es-course-domain";
import { initTRPC, tracked, TRPCError } from "@trpc/server";
import { EventEmitter } from "node:events";
import { z } from "zod";
import { hashPassword, signToken, verifyPassword, verifyToken } from "./auth.js";

// === Context ===

export type Context = {
  user: UserProfile | null;
  actor: AppActor;
};

export function createContext({ req }: { req: { headers: Record<string, string | string[] | undefined> } }): Context {
  const auth = req.headers["authorization"];
  const token = typeof auth === "string" && auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      const user = getUserByEmail(payload.email) ?? null;
      if (user) {
        return {
          user,
          actor: { id: user.email, name: user.name, picture: user.picture, role: user.role },
        };
      }
    }
  }

  return {
    user: null,
    actor: { id: "anonymous", name: "Anonymous", role: "user" },
  };
}

// === tRPC setup ===

const t = initTRPC.context<Context>().create();

const isAuthenticated = t.middleware(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

const isAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

const publicProcedure = t.procedure;
const authedProcedure = t.procedure.use(isAuthenticated);
const adminProcedure = t.procedure.use(isAdmin);

// === Helpers ===

type SerializedEvent = {
  id: number;
  name: string;
  data: Record<string, unknown>;
  stream: string;
  version: number;
  created: string;
  meta: {
    correlation: string;
    causation: {
      action?: { stream: string; actor: { id: string; name: string }; name?: string };
      event?: { id: number; name: string; stream: string };
    };
  };
};

function serializeEvents(events: Array<{ id: number; name: unknown; data: unknown; stream: string; version: number; created: Date; meta: unknown }>): SerializedEvent[] {
  return events.map((e) => ({
    id: e.id,
    name: e.name as string,
    data: e.data as Record<string, unknown>,
    stream: e.stream,
    version: e.version,
    created: e.created.toISOString(),
    meta: e.meta as SerializedEvent["meta"],
  }));
}

async function drainAll() {
  for (let i = 0; i < 2; i++) {
    const { leased } = await app.correlate({ after: -1, limit: 100 });
    if (leased.length === 0) return;
    await app.drain({ streamLimit: 10, eventLimit: 100 });
  }
}

// Local event bus for SSE subscriptions
const eventBus = new EventEmitter();
eventBus.setMaxListeners(100);
app.on("committed", () => eventBus.emit("committed"));

// Google OAuth client (lazy-loaded)
let googleClient: import("google-auth-library").OAuth2Client | null = null;
function getGoogleClient() {
  if (!googleClient && process.env.GOOGLE_CLIENT_ID) {
    const { OAuth2Client } = require("google-auth-library") as typeof import("google-auth-library");
    googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }
  return googleClient;
}

// === Router ===

export const router = t.router({
  // --- Auth procedures ---

  getAuthConfig: publicProcedure.query(() => {
    const providers: ("local" | "google")[] = ["local"];
    if (process.env.GOOGLE_CLIENT_ID) providers.push("google");
    return { providers };
  }),

  login: publicProcedure
    .input(z.object({ username: z.string(), password: z.string() }))
    .mutation(async ({ input }) => {
      // Look up user by providerId (username for local)
      const user = getUserByProviderId(input.username);
      if (!user || user.provider !== "local" || !user.passwordHash) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials" });
      }
      if (!verifyPassword(input.password, user.passwordHash)) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials" });
      }
      const token = signToken({ email: user.email });
      const { passwordHash: _, ...profile } = user;
      return { user: profile, token };
    }),

  signup: publicProcedure
    .input(z.object({ username: z.string(), name: z.string(), password: z.string() }))
    .mutation(async ({ input }) => {
      const existing = getUserByEmail(input.username);
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "User already exists" });
      }
      const passwordHash = hashPassword(input.password);
      await app.do("RegisterUser", { stream: input.username, actor: { ...systemActor, name: "AuthSystem" } }, {
        email: input.username,
        name: input.name,
        provider: "local",
        providerId: input.username,
        passwordHash,
      });
      await drainAll();
      const user = getUserByEmail(input.username);
      if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to register user" });
      const token = signToken({ email: user.email });
      const { passwordHash: _, ...profile } = user;
      return { user: profile, token };
    }),

  loginWithGoogle: publicProcedure
    .input(z.object({ idToken: z.string() }))
    .mutation(async ({ input }) => {
      const client = getGoogleClient();
      if (!client) throw new TRPCError({ code: "BAD_REQUEST", message: "Google SSO not configured" });

      const ticket = await client.verifyIdToken({
        idToken: input.idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload || !payload.email || !payload.sub) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid Google token" });
      }

      // Register if new
      let user = getUserByEmail(payload.email);
      if (!user) {
        await app.do("RegisterUser", { stream: payload.email, actor: { ...systemActor, name: "AuthSystem" } }, {
          email: payload.email,
          name: payload.name || payload.email,
          picture: payload.picture,
          provider: "google",
          providerId: payload.sub,
        });
        await drainAll();
        user = getUserByEmail(payload.email);
      }
      if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to register user" });

      const token = signToken({ email: user.email });
      const { passwordHash: _, ...profile } = user;
      return { user: profile, token };
    }),

  me: authedProcedure.query(({ ctx }) => {
    const { passwordHash: _, ...profile } = ctx.user;
    return profile;
  }),

  assignRole: adminProcedure
    .input(z.object({ email: z.string(), role: z.enum(["admin", "user"]) }))
    .mutation(async ({ input, ctx }) => {
      const target = getUserByEmail(input.email);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      await app.do("AssignRole", { stream: input.email, actor: ctx.actor }, { role: input.role });
      await drainAll();
      return { success: true };
    }),

  listUsers: adminProcedure.query(() => {
    return getAllUsers().map(({ passwordHash: _, ...profile }) => profile);
  }),

  // --- Domain procedures ---

  PlaceOrder: authedProcedure
    .input(
      z.object({
        items: z.array(
          z.object({
            itemId: z.string(),
            name: z.string(),
            description: z.string(),
            price: z.string(),
            productId: z.string(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const target = {
        stream: crypto.randomUUID(),
        actor: ctx.actor,
      };
      await app.do("PlaceOrder", target, { items: input.items });
      await drainAll();
      return { success: true, orderId: target.stream };
    }),

  // Inventory commands (admin only)
  ImportInventory: adminProcedure
    .input(
      z.object({
        productId: z.string(),
        name: z.string(),
        price: z.number(),
        quantity: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await app.do(
        "ImportInventory",
        { stream: input.productId, actor: ctx.actor },
        input
      );
      await drainAll();
      return { success: true };
    }),

  AdjustInventory: adminProcedure
    .input(
      z.object({
        productId: z.string(),
        quantity: z.number(),
        price: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await app.do(
        "AdjustInventory",
        { stream: input.productId, actor: ctx.actor },
        input
      );
      await drainAll();
      return { success: true };
    }),

  DecommissionInventory: adminProcedure
    .input(
      z.object({
        productId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await app.do(
        "DecommissionInventory",
        { stream: input.productId, actor: ctx.actor },
        input
      );
      await drainAll();
      return { success: true };
    }),

  // Cart activity tracking (fire-and-forget, no drain)
  TrackCartActivity: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        action: z.enum(["add", "remove", "clear"]),
        productId: z.string(),
        quantity: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      await app.do(
        "TrackCartActivity",
        { stream: input.sessionId, actor: { id: "anonymous", name: "Browser", role: "user" } },
        { action: input.action, productId: input.productId, quantity: input.quantity }
      );
      return { success: true };
    }),

  // Queries
  getCartActivity: publicProcedure.query(async () => {
    return getCartActivities();
  }),

  getInventory: publicProcedure.query(async () => {
    return getInventoryItems();
  }),

  getProducts: publicProcedure.query(async () => {
    const items = getInventoryItems();
    const ids = ["prod-espresso", "prod-grinder", "prod-kettle", "prod-scale", "prod-filters"];
    return ids.map((id) => {
      const inv = items[id];
      return {
        productId: id,
        price: inv?.price ?? 0,
        inventory: inv?.quantity ?? 0,
      };
    });
  }),

  listOrders: authedProcedure.query(async ({ ctx }) => {
    return ctx.user.role === "admin" ? getOrders() : getOrdersByActor(ctx.user.email);
  }),

  // Subscription — push events via SSE
  onEvent: publicProcedure.subscription(async function*({ signal }) {
    const existing = await app.query_array({ after: -1 });
    for (const e of serializeEvents(existing)) {
      yield tracked(String(e.id), e);
    }

    let lastId = existing.length > 0 ? existing[existing.length - 1].id : -1;

    let notify: (() => void) | null = null;
    const onCommitted = () => {
      if (notify) {
        notify();
        notify = null;
      }
    };
    eventBus.on("committed", onCommitted);

    try {
      while (!signal?.aborted) {
        await new Promise<void>((resolve) => {
          notify = resolve;
          signal?.addEventListener("abort", () => resolve(), { once: true });
        });
        if (signal?.aborted) break;

        const newEvents = await app.query_array({ after: lastId });
        for (const e of serializeEvents(newEvents)) {
          yield tracked(String(e.id), e);
          lastId = e.id;
        }
      }
    } finally {
      eventBus.off("committed", onCommitted);
    }
  }),
});

export type AppRouter = typeof router;
