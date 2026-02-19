import { useRef } from "react";
import { trpc } from "../trpc.js";

export function useActivityTracker() {
  const sessionId = useRef(crypto.randomUUID());
  const trackActivity = trpc.TrackCartActivity.useMutation();

  const track = (action: "add" | "remove" | "clear", productId: string, quantity: number) => {
    trackActivity.mutate({ sessionId: sessionId.current, action, productId, quantity });
  };

  return { track };
}
