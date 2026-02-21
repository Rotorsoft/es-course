import { act } from "@rotorsoft/act";
import { CartSlice } from "./cart.js";
import { InventorySlice } from "./inventory.js";
import type { AppActor } from "./schemas.js";
import { CartTrackingSlice } from "./tracking.js";
import { UserSlice } from "./user.js";

export const app = act()
  .withActor<AppActor>()
  .withSlice(CartSlice)
  .withSlice(InventorySlice)
  .withSlice(CartTrackingSlice)
  .withSlice(UserSlice)
  .build();
