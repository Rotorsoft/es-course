import { describe, it, expect, beforeEach } from "vitest";
import { store, type Target } from "@rotorsoft/act";
import { app, Cart, CartTracking, Inventory, getOrders, getOrdersByActor, clearOrders, getInventoryItems, clearInventory, getCartActivities, clearCartActivities } from "../src/index.js";

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

  describe("spec: Place Order", () => {
    it("should place an order with items", async () => {
      const t = target();
      await app.do("PlaceOrder", t, { items: [sampleItem()] });
      const snap = await app.load(Cart, t.stream);
      expect(snap.state.status).toBe("Submitted");
      expect(snap.state.totalPrice).toBe(9.99);
    });

    it("should reject placing an order with empty items", async () => {
      const t = target();
      await expect(
        app.do("PlaceOrder", t, { items: [] })
      ).rejects.toThrow();
    });

    it("should reject placing a second order on the same stream", async () => {
      const t = target();
      await app.do("PlaceOrder", t, { items: [sampleItem()] });
      await expect(
        app.do("PlaceOrder", t, { items: [sampleItem()] })
      ).rejects.toThrow();
    });
  });

  describe("spec: Publish Cart (via reaction)", () => {
    it("should publish cart after placement", async () => {
      const t = target();
      await app.do("PlaceOrder", t, {
        items: [sampleItem({ price: "25.50" })],
      });
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

    const cart = target();
    await app.do("PlaceOrder", cart, {
      items: [sampleItem({ itemId: "i1", productId: "prod-1", price: "9.99" })],
    });
    await drainAll();

    const items = getInventoryItems();
    expect(items["prod-1"].quantity).toBe(9);
  });

  it("should decrement multiple items of same product in one order", async () => {
    const sys = (id: string) => ({ stream: id, actor: { id: "system", name: "System" } });
    await app.do("ImportInventory", sys("prod-1"), { name: "Widget", price: 9.99, quantity: 10, productId: "prod-1" });
    await drainAll();

    const cart = target();
    await app.do("PlaceOrder", cart, {
      items: [
        sampleItem({ itemId: "i1", productId: "prod-1", price: "9.99" }),
        sampleItem({ itemId: "i2", productId: "prod-1", price: "9.99" }),
      ],
    });
    await drainAll();

    const items = getInventoryItems();
    expect(items["prod-1"].quantity).toBe(8);
  });

  it("should not go below zero", async () => {
    const sys = (id: string) => ({ stream: id, actor: { id: "system", name: "System" } });
    await app.do("ImportInventory", sys("prod-1"), { name: "Widget", price: 9.99, quantity: 1, productId: "prod-1" });
    await drainAll();

    const cart = target();
    await app.do("PlaceOrder", cart, {
      items: [
        sampleItem({ itemId: "i1", productId: "prod-1", price: "9.99" }),
        sampleItem({ itemId: "i2", productId: "prod-1", price: "9.99" }),
      ],
    });
    await drainAll();

    const items = getInventoryItems();
    expect(items["prod-1"].quantity).toBe(0);
  });

  it("should update quantity on AdjustInventory (admin update)", async () => {
    const sys = (id: string) => ({ stream: id, actor: { id: "system", name: "System" } });
    await app.do("ImportInventory", sys("prod-1"), { name: "Widget", price: 9.99, quantity: 10, productId: "prod-1" });
    await drainAll();

    await app.do("AdjustInventory", sys("prod-1"), { quantity: 50, price: 9.99, productId: "prod-1" });
    await drainAll();

    const items = getInventoryItems();
    expect(items["prod-1"].quantity).toBe(50);
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

  it("should materialize order from PlaceOrder", async () => {
    const t = target();
    await app.do("PlaceOrder", t, {
      items: [sampleItem({ itemId: "i1", price: "10.00" })],
    });
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
    await app.do("PlaceOrder", t, {
      items: [sampleItem({ itemId: "i1", price: "25.50" })],
    });
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
    await app.do("PlaceOrder", t1, {
      items: [sampleItem({ itemId: "i1", price: "10.00" })],
    });
    await app.do("PlaceOrder", t2, {
      items: [sampleItem({ itemId: "i2", price: "20.00" })],
    });
    await drainAll();

    const orders = getOrders();
    expect(orders).toHaveLength(2);
    const o1 = orders.find((o) => o.id === t1.stream);
    const o2 = orders.find((o) => o.id === t2.stream);
    expect(o1!.totalPrice).toBe(10.0);
    expect(o2!.totalPrice).toBe(20.0);
  });

  it("should capture actorId from event metadata", async () => {
    const t = target();
    await app.do("PlaceOrder", t, {
      items: [sampleItem({ itemId: "i1", price: "10.00" })],
    });
    await drainAll();

    const orders = getOrders();
    const order = orders.find((o) => o.id === t.stream);
    expect(order).toBeDefined();
    expect(order!.actorId).toBe("user-1");
  });

  it("should filter orders by actorId with getOrdersByActor", async () => {
    const t1: Target = { stream: crypto.randomUUID(), actor: { id: "alice@test.com", name: "Alice" } };
    const t2: Target = { stream: crypto.randomUUID(), actor: { id: "bob@test.com", name: "Bob" } };
    const t3: Target = { stream: crypto.randomUUID(), actor: { id: "alice@test.com", name: "Alice" } };
    await app.do("PlaceOrder", t1, { items: [sampleItem({ itemId: "i1", price: "10.00" })] });
    await app.do("PlaceOrder", t2, { items: [sampleItem({ itemId: "i2", price: "20.00" })] });
    await app.do("PlaceOrder", t3, { items: [sampleItem({ itemId: "i3", price: "30.00" })] });
    await drainAll();

    const aliceOrders = getOrdersByActor("alice@test.com");
    expect(aliceOrders).toHaveLength(2);
    expect(aliceOrders.every((o) => o.actorId === "alice@test.com")).toBe(true);

    const bobOrders = getOrdersByActor("bob@test.com");
    expect(bobOrders).toHaveLength(1);
    expect(bobOrders[0].actorId).toBe("bob@test.com");

    const noOrders = getOrdersByActor("nobody@test.com");
    expect(noOrders).toHaveLength(0);
  });
});

describe("Cart tracking", () => {
  beforeEach(async () => {
    await store().seed();
    clearOrders();
    clearInventory();
    clearCartActivities();
  });

  it("should emit CartActivityTracked on TrackCartActivity", async () => {
    const session = target("session-1");
    await app.do("TrackCartActivity", session, {
      action: "add",
      productId: "prod-espresso",
      quantity: 1,
    });
    const snap = await app.load(CartTracking, session.stream);
    expect(snap.state.eventCount).toBe(1);
  });

  it("should increment eventCount for multiple activities", async () => {
    const session = target("session-2");
    await app.do("TrackCartActivity", session, { action: "add", productId: "prod-espresso", quantity: 1 });
    await app.do("TrackCartActivity", session, { action: "add", productId: "prod-grinder", quantity: 1 });
    await app.do("TrackCartActivity", session, { action: "remove", productId: "prod-espresso", quantity: 1 });
    const snap = await app.load(CartTracking, session.stream);
    expect(snap.state.eventCount).toBe(3);
  });

  it("should materialize activity entries in projection", async () => {
    const session = target("session-3");
    await app.do("TrackCartActivity", session, { action: "add", productId: "prod-espresso", quantity: 1 });
    await app.do("TrackCartActivity", session, { action: "remove", productId: "prod-espresso", quantity: 1 });
    await drainAll();

    const activities = getCartActivities();
    const sessionActivities = activities.filter((a) => a.sessionId === "session-3");
    expect(sessionActivities).toHaveLength(2);
    expect(sessionActivities[0].action).toBe("add");
    expect(sessionActivities[1].action).toBe("remove");
    expect(sessionActivities[0].productId).toBe("prod-espresso");
  });

  it("should not interfere with order flow", async () => {
    // Track some activity
    const session = target("session-4");
    await app.do("TrackCartActivity", session, { action: "add", productId: "prod-espresso", quantity: 1 });

    // Place an order on a separate stream
    const cart = target();
    await app.do("PlaceOrder", cart, { items: [sampleItem({ price: "10.00" })] });
    await drainAll();

    // Order should work normally
    const orders = getOrders();
    const order = orders.find((o) => o.id === cart.stream);
    expect(order).toBeDefined();
    expect(order!.status).toBe("Published");

    // Tracking should be on its own stream
    const snap = await app.load(CartTracking, session.stream);
    expect(snap.state.eventCount).toBe(1);
  });
});
