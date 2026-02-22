import { app } from "@rotorsoft/es-course-domain";
import { tracked } from "@trpc/server";
import { serializeEvents } from "./helpers.js";
import { t, publicProcedure } from "./trpc.js";

export const eventsRouter = t.router({
  onEvent: publicProcedure.subscription(async function*({ signal }) {
    const existing = await app.query_array({ after: -1 });
    for (const e of serializeEvents(existing)) {
      yield tracked(String(e.id), e);
    }

    let lastId = existing.length > 0 ? existing[existing.length - 1].id : -1;

    let notify: (() => void) | null = null;
    const onCommitted = () => {
      if (notify) {
        notify();
        notify = null;
      }
    };
    // Use "committed" — fires synchronously on every app.do(), including
    // reaction commits during settle. "settled" fires only after the full
    // settle loop completes which can lag several seconds with InMemoryStore.
    app.on("committed", onCommitted);

    try {
      while (!signal?.aborted) {
        await new Promise<void>((resolve) => {
          notify = resolve;
          signal?.addEventListener("abort", () => resolve(), { once: true });
        });
        if (signal?.aborted) break;

        const newEvents = await app.query_array({ after: lastId });
        for (const e of serializeEvents(newEvents)) {
          yield tracked(String(e.id), e);
          lastId = e.id;
        }
      }
    } finally {
      app.off("committed", onCommitted);
    }
  }),
});
