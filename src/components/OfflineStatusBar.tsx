import { useState, useEffect, useRef } from "react";
import { Wifi, WifiOff, AlertTriangle, RefreshCw, CheckCircle2, ChevronDown, ChevronUp, Clock, Trash2 } from "lucide-react";
import { useOffline } from "../lib/useOffline";
import { triggerManualSync, type QueuedAction } from "../lib/offline";
import { type ConnectionStatus } from "../lib/offline";

const BORDER = "#1B2A4A";
const CARD = "#111D30";
const MUTED = "#8A9BB5";
const DIM = "#3A4F6A";

interface StatusConfig {
  icon: React.ReactNode;
  label: string;
  color: string;
  bg: string;
  border: string;
  pulse?: boolean;
}

function getStatusConfig(status: ConnectionStatus, queuedCount: number): StatusConfig {
  switch (status) {
    case "online":
      return {
        icon: <Wifi size={11} />,
        label: queuedCount > 0 ? `Online — synced` : "Online",
        color: "#4ADE80",
        bg: "rgba(74,222,128,0.06)",
        border: "rgba(74,222,128,0.2)",
      };
    case "offline":
      return {
        icon: <WifiOff size={11} />,
        label: queuedCount > 0 ? `Offline — ${queuedCount} queued` : "Offline",
        color: "#F87171",
        bg: "rgba(248,113,113,0.08)",
        border: "rgba(248,113,113,0.3)",
        pulse: true,
      };
    case "unstable":
      return {
        icon: <AlertTriangle size={11} />,
        label: queuedCount > 0 ? `Unstable — ${queuedCount} queued` : "Unstable connection",
        color: "#F59E0B",
        bg: "rgba(245,158,11,0.08)",
        border: "rgba(245,158,11,0.3)",
        pulse: true,
      };
    case "syncing":
      return {
        icon: <RefreshCw size={11} className="animate-spin" />,
        label: queuedCount > 0 ? `Syncing ${queuedCount} action${queuedCount !== 1 ? "s" : ""}...` : "Syncing...",
        color: "#60A5FA",
        bg: "rgba(96,165,250,0.08)",
        border: "rgba(96,165,250,0.3)",
      };
    case "sync_error":
      return {
        icon: <AlertTriangle size={11} />,
        label: "Sync error — will retry",
        color: "#F87171",
        bg: "rgba(248,113,113,0.08)",
        border: "rgba(248,113,113,0.3)",
        pulse: true,
      };
  }
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function QueuePanel({ actions, onClose }: { actions: QueuedAction[]; onClose: () => void }) {
  if (actions.length === 0) {
    return (
      <div
        className="absolute right-0 top-full mt-2 w-80 rounded-xl shadow-2xl z-50 p-4"
        style={{ backgroundColor: "#0D1B2E", border: `1px solid ${BORDER}` }}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold tracking-widest uppercase" style={{ color: MUTED }}>Sync Queue</p>
          <button onClick={onClose} className="text-xs hover:opacity-70" style={{ color: DIM }}>Close</button>
        </div>
        <div className="flex items-center gap-2 py-3">
          <CheckCircle2 size={14} style={{ color: "#4ADE80" }} />
          <p className="text-xs" style={{ color: MUTED }}>Queue is empty — all actions synced</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="absolute right-0 top-full mt-2 w-80 rounded-xl shadow-2xl z-50 flex flex-col"
      style={{ backgroundColor: "#0D1B2E", border: `1px solid ${BORDER}`, maxHeight: "320px" }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0" style={{ borderColor: BORDER }}>
        <div className="flex items-center gap-2">
          <Clock size={12} style={{ color: MUTED }} />
          <p className="text-xs font-bold tracking-widest uppercase" style={{ color: MUTED }}>
            Queued Actions
          </p>
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: "rgba(96,165,250,0.15)", color: "#60A5FA" }}
          >
            {actions.length}
          </span>
        </div>
        <button onClick={onClose} className="text-xs hover:opacity-70 transition-opacity" style={{ color: DIM }}>Close</button>
      </div>

      <div className="overflow-y-auto flex-1">
        {actions.map((action) => (
          <div
            key={action.id}
            className="px-4 py-2.5 border-b flex items-start gap-2.5"
            style={{ borderColor: BORDER }}
          >
            <div
              className="flex-shrink-0 mt-0.5 w-5 h-5 rounded flex items-center justify-center"
              style={{ backgroundColor: CARD }}
            >
              <Trash2 size={9} style={{ color: "#F87171", opacity: action.type === "delete" ? 1 : 0 }} />
              {action.type !== "delete" && (
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#60A5FA" }} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: "#D0DFEE" }}>
                {action.label ?? `${action.type} → ${action.table}`}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: DIM }}>
                {action.type.toUpperCase()} · {timeAgo(action.createdAt)}
                {action.retries > 0 && ` · ${action.retries} retries`}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 py-2.5 border-t flex-shrink-0" style={{ borderColor: BORDER }}>
        <button
          onClick={() => { triggerManualSync(); onClose(); }}
          className="w-full py-2 rounded-lg text-xs font-bold tracking-widest uppercase hover:opacity-80 transition-opacity flex items-center justify-center gap-2"
          style={{ backgroundColor: "rgba(96,165,250,0.1)", color: "#60A5FA", border: "1px solid rgba(96,165,250,0.2)" }}
        >
          <RefreshCw size={11} />
          Retry Sync Now
        </button>
      </div>
    </div>
  );
}

export default function OfflineStatusBar() {
  const { status, queuedCount, queuedActions } = useOffline();
  const [panelOpen, setPanelOpen] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);
  const prevStatus = useRef<ConnectionStatus>(status);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prevStatus.current !== "online" && status === "online" && queuedCount === 0) {
      setShowReconnected(true);
      const t = setTimeout(() => setShowReconnected(false), 3000);
      return () => clearTimeout(t);
    }
    prevStatus.current = status;
  }, [status, queuedCount]);

  useEffect(() => {
    if (!panelOpen) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [panelOpen]);

  if (status === "online" && queuedCount === 0 && !showReconnected) return null;

  const cfg = getStatusConfig(status, queuedCount);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setPanelOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all hover:opacity-90"
        style={{
          backgroundColor: cfg.bg,
          border: `1px solid ${cfg.border}`,
          color: cfg.color,
        }}
      >
        {showReconnected && status === "online" ? (
          <>
            <CheckCircle2 size={11} style={{ color: "#4ADE80" }} />
            <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "#4ADE80" }}>
              Reconnected
            </span>
          </>
        ) : (
          <>
            <span style={{ color: cfg.color }}>
              {cfg.icon}
            </span>
            <span className="text-[10px] font-bold tracking-widest uppercase">{cfg.label}</span>
            {cfg.pulse && (
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ backgroundColor: cfg.color }}
              />
            )}
            {queuedCount > 0 && (
              panelOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />
            )}
          </>
        )}
      </button>

      {panelOpen && (
        <QueuePanel actions={queuedActions} onClose={() => setPanelOpen(false)} />
      )}
    </div>
  );
}
