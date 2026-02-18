import { type Invariant } from "@rotorsoft/act";
import type { CartItem } from "./schemas.js";

export const mustHaveItems: Invariant<{ items: CartItem[] }> = {
  description: "Cart must have items",
  valid: (state) => state.items.length > 0,
};

export const mustBeOpen: Invariant<{ status: string }> = {
  description: "Cart must be open",
  valid: (state) => state.status === "Open",
};
