# Act Model Spec

Markdown format for event-sourced domain models built with `@rotorsoft/act`.
Mirrors Act's primitives: State, Projection, Reaction, Slice.

## Structure

```
# Model: <Name>
## Types
## State: <Name>
## Projection: <Name>
## Reactions
## Slices
```

## Types

Shared value objects. Supported types: `string`, `number`, `boolean`, `date`,
`<TypeName>`, `<Type>[]`, `"a" | "b"` (enum). Constraints: `min(N)`,
`max(N)`, `optional`. Bare field names default to `string`.

```markdown
## Types

CartItem:
- itemId: string
- name: string
- price: string
```

## State

A write model built with `state()`. Everything nests under the heading as
a list tree with three branches: `init`, `actions`, and `patches`.

```markdown
## State: Cart
- init:
  - status: string = "Open"
  - totalPrice: number = 0
- actions:
  - PlaceOrder `{ items: CartItem[] min(1) }`
    - given: `status == "Open"` — Cart must be open
    - emit CartSubmitted `{ orderedProducts: CartItem[], totalPrice: number }`
      - `orderedProducts = items`
      - `totalPrice = sum(items.price)`
  - PublishCart `{ orderedProducts: CartItem[], totalPrice: number }`
    - emit CartPublished (passthrough)
- patches:
  - CartSubmitted: status: "Submitted", totalPrice
  - CartPublished: status: "Published", totalPrice
```

init — field defaults for new streams, becomes `.init()`.

actions — each action declares payload, optional invariants (`given`),
and the event it emits. Event schemas are declared inline — no separate
Events section. Passthrough means action payload = event payload.
Empty payloads use `{}`.

patches — how events update state. Bare field names mean "copy from
event.data". Prefix `state.` for current state. Use `"literal"` for constants.

## Projection

A read model built with `projection()`. Model shape + event handlers nest
under the heading. Shapes: `Map<key : Type>` or `Type[]`.
Operations: set, update, delete, append.
References: `stream`, `event.*`, `now`.

```markdown
## Projection: Orders — `Map<streamId : OrderSummary>`
- OrderSummary:
  - status: string
  - totalPrice: number
  - submittedAt: date (optional)
- on CartSubmitted:
  - set stream: status: "Submitted", totalPrice, submittedAt: now
- on CartPublished:
  - update stream: status: "Published", publishedAt: now
```

## Reactions

Event-to-action automations. Maps to `.on("Event").do(handler).to(resolver)`
in a slice. Targets: `same stream`, `event.<field>`, or computed expression.

```markdown
## Reactions
- CartSubmitted: PublishCart @ same stream (actor: system)
```

## Slices

Composition with `slice()`. Formula: states + projections + [reactions].
When a state appears in multiple slices, the framework merges them.

```markdown
## Slices
- CartSlice = Cart + Orders + [CartSubmitted: PublishCart]
- InventorySlice = Cart, Inventory + InventoryItems
```

## Naming

- State — singular noun: Cart, Inventory
- Event — past tense: CartSubmitted, InventoryImported
- Action — imperative: PlaceOrder, ImportInventory
- Projection — plural / model name: Orders, Feed
- Slice — state name + Slice: CartSlice

## Code Mapping

- `## State` maps to `state({ Name: Schema }).init(...).emits({...}).patch({...}).on({...}).build()`
- `## Projection` maps to `projection("name").on({ Event }).do(handler).build()`
- `## Reactions` maps to `.on("Event").do(handler).to(resolver)` in slice
- `## Slices` maps to `slice().withState(X).withProjection(Y).build()`
- `# Model` maps to `act().withSlice(A).withSlice(B).build()`

## Principles

1. WHAT, not HOW — domain semantics, not implementation
2. Passthrough is the default — only spell out non-trivial transforms
3. Natural language for invariants — expression + human description
4. Projections span states — subscribe to events across boundaries
5. Reactions close the loop — only way states trigger each other
6. Slices are the composition boundary — what travels together

---

# Full Example: Shopping Cart

# Model: Shopping Cart

## Types

CartItem:
- itemId: string
- name: string
- description: string
- price: string
- productId: string

## State: Cart
- init:
  - status: string = "Open"
  - totalPrice: number = 0
- actions:
  - PlaceOrder `{ items: CartItem[] min(1) }`
    - given: `status == "Open"` — Cart must be open
    - emit CartSubmitted `{ orderedProducts: CartItem[], totalPrice: number }`
      - `orderedProducts = items`
      - `totalPrice = sum(items.price)`
  - PublishCart `{ orderedProducts: CartItem[], totalPrice: number }`
    - emit CartPublished (passthrough)
- patches:
  - CartSubmitted: status: "Submitted", totalPrice
  - CartPublished: status: "Published", totalPrice

## State: Inventory
- init:
  - name: string = ""
  - price: number = 0
  - quantity: number = 0
  - productId: string = ""
- actions:
  - ImportInventory `{ name, price: number, quantity: number, productId }`
    - emit InventoryImported (passthrough)
  - AdjustInventory `{ quantity: number, price: number, productId }`
    - emit InventoryAdjusted (passthrough)
  - DecommissionInventory `{ productId }`
    - emit InventoryDecommissioned (passthrough)
- patches:
  - InventoryImported: name, price, quantity, productId
  - InventoryAdjusted: quantity, price
  - InventoryDecommissioned: quantity: 0

## State: CartTracking
- init:
  - eventCount: number = 0
- actions:
  - TrackCartActivity `{ action: "add" | "remove" | "clear", productId, quantity: number }`
    - emit CartActivityTracked (passthrough)
- patches:
  - CartActivityTracked: eventCount: state.eventCount + 1

## Projection: Orders — `Map<streamId : OrderSummary>`
- OrderSummary:
  - status: string
  - items: CartItem[]
  - totalPrice: number
  - submittedAt: date (optional)
  - publishedAt: date (optional)
- on CartSubmitted:
  - set stream: status: "Submitted", items: orderedProducts, totalPrice, submittedAt: now
- on CartPublished:
  - update stream: status: "Published", publishedAt: now

## Projection: InventoryItems — `Map<productId : InventoryItem>`
- InventoryItem:
  - name: string
  - price: number
  - quantity: number
- on InventoryImported:
  - set event.productId: name, price, quantity
- on InventoryAdjusted:
  - update event.productId: quantity, price
- on InventoryDecommissioned:
  - delete event.productId
- on CartPublished:
  - for each product in orderedProducts: decrement productId.quantity by count (floor at 0)

## Projection: CartActivity — `CartActivity[]`
- CartActivity:
  - sessionId: string
  - action: "add" | "remove" | "clear"
  - productId: string
  - quantity: number
  - timestamp: date
- on CartActivityTracked:
  - append: sessionId: stream, action, productId, quantity, timestamp: now

## Reactions
- CartSubmitted: PublishCart @ same stream (actor: system)

## Slices
- CartSlice = Cart + Orders + [CartSubmitted: PublishCart]
- InventorySlice = Cart, Inventory + InventoryItems
- CartTrackingSlice = CartTracking + CartActivity
