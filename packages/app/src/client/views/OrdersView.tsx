import { PRODUCTS } from "../data/products.js";
import { trpc } from "../trpc.js";

const productMap = Object.fromEntries(PRODUCTS.map((p) => [p.productId, p]));

export function OrdersView() {
  const orders = trpc.listOrders.useQuery();

  if (orders.isLoading) {
    return (
      <section className="orders-section">
        <h2>Orders</h2>
        <div className="orders-empty"><p>Loading orders...</p></div>
      </section>
    );
  }

  const data = orders.data ?? [];

  return (
    <section className="orders-section">
      <h2>Orders</h2>
      {data.length === 0 ? (
        <div className="orders-empty">
          <div className="empty-icon">{"\uD83D\uDCE6"}</div>
          <p>No orders yet. Submit a cart to see it here.</p>
        </div>
      ) : (
        data.map((order) => {
          const shortId = order.id.slice(0, 8);
          const statusClass = order.status === "Published" ? "published" : "submitted";
          const time = order.publishedAt ?? order.submittedAt;
          const timeStr = time
            ? new Date(time).toLocaleString("en-US", {
              month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
            })
            : "";

          return (
            <div key={order.id} className="order-card">
              <div className="order-header">
                <span className="order-id">Order #{shortId}</span>
                <span className={`status-badge ${statusClass}`}>
                  {order.status}
                </span>
              </div>
              <div className="order-items">
                {order.items.map((item) => {
                  const prod = productMap[item.productId];
                  return (
                    <div key={item.itemId} className="order-item-row">
                      <span>{prod?.icon ?? "\uD83D\uDCE6"} {item.name}</span>
                      <span>${item.price}</span>
                    </div>
                  );
                })}
              </div>
              <div className="order-total">
                <span>Total</span>
                <span>${order.totalPrice.toFixed(2)}</span>
              </div>
              {timeStr && <div className="order-time">{timeStr}</div>}
            </div>
          );
        })
      )}
    </section>
  );
}
