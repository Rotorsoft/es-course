import { projection } from "@rotorsoft/act";
import { CartSubmitted, CartPublished, type CartItem } from "./schemas.js";

export type OrderSummary = {
  status: string;
  items: CartItem[];
  totalPrice: number;
  actorId: string;
  submittedAt?: string;
  publishedAt?: string;
};

// In-memory read model
const orders = new Map<string, OrderSummary>();

export const OrdersProjection = projection("orders")
  .on({ CartSubmitted })
  .do(async (event) => {
    const actorId = event.meta.causation.action?.actor?.id ?? "anonymous";
    orders.set(event.stream, {
      status: "Submitted",
      items: event.data.orderedProducts,
      totalPrice: event.data.totalPrice,
      actorId,
      submittedAt: event.created.toISOString(),
    });
  })
  .on({ CartPublished })
  .do(async (event) => {
    const existing = orders.get(event.stream);
    if (existing) {
      existing.status = "Published";
      existing.publishedAt = event.created.toISOString();
    }
  })
  .build();

export function getOrders() {
  return Array.from(orders.entries()).map(([id, order]) => ({
    id,
    ...order,
  }));
}

export function getOrdersByActor(actorId: string) {
  return Array.from(orders.entries())
    .filter(([, order]) => order.actorId === actorId)
    .map(([id, order]) => ({ id, ...order }));
}

export function clearOrders() {
  orders.clear();
}
