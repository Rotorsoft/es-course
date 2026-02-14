import { act, slice } from "@rotorsoft/act";
import { Cart } from "./cart.js";
import { Price } from "./price.js";
import { Inventory } from "./inventory.js";

const CartSlice = slice().with(Cart).build();
const PriceSlice = slice().with(Price).build();
const InventorySlice = slice().with(Inventory).build();

export const app = act()
  .with(CartSlice)
  .with(PriceSlice)
  .with(InventorySlice)
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
