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

// Event bus for SSE — only signals AFTER reactions complete
export const eventBus = new EventEmitter();
eventBus.setMaxListeners(100);

// Debounced, non-blocking drain — coalesces rapid commits
let drainTimer: ReturnType<typeof setTimeout> | null = null;
let draining = false;

async function executeDrain() {
  if (draining) return;
  draining = true;
  try {
    for (let i = 0; i < 2; i++) {
      const { leased } = await app.correlate({ after: -1, limit: 100 });
      if (leased.length === 0) break;
      await app.drain({ streamLimit: 10, eventLimit: 100 });
    }
  } finally {
    draining = false;
  }
  eventBus.emit("committed");
}

/** Non-blocking, debounced drain. Call after app.do() — returns immediately. */
export function scheduleDrain() {
  if (drainTimer) clearTimeout(drainTimer);
  drainTimer = setTimeout(() => {
    drainTimer = null;
    executeDrain().catch(console.error);
  }, 10);
}

// Google OAuth client (lazy-loaded)
let googleClient: import("google-auth-library").OAuth2Client | null = null;
export function getGoogleClient() {
  if (!googleClient && process.env.GOOGLE_CLIENT_ID) {
    const { OAuth2Client } = require("google-auth-library") as typeof import("google-auth-library");
    googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }
  return googleClient;
}
