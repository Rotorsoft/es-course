import { useState } from "react";
import { PRODUCTS } from "../data/products.js";
import { trpc } from "../trpc.js";

const productMap = Object.fromEntries(PRODUCTS.map((p) => [p.productId, p]));

export function AdminView() {
  const utils = trpc.useUtils();
  const products = trpc.getProducts.useQuery();
  const adjustInventory = trpc.AdjustInventory.useMutation({
    onSuccess: () => utils.getProducts.invalidate(),
  });
  const decommission = trpc.DecommissionInventory.useMutation({
    onSuccess: () => utils.getProducts.invalidate(),
  });

  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({});
  const [qtyInputs, setQtyInputs] = useState<Record<string, string>>({});

  const data = products.data ?? [];

  return (
    <section className="admin-section">
      <h2>Admin</h2>

      <div className="admin-block">
        <h3>Inventory Manager</h3>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Price</th>
                <th>Stock</th>
                <th>New Price</th>
                <th>New Stock</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => {
                const meta = productMap[p.productId];
                const isActive = p.inventory > 0;
                const newPrice = priceInputs[p.productId] ?? "";
                const newQty = qtyInputs[p.productId] ?? "";
                const hasChanges = newPrice !== "" || newQty !== "";
                return (
                  <tr key={p.productId} style={isActive ? {} : { opacity: 0.5 }}>
                    <td className="admin-product-name">{meta?.icon} {meta?.name ?? p.productId}</td>
                    <td className="admin-current">${p.price.toFixed(2)}</td>
                    <td className="admin-current">{p.inventory}</td>
                    <td>
                      <input
                        className="admin-input"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder={p.price.toFixed(2)}
                        value={newPrice}
                        onChange={(e) =>
                          setPriceInputs((prev) => ({ ...prev, [p.productId]: e.target.value }))
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="admin-input"
                        type="number"
                        step="1"
                        min="0"
                        placeholder={String(p.inventory)}
                        value={newQty}
                        onChange={(e) =>
                          setQtyInputs((prev) => ({ ...prev, [p.productId]: e.target.value }))
                        }
                      />
                    </td>
                    <td style={{ display: "flex", gap: "8px" }}>
                      <button
                        className="admin-update-btn"
                        disabled={!hasChanges || adjustInventory.isPending}
                        onClick={() => {
                          const price = newPrice !== "" ? parseFloat(newPrice) : p.price;
                          const qty = newQty !== "" ? parseInt(newQty, 10) : p.inventory;
                          if (!isNaN(price) && price >= 0 && !isNaN(qty) && qty >= 0) {
                            adjustInventory.mutate({
                              productId: p.productId,
                              price,
                              quantity: qty,
                            });
                            setPriceInputs((prev) => ({ ...prev, [p.productId]: "" }));
                            setQtyInputs((prev) => ({ ...prev, [p.productId]: "" }));
                          }
                        }}
                      >
                        Update
                      </button>
                      {isActive && (
                        <button
                          className="admin-update-btn"
                          style={{ background: "#fff", borderColor: "var(--danger)", color: "var(--danger)" }}
                          disabled={decommission.isPending}
                          onClick={() => decommission.mutate({ productId: p.productId })}
                        >
                          Decommission
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
