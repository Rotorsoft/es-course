import { z } from "zod";

// === Shared ===
export const CartItem = z.object({
  itemId: z.string(),
  name: z.string(),
  description: z.string(),
  price: z.string(),
  productId: z.string(),
});
export type CartItem = z.infer<typeof CartItem>;

// === Cart Actions ===
export const PlaceOrder = z.object({
  items: z.array(CartItem).min(1),
});

export const PublishCart = z.object({
  orderedProducts: z.array(CartItem),
  totalPrice: z.number(),
});

// === Cart Events ===
export const CartSubmitted = z.object({
  orderedProducts: z.array(CartItem),
  totalPrice: z.number(),
});

export const CartPublished = z.object({
  orderedProducts: z.array(CartItem),
  totalPrice: z.number(),
});

// === Cart State ===
export const CartState = z.object({
  status: z.string(),
  totalPrice: z.number(),
});

// === Price Actions ===
export const ChangePrice = z.object({
  price: z.number(),
  productId: z.string(),
});

// === Price Events ===
export const PriceChanged = z.object({
  price: z.number(),
  productId: z.string(),
});

// === Price State ===
export const PriceState = z.object({
  price: z.number(),
  productId: z.string(),
});

// === Inventory Actions ===
export const ImportInventory = z.object({
  name: z.string(),
  price: z.number(),
  quantity: z.number(),
  productId: z.string(),
});

// === Inventory Events ===
export const InventoryImported = z.object({
  name: z.string(),
  price: z.number(),
  quantity: z.number(),
  productId: z.string(),
});

export const AdjustInventory = z.object({
  quantity: z.number(),
  price: z.number(),
  productId: z.string(),
});

export const InventoryAdjusted = z.object({
  quantity: z.number(),
  price: z.number(),
  productId: z.string(),
});

export const DecommissionInventory = z.object({
  productId: z.string(),
});

export const InventoryDecommissioned = z.object({
  productId: z.string(),
});

// === Inventory State ===
export const InventoryState = z.object({
  name: z.string(),
  price: z.number(),
  quantity: z.number(),
  productId: z.string(),
});

// === Cart Tracking Actions ===
export const TrackCartActivity = z.object({
  action: z.enum(["add", "remove", "clear"]),
  productId: z.string(),
  quantity: z.number(),
});

// === Cart Tracking Events ===
export const CartActivityTracked = z.object({
  action: z.enum(["add", "remove", "clear"]),
  productId: z.string(),
  quantity: z.number(),
});

// === Cart Tracking State ===
export const CartTrackingState = z.object({
  eventCount: z.number(),
});
