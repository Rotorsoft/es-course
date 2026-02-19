import { useEffect, useRef, useState } from "react";
import type { PRODUCTS } from "../data/products.js";
import { PriceDisplay } from "./PriceDisplay.js";

export function ProductCard({
  product, onAdd, adding, livePrice, liveInventory,
}: {
  product: (typeof PRODUCTS)[number];
  onAdd: () => void;
  adding: boolean;
  livePrice?: number;
  liveInventory?: number;
}) {
  const [flashing, setFlashing] = useState(false);
  const prevAdding = useRef(adding);

  useEffect(() => {
    if (prevAdding.current && !adding) {
      setFlashing(true);
      const t = setTimeout(() => setFlashing(false), 800);
      return () => clearTimeout(t);
    }
    prevAdding.current = adding;
  }, [adding]);

  const displayPrice = livePrice != null && livePrice > 0
    ? livePrice.toFixed(2)
    : product.price;
  const inStock = liveInventory == null || liveInventory > 0;
  const stockLabel = liveInventory != null
    ? liveInventory > 0 ? `In Stock (${liveInventory})` : "Out of Stock"
    : "In Stock";

  return (
    <div className="product-card">
      <div className="product-img" style={{ background: product.gradient }}>
        <img src={product.image} alt={product.name} loading="lazy" />
      </div>
      <div className="product-body">
        <div className="product-name">{product.name}</div>
        <div className="product-desc">{product.description}</div>
        <PriceDisplay price={displayPrice} />
        <div className="product-stock" style={inStock ? {} : { color: "var(--danger)" }}>
          {stockLabel}
        </div>
        <button
          className={`add-btn ${flashing ? "added-flash" : ""}`}
          onClick={onAdd}
          disabled={adding || !inStock}
        >
          {flashing ? "\u2713 Added" : adding ? "Adding..." : !inStock ? "Out of Stock" : "Add to Cart"}
        </button>
      </div>
    </div>
  );
}
