import { Cart, Price, Inventory, getOrders, app } from "@rotorsoft/es-course-domain";
import type { Target } from "@rotorsoft/act";
import { EventEmitter } from "node:events";
import { initTRPC } from "@trpc/server";
import { tracked } from "@trpc/server";
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

// Auto-drain on every commit (processes reactions and projections)
app.on("committed", () => {
  app.correlate({ after: -1, limit: 100 }).then(() => app.drain()).catch(console.error);
});

// Local event bus for SSE subscriptions (decoupled from app's own listeners)
const eventBus = new EventEmitter();
eventBus.setMaxListeners(100);
app.on("committed", () => eventBus.emit("committed"));

export const router = t.router({
  // Cart commands
  AddItem: t.procedure
    .input(
      z.object({
        stream: z.string().optional(),
        description: z.string(),
        price: z.string(),
        itemId: z.string().optional(),
        name: z.string(),
        productId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const { stream, ...data } = input;
      const target = userTarget(stream);
      const itemId = data.itemId ?? crypto.randomUUID();
      await app.do("AddItem", target, { ...data, itemId });
      return { success: true, cartId: target.stream, itemId };
    }),

  RemoveItem: t.procedure
    .input(
      z.object({
        stream: z.string(),
        itemId: z.string(),
        productId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const { stream, ...data } = input;
      await app.do("RemoveItem", userTarget(stream), data);
      return { success: true };
    }),

  ClearCart: t.procedure
    .input(z.object({ stream: z.string() }))
    .mutation(async ({ input }) => {
      await app.do("ClearCart", userTarget(input.stream), {});
      return { success: true };
    }),

  SubmitCart: t.procedure
    .input(z.object({ stream: z.string() }))
    .mutation(async ({ input }) => {
      await app.do("SubmitCart", userTarget(input.stream), {});
      // Process reactions synchronously so CartPublished is committed before response
      await app.correlate({ after: -1, limit: 100 });
      await app.drain();
      return { success: true };
    }),

  // Price commands
  ChangePrice: t.procedure
    .input(
      z.object({
        productId: z.string(),
        price: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      await app.do(
        "ChangePrice",
        { stream: input.productId, actor: { id: "system", name: "System" } },
        input
      );
      return { success: true };
    }),

  // Inventory commands
  ImportInventory: t.procedure
    .input(
      z.object({
        productId: z.string(),
        inventory: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      await app.do(
        "ImportInventory",
        { stream: input.productId, actor: { id: "system", name: "System" } },
        input
      );
      return { success: true };
    }),

  // Queries
  getCart: t.procedure.input(z.string()).query(async ({ input }) => {
    const snap = await app.load(Cart, input);
    return snap.state;
  }),

  getPrice: t.procedure.input(z.string()).query(async ({ input }) => {
    const snap = await app.load(Price, input);
    return snap.state;
  }),

  getInventory: t.procedure.input(z.string()).query(async ({ input }) => {
    const snap = await app.load(Inventory, input);
    return snap.state;
  }),

  getProducts: t.procedure.query(async () => {
    const ids = ["prod-espresso", "prod-grinder", "prod-kettle", "prod-scale", "prod-filters"];
    return Promise.all(
      ids.map(async (id) => {
        const [priceSnap, invSnap] = await Promise.all([
          app.load(Price, id),
          app.load(Inventory, id),
        ]);
        return {
          productId: id,
          price: priceSnap.state.price,
          inventory: invSnap.state.inventory,
        };
      })
    );
  }),

  listOrders: t.procedure.query(async () => {
    return getOrders();
  }),

  // Subscription — push events via SSE
  onEvent: t.procedure.subscription(async function* ({ signal }) {
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
