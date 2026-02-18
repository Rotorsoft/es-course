import { slice, state } from "@rotorsoft/act";
import { mustBeOpen } from "./invariants.js";
import { OrdersProjection } from "./orders.js";
import {
  CartPublished,
  CartState,
  CartSubmitted,
  PlaceOrder,
  PublishCart,
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

export const CartSlice = slice()
  .withState(Cart)
  .withProjection(OrdersProjection)
  // When a cart is submitted, publish it
  .on("CartSubmitted")
  .do(async function publishCart(event, stream, app) {
    await app.do(
      "PublishCart",
      { stream, actor: { id: "system", name: "CartPublisher" } },
      { orderedProducts: event.data.orderedProducts, totalPrice: event.data.totalPrice },
      event
    );
  })
  .to((event) => ({ target: event.stream })).build();
