import { useCallback, useRef, useState } from "react";
import { trpc } from "../trpc.js";
import type { EventEntry } from "../types.js";

export function useEventStream() {
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const seenIds = useRef(new Set<number>());
  const utils = trpc.useUtils();

  const onData = useCallback(
    (envelope: { id: string; data: EventEntry }) => {
      const evt = envelope.data;
      if (seenIds.current.has(evt.id)) return;
      seenIds.current.add(evt.id);
      setEvents((prev) => [...prev, evt]);

      if (evt.name === "InventoryImported" || evt.name === "InventoryAdjusted" || evt.name === "InventoryDecommissioned") {
        utils.getProducts.invalidate();
      }
      if (evt.name === "CartSubmitted" || evt.name === "CartPublished") {
        utils.listOrders.invalidate();
        utils.getProducts.invalidate();
      }
      if (evt.name === "CartActivityTracked") {
        utils.getCartActivity.invalidate();
      }
    },
    [utils]
  );

  trpc.onEvent.useSubscription(undefined, {
    onStarted: () => setConnected(true),
    onData,
    onError: () => setConnected(false),
  });

  return { events, connected };
}
