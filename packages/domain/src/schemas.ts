import { ZodEmpty } from "@rotorsoft/act";
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
export const AddItem = z.object({
  description: z.string(),
  price: z.string(),
  itemId: z.string(),
  name: z.string(),
  productId: z.string(),
});

export const RemoveItem = z.object({
  itemId: z.string(),
  productId: z.string(),
});

export const ClearCart = ZodEmpty;

export const RequestToArchiveItem = z.object({
  productId: z.string(),
  itemId: z.string(),
});

export const ArchiveItem = z.object({
  productId: z.string(),
  itemId: z.string(),
});

export const SubmitCart = ZodEmpty;

export const PublishCart = z.object({
  orderedProducts: z.array(CartItem),
  totalPrice: z.number(),
});

// === Cart Events ===
export const ItemAdded = z.object({
  description: z.string(),
  itemId: z.string(),
  name: z.string(),
  price: z.string(),
  productId: z.string(),
});

export const ItemRemoved = z.object({
  itemId: z.string(),
  productId: z.string(),
});

export const CartCleared = ZodEmpty;

export const ItemArchiveRequested = z.object({
  productId: z.string(),
  itemId: z.string(),
});

export const ItemArchived = z.object({
  productId: z.string(),
  itemId: z.string(),
});

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
  items: z.array(CartItem),
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
  inventory: z.number(),
  productId: z.string(),
});

// === Inventory Events ===
export const InventoryUpdated = z.object({
  inventory: z.number(),
  productId: z.string(),
});

// === Inventory State ===
export const InventoryState = z.object({
  inventory: z.number(),
  productId: z.string(),
});
