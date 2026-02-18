import { Cart, Price, getOrders, getInventoryItems, app } from "@rotorsoft/es-course-domain";
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

// Event-driven drain: each commit enqueues exactly one correlate+drain.
// Reactions that commit new events trigger further drains via committed.
let drainChain = Promise.resolve();

function enqueueDrain() {
  drainChain = drainChain.then(async () => {
    const { leased } = await app.correlate({ after: -1, limit: 100 });
    if (leased.length > 0) await app.drain();
  }).catch(console.error) as Promise<void>;
}

// Kick off a drain and wait for the chain to settle (no more pending work)
async function drainSettled() {
  enqueueDrain();
  let prev;
  do {
    prev = drainChain;
    await drainChain;
  } while (drainChain !== prev);
}

// Reactions that commit new events during drain trigger further drains
app.on("committed", () => { enqueueDrain(); });

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
      await drainSettled();
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
      await drainSettled();
      return { success: true };
    }),

  ClearCart: t.procedure
    .input(z.object({ stream: z.string() }))
    .mutation(async ({ input }) => {
      await app.do("ClearCart", userTarget(input.stream), {});
      await drainSettled();
      return { success: true };
    }),

  SubmitCart: t.procedure
    .input(z.object({ stream: z.string() }))
    .mutation(async ({ input }) => {
      await app.do("SubmitCart", userTarget(input.stream), {});
      await drainSettled();
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
      await drainSettled();
      return { success: true };
    }),

  // Inventory commands (ImportInventory for seeding, AdjustInventory for admin)
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
      await drainSettled();
      return { success: true };
    }),

  AdjustInventory: t.procedure
    .input(
      z.object({
        productId: z.string(),
        quantity: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      await app.do(
        "AdjustInventory",
        { stream: input.productId, actor: { id: "system", name: "System" } },
        input
      );
      await drainSettled();
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
      await drainSettled();
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
