import { useState, useEffect, useRef, useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpLink } from "@trpc/client";
import { httpSubscriptionLink } from "@trpc/client";
import { splitLink } from "@trpc/client";
import { trpc } from "./trpc.js";

// ── Product catalog (matches seed data) ──────────────────────────────
const PRODUCTS = [
  {
    productId: "prod-espresso",
    name: "Espresso Machine",
    price: "299.99",
    description: "Professional 15-bar pressure",
    gradient: "linear-gradient(135deg, #2c1810 0%, #5c3a28 50%, #8b6914 100%)",
    icon: "☕",
    image: "https://images.unsplash.com/photo-1548270311-3a9e56a480ff?w=400&h=400&fit=crop&q=80",
  },
  {
    productId: "prod-grinder",
    name: "Burr Grinder",
    price: "89.50",
    description: "40mm conical burrs, 18 settings",
    gradient: "linear-gradient(135deg, #1a1a2e 0%, #3d3d5c 50%, #6b5b95 100%)",
    icon: "⚙️",
    image: "https://images.unsplash.com/photo-1573066380308-24ff4c273dbc?w=400&h=400&fit=crop&q=80",
  },
  {
    productId: "prod-kettle",
    name: "Gooseneck Kettle",
    price: "54.00",
    description: "Temperature control, 1.2L capacity",
    gradient: "linear-gradient(135deg, #0c2340 0%, #1b4d6e 50%, #48a9a6 100%)",
    icon: "🫖",
    image: "https://images.unsplash.com/photo-1621814688815-bae1c0dbc3d2?w=400&h=400&fit=crop&q=80",
  },
  {
    productId: "prod-scale",
    name: "Precision Scale",
    price: "34.95",
    description: "0.1g accuracy, built-in timer",
    gradient: "linear-gradient(135deg, #2d2d2d 0%, #4a4a4a 50%, #7c7c7c 100%)",
    icon: "⚖️",
    image: "https://images.unsplash.com/photo-1559761340-04607d9f5bff?w=400&h=400&fit=crop&q=80",
  },
  {
    productId: "prod-filters",
    name: "Paper Filters",
    price: "12.00",
    description: "100 pack — unbleached, V60 & Chemex",
    gradient: "linear-gradient(135deg, #8b7355 0%, #c4a77d 50%, #e8d5b7 100%)",
    icon: "🫧",
    image: "https://images.unsplash.com/photo-1498603536246-15572faa67a6?w=400&h=400&fit=crop&q=80",
  },
];

// ── Event type ───────────────────────────────────────────────────────
type EventEntry = {
  id: number;
  name: string;
  data: Record<string, unknown>;
  stream: string;
  version: number;
  created: string;
  meta: {
    correlation: string;
    causation: {
      action?: { stream: string; actor: { id: string; name: string }; name?: string };
      event?: { id: number; name: string; stream: string };
    };
  };
};

// ── Event colors ─────────────────────────────────────────────────────
const EVENT_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  CartSubmitted:        { bg: "#e8f5e9", fg: "#2e7d32", label: "CartSubmitted" },
  CartPublished:        { bg: "#f3e5f5", fg: "#6a1b9a", label: "CartPublished" },
  PriceChanged:         { bg: "#e0f7fa", fg: "#00838f", label: "PriceChanged" },
  InventoryImported:    { bg: "#f1f8e9", fg: "#558b2f", label: "InventoryImported" },
  InventoryAdjusted:    { bg: "#dcedc8", fg: "#33691e", label: "InventoryAdjusted" },
  InventoryDecommissioned: { bg: "#ffcdd2", fg: "#b71c1c", label: "InventoryDecommissioned" },
};

const DEFAULT_EVENT_COLOR = { bg: "#f5f5f5", fg: "#616161", label: "EVENT" };

