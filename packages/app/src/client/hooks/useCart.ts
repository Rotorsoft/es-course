import { useState } from "react";

export function useCart() {
  const [cart, setCart] = useState<Record<string, number>>({});

  const addItem = (productId: string) => {
    setCart((prev) => ({
      ...prev,
      [productId]: (prev[productId] ?? 0) + 1,
    }));
  };

  const increment = (productId: string) => {
    setCart((prev) => ({
      ...prev,
      [productId]: (prev[productId] ?? 0) + 1,
    }));
  };

  const decrement = (productId: string) => {
    setCart((prev) => {
      const qty = (prev[productId] ?? 0) - 1;
      if (qty <= 0) {
        const { [productId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [productId]: qty };
    });
  };

  const clear = () => {
    setCart({});
  };

  const itemCount = Object.values(cart).reduce((sum, qty) => sum + qty, 0);

  return { cart, addItem, increment, decrement, clear, setCart, itemCount };
}
