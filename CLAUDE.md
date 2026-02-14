# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
pnpm install              # Install dependencies
pnpm test                 # Run all tests (vitest)
pnpm test -- cart         # Run a single test file by name
pnpm typecheck            # Type-check all packages
pnpm build                # Build all packages
pnpm dev                  # Start API (port 4000) + React client
```

## Architecture

pnpm monorepo with two packages:

- **`packages/domain`** — Event-sourced domain model using `@rotorsoft/act`. Pure domain logic, no I/O.
- **`packages/app`** — Full-stack: tRPC API server + React/Vite client with SSE event streaming.

### Domain model (`packages/domain/src/`)

Built on `@rotorsoft/act` — aggregates emit events that patch state, reactions automate workflows, projections build read models.

- `schemas.ts` — Zod schemas for all action payloads, event payloads, and state types
- `cart.ts` — Cart aggregate (AddItem, RemoveItem, ClearCart, SubmitCart, PublishCart)
- `price.ts` — Price aggregate (ChangePrice)
- `inventory.ts` — Inventory aggregate (ImportInventory)
- `orders.ts` — Orders read-model projection (materialized from CartSubmitted/CartPublished)
- `invariants.ts` — Business rule constraints (max 3 items, must have items, must be open)
- `bootstrap.ts` — Composes slices into the app, defines reactions (CartSubmitted → PublishCart)

### App layer (`packages/app/src/`)

- `api/index.ts` — tRPC router: mutations for commands, queries for state, SSE subscription for live events
- `client/App.tsx` — Single-file React app (Shop, Orders, Admin views)
- `dev-server.ts` — Dev server with seed data (5 products, 3 test carts)

## @rotorsoft/act patterns

**Patch handler**: `(event: Committed, state: Readonly<S>) => Partial<S>` — access payload via `event.data`, current state is 2nd arg.

**Emit handler**: `(actionPayload, snapshot, target) => [EventName, data]`

**Invariant shape**: `{ description: string; valid: (state, actor?) => boolean }`

**Empty payloads**: Use `ZodEmpty` = `z.record(z.string(), z.never())`

**Reactions**: `.void()` reactions are NEVER processed by `drain()`. Use `.to((event) => ({ target: event.stream }))` for self-targeting.

**Test isolation**: Call `store().seed()` in `beforeEach`. Call `app.correlate()` before `app.drain()` to register reaction targets.

## Commit conventions

Follow conventional commits: `feat:`, `fix:`, `refactor:`, `test:`, `chore:`, `docs:`

All AI commits must include `Co-Authored-By` trailer.
