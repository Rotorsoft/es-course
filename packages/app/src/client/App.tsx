import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpLink, httpSubscriptionLink, splitLink } from "@trpc/client";
import { useState } from "react";
import { trpc } from "./trpc.js";
import type { Tab } from "./types.js";
import { useCart } from "./hooks/useCart.js";
import { useEventStream } from "./hooks/useEventStream.js";
import { useToast } from "./hooks/useToast.js";
import { useActivityTracker } from "./hooks/useActivityTracker.js";
import { usePlaceOrder } from "./hooks/usePlaceOrder.js";
import { useAuth, AuthProvider } from "./hooks/useAuth.js";
import { Header } from "./components/Header.js";
import { SubNav } from "./components/SubNav.js";
import { EventPanel } from "./components/EventPanel.js";
import { CartDrawer } from "./components/CartDrawer.js";
import { Toast } from "./components/Toast.js";
import { ShopView } from "./views/ShopView.js";
import { OrdersView } from "./views/OrdersView.js";
import { AdminView } from "./views/AdminView.js";
import { MarketingView } from "./views/MarketingView.js";
import "./styles/global.css";
import "./styles/layout.css";
import "./styles/products.css";
import "./styles/cart.css";
import "./styles/events.css";
import "./styles/orders.css";
import "./styles/admin.css";
import "./styles/marketing.css";

function CartApp() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("shop");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchCategory, setSearchCategory] = useState("All");
  const { cart, addItem, increment, decrement, clear, setCart, itemCount } = useCart();
  const { events, connected } = useEventStream();
  const { message: toastMsg, show: showToast } = useToast();
  const { track } = useActivityTracker();
  const { isAdmin } = useAuth();

  const { submit, submitting, liveStock } = usePlaceOrder({
    cart,
    onSuccess: () => { setCart({}); setDrawerOpen(false); showToast("Order placed successfully!"); },
    onError: (msg) => showToast(msg),
  });

  const handleIncrement = (id: string) => { increment(id); track("add", id, 1); };
  const handleDecrement = (id: string) => { decrement(id); track("remove", id, 1); };
  const handleClear = () => {
    const pids = Object.keys(cart);
    clear();
    for (const pid of pids) track("clear", pid, 0);
  };

  return (
    <>
      <div className="app-layout">
        <div className="app-main">
          <Header
            itemCount={itemCount}
            onCartOpen={() => setDrawerOpen(true)}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchCategory={searchCategory}
            onCategoryChange={setSearchCategory}
          />
          <SubNav activeTab={activeTab} onTabChange={setActiveTab} />
          {activeTab === "shop" && <ShopView onAdd={addItem} toast={showToast} searchQuery={searchQuery} searchCategory={searchCategory} />}
          {activeTab === "orders" && <OrdersView />}
          {activeTab === "admin" && isAdmin && <AdminView />}
          {activeTab === "marketing" && isAdmin && <MarketingView />}
        </div>
        <EventPanel events={events} connected={connected} />
      </div>
      <CartDrawer
        open={drawerOpen} onClose={() => setDrawerOpen(false)}
        cart={cart} onIncrement={handleIncrement} onDecrement={handleDecrement}
        onClear={handleClear} onSubmit={submit} submitting={submitting} liveStock={liveStock}
      />
      <Toast message={toastMsg} />
    </>
  );
}

const API_URL = import.meta.env.DEV ? "http://localhost:4000" : "/trpc";

function getAuthHeaders() {
  const token = localStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function App() {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        splitLink({
          condition: (op) => op.type === "subscription",
          true: httpSubscriptionLink({ url: API_URL }),
          false: httpLink({ url: API_URL, headers: getAuthHeaders }),
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <CartApp />
        </AuthProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
