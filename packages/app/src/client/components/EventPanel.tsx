import { useEffect, useRef } from "react";
import { EVENT_COLORS, DEFAULT_EVENT_COLOR } from "../data/products.js";
import type { EventEntry } from "../types.js";
import { highlightJSON } from "./JsonHighlight.js";

export function EventPanel({
  events,
  connected,
}: {
  events: EventEntry[];
  connected: boolean;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const prevCount = useRef(0);

  useEffect(() => {
    if (events.length > prevCount.current && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
    prevCount.current = events.length;
  }, [events.length]);

  return (
    <aside className="event-panel">
      <div className="event-panel-header">
        <h3>
          Event Log
          {events.length > 0 && (
            <span className="event-panel-count">{events.length}</span>
          )}
        </h3>
        <div className="event-panel-subtitle">
          <span className={`event-panel-dot ${connected ? "connected" : ""}`} />
          {connected ? "connected" : "connecting..."}
        </div>
      </div>

      <div className="event-panel-body" ref={bodyRef}>
        {events.length === 0 ? (
          <div className="event-panel-empty">
            <div className="empty-terminal">&gt;_</div>
            <p>{connected ? "Add items to see events" : "Connecting..."}</p>
          </div>
        ) : (
          events.map((evt, i) => {
            const color = EVENT_COLORS[evt.name] ?? DEFAULT_EVENT_COLOR;
            const time = new Date(evt.created);
            const timeStr = time.toLocaleTimeString("en-US", {
              hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit",
            });
            const msStr = time.getMilliseconds().toString().padStart(3, "0");

            const causation = evt.meta?.causation;
            const causedBy = causation?.event
              ? `${causation.event.name} #${causation.event.id}`
              : causation?.action
                ? `${causation.action.name ?? "action"} by ${causation.action.actor.name}`
                : null;

            const shortStream =
              evt.stream.length > 16
                ? `${evt.stream.slice(0, 8)}...${evt.stream.slice(-4)}`
                : evt.stream;

            return (
              <div
                key={evt.id}
                className={`event-entry ${i === events.length - 1 ? "new-event" : ""}`}
              >
                <div className="event-entry-head">
                  <span className="event-seq">#{evt.id}</span>
                  <span
                    className="event-badge"
                    style={{ background: color.bg, color: color.fg }}
                  >
                    {evt.name}
                  </span>
                  <span className="event-version">v{evt.version}</span>
                </div>
                <div className="event-stream">
                  stream: <span>{shortStream}</span>
                </div>
                <div className="event-time">{timeStr}.{msStr}</div>
                <div className="event-data">
                  <pre dangerouslySetInnerHTML={{ __html: highlightJSON(evt.data) }} />
                </div>
                {causedBy && (
                  <div className="event-causation">
                    caused by <span>{causedBy}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
