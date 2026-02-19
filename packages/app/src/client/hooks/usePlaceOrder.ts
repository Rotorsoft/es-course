import { PRODUCTS } from "../data/products.js";
import { trpc } from "../trpc.js";

const productMap = Object.fromEntries(PRODUCTS.map((p) => [p.productId, p]));

export function usePlaceOrder({
  cart,
  onSuccess,
  onError,
}: {
  cart: Record<string, number>;
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const productsQuery = trpc.getProducts.useQuery();
  const liveProducts = productsQuery.data ?? [];
  const liveMap = Object.fromEntries(liveProducts.map((p) => [p.productId, p]));
  const liveStock = Object.fromEntries(liveProducts.map((p) => [p.productId, p.inventory]));

  const utils = trpc.useUtils();
  const placeOrder = trpc.PlaceOrder.useMutation({
    onSuccess: () => {
      utils.getProducts.invalidate();
      utils.listOrders.invalidate();
      onSuccess();
    },
    onError: (err) => {
      onError(
        err.message.includes("invariant")
          ? "Could not place order \u2014 check stock availability"
          : "Could not place order"
      );
    },
  });

  const submit = () => {
    const items = Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .flatMap(([productId, qty]) => {
        const prod = productMap[productId];
        if (!prod) return [];
        const live = liveMap[productId];
        const price = live && live.price > 0 ? live.price.toFixed(2) : prod.price;
        return Array.from({ length: qty }, () => ({
          itemId: crypto.randomUUID(),
          name: prod.name,
          description: prod.description,
          price,
          productId: prod.productId,
        }));
      });
    if (items.length === 0) return;
    placeOrder.mutate({ items });
  };

  return { submit, submitting: placeOrder.isPending, liveStock };
}
