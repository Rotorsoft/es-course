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
