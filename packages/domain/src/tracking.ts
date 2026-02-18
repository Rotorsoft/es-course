import { state, projection } from "@rotorsoft/act";
import {
  TrackCartActivity,
  CartActivityTracked,
  CartTrackingState,
} from "./schemas.js";

// === Cart Tracking aggregate (append-only, no invariants) ===
export const CartTracking = state({ CartTracking: CartTrackingState })
  .init(() => ({ eventCount: 0 }))
  .emits({ CartActivityTracked })
  .patch({
    CartActivityTracked: (_event, state) => ({
      eventCount: state.eventCount + 1,
    }),
  })
  .on({ TrackCartActivity })
  .emit((data) => ["CartActivityTracked", data])
  .build();

// === Cart Tracking projection (read model) ===
export type CartActivity = {
  sessionId: string;
  action: "add" | "remove" | "clear";
  productId: string;
  quantity: number;
  timestamp: string;
};

const activities: CartActivity[] = [];

export const CartTrackingProjection = projection("cart-tracking")
  .on({ CartActivityTracked })
  .do(async (event) => {
    activities.push({
      sessionId: event.stream,
      action: event.data.action,
      productId: event.data.productId,
      quantity: event.data.quantity,
      timestamp: event.created.toISOString(),
    });
  })
  .build();

export function getCartActivities(): CartActivity[] {
  return [...activities];
}

export function clearCartActivities(): void {
  activities.length = 0;
}
