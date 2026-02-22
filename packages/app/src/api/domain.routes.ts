import {
  app,
  getCartActivities,
  getInventoryItems,
  getOrders,
  getOrdersByActor,
} from "@rotorsoft/es-course-domain";
import { z } from "zod";
import { t, publicProcedure, authedProcedure, adminProcedure } from "./trpc.js";

export const domainRouter = t.router({
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
      app.settle();
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
      app.settle();
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
      app.settle();
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
      app.settle();
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
    return Object.entries(items).map(([id, inv]) => ({
      productId: id,
      price: inv?.price ?? 0,
      inventory: inv?.quantity ?? 0,
    }));
  }),

  listOrders: authedProcedure.query(async ({ ctx }) => {
    return ctx.actor.role === "admin" ? getOrders() : getOrdersByActor(ctx.actor.id);
  }),
});
