import { describe, it, expect, beforeEach } from "vitest";
import { store, type Target } from "@rotorsoft/act";
import { app, Cart, Inventory, getOrders, clearOrders, getInventoryItems, clearInventory } from "../src/index.js";

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
    clearInventory();
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

    it("should allow adding many items (no hardcoded cap)", async () => {
      const t = target();
      for (let i = 1; i <= 15; i++) {
        await app.do("AddItem", t, sampleItem({ itemId: `i${i}` }));
      }
      const snap = await app.load(Cart, t.stream);
      expect(snap.state.items).toHaveLength(15);
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
    clearInventory();
  });

  it("should import inventory", async () => {
    const t = target("prod-1");
    await app.do("ImportInventory", t, {
      name: "Widget",
      price: 9.99,
      quantity: 100,
      productId: "prod-1",
    });
    const snap = await app.load(Inventory, t.stream);
    expect(snap.state.quantity).toBe(100);
    expect(snap.state.name).toBe("Widget");
    expect(snap.state.price).toBe(9.99);
  });
});

describe("Inventory projection", () => {
  beforeEach(async () => {
    await store().seed();
    clearOrders();
    clearInventory();
  });

  it("should materialize from InventoryImported events", async () => {
    const system = { stream: "prod-1", actor: { id: "system", name: "System" } };
    await app.do("ImportInventory", system, {
      name: "Widget",
      price: 9.99,
      quantity: 50,
      productId: "prod-1",
    });
    await drainAll();

    const items = getInventoryItems();
    expect(items["prod-1"]).toBeDefined();
    expect(items["prod-1"].name).toBe("Widget");
    expect(items["prod-1"].price).toBe(9.99);
    expect(items["prod-1"].quantity).toBe(50);
  });

  it("should track multiple products", async () => {
    const sys = (id: string) => ({ stream: id, actor: { id: "system", name: "System" } });
    await app.do("ImportInventory", sys("prod-1"), { name: "Widget", price: 9.99, quantity: 50, productId: "prod-1" });
    await app.do("ImportInventory", sys("prod-2"), { name: "Gadget", price: 19.99, quantity: 30, productId: "prod-2" });
    await drainAll();

    const items = getInventoryItems();
    expect(Object.keys(items)).toHaveLength(2);
    expect(items["prod-1"].quantity).toBe(50);
    expect(items["prod-2"].quantity).toBe(30);
  });

  it("should decrement stock on CartPublished", async () => {
    const sys = (id: string) => ({ stream: id, actor: { id: "system", name: "System" } });
    await app.do("ImportInventory", sys("prod-1"), { name: "Widget", price: 9.99, quantity: 10, productId: "prod-1" });
    await drainAll();

    // Create and submit a cart with the product
    const cart = target();
    await app.do("AddItem", cart, sampleItem({ itemId: "i1", productId: "prod-1", price: "9.99" }));
    await app.do("SubmitCart", cart, {});
    await drainAll();

    const items = getInventoryItems();
    expect(items["prod-1"].quantity).toBe(9);
  });

  it("should decrement multiple items of same product in one cart", async () => {
    const sys = (id: string) => ({ stream: id, actor: { id: "system", name: "System" } });
    await app.do("ImportInventory", sys("prod-1"), { name: "Widget", price: 9.99, quantity: 10, productId: "prod-1" });
    await drainAll();

    const cart = target();
    await app.do("AddItem", cart, sampleItem({ itemId: "i1", productId: "prod-1", price: "9.99" }));
    await app.do("AddItem", cart, sampleItem({ itemId: "i2", productId: "prod-1", price: "9.99" }));
    await app.do("SubmitCart", cart, {});
    await drainAll();

    const items = getInventoryItems();
    expect(items["prod-1"].quantity).toBe(8);
  });

  it("should not go below zero", async () => {
    const sys = (id: string) => ({ stream: id, actor: { id: "system", name: "System" } });
    await app.do("ImportInventory", sys("prod-1"), { name: "Widget", price: 9.99, quantity: 1, productId: "prod-1" });
    await drainAll();

    const cart = target();
    await app.do("AddItem", cart, sampleItem({ itemId: "i1", productId: "prod-1", price: "9.99" }));
    await app.do("AddItem", cart, sampleItem({ itemId: "i2", productId: "prod-1", price: "9.99" }));
    await app.do("SubmitCart", cart, {});
    await drainAll();

    const items = getInventoryItems();
    expect(items["prod-1"].quantity).toBe(0);
  });

  it("should update price on PriceChanged", async () => {
    const sys = (id: string) => ({ stream: id, actor: { id: "system", name: "System" } });
    await app.do("ImportInventory", sys("prod-1"), { name: "Widget", price: 9.99, quantity: 10, productId: "prod-1" });
    await app.do("ChangePrice", sys("prod-1"), { price: 14.99, productId: "prod-1" });
    await drainAll();

    const items = getInventoryItems();
    expect(items["prod-1"].price).toBe(14.99);
  });

  it("should update quantity on AdjustInventory (admin update)", async () => {
    const sys = (id: string) => ({ stream: id, actor: { id: "system", name: "System" } });
    await app.do("ImportInventory", sys("prod-1"), { name: "Widget", price: 9.99, quantity: 10, productId: "prod-1" });
    await drainAll();

    // Admin adjusts stock to 50
    await app.do("AdjustInventory", sys("prod-1"), { quantity: 50, productId: "prod-1" });
    await drainAll();

    const items = getInventoryItems();
    expect(items["prod-1"].quantity).toBe(50);
    // Name and price should be preserved
    expect(items["prod-1"].name).toBe("Widget");
    expect(items["prod-1"].price).toBe(9.99);
  });

  it("should remove item on DecommissionInventory", async () => {
    const sys = (id: string) => ({ stream: id, actor: { id: "system", name: "System" } });
    await app.do("ImportInventory", sys("prod-1"), { name: "Widget", price: 9.99, quantity: 10, productId: "prod-1" });
    await app.do("ImportInventory", sys("prod-2"), { name: "Gadget", price: 19.99, quantity: 5, productId: "prod-2" });
    await drainAll();

    expect(Object.keys(getInventoryItems())).toHaveLength(2);

    await app.do("DecommissionInventory", sys("prod-1"), { productId: "prod-1" });
    await drainAll();

    const items = getInventoryItems();
    expect(items["prod-1"]).toBeUndefined();
    expect(items["prod-2"]).toBeDefined();
    expect(items["prod-2"].quantity).toBe(5);
  });

  it("should allow re-importing a decommissioned item", async () => {
    const sys = (id: string) => ({ stream: id, actor: { id: "system", name: "System" } });
    await app.do("ImportInventory", sys("prod-1"), { name: "Widget", price: 9.99, quantity: 10, productId: "prod-1" });
    await drainAll();

    await app.do("DecommissionInventory", sys("prod-1"), { productId: "prod-1" });
    await drainAll();
    expect(getInventoryItems()["prod-1"]).toBeUndefined();

    // Re-import brings it back
    await app.do("ImportInventory", sys("prod-1"), { name: "Widget v2", price: 12.99, quantity: 20, productId: "prod-1" });
    await drainAll();

    const items = getInventoryItems();
    expect(items["prod-1"]).toBeDefined();
    expect(items["prod-1"].name).toBe("Widget v2");
    expect(items["prod-1"].quantity).toBe(20);
  });
});

describe("Orders projection", () => {
  beforeEach(async () => {
    await store().seed();
    clearOrders();
    clearInventory();
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
