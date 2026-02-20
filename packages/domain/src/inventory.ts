import { projection, slice, state } from "@rotorsoft/act";
import { Cart } from "./cart.js";
import {
  AdjustInventory,
  CartPublished,
  DecommissionInventory,
  ImportInventory,
  InventoryAdjusted,
  InventoryDecommissioned,
  InventoryImported,
  InventoryState,
} from "./schemas.js";

// === Per-product Inventory aggregate (write model) ===
export const Inventory = state({ Inventory: InventoryState })
  .init(() => ({ name: "", price: 0, quantity: 0, productId: "" }))
  .emits({ InventoryImported, InventoryAdjusted, InventoryDecommissioned })
  .patch({
    InventoryDecommissioned: () => ({ quantity: 0 }),
  })
  .on({ ImportInventory }).emit("InventoryImported")
  .on({ AdjustInventory }).emit("InventoryAdjusted")
  .on({ DecommissionInventory }).emit("InventoryDecommissioned")
  .build();

// === Inventory projection (read model) ===
export type InventoryItem = {
  name: string;
  price: number;
  quantity: number;
};

const inventory = new Map<string, InventoryItem>();

export const InventoryProjection = projection("inventory")
  .on({ InventoryImported })
  .do(async (event) => {
    inventory.set(event.data.productId, {
      name: event.data.name,
      price: event.data.price,
      quantity: event.data.quantity,
    });
  })
  .on({ InventoryAdjusted })
  .do(async (event) => {
    const existing = inventory.get(event.data.productId);
    if (existing) {
      existing.quantity = event.data.quantity;
      existing.price = event.data.price;
    }
  })
  .on({ InventoryDecommissioned })
  .do(async (event) => {
    inventory.delete(event.data.productId);
  })
  .on({ CartPublished })
  .do(async (event) => {
    const counts = new Map<string, number>();
    for (const item of event.data.orderedProducts) {
      counts.set(item.productId, (counts.get(item.productId) ?? 0) + 1);
    }
    for (const [productId, count] of counts) {
      const existing = inventory.get(productId);
      if (existing) {
        existing.quantity = Math.max(0, existing.quantity - count);
      }
    }
  })
  .build();

export const InventorySlice = slice()
  .withState(Cart)
  .withState(Inventory)
  .withProjection(InventoryProjection)
  .build();

export function getInventoryItems() {
  return Object.fromEntries(inventory.entries());
}

export function clearInventory() {
  inventory.clear();
}
