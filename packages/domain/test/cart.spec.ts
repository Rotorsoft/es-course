import { describe, it, expect, beforeEach } from "vitest";
import { store, type Target } from "@rotorsoft/act";
import { app, Cart, Inventory, getOrders, clearOrders } from "../src/index.js";

const target = (stream = crypto.randomUUID()): Target => ({
  stream,
  actor: { id: "user-1", name: "Test User" },
});

const sampleItem = (overrides: Partial<{ itemId: string; productId: string; name: string; price: string; description: string }> = {}) => ({
  itemId: overrides.itemId ?? crypto.randomUUID(),
  name: overrides.name ?? "Widget",
  description: overrides.description ?? "A fine widget",
  price: overrides.price ?? "9.99",
  productId: overrides.productId ?? "prod-1",
});

async function drainAll() {
  for (let i = 0; i < 10; i++) {
    const { leased } = await app.correlate({ after: -1, limit: 100 });
    if (leased.length === 0) break;
    await app.drain({ streamLimit: 10, eventLimit: 100 });
  }
}

describe("Cart", () => {
  beforeEach(async () => {
    await store().seed();
    clearOrders();
  });

  describe("spec: Add Item", () => {
    it("should add an item to the cart", async () => {
      const t = target();
      const item = sampleItem();
      await app.do("AddItem", t, item);
      const snap = await app.load(Cart, t.stream);
      expect(snap.state.items).toHaveLength(1);
      expect(snap.state.items[0].name).toBe("Widget");
    });

    it("should reject adding a 4th item (max 3)", async () => {
      const t = target();
      await app.do("AddItem", t, sampleItem({ itemId: "i1" }));
      await app.do("AddItem", t, sampleItem({ itemId: "i2" }));
      await app.do("AddItem", t, sampleItem({ itemId: "i3" }));
      await expect(
        app.do("AddItem", t, sampleItem({ itemId: "i4" }))
      ).rejects.toThrow();
    });
  });

  describe("spec: Remove Item", () => {
    it("should reject removing from empty cart", async () => {
      const t = target();
      await expect(
        app.do("RemoveItem", t, { itemId: "x", productId: "p" })
      ).rejects.toThrow();
    });

    it("should remove an existing item", async () => {
      const t = target();
      const item = sampleItem({ itemId: "i1", productId: "p1" });
      await app.do("AddItem", t, item);
      await app.do("RemoveItem", t, {
        itemId: "i1",
        productId: "p1",
      });
      const snap = await app.load(Cart, t.stream);
      expect(snap.state.items).toHaveLength(0);
    });
  });

  describe("spec: Clear Cart", () => {
    it("should clear all items from the cart", async () => {
      const t = target();
      await app.do("AddItem", t, sampleItem({ itemId: "i1" }));
      await app.do("ClearCart", t, {});
      const snap = await app.load(Cart, t.stream);
      expect(snap.state.items).toHaveLength(0);
    });
  });

  describe("spec: Archive Item", () => {
    it("should archive an item from the cart", async () => {
      const t = target();
      await app.do(
        "AddItem",
        t,
        sampleItem({ itemId: "i1", productId: "p1" })
      );
      await app.do("ArchiveItem", t, {
        productId: "p1",
        itemId: "i1",
      });
      const snap = await app.load(Cart, t.stream);
      expect(snap.state.items).toHaveLength(0);
    });
  });

  describe("spec: Submit Cart", () => {
    it("should submit a cart with items", async () => {
      const t = target();
      await app.do(
        "AddItem",
        t,
        sampleItem({ itemId: "i1", price: "10.00" })
      );
      await app.do("SubmitCart", t, {});
      const snap = await app.load(Cart, t.stream);
      expect(snap.state.status).toBe("Submitted");
      expect(snap.state.totalPrice).toBe(10.0);
    });

    it("should reject submitting an empty cart", async () => {
      const t = target();
      await expect(app.do("SubmitCart", t, {})).rejects.toThrow();
    });
  });

  describe("spec: Publish Cart (via reaction)", () => {
    it("should publish cart after submission", async () => {
      const t = target();
      await app.do(
        "AddItem",
        t,
        sampleItem({ itemId: "i1", price: "25.50" })
      );
      await app.do("SubmitCart", t, {});
      await drainAll();
      const snap = await app.load(Cart, t.stream);
      expect(snap.state.status).toBe("Published");
    });
  });
});

describe("Inventory", () => {
  beforeEach(async () => {
    await store().seed();
    clearOrders();
  });

  it("should import inventory", async () => {
    const t = target("prod-1");
    await app.do("ImportInventory", t, {
      inventory: 100,
      productId: "prod-1",
    });
    const snap = await app.load(Inventory, t.stream);
    expect(snap.state.inventory).toBe(100);
  });
});

describe("Orders projection", () => {
  beforeEach(async () => {
    await store().seed();
    clearOrders();
  });

  it("should materialize order from cart events", async () => {
    const t = target();
    await app.do("AddItem", t, sampleItem({ itemId: "i1", price: "10.00" }));
    await app.do("SubmitCart", t, {});
    await drainAll();

    const orders = getOrders();
    const order = orders.find((o) => o.id === t.stream);
    expect(order).toBeDefined();
    expect(order!.items).toHaveLength(1);
    expect(order!.totalPrice).toBe(10.0);
    expect(order!.submittedAt).toBeDefined();
  });

  it("should update order status on CartPublished", async () => {
    const t = target();
    await app.do("AddItem", t, sampleItem({ itemId: "i1", price: "25.50" }));
    await app.do("SubmitCart", t, {});
    await drainAll();

    const orders = getOrders();
    const order = orders.find((o) => o.id === t.stream);
    expect(order).toBeDefined();
    expect(order!.status).toBe("Published");
    expect(order!.totalPrice).toBe(25.5);
    expect(order!.submittedAt).toBeDefined();
    expect(order!.publishedAt).toBeDefined();
  });

  it("should track multiple orders", async () => {
    const t1 = target();
    const t2 = target();
    await app.do("AddItem", t1, sampleItem({ itemId: "i1", price: "10.00" }));
    await app.do("AddItem", t2, sampleItem({ itemId: "i2", price: "20.00" }));
    await app.do("SubmitCart", t1, {});
    await app.do("SubmitCart", t2, {});
    await drainAll();

    const orders = getOrders();
    expect(orders).toHaveLength(2);
    const o1 = orders.find((o) => o.id === t1.stream);
    const o2 = orders.find((o) => o.id === t2.stream);
    expect(o1!.totalPrice).toBe(10.0);
    expect(o2!.totalPrice).toBe(20.0);
  });
});
