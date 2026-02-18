import { act, slice } from "@rotorsoft/act";
import { Cart } from "./cart.js";
import { Price } from "./price.js";
import { Inventory, InventoryProjection } from "./inventory.js";
import { OrdersProjection } from "./orders.js";
import { CartTracking, CartTrackingProjection } from "./tracking.js";

const CartSlice = slice().with(Cart).build();
const PriceSlice = slice().with(Price).build();
const InventorySlice = slice().with(Inventory).build();
const CartTrackingSlice = slice().with(CartTracking).build();

export const app = act()
  .with(CartSlice)
  .with(PriceSlice)
  .with(InventorySlice)
  .with(CartTrackingSlice)
  .with(OrdersProjection)
  .with(InventoryProjection)
  .with(CartTrackingProjection)
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
  .to((event) => ({ target: event.stream }))
  .build();
