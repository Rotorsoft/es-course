import { type Invariant } from "@rotorsoft/act";

export const mustBeOpen: Invariant<{ status: string }> = {
  description: "Cart must be open",
  valid: (state) => state.status === "Open",
};
