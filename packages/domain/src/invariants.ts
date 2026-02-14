import { type Invariant } from "@rotorsoft/act";
import type { CartItem } from "./schemas.js";

const MAX_CART_ITEMS = 3;

export const mustNotExceedMaxItems: Invariant<{ items: CartItem[] }> = {
  description: `Cart cannot have more than ${MAX_CART_ITEMS} items`,
  valid: (state) => state.items.length < MAX_CART_ITEMS,
};

export const mustHaveItems: Invariant<{ items: CartItem[] }> = {
  description: "Cart must have items",
  valid: (state) => state.items.length > 0,
};

export const mustBeOpen: Invariant<{ status: string }> = {
  description: "Cart must be open",
  valid: (state) => state.status === "Open",
};
