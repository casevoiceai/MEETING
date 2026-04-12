import { useState, useEffect, useCallback } from "react";
import { Shield, Check, X, Clock, ChevronDown, AlertTriangle, RefreshCw, Lock } from "lucide-react";
import {
  listPendingApprovals, listApprovalLog, approveAction, rejectAction, proposeAction,
  ACTION_TYPE_LABELS, ACTION_TYPE_RISK, RISK_COLORS,
  type ApprovalEntry, type ApprovalStatus, type ActionType,
} from "../lib/approval";

const GOLD = "#C9A84C";
const NAVY = "#0D1B2E";
const CARD = "#0A1628";
const BORDER = "#1B2A4A";
const MUTED = "#8A9BB5";
const DIM = "#3A4F6A";
const TEXT = "#D0DFEE";

const STATUS_COLORS: Record<ApprovalStatus, { color: string; bg: string; label: string }> = {
  draft:            { color: DIM,       bg: "rgba(58,79,106,0.2)",     label: "Draft" },
  suggested:        { color: MUTED,     bg: "rgba(138,155,181,0.12)",  label: "Suggested" },
  pending_approval: { color: "#F59E0B", bg: "rgba(245,158,11,0.12)",  label: "Pending Approval" },
  approved:         { color: "#4ADE80", bg: "rgba(74,222,128,0.1)",   label: "Approved" },
  rejected:         { color: "#F87171", bg: "rgba(248,113,113,0.1)",  label: "Rejected" },
  completed:        { color: "#60A5FA", bg: "rgba(96,165,250,0.1)",   label: "Completed" },
};

function StatusBadge({ status }: { status: ApprovalStatus }) {
  const s = STATUS_COLORS[status];
  return (
    <span className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full" style={{ color: s.color, backgroundColor: s.bg }}>
      {s.label}
    </span>
  );
}

function RiskBadge({ level }: { level: "high" | "medium" | "low" }) {
  const r = RISK_COLORS[level];
  return (
    <span className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full flex items-center gap-1" style={{ color: r.color, backgroundColor: r.bg, border: `1px solid ${r.border}` }}>
      {level === "high" && <AlertTriangle size={9} />}
      {level}
    </span>
  );
}

interface ApprovalCardProps {
  entry: ApprovalEntry;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onExecute?: (entry: ApprovalEntry) => void;
  showActions?: boolean;
}

