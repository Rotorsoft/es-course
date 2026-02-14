import { state } from "@rotorsoft/act";
import {
  mustNotExceedMaxItems,
  mustHaveItems,
  mustBeOpen,
} from "./invariants.js";
import {
  AddItem,
  RemoveItem,
  ClearCart,
  RequestToArchiveItem,
  ArchiveItem,
  SubmitCart,
  PublishCart,
  ItemAdded,
  ItemRemoved,
  CartCleared,
  ItemArchiveRequested,
  ItemArchived,
  CartSubmitted,
  CartPublished,
  CartState,
} from "./schemas.js";

export const Cart = state({ Cart: CartState })
  .init(() => ({ items: [], status: "Open", totalPrice: 0 }))
  .emits({
    ItemAdded,
    ItemRemoved,
    CartCleared,
    ItemArchiveRequested,
    ItemArchived,
    CartSubmitted,
    CartPublished,
  })
  .patch({
    ItemAdded: ({ data }, state) => ({
      items: [
        ...state.items,
        {
          itemId: data.itemId,
          name: data.name,
          description: data.description,
          price: data.price,
          productId: data.productId,
        },
      ],
    }),
    ItemRemoved: ({ data }, state) => ({
      items: state.items.filter((i) => i.itemId !== data.itemId),
    }),
    CartCleared: () => ({ items: [], status: "Open" }),
    ItemArchiveRequested: () => ({}),
    ItemArchived: ({ data }, state) => ({
      items: state.items.filter((i) => i.itemId !== data.itemId),
    }),
    CartSubmitted: ({ data }) => ({
      status: "Submitted",
      totalPrice: data.totalPrice,
    }),
    CartPublished: ({ data }) => ({
      status: "Published",
      totalPrice: data.totalPrice,
    }),
  })
  .on({ AddItem })
  .given([mustNotExceedMaxItems, mustBeOpen])
  .emit((data) => ["ItemAdded", data])
  .on({ RemoveItem })
  .given([mustHaveItems, mustBeOpen])
  .emit((data) => ["ItemRemoved", data])
  .on({ ClearCart })
  .given([mustBeOpen])
  .emit(() => ["CartCleared", {}])
  .on({ RequestToArchiveItem })
  .given([mustBeOpen])
  .emit((data) => ["ItemArchiveRequested", data])
  .on({ ArchiveItem })
  .given([mustHaveItems, mustBeOpen])
  .emit((data) => ["ItemArchived", data])
  .on({ SubmitCart })
  .given([mustHaveItems, mustBeOpen])
  .emit((_, { state }) => [
    "CartSubmitted",
    {
      orderedProducts: state.items,
      totalPrice: state.items.reduce(
        (sum, item) => sum + parseFloat(item.price || "0"),
        0
      ),
    },
  ])
  .on({ PublishCart })
  .emit((data) => ["CartPublished", data])
  .build();
