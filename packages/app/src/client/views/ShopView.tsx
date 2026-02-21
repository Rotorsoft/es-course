import { useMemo, useState } from "react";
import { PRODUCTS } from "../data/products.js";
import type { Product } from "../data/products.js";
import { ProductCard } from "../components/ProductCard.js";
import { trpc } from "../trpc.js";
import { useActivityTracker } from "../hooks/useActivityTracker.js";

export function ShopView({
  onAdd,
  toast,
  searchQuery,
  searchCategory,
}: {
  onAdd: (productId: string) => void;
  toast: (msg: string, duration?: number) => void;
  searchQuery: string;
  searchCategory: string;
}) {
  const [addingProduct, setAddingProduct] = useState<string | null>(null);
  const productsQuery = trpc.getProducts.useQuery();
  const liveProducts = productsQuery.data ?? [];
  const liveMap = Object.fromEntries(liveProducts.map((p) => [p.productId, p]));
  const { track } = useActivityTracker();

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return PRODUCTS.filter((p) => {
      if (searchCategory !== "All" && p.category !== searchCategory) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [searchQuery, searchCategory]);

  const handleAdd = (product: Product) => {
    setAddingProduct(product.productId);
    onAdd(product.productId);
    track("add", product.productId, 1);
    toast("Added to cart", 800);
    setTimeout(() => setAddingProduct(null), 800);
  };

  return (
    <>
      <section className="hero">
        <h2>Craft Your Perfect Cup</h2>
        <p>Premium coffee equipment — sourced for the serious brewer</p>
      </section>

      {filtered.length === 0 ? (
        <section className="products-empty">
          <p>No products match your search.</p>
        </section>
      ) : (
        <section className="products">
          {filtered.map((product) => {
            const live = liveMap[product.productId];
            return (
              <ProductCard
                key={product.productId}
                product={product}
                onAdd={() => handleAdd(product)}
                adding={addingProduct === product.productId}
                livePrice={live?.price}
                liveInventory={live?.inventory}
              />
            );
          })}
        </section>
      )}
    </>
  );
}