export function ApprovalCard({ entry, onApprove, onReject, onExecute, showActions = true }: ApprovalCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [acting, setActing] = useState(false);
  const risk = ACTION_TYPE_RISK[entry.action_type] ?? "medium";
  const riskStyle = RISK_COLORS[risk];
  const isPending = entry.status === "pending_approval";

  async function handleApprove() {
    setActing(true);
    await approveAction(entry.id);
    onApprove(entry.id);
    if (onExecute) onExecute(entry);
    setActing(false);
  }

  async function handleReject() {
    if (!rejecting) { setRejecting(true); return; }
    setActing(true);
    await rejectAction(entry.id, rejectReason || "Rejected by user");
    onReject(entry.id);
    setActing(false);
    setRejecting(false);
  }

  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{
        backgroundColor: CARD,
        border: isPending
          ? `1px solid ${riskStyle.border}`
          : `1px solid ${BORDER}`,
      }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start gap-3 px-4 py-3.5 hover:opacity-90 transition-opacity text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded" style={{ color: MUTED, backgroundColor: "rgba(255,255,255,0.04)" }}>
              {ACTION_TYPE_LABELS[entry.action_type] ?? entry.action_type}
            </span>
            <StatusBadge status={entry.status} />
            <RiskBadge level={risk} />
          </div>
          <p className="text-sm font-semibold leading-snug" style={{ color: TEXT }}>{entry.title}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[10px]" style={{ color: DIM }}>
              Proposed by <span style={{ color: MUTED }}>{entry.proposed_by}</span>
            </span>
            <span className="text-[10px]" style={{ color: DIM }}>
              {new Date(entry.created_at).toLocaleString()}
            </span>
          </div>
        </div>
        <ChevronDown
          size={13}
          style={{ color: DIM, flexShrink: 0, transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}
        />
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t" style={{ borderColor: BORDER }}>
          {entry.description && (
            <p className="text-sm leading-relaxed mt-3" style={{ color: MUTED }}>{entry.description}</p>
          )}

          {Object.keys(entry.payload ?? {}).length > 0 && (
            <div className="mt-3 px-3 py-2.5 rounded-lg" style={{ backgroundColor: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}` }}>
              <p className="text-[9px] tracking-widest uppercase font-bold mb-2" style={{ color: DIM }}>Action Data</p>
              {Object.entries(entry.payload).map(([k, v]) => (
                <div key={k} className="flex gap-2 text-[11px] mb-1">
                  <span className="font-semibold" style={{ color: MUTED, minWidth: "100px" }}>{k}:</span>
                  <span className="truncate" style={{ color: TEXT }}>{String(v).slice(0, 120)}</span>
                </div>
              ))}
            </div>
          )}

          {entry.rejection_reason && entry.status === "rejected" && (
            <div className="mt-3 px-3 py-2 rounded-lg" style={{ backgroundColor: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)" }}>
              <p className="text-[10px] font-bold tracking-widest uppercase mb-1" style={{ color: "#F87171" }}>Rejection reason</p>
              <p className="text-sm" style={{ color: "#FCA5A5" }}>{entry.rejection_reason}</p>
            </div>
          )}

          {entry.blocked_reason && (
            <div className="mt-3 px-3 py-2 rounded-lg" style={{ backgroundColor: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)" }}>
              <p className="text-[10px] font-bold tracking-widest uppercase mb-1" style={{ color: "#F87171" }}>Blocked</p>
              <p className="text-sm" style={{ color: "#FCA5A5" }}>{entry.blocked_reason}</p>
            </div>
          )}

          {showActions && isPending && (
            <div className="mt-3 flex flex-col gap-2">
              {rejecting ? (
                <div className="flex flex-col gap-2">
                  <input
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Reason for rejection (optional)"
                    className="px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ backgroundColor: NAVY, color: TEXT, border: `1px solid rgba(248,113,113,0.4)` }}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleReject}
                      disabled={acting}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold tracking-wider uppercase transition-all hover:opacity-90 disabled:opacity-40"
                      style={{ backgroundColor: "rgba(248,113,113,0.12)", color: "#F87171", border: "1px solid rgba(248,113,113,0.3)" }}
                    >
                      <X size={12} /> Confirm Reject
                    </button>
                    <button
                      onClick={() => { setRejecting(false); setRejectReason(""); }}
                      className="px-4 py-2.5 rounded-lg text-sm font-bold tracking-wider uppercase transition-all hover:opacity-80"
                      style={{ backgroundColor: "#1B2A4A", color: MUTED, border: `1px solid ${BORDER}` }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handleApprove}
                    disabled={acting}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold tracking-wider uppercase transition-all hover:opacity-90 disabled:opacity-40"
                    style={{ backgroundColor: "rgba(74,222,128,0.12)", color: "#4ADE80", border: "1px solid rgba(74,222,128,0.3)" }}
                  >
                    <Check size={12} /> Approve
                  </button>
                  <button
                    onClick={() => setRejecting(true)}
                    disabled={acting}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold tracking-wider uppercase transition-all hover:opacity-90 disabled:opacity-40"
                    style={{ backgroundColor: "rgba(248,113,113,0.08)", color: "#F87171", border: "1px solid rgba(248,113,113,0.2)" }}
                  >
                    <X size={12} /> Reject
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ApprovalQueueProps {
  onExecute?: (entry: ApprovalEntry) => void;
  showLog?: boolean;
  maxHeight?: string;
  onPendingCountChange?: (count: number) => void;
}

export default function ApprovalQueue({ onExecute, showLog = true, maxHeight, onPendingCountChange }: ApprovalQueueProps) {
  const [pending, setPending] = useState<ApprovalEntry[]>([]);
  const [log, setLog] = useState<ApprovalEntry[]>([]);
  const [tab, setTab] = useState<"pending" | "log">("pending");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [p, l] = await Promise.all([listPendingApprovals(), listApprovalLog(40)]);
    setPending(p);
    setLog(l);
    onPendingCountChange?.(p.length);
    setLoading(false);
  }, [onPendingCountChange]);

  useEffect(() => { load(); }, [load]);

  function handleApprove(id: string) {
    setPending((prev) => prev.filter((e) => e.id !== id));
    onPendingCountChange?.(pending.length - 1);
    setLog((prev) => prev.map((e) => e.id === id ? { ...e, status: "approved" as ApprovalStatus } : e));
  }

  function handleReject(id: string) {
    setPending((prev) => prev.filter((e) => e.id !== id));
    onPendingCountChange?.(pending.length - 1);
    setLog((prev) => prev.map((e) => e.id === id ? { ...e, status: "rejected" as ApprovalStatus } : e));
  }

  return (
    <div className="flex flex-col" style={{ maxHeight }}>
      <div className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0" style={{ borderColor: BORDER }}>
        <Shield size={14} style={{ color: GOLD }} />
        <span className="text-xs font-bold tracking-widest uppercase" style={{ color: GOLD }}>Approval Queue</span>
        {pending.length > 0 && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(245,158,11,0.2)", color: "#F59E0B" }}>
            {pending.length} pending
          </span>
        )}
        <button onClick={load} className="ml-auto p-1 rounded opacity-50 hover:opacity-80 transition-opacity" title="Refresh">
          <RefreshCw size={11} style={{ color: MUTED }} />
        </button>
      </div>

      {showLog && (
        <div className="flex border-b flex-shrink-0" style={{ borderColor: BORDER }}>
          <button
            onClick={() => setTab("pending")}
            className="flex-1 py-2.5 text-xs font-bold tracking-widest uppercase transition-all"
            style={{ color: tab === "pending" ? GOLD : DIM, borderBottom: tab === "pending" ? `2px solid ${GOLD}` : "2px solid transparent" }}
          >
            Pending ({pending.length})
          </button>
          <button
            onClick={() => setTab("log")}
            className="flex-1 py-2.5 text-xs font-bold tracking-widest uppercase transition-all"
            style={{ color: tab === "log" ? GOLD : DIM, borderBottom: tab === "log" ? `2px solid ${GOLD}` : "2px solid transparent" }}
          >
            Audit Log
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <RefreshCw size={16} className="animate-spin" style={{ color: DIM }} />
          </div>
        )}

        {!loading && tab === "pending" && (
          <div className="p-4 flex flex-col gap-3">
            {pending.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(74,222,128,0.08)" }}>
                  <Check size={18} style={{ color: "#4ADE80", opacity: 0.6 }} />
                </div>
                <p className="text-sm font-semibold" style={{ color: MUTED }}>No pending approvals</p>
                <p className="text-[11px]" style={{ color: DIM }}>All clear. The team hasn't proposed any actions yet.</p>
              </div>
            ) : (
              pending.map((entry) => (
                <ApprovalCard
                  key={entry.id}
                  entry={entry}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onExecute={onExecute}
                />
              ))
            )}
          </div>
        )}

        {!loading && tab === "log" && (
          <div className="p-4 flex flex-col gap-2">
            {log.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: DIM }}>No history yet.</p>
            ) : (
              log.map((entry) => (
                <ApprovalCard
                  key={entry.id}
                  entry={entry}
                  onApprove={() => {}}
                  onReject={() => {}}
                  showActions={entry.status === "pending_approval"}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface ApprovalGateProps {
  title: string;
  description: string;
  actionType: ActionType;
  proposedBy?: string;
  payload?: Record<string, unknown>;
  context?: Record<string, unknown>;
  sessionId?: string;
  children: React.ReactNode;
  onQueued?: (entry: ApprovalEntry) => void;
  buttonLabel?: string;
  buttonStyle?: React.CSSProperties;
  className?: string;
}

export function ApprovalGate({
  title, description, actionType, proposedBy = "SYSTEM",
  payload, context, sessionId, children, onQueued,
  buttonLabel = "Request Approval", buttonStyle, className,
}: ApprovalGateProps) {
  const [queued, setQueued] = useState(false);
  const [entry, setEntry] = useState<ApprovalEntry | null>(null);

  async function handleQueue() {
    const e = await proposeAction({ action_type: actionType, title, description, proposed_by: proposedBy, payload, context, session_id: sessionId });
    setEntry(e);
    setQueued(true);
    onQueued?.(e);
  }

  if (queued && entry) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
        <Clock size={12} style={{ color: "#F59E0B" }} />
        <span className="text-[11px] font-semibold" style={{ color: "#F59E0B" }}>Queued for approval</span>
      </div>
    );
  }

  return (
    <button onClick={handleQueue} className={className} style={buttonStyle}>
      {children}
    </button>
  );
}

export function ApprovalBlockedBanner() {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)" }}>
      <Lock size={12} style={{ color: "#F59E0B" }} />
      <p className="text-[11px]" style={{ color: "#F59E0B" }}>
        <span className="font-bold">Approval required before execution.</span> Action queued for your review.
      </p>
    </div>
  );
}
