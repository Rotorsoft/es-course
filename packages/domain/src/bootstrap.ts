import { act } from "@rotorsoft/act";
import { CartSlice } from "./cart.js";
import { InventorySlice } from "./inventory.js";
import { CartTrackingSlice } from "./tracking.js";
import { UserSlice } from "./user.js";

export const app = act()
  .withSlice(CartSlice)
  .withSlice(InventorySlice)
  .withSlice(CartTrackingSlice)
  .withSlice(UserSlice)
  .build();
