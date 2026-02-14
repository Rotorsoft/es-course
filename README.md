# ES Course — Event-Sourced Shopping Cart

An event-sourced shopping cart application built with the [@rotorsoft/act](https://github.com/Rotorsoft/act) framework. Demonstrates event sourcing patterns including aggregates, reactions, and projections.

## Architecture

```
packages/
  domain/     Event-sourced domain model (aggregates, projections, invariants)
  app/        Full-stack app (tRPC API + React client)
```

**Domain slices:**

- **Cart** — shopping cart aggregate with items, submission, and publication lifecycle
- **Price** — product price management
- **Inventory** — product inventory tracking
- **Orders** — read-model projection materialized from cart submission/publication events

**Key patterns:**

- Commands validate invariants, then emit events that patch aggregate state
- Reactions automate cross-aggregate workflows (e.g., `CartSubmitted` triggers `PublishCart`)
- Projections build read models from event streams (e.g., Orders projection)

## Prerequisites

- Node.js >= 22.18.0
- pnpm >= 10.27.0

## Setup

```sh
pnpm install
```

## Development

```sh
pnpm dev        # Start API server (port 4000) + React client
pnpm test       # Run tests
pnpm typecheck  # Type-check all packages
pnpm build      # Build all packages
```

## Packages

| Package | Description |
|---------|------------|
| `@rotorsoft/es-course-domain` | Domain model: Cart, Price, Inventory aggregates + Orders projection |
| `@rotorsoft/es-course-app` | tRPC API server + React client with live event streaming |
