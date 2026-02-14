import { state } from "@rotorsoft/act";
import { ChangePrice, PriceChanged, PriceState } from "./schemas.js";

export const Price = state({ Price: PriceState })
  .init(() => ({ price: 0, productId: "" }))
  .emits({ PriceChanged })
  .patch({
    PriceChanged: ({ data }) => ({
      price: data.price,
      productId: data.productId,
    }),
  })
  .on({ ChangePrice })
  .emit((data) => ["PriceChanged", data])
  .build();