// ── Styles ───────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&family=Work+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  --header-bg: #131921;
  --header-accent: #f0c14b;
  --accent: #ff9900;
  --bg: #eaeded;
  --card-bg: #ffffff;
  --text-primary: #0f1111;
  --text-secondary: #565959;
  --text-link: #007185;
  --border: #d5d9d9;
  --success: #067d62;
  --danger: #b12704;
  --serif: 'Libre Baskerville', Georgia, serif;
  --sans: 'Work Sans', system-ui, sans-serif;
  --mono: 'JetBrains Mono', 'Fira Code', monospace;
  --event-panel-w: 380px;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--sans);
  background: var(--bg);
  color: var(--text-primary);
  -webkit-font-smoothing: antialiased;
}

.app-layout { display: flex; min-height: 100vh; }
.app-main { flex: 1; min-width: 0; }

.header {
  background: var(--header-bg);
  padding: 0 24px;
  display: flex;
  align-items: center;
  height: 60px;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}
.header-logo {
  font-family: var(--serif);
  color: #fff;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.5px;
  margin-right: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
}
.header-logo span { color: var(--header-accent); }
.header-search {
  flex: 1;
  max-width: 560px;
  margin: 0 24px;
  display: flex;
  height: 40px;
  border-radius: 4px;
  overflow: hidden;
}
.header-search select {
  background: #e6e6e6;
  border: none;
  padding: 0 8px;
  font-size: 12px;
  color: #555;
  cursor: pointer;
  font-family: var(--sans);
  border-right: 1px solid var(--border);
}
.header-search input {
  flex: 1;
  border: none;
  padding: 0 12px;
  font-size: 14px;
  font-family: var(--sans);
  outline: none;
}
.header-search button {
  background: var(--header-accent);
  border: none;
  padding: 0 14px;
  cursor: pointer;
  font-size: 18px;
  display: flex;
  align-items: center;
}

