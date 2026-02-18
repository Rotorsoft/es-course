import { state } from "@rotorsoft/act";
import { mustBeOpen } from "./invariants.js";
import {
  PlaceOrder,
  PublishCart,
  CartSubmitted,
  CartPublished,
  CartState,
} from "./schemas.js";

export const Cart = state({ Cart: CartState })
  .init(() => ({ status: "Open", totalPrice: 0 }))
  .emits({ CartSubmitted, CartPublished })
  .patch({
    CartSubmitted: ({ data }) => ({
      status: "Submitted",
      totalPrice: data.totalPrice,
    }),
    CartPublished: ({ data }) => ({
      status: "Published",
      totalPrice: data.totalPrice,
    }),
  })
  .on({ PlaceOrder })
  .given([mustBeOpen])
  .emit((data) => [
    "CartSubmitted",
    {
      orderedProducts: data.items,
      totalPrice: data.items.reduce(
        (sum, item) => sum + parseFloat(item.price || "0"),
        0
      ),
    },
  ])
  .on({ PublishCart })
  .emit((data) => ["CartPublished", data])
  .build();
