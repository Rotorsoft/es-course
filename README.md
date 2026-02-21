# ES Course — Event-Sourced Shopping Cart

An event-sourced shopping cart application built with the [@rotorsoft/act](https://github.com/Rotorsoft/act) framework. Demonstrates event sourcing patterns including aggregates, reactions, projections, and fire-and-forget tracking — all composed into a single application from independent domain slices.

### User flow — browse, search, sign up, place order

https://github.com/Rotorsoft/es-course/raw/refs/heads/master/docs/demo-user.mp4

### Admin flow — orders, inventory management, marketing analytics

https://github.com/Rotorsoft/es-course/raw/refs/heads/master/docs/demo-admin.mp4

## Prerequisites

- Node.js >= 22.18.0
- pnpm >= 10.27.0

## Quick Start

```sh
pnpm install
pnpm dev          # API (port 4000) + React client (port 5173)
```

Other commands:

```sh
pnpm test         # Run all tests (vitest)
pnpm typecheck    # Type-check all packages
pnpm build        # Build all packages
```

---

## Architecture

```
packages/
  domain/src/
    schemas.ts        Zod schemas — actions, events, state
    cart.ts           Cart aggregate + CartSlice (reaction: auto-publish)
    inventory.ts      Inventory aggregate + projection + InventorySlice
    tracking.ts       CartTracking aggregate + projection + CartTrackingSlice
    user.ts           User aggregate + projection + UserSlice
    orders.ts         Orders projection (read model)
    invariants.ts     Business rules (must be open)
    bootstrap.ts      Composes slices into the app
    index.ts          Public exports
  domain/test/
    cart.spec.ts      22 tests — cart, inventory, orders, tracking slices
    user.spec.ts      7 tests — user registration, roles, projection
  app/src/
    api/
      index.ts          Merges routers, exports appRouter type
      trpc.ts           tRPC init + procedure levels (public, authed, admin)
      context.ts        Request context with token verification
      auth.ts           Token signing, password hashing (HMAC-SHA256)
      auth.routes.ts    Auth endpoints (login, signup, Google OAuth, roles)
      domain.routes.ts  Domain mutations + queries
      events.routes.ts  SSE subscription for live events
      helpers.ts        Event serialization, drain utilities, Google OAuth
    client/
      App.tsx           Root component — providers, layout, tab routing
      data/products.ts  50-product catalog (10 categories)
      components/       Header, CartDrawer, SubNav, EventPanel, ProductCard, ...
      views/            ShopView, OrdersView, AdminView, MarketingView
      hooks/            useAuth, useCart, useEventStream, usePlaceOrder, ...
    dev-server.ts       Dev server with seed data (50 products, admin user)
```

The monorepo has two packages:

| Package | Purpose |
|---------|---------|
| `@rotorsoft/es-course-domain` | Pure domain logic — aggregates, projections, invariants. No I/O. |
| `@rotorsoft/es-course-app` | Full-stack — tRPC API server + React/Vite client with SSE streaming. |

---

## Auth

Token-based authentication with HMAC-SHA256 signed JWTs (24-hour TTL).

- **Local auth** — username/password signup and login
- **Google OAuth** — optional, enabled via `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` env vars
- **Roles** — `admin` (full access) and `user` (own orders only)
- **Dev seed** — admin account pre-created (`admin` / `admin`)

The API uses three tRPC procedure levels:

| Procedure | Access |
|-----------|--------|
| `publicProcedure` | Anyone (product catalog, tracking, auth config) |
| `authedProcedure` | Signed-in users (place orders, view own orders) |
| `adminProcedure` | Admin role only (inventory management, user roles) |

---

## Domain Slices

The domain is built from four independent **slices**, each owning its own aggregate, events, state, and projections. Each slice is self-contained in its own file and composed in `bootstrap.ts`.

### Cart Slice (`cart.ts`)

The order lifecycle aggregate. A cart starts `Open`, accepts a `PlaceOrder` command (which validates invariants), emits `CartSubmitted`, then a **reaction** defined within the slice automatically fires `PublishCart` to emit `CartPublished`. The Orders projection is also bundled into this slice.

```
PlaceOrder ──► CartSubmitted ──► (reaction) ──► PublishCart ──► CartPublished
```

```ts
// cart.ts — aggregate
export const Cart = state({ Cart: CartState })
  .init(() => ({ status: "Open", totalPrice: 0 }))
  .emits({ CartSubmitted, CartPublished })
  .patch({
    CartSubmitted: ({ data }) => ({
      status: "Submitted",
      totalPrice: data.totalPrice,
    }),
    CartPublished: ({ data }) => ({
      status: "Published",
      totalPrice: data.totalPrice,
    }),
  })
  .on({ PlaceOrder })
  .given([mustBeOpen])
  .emit((data) => [
    "CartSubmitted",
    {
      orderedProducts: data.items,
      totalPrice: data.items.reduce(
        (sum, item) => sum + parseFloat(item.price || "0"), 0
      ),
    },
  ])
  .on({ PublishCart })
  .emit("CartPublished")
  .build();

// cart.ts — slice with reaction + Orders projection
export const CartSlice = slice()
  .withState(Cart)
  .withProjection(OrdersProjection)
  .on("CartSubmitted")
  .do(async function publishCart(event, stream, app) {
    await app.do(
      "PublishCart",
      { stream, actor: { id: "system", name: "CartPublisher" } },
      { orderedProducts: event.data.orderedProducts, totalPrice: event.data.totalPrice },
      event
    );
  })
  .to((event) => ({ target: event.stream }))
  .build();
```

### Inventory Slice (`inventory.ts`)

Per-product inventory tracking with import, adjust, and decommission lifecycle. Includes a **projection** that maintains a live read model of stock levels, and also reacts to `CartPublished` events from other slices.

```
ImportInventory ──► InventoryImported
AdjustInventory ──► InventoryAdjusted
DecommissionInventory ──► InventoryDecommissioned
```

```ts
// inventory.ts — aggregate uses shorthand emit + auto-patching from events
export const Inventory = state({ Inventory: InventoryState })
  .init(() => ({ name: "", price: 0, quantity: 0, productId: "" }))
  .emits({ InventoryImported, InventoryAdjusted, InventoryDecommissioned })
  .patch({
    InventoryDecommissioned: () => ({ quantity: 0 }),
  })
  .on({ ImportInventory }).emit("InventoryImported")
  .on({ AdjustInventory }).emit("InventoryAdjusted")
  .on({ DecommissionInventory }).emit("InventoryDecommissioned")
  .build();

// inventory.ts — projection listens to events from multiple slices
export const InventoryProjection = projection("inventory")
  .on({ InventoryImported })
  .do(async (event) => {
    inventory.set(event.data.productId, { ... });
  })
  .on({ InventoryAdjusted })
  .do(async (event) => {
    // Update price and quantity
  })
  .on({ InventoryDecommissioned })
  .do(async (event) => {
    inventory.delete(event.data.productId);
  })
  .on({ CartPublished })
  .do(async (event) => {
    // Decrement stock for each ordered item
    for (const [productId, count] of counts) {
      const existing = inventory.get(productId);
      if (existing) existing.quantity = Math.max(0, existing.quantity - count);
    }
  })
  .build();

// inventory.ts — slice bundles Cart (for CartPublished), Inventory, and projection
export const InventorySlice = slice()
  .withState(Cart)
  .withState(Inventory)
  .withProjection(InventoryProjection)
  .build();
```

### CartTracking Slice (`tracking.ts`)

Append-only aggregate for marketing analytics. Captures browsing behavior (add/remove/clear) without affecting the order flow. Fire-and-forget from the client — no drain needed, no invariants, no error handling that blocks the UI.

One stream per browser session (keyed by UUID).

```
TrackCartActivity ──► CartActivityTracked
```

```ts
// tracking.ts — aggregate
export const CartTracking = state({ CartTracking: CartTrackingState })
  .init(() => ({ eventCount: 0 }))
  .emits({ CartActivityTracked })
  .patch({
    CartActivityTracked: (_event, state) => ({
      eventCount: state.eventCount + 1,
    }),
  })
  .on({ TrackCartActivity }).emit("CartActivityTracked")
  .build();

// tracking.ts — slice bundles aggregate + projection
export const CartTrackingSlice = slice()
  .withState(CartTracking)
  .withProjection(CartTrackingProjection)
  .build();
```

### User Slice (`user.ts`)

User identity and role management. Supports local registration and Google OAuth. The User projection maintains an in-memory read model keyed by email, with secondary indexes by provider ID.

```
RegisterUser ──► UserRegistered
AssignRole   ──► RoleAssigned
```

---

## Composition

Each slice is self-contained — aggregate, projection, and reactions are defined together in a single file. The `bootstrap.ts` file simply wires the slices into the app:

```ts
// bootstrap.ts
import { act } from "@rotorsoft/act";
import { CartSlice } from "./cart.js";
import { InventorySlice } from "./inventory.js";
import { CartTrackingSlice } from "./tracking.js";
import { UserSlice } from "./user.js";

export const app = act()
  .withActor<AppActor>()
  .withSlice(CartSlice)
  .withSlice(InventorySlice)
  .withSlice(CartTrackingSlice)
  .withSlice(UserSlice)
  .build();
```

### How the pieces connect

```
┌─────────────────────────────────────────────────────────┐
│                      Event Store                        │
│  (single append-only log, shared by all slices)         │
└────────┬──────────────────┬──────────────┬──────────┬───┘
         │                  │              │          │
    CartSlice         InventorySlice  TrackingSlice  UserSlice
    ┌────────┐        ┌────────────┐  ┌──────────┐  ┌──────┐
    │ Cart   │        │ Inventory  │  │ Tracking │  │ User │
    │ agg.   │        │ agg.       │  │ agg.     │  │ agg. │
    └───┬────┘        └─────┬──────┘  └────┬─────┘  └──┬───┘
        │                   │              │            │
        ▼                   ▼              ▼            ▼
   ┌─────────┐       ┌───────────┐  ┌──────────┐  ┌────────┐
   │ Orders  │       │ Inventory │  │ Tracking │  │ User   │
   │ proj.   │       │ proj.     │  │ proj.    │  │ proj.  │
   └─────────┘       └───────────┘  └──────────┘  └────────┘
        │                  │              │            │
        ▼                  ▼              ▼            ▼
   Orders View        Admin View    Marketing     Auth
```

---

## UI Views

The React client has five tabs and a live event log panel. The Shop tab is always visible. Orders requires sign-in. Admin and Marketing require the admin role.

Product catalog: 50 items across 10 categories (Espresso, Brewing, Grinders, Kettles, Accessories, Beans, Cups & Mugs, Cleaning, Storage) with full-text search and category filtering.

### Shop

Product catalog with live inventory counts and prices. Cart is fully local (React state). Search and category filter narrow the product grid. Only `PlaceOrder` talks to the server.

### Cart Drawer

Slide-out cart with quantity controls. Each add/remove/clear fires a tracking event to the server (fire-and-forget). Shows "Sign in to order" when not authenticated.

### Orders

Read model materialized by the Orders projection from `CartSubmitted` and `CartPublished` events. Regular users see their own orders; admins see all orders with actor IDs.

### Admin

Inventory management — adjust prices and stock levels, or decommission products. Each action emits domain events that flow through projections. Admin role required.

### Marketing

Analytics dashboard built from the CartTracking projection. Shows:

- **KPI cards** — sessions, total events, orders placed, conversion rate
- **Product Interest** — per-product adds/removes with engagement bars
- **Conversion Funnel** — sessions → adds → orders → abandoned
- **Activity Timeline** — recent tracking events with timestamps

Data updates live via SSE event invalidation. Admin role required.

---

## Event Flow

Every action in the system produces events that flow through the store:

| Event | Source | Consumed By |
|-------|--------|-------------|
| `CartSubmitted` | Cart aggregate | Orders proj., Reaction (PublishCart) |
| `CartPublished` | Cart aggregate (via reaction) | Orders proj., Inventory proj. |
| `InventoryImported` | Inventory aggregate | Inventory proj. |
| `InventoryAdjusted` | Inventory aggregate | Inventory proj. |
| `InventoryDecommissioned` | Inventory aggregate | Inventory proj. |
| `CartActivityTracked` | CartTracking aggregate | CartTracking proj. |
| `UserRegistered` | User aggregate | User proj. |
| `RoleAssigned` | User aggregate | User proj. |

The Event Log panel (right sidebar) shows every event in real time via SSE subscription.

---

## API

The tRPC router is split into three sub-routers: auth, domain, and events.

**Auth routes (`auth.routes.ts`):**

| Endpoint | Procedure | Description |
|----------|-----------|-------------|
| `getAuthConfig` | public | Available auth providers |
| `login` | public | Sign in with username/password |
| `signup` | public | Create a local account |
| `loginWithGoogle` | public | Sign in / register via Google OAuth |
| `me` | authed | Current user profile from token |
| `assignRole` | admin | Change a user's role |
| `listUsers` | admin | All registered users (sans password hashes) |

**Domain mutations (`domain.routes.ts`):**

| Endpoint | Procedure | Description |
|----------|-----------|-------------|
| `PlaceOrder` | authed | Submit a complete order (drains reactions + projections) |
| `ImportInventory` | admin | Seed a product into inventory |
| `AdjustInventory` | admin | Update price/stock for a product |
| `DecommissionInventory` | admin | Remove a product from inventory |
| `TrackCartActivity` | public | Fire-and-forget browsing event (no drain) |

**Domain queries (`domain.routes.ts`):**

| Endpoint | Procedure | Description |
|----------|-----------|-------------|
| `getProducts` | public | Live product list (prices + stock from Inventory projection) |
| `getInventory` | public | Raw inventory map (all products) |
| `listOrders` | authed | Own orders for users, all orders for admins |
| `getCartActivity` | public | Activity log (from CartTracking projection) |

**SSE subscription (`events.routes.ts`):**

| Endpoint | Description |
|----------|-------------|
| `onEvent` | SSE stream of all committed events |

---

## Testing

29 tests across 2 test files cover all domain slices:

```sh
pnpm test
```

Test structure:

- **Cart** — PlaceOrder lifecycle, invariant enforcement, reaction-driven publish
- **Inventory** — Import, adjust, decommission, cross-slice stock decrement on CartPublished
- **Orders projection** — Materialization from CartSubmitted/CartPublished
- **CartTracking** — Event emission, state accumulation, projection materialization, non-interference with order flow
- **User** — Registration, role assignment, projection queries, duplicate prevention

Tests use `store().seed()` for isolation and `app.correlate()` + `app.drain()` to process reactions and projections.

### Coverage

```sh
npx vitest run --coverage
```

---

## Demo Video

To regenerate the demo videos (requires Playwright, ffmpeg, and a running dev server):

```sh
pnpm dev &
node docs/demo.mjs
```
