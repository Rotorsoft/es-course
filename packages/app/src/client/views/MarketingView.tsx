import { useMemo } from "react";
import { PRODUCTS } from "../data/products.js";
import { trpc } from "../trpc.js";
import type { ActivityEntry } from "../types.js";

const productMap = Object.fromEntries(PRODUCTS.map((p) => [p.productId, p]));

export function MarketingView() {
  const activityQuery = trpc.getCartActivity.useQuery(undefined, { refetchInterval: 5000 });
  const ordersQuery = trpc.listOrders.useQuery();

  const activities: ActivityEntry[] = activityQuery.data ?? [];
  const orders = ordersQuery.data ?? [];

  const stats = useMemo(() => {
    const sessions = new Set<string>();
    const perProduct: Record<string, { adds: number; removes: number; clears: number }> = {};

    for (const a of activities) {
      sessions.add(a.sessionId);
      if (!perProduct[a.productId]) {
        perProduct[a.productId] = { adds: 0, removes: 0, clears: 0 };
      }
      if (a.action === "add") perProduct[a.productId].adds += a.quantity;
      else if (a.action === "remove") perProduct[a.productId].removes += a.quantity;
      else perProduct[a.productId].clears++;
    }

    const totalAdds = activities.filter((a) => a.action === "add").reduce((s, a) => s + a.quantity, 0);
    const totalRemoves = activities.filter((a) => a.action === "remove").reduce((s, a) => s + a.quantity, 0);
    const sessionsWithAdds = new Set(activities.filter((a) => a.action === "add").map((a) => a.sessionId)).size;
    const orderCount = orders.length;

    const productEngagement = Object.entries(perProduct)
      .map(([productId, counts]) => ({
        productId,
        ...counts,
        net: counts.adds - counts.removes,
      }))
      .sort((a, b) => b.adds - a.adds);

    const maxAdds = Math.max(1, ...productEngagement.map((p) => p.adds));

    return {
      sessionCount: sessions.size,
      totalEvents: activities.length,
      totalAdds,
      totalRemoves,
      sessionsWithAdds,
      orderCount,
      conversionRate: sessionsWithAdds > 0 ? orderCount / sessionsWithAdds : 0,
      productEngagement,
      maxAdds,
    };
  }, [activities, orders]);

  const recentActivities = useMemo(
    () => [...activities].reverse().slice(0, 50),
    [activities]
  );

  if (activityQuery.isLoading) {
    return (
      <section className="mkt-section">
        <h2>Marketing</h2>
        <div className="mkt-empty"><p>Loading activity data...</p></div>
      </section>
    );
  }

  return (
    <section className="mkt-section">
      <h2>Marketing</h2>
      <p className="mkt-subtitle">Cart activity analytics from the CartTracking event stream</p>

      {activities.length === 0 ? (
        <div className="mkt-empty">
          <div className="empty-icon">{"\uD83D\uDCCA"}</div>
          <p>No browsing activity yet. Add items to the cart to generate tracking events.</p>
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="mkt-kpis">
            <div className="mkt-kpi">
              <span className="mkt-kpi-label">Sessions</span>
              <span className="mkt-kpi-value">{stats.sessionCount}</span>
              <span className="mkt-kpi-detail">unique browsers</span>
            </div>
            <div className="mkt-kpi">
              <span className="mkt-kpi-label">Total Events</span>
              <span className="mkt-kpi-value">{stats.totalEvents}</span>
              <span className="mkt-kpi-detail">
                {stats.totalAdds} adds / {stats.totalRemoves} removes
              </span>
            </div>
            <div className="mkt-kpi">
              <span className="mkt-kpi-label">Orders Placed</span>
              <span className="mkt-kpi-value">{stats.orderCount}</span>
              <span className="mkt-kpi-detail">
                {stats.sessionsWithAdds > 0
                  ? `from ${stats.sessionsWithAdds} session${stats.sessionsWithAdds > 1 ? "s" : ""} with adds`
                  : "no sessions with adds yet"}
              </span>
            </div>
            <div className="mkt-kpi">
              <span className="mkt-kpi-label">Conversion Rate</span>
              <span className="mkt-kpi-value">
                {(stats.conversionRate * 100).toFixed(1)}%
              </span>
              <span className="mkt-kpi-detail">orders / sessions with adds</span>
            </div>
          </div>

          <div className="mkt-grid">
            {/* Product Engagement */}
            <div className="mkt-card">
              <div className="mkt-card-header">
                <h3>Product Interest</h3>
                <span className="mkt-badge">{stats.productEngagement.length} products</span>
              </div>
              <div className="mkt-card-body">
                <table className="mkt-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Adds</th>
                      <th>Removes</th>
                      <th style={{ textAlign: "left" }}>Engagement</th>
                      <th>Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.productEngagement.map((p) => {
                      const meta = productMap[p.productId];
                      const pct = Math.round((p.adds / stats.maxAdds) * 100);
                      return (
                        <tr key={p.productId}>
                          <td>
                            <span className="mkt-product-cell">
                              {meta?.icon ?? "\uD83D\uDCE6"} {meta?.name ?? p.productId}
                            </span>
                          </td>
                          <td className="mkt-mono" style={{ color: "var(--success)" }}>+{p.adds}</td>
                          <td className="mkt-mono" style={{ color: "var(--danger)" }}>-{p.removes}</td>
                          <td>
                            <div className="mkt-bar-wrap">
                              <div className="mkt-bar-track">
                                <div
                                  className="mkt-bar-fill"
                                  style={{
                                    width: `${pct}%`,
                                    background: `linear-gradient(90deg, var(--success), #48a9a6)`,
                                  }}
                                />
                              </div>
                              <span className="mkt-bar-label">{pct}%</span>
                            </div>
                          </td>
                          <td className="mkt-mono" style={{
                            fontWeight: 700,
                            color: p.net > 0 ? "var(--success)" : p.net < 0 ? "var(--danger)" : "var(--text-secondary)",
                          }}>
                            {p.net > 0 ? "+" : ""}{p.net}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Conversion Funnel */}
            <div className="mkt-card">
              <div className="mkt-card-header">
                <h3>Conversion Funnel</h3>
              </div>
              <div className="mkt-funnel">
                <div className="mkt-funnel-step">
                  <span className="mkt-funnel-num">{stats.sessionCount}</span>
                  <div className="mkt-funnel-info">
                    <div className="mkt-funnel-label">Browsing Sessions</div>
                    <div className="mkt-funnel-desc">Sessions with any cart activity</div>
                  </div>
                  <span className="mkt-funnel-pct" style={{ background: "#e3f2fd", color: "#1565c0" }}>
                    100%
                  </span>
                </div>
                <div className="mkt-funnel-step">
                  <span className="mkt-funnel-num">{stats.sessionsWithAdds}</span>
                  <div className="mkt-funnel-info">
                    <div className="mkt-funnel-label">Added to Cart</div>
                    <div className="mkt-funnel-desc">Sessions where items were added</div>
                  </div>
                  <span className="mkt-funnel-pct" style={{ background: "#e8f5e9", color: "#2e7d32" }}>
                    {stats.sessionCount > 0
                      ? `${Math.round((stats.sessionsWithAdds / stats.sessionCount) * 100)}%`
                      : "\u2014"}
                  </span>
                </div>
                <div className="mkt-funnel-step">
                  <span className="mkt-funnel-num">{stats.orderCount}</span>
                  <div className="mkt-funnel-info">
                    <div className="mkt-funnel-label">Order Placed</div>
                    <div className="mkt-funnel-desc">Completed checkout</div>
                  </div>
                  <span className="mkt-funnel-pct" style={{
                    background: stats.conversionRate > 0 ? "#f3e5f5" : "#fff8e1",
                    color: stats.conversionRate > 0 ? "#6a1b9a" : "#b8860b",
                  }}>
                    {stats.sessionsWithAdds > 0
                      ? `${(stats.conversionRate * 100).toFixed(1)}%`
                      : "\u2014"}
                  </span>
                </div>
                {stats.sessionsWithAdds > stats.orderCount && (
                  <div className="mkt-funnel-step">
                    <span className="mkt-funnel-num" style={{ color: "var(--danger)" }}>
                      {stats.sessionsWithAdds - stats.orderCount}
                    </span>
                    <div className="mkt-funnel-info">
                      <div className="mkt-funnel-label">Abandoned Carts</div>
                      <div className="mkt-funnel-desc">Sessions with adds but no order</div>
                    </div>
                    <span className="mkt-funnel-pct" style={{ background: "#ffebee", color: "#b71c1c" }}>
                      {Math.round(((stats.sessionsWithAdds - stats.orderCount) / stats.sessionsWithAdds) * 100)}%
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Activity Timeline */}
            <div className="mkt-card mkt-card-full">
              <div className="mkt-card-header">
                <h3>Recent Activity</h3>
                <span className="mkt-badge">latest {recentActivities.length}</span>
              </div>
              <div className="mkt-timeline">
                {recentActivities.map((a, i) => {
                  const meta = productMap[a.productId];
                  const time = new Date(a.timestamp);
                  const timeStr = time.toLocaleTimeString("en-US", {
                    hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit",
                  });
                  const shortSession = a.sessionId.length > 12
                    ? `${a.sessionId.slice(0, 6)}...${a.sessionId.slice(-4)}`
                    : a.sessionId;
                  const actionLabel =
                    a.action === "add" ? `Added ${meta?.name ?? a.productId}`
                      : a.action === "remove" ? `Removed ${meta?.name ?? a.productId}`
                        : `Cleared ${meta?.name ?? a.productId}`;

                  return (
                    <div key={`${a.sessionId}-${a.timestamp}-${i}`} className="mkt-tl-entry">
                      <span className={`mkt-tl-dot ${a.action}`} />
                      <div className="mkt-tl-content">
                        <div className="mkt-tl-action">{actionLabel}</div>
                        <div className="mkt-tl-meta">{timeStr} &middot; {shortSession}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