.cart-btn {
  background: none;
  border: none;
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 3px;
  font-family: var(--sans);
  font-size: 14px;
  font-weight: 600;
  transition: outline 0.1s;
  position: relative;
}
.cart-btn:hover { outline: 1px solid #fff; }
.cart-btn .cart-icon { font-size: 26px; line-height: 1; }
.cart-badge {
  position: absolute;
  top: 0;
  right: 2px;
  background: var(--accent);
  color: var(--header-bg);
  font-size: 15px;
  font-weight: 700;
  min-width: 20px;
  height: 20px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
}

.subnav {
  background: #232f3e;
  padding: 0 24px;
  display: flex;
  align-items: center;
  height: 38px;
  gap: 16px;
  overflow-x: auto;
}
.subnav a {
  color: #e8e8e8;
  text-decoration: none;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  padding: 0 4px;
  transition: color 0.15s;
}
.subnav a:hover { color: #fff; }
.subnav a:first-child { font-weight: 700; }

.hero {
  background: linear-gradient(180deg, #7ec8b7 0%, var(--bg) 100%);
  padding: 32px 24px 48px;
  text-align: center;
}
.hero h2 {
  font-family: var(--serif);
  font-size: 32px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 4px;
}
.hero p { color: var(--text-secondary); font-size: 15px; }

.products {
  max-width: 1280px;
  margin: -24px auto 48px;
  padding: 0 24px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 20px;
}
.product-card {
  background: var(--card-bg);
  border-radius: 4px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: box-shadow 0.2s;
  border: 1px solid transparent;
}
.product-card:hover {
  box-shadow: 0 4px 20px rgba(0,0,0,0.12);
  border-color: var(--border);
}
.product-img {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 72px;
  user-select: none;
  position: relative;
  overflow: hidden;
}
.product-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.product-img::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 60%, rgba(255,255,255,0.4) 100%);
}
.product-body { padding: 16px; flex: 1; display: flex; flex-direction: column; }
.product-name {
  font-family: var(--serif);
  font-size: 15px;
  font-weight: 700;
  color: var(--text-link);
  margin-bottom: 4px;
  line-height: 1.3;
}
.product-desc { font-size: 12px; color: var(--text-secondary); margin-bottom: 12px; line-height: 1.4; }
.product-price { font-size: 20px; font-weight: 400; margin-bottom: 12px; }
.product-price sup { font-size: 12px; top: -6px; position: relative; }
.product-price .cents { font-size: 12px; position: relative; top: -6px; }
.product-stock { font-size: 12px; color: var(--success); font-weight: 600; margin-bottom: 12px; }
.add-btn {
  background: linear-gradient(180deg, #f7dfa5 0%, var(--header-accent) 100%);
  border: 1px solid #a88734;
  border-radius: 20px;
  padding: 7px 16px;
  font-size: 13px;
  font-family: var(--sans);
  font-weight: 500;
  cursor: pointer;
  color: var(--text-primary);
  margin-top: auto;
  transition: background 0.15s;
  width: 100%;
}
.add-btn:hover { background: linear-gradient(180deg, #f5d78e 0%, #ddb347 100%); }
.add-btn:active { background: #e2b534; }
.add-btn:disabled { opacity: 0.5; cursor: default; }
.added-flash {
  background: var(--success) !important;
  border-color: var(--success) !important;
  color: #fff !important;
}

.drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 200;
  animation: fadeIn 0.2s ease;
}
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
.drawer {
  position: fixed;
  top: 0;
  right: 0;
  width: 420px;
  max-width: 100vw;
  height: 100vh;
  background: var(--card-bg);
  z-index: 201;
  display: flex;
  flex-direction: column;
  box-shadow: -4px 0 24px rgba(0,0,0,0.2);
  animation: slideIn 0.25s ease;
}
@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
.drawer-header {
  background: var(--header-bg);
  color: #fff;
  padding: 18px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}
.drawer-header h3 { font-family: var(--serif); font-size: 18px; font-weight: 700; }
.drawer-close {
  background: none;
  border: none;
  color: #999;
  font-size: 24px;
  cursor: pointer;
  padding: 4px;
  line-height: 1;
}
.drawer-close:hover { color: #fff; }
.drawer-body { flex: 1; overflow-y: auto; padding: 0; }
.drawer-empty { padding: 48px 24px; text-align: center; color: var(--text-secondary); }
.drawer-empty .empty-icon { font-size: 48px; margin-bottom: 12px; }

.cart-item {
  display: flex;
  gap: 14px;
  padding: 16px 20px;
  border-bottom: 1px solid #f0f0f0;
  align-items: flex-start;
}
.cart-item-img {
  width: 72px;
  height: 72px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  flex-shrink: 0;
  overflow: hidden;
}
.cart-item-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cart-item-info { flex: 1; min-width: 0; }
.cart-item-name { font-weight: 600; font-size: 14px; color: var(--text-link); margin-bottom: 2px; }
.cart-item-desc { font-size: 12px; color: var(--text-secondary); margin-bottom: 6px; }
.cart-item-price { font-size: 16px; font-weight: 700; margin-bottom: 6px; }
.cart-item-remove {
  background: none;
  border: none;
  color: var(--text-link);
  font-size: 12px;
  cursor: pointer;
  padding: 0;
  font-family: var(--sans);
}
.cart-item-remove:hover { color: var(--danger); text-decoration: underline; }

.cart-qty {
  display: flex;
  align-items: center;
  gap: 0;
  margin-bottom: 6px;
}
.cart-qty-btn {
  width: 28px;
  height: 28px;
  border: 1px solid var(--border);
  background: #f7f7f7;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--sans);
  color: var(--text-primary);
  transition: background 0.1s;
}
.cart-qty-btn:first-child { border-radius: 4px 0 0 4px; }
.cart-qty-btn:last-child { border-radius: 0 4px 4px 0; }
.cart-qty-btn:hover { background: #eee; }
.cart-qty-btn:disabled { opacity: 0.3; cursor: default; }
.cart-qty-val {
  width: 36px;
  height: 28px;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  border-left: none;
  border-right: none;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--mono);
  font-size: 14px;
  font-weight: 600;
  background: #fff;
}

.drawer-footer {
  border-top: 1px solid var(--border);
  padding: 16px 20px;
  flex-shrink: 0;
  background: #fafafa;
}
.drawer-subtotal {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  font-size: 16px;
}
.drawer-subtotal strong { font-size: 18px; }
.checkout-btn {
  width: 100%;
  background: linear-gradient(180deg, #f7dfa5 0%, var(--header-accent) 100%);
  border: 1px solid #a88734;
  border-radius: 20px;
  padding: 10px;
  font-size: 14px;
  font-weight: 600;
  font-family: var(--sans);
  cursor: pointer;
  color: var(--text-primary);
  margin-bottom: 8px;
  transition: background 0.15s;
}
.checkout-btn:hover { background: linear-gradient(180deg, #f5d78e 0%, #ddb347 100%); }
.checkout-btn:disabled { opacity: 0.5; cursor: default; }
.clear-btn {
  width: 100%;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 8px;
  font-size: 13px;
  font-family: var(--sans);
  cursor: pointer;
  color: var(--text-secondary);
}
.clear-btn:hover { background: #f7f7f7; }

.cart-status-bar {
  padding: 12px 20px;
  font-size: 14px;
  font-weight: 600;
  text-align: center;
}
.cart-status-bar.submitted { background: #fff8e1; color: #b8860b; }
.cart-status-bar.published { background: #e8f5e9; color: var(--success); }

.new-cart-btn {
  width: 100%;
  background: var(--header-bg);
  border: none;
  border-radius: 20px;
  padding: 10px;
  font-size: 14px;
  font-weight: 600;
  font-family: var(--sans);
  cursor: pointer;
  color: #fff;
  transition: background 0.15s;
}
.new-cart-btn:hover { background: #232f3e; }

.toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--header-bg);
  color: #fff;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  z-index: 300;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  animation: toastIn 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
}
@keyframes toastIn {
  from { opacity: 0; transform: translateX(-50%) translateY(20px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

/* ── Event Log Panel ────────────────────────────────────────────────── */
.event-panel {
  width: var(--event-panel-w);
  background: #1a1d23;
  color: #c8ccd4;
  display: flex;
  flex-direction: column;
  border-left: 1px solid #2d3139;
  flex-shrink: 0;
  height: 100vh;
  position: sticky;
  top: 0;
}
.event-panel-header {
  padding: 16px 18px 12px;
  border-bottom: 1px solid #2d3139;
  flex-shrink: 0;
}
.event-panel-header h3 {
  font-family: var(--mono);
  font-size: 13px;
  font-weight: 500;
  color: #8b919a;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  margin-bottom: 2px;
}
.event-panel-count {
  display: inline-block;
  background: #2d3139;
  color: #8b919a;
  font-family: var(--mono);
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  margin-left: 8px;
}
.event-panel-subtitle {
  font-family: var(--mono);
  font-size: 11px;
  color: #565b64;
  display: flex;
  align-items: center;
  gap: 6px;
}
.event-panel-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #565b64;
}
.event-panel-dot.connected { background: #4caf50; }

.event-panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}
.event-panel-body::-webkit-scrollbar { width: 6px; }
.event-panel-body::-webkit-scrollbar-track { background: transparent; }
.event-panel-body::-webkit-scrollbar-thumb { background: #2d3139; border-radius: 3px; }
.event-panel-body::-webkit-scrollbar-thumb:hover { background: #3d4149; }

.event-panel-empty {
  padding: 48px 18px;
  text-align: center;
  color: #565b64;
  font-size: 13px;
}
.event-panel-empty .empty-terminal {
  font-family: var(--mono);
  font-size: 28px;
  margin-bottom: 12px;
  opacity: 0.3;
}

.event-entry {
  padding: 10px 18px;
  border-bottom: 1px solid #22252b;
  transition: background 0.15s;
  cursor: default;
}
.event-entry:hover { background: #22252b; }
.event-entry.new-event { animation: eventSlideIn 0.3s ease; }
@keyframes eventSlideIn {
  from { opacity: 0; transform: translateX(20px); }
  to { opacity: 1; transform: translateX(0); }
}

.event-entry-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.event-seq { font-family: var(--mono); font-size: 10px; color: #565b64; min-width: 22px; }
.event-badge {
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 500;
  padding: 2px 7px;
  border-radius: 3px;
  letter-spacing: 0.3px;
  white-space: nowrap;
}
.event-version { font-family: var(--mono); font-size: 10px; color: #565b64; margin-left: auto; }

.event-stream {
  font-family: var(--mono);
  font-size: 10px;
  color: #4a4f58;
  margin-bottom: 4px;
  padding-left: 30px;
}
.event-stream span { color: #6a6f79; }

.event-time {
  font-family: var(--mono);
  font-size: 10px;
  color: #4a4f58;
  margin-bottom: 6px;
  padding-left: 30px;
}

.event-data {
  background: #14161b;
  border-radius: 4px;
  padding: 8px 10px;
  margin-left: 30px;
  overflow-x: auto;
}
.event-data pre {
  font-family: var(--mono);
  font-size: 11px;
  line-height: 1.5;
  color: #a9b1bc;
  white-space: pre-wrap;
  word-break: break-word;
}
.event-data .json-key { color: #e06c75; }
.event-data .json-string { color: #98c379; }
.event-data .json-number { color: #d19a66; }
.event-data .json-bool { color: #56b6c2; }
.event-data .json-null { color: #565b64; }

.event-causation {
  font-family: var(--mono);
  font-size: 10px;
  color: #4a4f58;
  padding-left: 30px;
  margin-top: 4px;
}
.event-causation span { color: #6a6f79; }

/* ── Tab Navigation ───────────────────────────────────────────────── */
.subnav-tab {
  background: none;
  border: none;
  color: #ccc;
  font-size: 13px;
  font-weight: 500;
  font-family: var(--sans);
  cursor: pointer;
  padding: 0 4px;
  height: 100%;
  display: flex;
  align-items: center;
  border-bottom: 2px solid transparent;
  transition: color 0.15s, border-color 0.15s;
  gap: 6px;
}
.subnav-tab:hover { color: #fff; }
.subnav-tab.active {
  color: var(--header-accent);
  border-bottom-color: var(--header-accent);
  font-weight: 700;
}

/* ── Orders View ──────────────────────────────────────────────────── */
.orders-section {
  max-width: 900px;
  margin: 32px auto;
  padding: 0 24px;
}
.orders-section h2 {
  font-family: var(--serif);
  font-size: 24px;
  margin-bottom: 20px;
}
.orders-empty {
  text-align: center;
  padding: 64px 24px;
  color: var(--text-secondary);
}
.orders-empty .empty-icon { font-size: 48px; margin-bottom: 12px; }
.order-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 16px;
  transition: box-shadow 0.2s;
}
.order-card:hover { box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
.order-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
}
.order-id {
  font-family: var(--mono);
  font-size: 13px;
  color: var(--text-secondary);
}
.status-badge {
  font-size: 12px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 12px;
}
.status-badge.submitted { background: #fff8e1; color: #b8860b; }
.status-badge.published { background: #e8f5e9; color: var(--success); }
.order-items { display: flex; flex-direction: column; gap: 6px; }
.order-item-row {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  color: var(--text-primary);
}
.order-item-row span:last-child { font-family: var(--mono); color: var(--text-secondary); }
.order-total {
  display: flex;
  justify-content: space-between;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
  font-size: 16px;
  font-weight: 700;
}
.order-time {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 8px;
}

/* ── Admin View ───────────────────────────────────────────────────── */
.admin-section {
  max-width: 900px;
  margin: 32px auto;
  padding: 0 24px;
}
.admin-section h2 {
  font-family: var(--serif);
  font-size: 24px;
  margin-bottom: 24px;
}
.admin-block {
  margin-bottom: 36px;
}
.admin-block h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}
.admin-table-wrap {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}
.admin-table {
  width: 100%;
  border-collapse: collapse;
}
.admin-table th {
  text-align: left;
  padding: 12px 16px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-secondary);
  background: #fafafa;
  border-bottom: 1px solid var(--border);
}
.admin-table td {
  padding: 12px 16px;
  font-size: 14px;
  border-bottom: 1px solid #f5f5f5;
  vertical-align: middle;
}
.admin-table tr:last-child td { border-bottom: none; }
.admin-input {
  width: 100px;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 14px;
  font-family: var(--mono);
}
.admin-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(255,153,0,0.2);
}
.admin-update-btn {
  background: linear-gradient(180deg, #f7dfa5 0%, var(--header-accent) 100%);
  border: 1px solid #a88734;
  border-radius: 4px;
  padding: 6px 16px;
  font-size: 13px;
  font-family: var(--sans);
  font-weight: 500;
  cursor: pointer;
  color: var(--text-primary);
  transition: background 0.15s;
}
.admin-update-btn:hover { background: linear-gradient(180deg, #f5d78e 0%, #ddb347 100%); }
.admin-update-btn:disabled { opacity: 0.5; cursor: default; }
.admin-product-name { font-weight: 600; color: var(--text-primary); }
.admin-current { font-family: var(--mono); color: var(--text-secondary); }
`;

// ── JSON syntax highlighting ─────────────────────────────────────────
function highlightJSON(data: Record<string, unknown>): string {
  const json = JSON.stringify(data, null, 2);
  return json
    .replace(/("(?:\\.|[^"\\])*")\s*:/g, '<span class="json-key">$1</span>:')
    .replace(/:\s*("(?:\\.|[^"\\])*")/g, ': <span class="json-string">$1</span>')
    .replace(/:\s*(\d+\.?\d*)/g, ': <span class="json-number">$1</span>')
    .replace(/:\s*(true|false)/g, ': <span class="json-bool">$1</span>')
    .replace(/:\s*(null)/g, ': <span class="json-null">$1</span>');
}

// ── Price formatting ─────────────────────────────────────────────────
function PriceDisplay({ price }: { price: string }) {
  const num = parseFloat(price);
  const dollars = Math.floor(num);
  const cents = Math.round((num - dollars) * 100).toString().padStart(2, "0");
  return (
    <span className="product-price">
      <sup>$</sup>{dollars}<span className="cents">{cents}</span>
    </span>
  );
}

// ── Product Card ─────────────────────────────────────────────────────
function ProductCard({
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
          {flashing ? "✓ Added" : adding ? "Adding..." : !inStock ? "Out of Stock" : "Add to Cart"}
        </button>
      </div>
    </div>
  );
}

// ── Event Log Panel (subscription-driven) ────────────────────────────
function EventPanel({
  events,
  connected,
}: {
  events: EventEntry[];
  connected: boolean;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const prevCount = useRef(0);

  useEffect(() => {
    if (events.length > prevCount.current && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
    prevCount.current = events.length;
  }, [events.length]);

  return (
    <aside className="event-panel">
      <div className="event-panel-header">
        <h3>
          Event Log
          {events.length > 0 && (
            <span className="event-panel-count">{events.length}</span>
          )}
        </h3>
        <div className="event-panel-subtitle">
          <span className={`event-panel-dot ${connected ? "connected" : ""}`} />
          {connected ? "connected" : "connecting..."}
        </div>
      </div>

      <div className="event-panel-body" ref={bodyRef}>
        {events.length === 0 ? (
          <div className="event-panel-empty">
            <div className="empty-terminal">&gt;_</div>
            <p>{connected ? "Add items to see events" : "Connecting..."}</p>
          </div>
        ) : (
          events.map((evt, i) => {
            const color = EVENT_COLORS[evt.name] ?? DEFAULT_EVENT_COLOR;
            const time = new Date(evt.created);
            const timeStr = time.toLocaleTimeString("en-US", {
              hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit",
            });
            const msStr = time.getMilliseconds().toString().padStart(3, "0");

            const causation = evt.meta?.causation;
            const causedBy = causation?.event
              ? `${causation.event.name} #${causation.event.id}`
              : causation?.action
                ? `${causation.action.name ?? "action"} by ${causation.action.actor.name}`
                : null;

            const shortStream =
              evt.stream.length > 16
                ? `${evt.stream.slice(0, 8)}...${evt.stream.slice(-4)}`
                : evt.stream;

            return (
              <div
                key={evt.id}
                className={`event-entry ${i === events.length - 1 ? "new-event" : ""}`}
              >
                <div className="event-entry-head">
                  <span className="event-seq">#{evt.id}</span>
                  <span
                    className="event-badge"
                    style={{ background: color.bg, color: color.fg }}
                  >
                    {color.label}
                  </span>
                  <span className="event-version">v{evt.version}</span>
                </div>
                <div className="event-stream">
                  stream: <span>{shortStream}</span>
                </div>
                <div className="event-time">{timeStr}.{msStr}</div>
                <div className="event-data">
                  <pre dangerouslySetInnerHTML={{ __html: highlightJSON(evt.data) }} />
                </div>
                {causedBy && (
                  <div className="event-causation">
                    caused by <span>{causedBy}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}

// ── Cart Drawer (reads from local cart state, only PlaceOrder talks to server)
function CartDrawer({
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
  if (!open) return null;

  const productMap = Object.fromEntries(PRODUCTS.map((p) => [p.productId, p]));
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
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>

        <div className="drawer-body">
          {entries.length === 0 ? (
            <div className="drawer-empty">
              <div className="empty-icon">🛒</div>
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
                        {qty === 1 ? "🗑" : "−"}
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
            <button
              className="checkout-btn"
              onClick={onSubmit}
              disabled={submitting}
            >
              {submitting ? "Placing order..." : "Place Order"}
            </button>
            <button className="clear-btn" onClick={onClear}>
              Clear cart
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ── Orders View ──────────────────────────────────────────────────────
function OrdersView() {
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
  const productMap = Object.fromEntries(PRODUCTS.map((p) => [p.productId, p]));

  return (
    <section className="orders-section">
      <h2>Orders</h2>
      {data.length === 0 ? (
        <div className="orders-empty">
          <div className="empty-icon">📦</div>
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
                      <span>{prod?.icon ?? "📦"} {item.name}</span>
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

// ── Admin View ───────────────────────────────────────────────────────
function AdminView() {
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
  const productMap = Object.fromEntries(PRODUCTS.map((p) => [p.productId, p]));

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

// ── Toast ────────────────────────────────────────────────────────────
function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return <div className="toast">✓ {message}</div>;
}

// ── Main App ─────────────────────────────────────────────────────────
type Tab = "shop" | "orders" | "admin";

function CartApp() {
  const [localCart, setLocalCart] = useState<Record<string, number>>({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [addingProduct, setAddingProduct] = useState<string | null>(null);
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("shop");
  const seenIds = useRef(new Set<number>());

  const utils = trpc.useUtils();
  const itemCount = Object.values(localCart).reduce((sum, qty) => sum + qty, 0);

  // Live product data from domain (prices + inventory)
  const productsQuery = trpc.getProducts.useQuery();
  const liveProducts = productsQuery.data ?? [];
  const liveMap = Object.fromEntries(liveProducts.map((p) => [p.productId, p]));
  const liveStock = Object.fromEntries(liveProducts.map((p) => [p.productId, p.inventory]));

  // SSE subscription — receives every event as it's committed
  const onData = useCallback(
    (envelope: { id: string; data: EventEntry }) => {
      const evt = envelope.data;
      if (seenIds.current.has(evt.id)) return;
      seenIds.current.add(evt.id);
      setEvents((prev) => [...prev, evt]);

      // Reactive invalidation for views
      if (evt.name === "PriceChanged" || evt.name === "InventoryImported" || evt.name === "InventoryAdjusted" || evt.name === "InventoryDecommissioned") {
        utils.getProducts.invalidate();
      }
      if (evt.name === "CartSubmitted" || evt.name === "CartPublished") {
        utils.listOrders.invalidate();
        utils.getProducts.invalidate();
      }
    },
    [utils]
  );

  trpc.onEvent.useSubscription(undefined, {
    onStarted: () => setConnected(true),
    onData,
    onError: () => setConnected(false),
  });

  // Local cart operations (no server calls)
  const productMap = Object.fromEntries(PRODUCTS.map((p) => [p.productId, p]));

  const handleAdd = (product: (typeof PRODUCTS)[number]) => {
    setAddingProduct(product.productId);
    setLocalCart((prev) => ({
      ...prev,
      [product.productId]: (prev[product.productId] ?? 0) + 1,
    }));
    setToast("Added to cart");
    setTimeout(() => {
      setToast(null);
      setAddingProduct(null);
    }, 800);
  };

  const handleIncrement = (productId: string) => {
    setLocalCart((prev) => ({
      ...prev,
      [productId]: (prev[productId] ?? 0) + 1,
    }));
  };

  const handleDecrement = (productId: string) => {
    setLocalCart((prev) => {
      const qty = (prev[productId] ?? 0) - 1;
      if (qty <= 0) {
        const { [productId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [productId]: qty };
    });
  };

  const handleClear = () => setLocalCart({});

  // PlaceOrder — the only mutation that touches the server
  const placeOrder = trpc.PlaceOrder.useMutation({
    onSuccess: () => {
      setLocalCart({});
      setDrawerOpen(false);
      utils.getProducts.invalidate();
      utils.listOrders.invalidate();
      setToast("Order placed successfully!");
      setTimeout(() => setToast(null), 3000);
    },
    onError: (err) => {
      setToast(err.message.includes("invariant")
        ? "Could not place order — check stock availability"
        : "Could not place order");
      setTimeout(() => setToast(null), 3000);
    },
  });

  const handleSubmit = () => {
    const items = Object.entries(localCart)
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

  return (
    <>
      <style>{CSS}</style>

      <div className="app-layout">
        <div className="app-main">
          <header className="header">
            <a className="header-logo" href="#">
              <span>☕</span> brew<span>cart</span>
            </a>
            <div className="header-search">
              <select><option>All</option></select>
              <input type="text" placeholder="Search coffee equipment..." />
              <button>🔍</button>
            </div>
            <button className="cart-btn" onClick={() => setDrawerOpen(true)}>
              <span className="cart-icon">🛒</span>
              Cart
              {itemCount > 0 && <span className="cart-badge">{itemCount}</span>}
            </button>
          </header>

          <nav className="subnav">
            <button
              className={`subnav-tab ${activeTab === "shop" ? "active" : ""}`}
              onClick={() => setActiveTab("shop")}
            >
              Shop
            </button>
            <button
              className={`subnav-tab ${activeTab === "orders" ? "active" : ""}`}
              onClick={() => setActiveTab("orders")}
            >
              Orders
            </button>
            <button
              className={`subnav-tab ${activeTab === "admin" ? "active" : ""}`}
              onClick={() => setActiveTab("admin")}
            >
              Admin
            </button>
          </nav>

          {activeTab === "shop" && (
            <>
              <section className="hero">
                <h2>Craft Your Perfect Cup</h2>
                <p>Premium coffee equipment — sourced for the serious brewer</p>
              </section>

              <section className="products">
                {PRODUCTS.map((product) => {
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
            </>
          )}

          {activeTab === "orders" && <OrdersView />}
          {activeTab === "admin" && <AdminView />}
        </div>

        <EventPanel events={events} connected={connected} />
      </div>

      <CartDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        cart={localCart}
        onIncrement={handleIncrement}
        onDecrement={handleDecrement}
        onClear={handleClear}
        onSubmit={handleSubmit}
        submitting={placeOrder.isPending}
        liveStock={liveStock}
      />

      <Toast message={toast} />
    </>
  );
}

// ── Root Provider ────────────────────────────────────────────────────
const API_URL = "http://localhost:4000";

export default function App() {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        splitLink({
          condition: (op) => op.type === "subscription",
          true: httpSubscriptionLink({ url: API_URL }),
          false: httpLink({ url: API_URL }),
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <CartApp />
      </QueryClientProvider>
    </trpc.Provider>
  );
}
