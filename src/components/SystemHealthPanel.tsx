import { useState, useEffect, useRef, useCallback } from "react";
import {
  Activity,
  Database,
  Cloud,
  FileText,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Layers,
} from "lucide-react";
import { getSystemHealth, getOverallStatus, type SystemHealth, type HealthStatus } from "../lib/health";

const BORDER = "#1B2A4A";
const CARD = "#111D30";
const MUTED = "#8A9BB5";
const DIM = "#3A4F6A";
const BG = "#0D1B2E";

const REFRESH_INTERVAL_MS = 60_000;

function statusColor(s: HealthStatus): string {
  switch (s) {
    case "ok": return "#4ADE80";
    case "warning": return "#F59E0B";
    case "error": return "#F87171";
    case "checking": return "#60A5FA";
    default: return MUTED;
  }
}

function statusBg(s: HealthStatus): string {
  switch (s) {
    case "ok": return "rgba(74,222,128,0.08)";
    case "warning": return "rgba(245,158,11,0.08)";
    case "error": return "rgba(248,113,113,0.08)";
    case "checking": return "rgba(96,165,250,0.08)";
    default: return "rgba(138,155,181,0.06)";
  }
}

function statusBorder(s: HealthStatus): string {
  switch (s) {
    case "ok": return "rgba(74,222,128,0.2)";
    case "warning": return "rgba(245,158,11,0.25)";
    case "error": return "rgba(248,113,113,0.3)";
    case "checking": return "rgba(96,165,250,0.2)";
    default: return BORDER;
  }
}

function StatusDot({ status }: { status: HealthStatus }) {
  const color = statusColor(status);
  const pulse = status === "error" || status === "warning";
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full flex-shrink-0${pulse ? " animate-pulse" : ""}`}
      style={{ backgroundColor: color }}
    />
  );
}

function StatusIcon({ status, size = 11 }: { status: HealthStatus; size?: number }) {
  const color = statusColor(status);
  if (status === "ok") return <CheckCircle2 size={size} style={{ color }} />;
  if (status === "error") return <XCircle size={size} style={{ color }} />;
  if (status === "warning") return <AlertTriangle size={size} style={{ color }} />;
  if (status === "checking") return <RefreshCw size={size} style={{ color }} className="animate-spin" />;
  return <Clock size={size} style={{ color }} />;
}

function ServiceRow({
  icon,
  name,
  status,
  label,
  detail,
}: {
  icon: React.ReactNode;
  name: string;
  status: HealthStatus;
  label: string;
  detail?: string;
}) {
  const color = statusColor(status);
  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 rounded-lg"
      style={{ backgroundColor: statusBg(status), border: `1px solid ${statusBorder(status)}` }}
    >
      <span style={{ color: MUTED }}>{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold" style={{ color: "#D0DFEE" }}>{name}</p>
          {detail && (
            <span className="text-[10px] truncate" style={{ color: DIM }}>{detail}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <StatusDot status={status} />
        <span className="text-[10px] font-bold tracking-wider uppercase" style={{ color }}>{label}</span>
      </div>
    </div>
  );
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function formatErrorTime(at: string | null): string {
  if (!at) return "";
  try {
    const d = new Date(at);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

interface HealthPanelProps {
  health: SystemHealth;
  loading: boolean;
  onRefresh: () => void;
}

function HealthPanel({ health, loading, onRefresh }: HealthPanelProps) {
  const overall = getOverallStatus(health);
  const overallColor = statusColor(overall);

  return (
    <div
      className="absolute right-0 top-full mt-2 w-80 rounded-xl shadow-2xl z-50 flex flex-col"
      style={{ backgroundColor: BG, border: `1px solid ${BORDER}`, maxHeight: "480px" }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0" style={{ borderColor: BORDER }}>
        <div className="flex items-center gap-2">
          <Activity size={12} style={{ color: overallColor }} />
          <p className="text-xs font-bold tracking-widest uppercase" style={{ color: MUTED }}>System Health</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px]" style={{ color: DIM }}>
            {timeAgo(health.lastRefreshed)}
          </span>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="hover:opacity-70 transition-opacity disabled:opacity-40"
          >
            <RefreshCw size={11} style={{ color: MUTED }} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      <div className="overflow-y-auto flex-1 p-3 flex flex-col gap-2">
        <ServiceRow
          icon={<Database size={12} />}
          name="Database"
          status={health.database.status}
          label={health.database.label}
          detail={health.database.detail}
        />
        <ServiceRow
          icon={<Cloud size={12} />}
          name="Google Drive"
          status={health.drive.status}
          label={health.drive.label}
          detail={health.drive.detail}
        />
        <ServiceRow
          icon={<FileText size={12} />}
          name="Notion"
          status={health.notion.status}
          label={health.notion.label}
          detail={health.notion.detail}
        />
        <ServiceRow
          icon={<Layers size={12} />}
          name="Sync Queue"
          status={health.syncQueue.status}
          label={health.syncQueue.label}
          detail={health.syncQueue.detail}
        />

        {health.recentErrors.length > 0 && (
          <div className="mt-1">
            <p className="text-[10px] font-bold tracking-widest uppercase px-1 mb-1.5" style={{ color: DIM }}>
              Recent Errors
            </p>
            <div className="flex flex-col gap-1.5">
              {health.recentErrors.map((err, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 px-3 py-2 rounded-lg"
                  style={{ backgroundColor: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.15)" }}
                >
                  <AlertTriangle size={10} style={{ color: "#F87171", marginTop: 1, flexShrink: 0 }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-bold" style={{ color: "#F87171" }}>{err.service}</p>
                      {err.at && (
                        <p className="text-[9px] flex-shrink-0" style={{ color: DIM }}>{formatErrorTime(err.at)}</p>
                      )}
                    </div>
                    <p className="text-[10px] mt-0.5 break-words" style={{ color: MUTED }}>{err.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function OverallDot({ status }: { status: HealthStatus }) {
  const color = statusColor(status);
  const pulse = status === "error" || status === "warning";
  return (
    <span
      className={`w-2 h-2 rounded-full flex-shrink-0${pulse ? " animate-pulse" : ""}`}
      style={{ backgroundColor: color }}
    />
  );
}

export default function SystemHealthPanel() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const h = await getSystemHealth(force);
      setHealth(h);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh(false);
    const timer = setInterval(() => refresh(false), REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const overall: HealthStatus = health ? getOverallStatus(health) : loading ? "checking" : "unknown";
  const color = statusColor(overall);

  const bg = statusBg(overall);
  const border = statusBorder(overall);

  const overallLabel = overall === "ok"
    ? "All Systems"
    : overall === "warning"
    ? "Warning"
    : overall === "error"
    ? "Degraded"
    : overall === "checking"
    ? "Checking"
    : "Health";

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => {
          setOpen((v) => !v);
          if (!health) refresh(true);
        }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all hover:opacity-90"
        style={{ backgroundColor: bg, border: `1px solid ${border}`, color }}
      >
        {loading && !health ? (
          <RefreshCw size={11} className="animate-spin" style={{ color }} />
        ) : (
          <StatusIcon status={overall} size={11} />
        )}
        <span className="text-[10px] font-bold tracking-widest uppercase">{overallLabel}</span>
        <OverallDot status={overall} />
        {open ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
      </button>

      {open && health && (
        <HealthPanel
          health={health}
          loading={loading}
          onRefresh={() => refresh(true)}
        />
      )}
    </div>
  );
}
