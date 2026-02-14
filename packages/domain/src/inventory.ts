import { state } from "@rotorsoft/act";
import {
  ImportInventory,
  InventoryUpdated,
  InventoryState,
} from "./schemas.js";

export const Inventory = state({ Inventory: InventoryState })
  .init(() => ({ inventory: 0, productId: "" }))
  .emits({ InventoryUpdated })
  .patch({
    InventoryUpdated: ({ data }) => ({
      inventory: data.inventory,
      productId: data.productId,
    }),
  })
  .on({ ImportInventory })
  .emit((data) => ["InventoryUpdated", data])
  .build();
