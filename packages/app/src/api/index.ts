import type { Target } from "@rotorsoft/act";
import { app, getCartActivities, getInventoryItems, getOrders } from "@rotorsoft/es-course-domain";
import { initTRPC, tracked } from "@trpc/server";
import { EventEmitter } from "node:events";
import { z } from "zod";

const t = initTRPC.create();

const userTarget = (stream?: string): Target => ({
  stream: stream ?? crypto.randomUUID(),
  actor: { id: "user-1", name: "User" },
});

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

// Drain reactions and projections — two passes:
// 1. CartSubmitted → ReserveStock + PublishCart (single reaction)
// 2. Projections (orders, inventory read models)
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

export const router = t.router({
  // Place a complete order in one call
  PlaceOrder: t.procedure
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
    .mutation(async ({ input }) => {
      const target = userTarget();
      await app.do("PlaceOrder", target, { items: input.items });
      await drainAll();
      return { success: true, orderId: target.stream };
    }),

  // Inventory commands
  ImportInventory: t.procedure
    .input(
      z.object({
        productId: z.string(),
        name: z.string(),
        price: z.number(),
        quantity: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      await app.do(
        "ImportInventory",
        { stream: input.productId, actor: { id: "system", name: "System" } },
        input
      );
      await drainAll();
      return { success: true };
    }),

  AdjustInventory: t.procedure
    .input(
      z.object({
        productId: z.string(),
        quantity: z.number(),
        price: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      await app.do(
        "AdjustInventory",
        { stream: input.productId, actor: { id: "system", name: "System" } },
        input
      );
      await drainAll();
      return { success: true };
    }),

  DecommissionInventory: t.procedure
    .input(
      z.object({
        productId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      await app.do(
        "DecommissionInventory",
        { stream: input.productId, actor: { id: "system", name: "System" } },
        input
      );
      await drainAll();
      return { success: true };
    }),

  // Cart activity tracking (fire-and-forget, no drain)
  TrackCartActivity: t.procedure
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
        { stream: input.sessionId, actor: { id: "anonymous", name: "Browser" } },
        { action: input.action, productId: input.productId, quantity: input.quantity }
      );
      return { success: true };
    }),

  // Queries
  getCartActivity: t.procedure.query(async () => {
    return getCartActivities();
  }),

  getInventory: t.procedure.query(async () => {
    return getInventoryItems();
  }),

  getProducts: t.procedure.query(async () => {
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

  listOrders: t.procedure.query(async () => {
    return getOrders();
  }),

  // Subscription — push events via SSE
  onEvent: t.procedure.subscription(async function*({ signal }) {
    // Send all existing events first
    const existing = await app.query_array({ after: -1 });
    for (const e of serializeEvents(existing)) {
      yield tracked(String(e.id), e);
    }

    let lastId = existing.length > 0 ? existing[existing.length - 1].id : -1;

    // Stream new events as they are committed
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
