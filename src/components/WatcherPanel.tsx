import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { getRecentWatcherEvents } from "../lib/watcherLog";

const COLORS = {
  card: "#0F1E33",
  border: "#1B2A4A",
  muted: "#8A9BB5",
  text: "#E8F0FA",
  down: "#ef4444",
  ok: "#22c55e",
};

export default function WatcherPanel({ refreshKey }: { refreshKey: number }) {
  const [open, setOpen] = useState(true);
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    setEvents(getRecentWatcherEvents());
  }, [refreshKey]);

  const failCount = events.filter((event) => event.status === "fail").length;
  const lastEvent = events[0];

  return (
    <section
      style={{
        marginTop: 22,
        background: COLORS.card,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 18,
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          padding: "18px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div>
          <div style={{ color: COLORS.text, fontWeight: 900 }}>Watcher Summary</div>
          <div style={{ color: COLORS.muted, fontSize: 13 }}>
            {failCount} recent failures. Latest: {lastEvent ? `${lastEvent.system} ${lastEvent.status}` : "none"}
          </div>
        </div>
        {open ? <ChevronUp size={18} color={COLORS.muted} /> : <ChevronDown size={18} color={COLORS.muted} />}
      </button>

      {open && (
        <div style={{ borderTop: `1px solid ${COLORS.border}`, padding: 16, maxHeight: 260, overflow: "auto" }}>
          {events.length === 0 ? (
            <div style={{ color: COLORS.muted }}>No Watcher events yet.</div>
          ) : (
            events.slice(0, 20).map((event, index) => (
              <div
                key={index}
                style={{
                  color: event.status === "fail" ? COLORS.down : COLORS.ok,
                  fontSize: 12,
                  marginBottom: 8,
                  fontFamily: "monospace",
                }}
              >
                [{new Date(event.time).toLocaleTimeString()}] {String(event.system).toUpperCase()} ?{" "}
                {String(event.status).toUpperCase()}   {event.detail}
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}
