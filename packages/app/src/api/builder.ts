import { act, slice } from "@rotorsoft/act";
import { Cart, Price, Inventory } from "@rotorsoft/es-course-domain";

const CartSlice = slice().with(Cart).build();
const PriceSlice = slice().with(Price).build();
const InventorySlice = slice().with(Inventory).build();

export const app = act()
  .with(CartSlice)
  .with(PriceSlice)
  .with(InventorySlice)
  .on("CartSubmitted")
  .do(async function publishCart(event, stream, app) {
    await app.do(
      "PublishCart",
      { stream, actor: { id: "system", name: "CartPublisher" } },
      {
        orderedProducts: event.data.orderedProducts,
        totalPrice: event.data.totalPrice,
      },
      event
    );
  })
  .to((event) => ({ target: event.stream }))
  .build();

app.on("committed", () => {
  app.correlate({ after: -1, limit: 100 }).then(() => app.drain()).catch(console.error);
});
