import { useAuth } from "../hooks/useAuth.js";
import { PRODUCTS } from "../data/products.js";

const productMap = Object.fromEntries(PRODUCTS.map((p) => [p.productId, p]));

export function CartDrawer({
  open, onClose, cart, onIncrement, onDecrement, onClear, onSubmit, submitting, liveStock,
}: {
  open: boolean;
  onClose: () => void;
  cart: Record<string, number>;
  onIncrement: (productId: string) => void;
  onDecrement: (productId: string) => void;
  onClear: () => void;
  onSubmit: () => void;
  submitting: boolean;
  liveStock: Record<string, number>;
}) {
  const { user } = useAuth();
  if (!open) return null;

  const entries = Object.entries(cart).filter(([, qty]) => qty > 0);
  const totalItems = entries.reduce((sum, [, qty]) => sum + qty, 0);
  const subtotal = entries
    .reduce((sum, [pid, qty]) => {
      const prod = productMap[pid];
      return sum + qty * parseFloat(prod?.price ?? "0");
    }, 0)
    .toFixed(2);

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-header">
          <h3>Shopping Cart</h3>
          <button className="drawer-close" onClick={onClose}>{"\u2715"}</button>
        </div>

        <div className="drawer-body">
          {entries.length === 0 ? (
            <div className="drawer-empty">
              <div className="empty-icon">{"\uD83D\uDED2"}</div>
              <p>Your cart is empty</p>
            </div>
          ) : (
            entries.map(([productId, qty]) => {
              const prod = productMap[productId];
              if (!prod) return null;
              const lineTotal = (qty * parseFloat(prod.price)).toFixed(2);
              return (
                <div key={productId} className="cart-item">
                  <div className="cart-item-img" style={{ background: prod.gradient }}>
                    {prod.image
                      ? <img src={prod.image} alt={prod.name} loading="lazy" />
                      : prod.icon}
                  </div>
                  <div className="cart-item-info">
                    <div className="cart-item-name">{prod.name}</div>
                    <div className="cart-item-desc">{prod.description}</div>
                    <div className="cart-item-price">${lineTotal}</div>
                    <div className="cart-qty">
                      <button
                        className="cart-qty-btn"
                        onClick={() => onDecrement(productId)}
                      >
                        {qty === 1 ? "\uD83D\uDDD1" : "\u2212"}
                      </button>
                      <div className="cart-qty-val">{qty}</div>
                      <button
                        className="cart-qty-btn"
                        disabled={qty >= (liveStock[productId] ?? 0)}
                        onClick={() => onIncrement(productId)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {entries.length > 0 && (
          <div className="drawer-footer">
            <div className="drawer-subtotal">
              <span>Subtotal ({totalItems} item{totalItems > 1 ? "s" : ""}):</span>
              <strong>${subtotal}</strong>
            </div>
            {user ? (
              <button
                className="checkout-btn"
                onClick={onSubmit}
                disabled={submitting}
              >
                {submitting ? "Placing order..." : "Place Order"}
              </button>
            ) : (
              <button
                className="checkout-btn"
                onClick={onClose}
              >
                Sign in to order
              </button>
            )}
            <button className="clear-btn" onClick={onClear}>
              Clear cart
            </button>
          </div>
        )}
      </div>
    </>
  );
}
