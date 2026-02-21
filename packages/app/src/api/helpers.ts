import { app } from "@rotorsoft/es-course-domain";
import { EventEmitter } from "node:events";

export type SerializedEvent = {
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

export function serializeEvents(events: Array<{ id: number; name: unknown; data: unknown; stream: string; version: number; created: Date; meta: unknown }>): SerializedEvent[] {
  return events.map((e) => ({
    id: e.id,
    name: e.name as string,
    data: e.data as Record<string, unknown>,
    stream: e.stream,
    version: e.version,
    created: e.created.toISOString(),
    meta: e.meta as SerializedEvent["meta"],
  }));
}

export async function drainAll() {
  for (let i = 0; i < 2; i++) {
    const { leased } = await app.correlate({ after: -1, limit: 100 });
    if (leased.length === 0) return;
    await app.drain({ streamLimit: 10, eventLimit: 100 });
  }
}

// Local event bus for SSE subscriptions
export const eventBus = new EventEmitter();
eventBus.setMaxListeners(100);
app.on("committed", () => eventBus.emit("committed"));

// Google OAuth client (lazy-loaded)
let googleClient: import("google-auth-library").OAuth2Client | null = null;
export function getGoogleClient() {
  if (!googleClient && process.env.GOOGLE_CLIENT_ID) {
    const { OAuth2Client } = require("google-auth-library") as typeof import("google-auth-library");
    googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }
  return googleClient;
}
