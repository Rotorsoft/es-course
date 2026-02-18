import { projection, state } from "@rotorsoft/act";
import {
  ImportInventory,
  InventoryImported,
  AdjustInventory,
  InventoryAdjusted,
  DecommissionInventory,
  InventoryDecommissioned,
  InventoryState,
  PriceChanged,
  CartPublished,
} from "./schemas.js";

// === Per-product Inventory aggregate (write model) ===
export const Inventory = state({ Inventory: InventoryState })
  .init(() => ({ name: "", price: 0, quantity: 0, productId: "" }))
  .emits({ InventoryImported, InventoryAdjusted, InventoryDecommissioned })
  .patch({
    InventoryImported: ({ data }) => ({
      name: data.name,
      price: data.price,
      quantity: data.quantity,
      productId: data.productId,
    }),
    InventoryAdjusted: ({ data }) => ({
      quantity: data.quantity,
      price: data.price,
    }),
    InventoryDecommissioned: () => ({
      quantity: 0,
    }),
  })
  .on({ ImportInventory })
  .emit((data) => ["InventoryImported", data])
  .on({ AdjustInventory })
  .emit((data) => ["InventoryAdjusted", data])
  .on({ DecommissionInventory })
  .emit((data) => ["InventoryDecommissioned", data])
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
  .on({ PriceChanged })
  .do(async (event) => {
    const existing = inventory.get(event.data.productId);
    if (existing) {
      existing.price = event.data.price;
    }
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

export function getInventoryItems() {
  return Object.fromEntries(inventory.entries());
}

export function clearInventory() {
  inventory.clear();
}
