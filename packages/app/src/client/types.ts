export type EventEntry = {
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

export type ActivityEntry = {
  sessionId: string;
  action: "add" | "remove" | "clear";
  productId: string;
  quantity: number;
  timestamp: string;
};

export type Tab = "shop" | "orders" | "admin" | "marketing";
