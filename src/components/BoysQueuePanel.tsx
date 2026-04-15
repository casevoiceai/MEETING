import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Check, CornerDownLeft, Clock, ChevronDown, Play } from "lucide-react";
import {
  listPendingQueueItems,
  listAllQueueItems,
  approveQueueItem,
  kickBackQueueItem,
  type BoysQueueItem,
  type QueueStatus,
} from "../lib/boysQueue";
import { supabase } from "../lib/supabase";

const GOLD = "#C9A84C";
const NAVY = "#0D1B2E";
const CARD = "#0A1628";
const BORDER = "#1B2A4A";
const MUTED = "#8A9BB5";
const DIM = "#3A4F6A";
const TEXT = "#D0DFEE";

const STATUS_STYLES: Record<QueueStatus, { color: string; bg: string; label: string }> = {
  pending:     { color: "#F59E0B", bg: "rgba(245,158,11,0.12)",  label: "Pending" },
  approved:    { color: "#4ADE80", bg: "rgba(74,222,128,0.1)",   label: "Approved" },
  kicked_back: { color: "#F87171", bg: "rgba(248,113,113,0.1)",  label: "Kicked Back" },
};

function StatusBadge({ status }: { status: QueueStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span
      className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full"
      style={{ color: s.color, backgroundColor: s.bg }}
    >
      {s.label}
    </span>
  );
}

interface QueueCardProps {
  item: BoysQueueItem;
  onApprove: (id: string) => void;
  onKickBack: (id: string, note: string) => void;
}

function QueueCard({ item, onApprove, onKickBack }: QueueCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [kicking, setKicking] = useState(false);
  const [note, setNote] = useState("");
  const [acting, setActing] = useState(false);
  const isPending = item.status === "pending";

  async function handleApprove() {
    setActing(true);
    await approveQueueItem(item.id);
    onApprove(item.id);
    setActing(false);
  }

  async function handleKickBack() {
    if (!kicking) { setKicking(true); return; }
    setActing(true);
    await kickBackQueueItem(item.id, note || "Kicked back by Daniel");
    onKickBack(item.id, note);
    setActing(false);
    setKicking(false);
  }

  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{
        backgroundColor: CARD,
        border: isPending ? "1px solid rgba(245,158,11,0.3)" : `1px solid ${BORDER}`,
      }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start gap-3 px-4 py-3.5 hover:opacity-90 transition-opacity text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded"
              style={{ color: GOLD, backgroundColor: "rgba(201,168,76,0.08)" }}
            >
              {item.boy_name}
            </span>
            <span
              className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded"
              style={{ color: MUTED, backgroundColor: "rgba(255,255,255,0.04)" }}
            >
              {item.item_type}
            </span>
            <StatusBadge status={item.status} />
          </div>
          <p className="text-sm font-semibold leading-snug line-clamp-2" style={{ color: TEXT }}>
            {item.content.slice(0, 120)}{item.content.length > 120 ? "..." : ""}
          </p>
          <span className="text-[10px]" style={{ color: DIM }}>
            {new Date(item.created_at).toLocaleString()}
          </span>
        </div>
        <ChevronDown
          size={13}
          style={{
            color: DIM,
            flexShrink: 0,
            transform: expanded ? "rotate(180deg)" : "none",
            transition: "transform 0.15s",
          }}
        />
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t" style={{ borderColor: BORDER }}>
          <p className="text-sm leading-relaxed mt-3 whitespace-pre-wrap" style={{ color: MUTED }}>
            {item.content}
          </p>

          {item.kickback_note && item.status === "kicked_back" && (
            <div
              className="mt-3 px-3 py-2 rounded-lg"
              style={{ backgroundColor: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)" }}
            >
              <p className="text-[10px] font-bold tracking-widest uppercase mb-1" style={{ color: "#F87171" }}>
                Kickback note
              </p>
              <p className="text-sm" style={{ color: "#FCA5A5" }}>{item.kickback_note}</p>
            </div>
          )}

          {isPending && (
            <div className="mt-3 flex flex-col gap-2">
              {kicking ? (
                <div className="flex flex-col gap-2">
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Reason for kickback (optional)"
                    className="px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ backgroundColor: NAVY, color: TEXT, border: "1px solid rgba(248,113,113,0.4)" }}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleKickBack}
                      disabled={acting}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold tracking-wider uppercase transition-all hover:opacity-90 disabled:opacity-40"
                      style={{ backgroundColor: "rgba(248,113,113,0.12)", color: "#F87171", border: "1px solid rgba(248,113,113,0.3)" }}
                    >
                      <CornerDownLeft size={12} /> Confirm Kick Back
                    </button>
                    <button
                      onClick={() => { setKicking(false); setNote(""); }}
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
                    onClick={() => setKicking(true)}
                    disabled={acting}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold tracking-wider uppercase transition-all hover:opacity-90 disabled:opacity-40"
                    style={{ backgroundColor: "rgba(248,113,113,0.08)", color: "#F87171", border: "1px solid rgba(248,113,113,0.2)" }}
                  >
                    <CornerDownLeft size={12} /> Kick Back
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

interface BoysQueuePanelProps {
  onPendingCountChange?: (count: number) => void;
}

export default function BoysQueuePanel({ onPendingCountChange }: BoysQueuePanelProps) {
  const [pending, setPending] = useState<BoysQueueItem[]>([]);
  const [history, setHistory] = useState<BoysQueueItem[]>([]);
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const [loading, setLoading] = useState(true);
  const [runningScout, setRunningScout] = useState(false);
  const [scoutMessage, setScoutMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [p, all] = await Promise.all([listPendingQueueItems(), listAllQueueItems(50)]);
    setPending(p);
    setHistory(all.filter((i) => i.status !== "pending"));
    onPendingCountChange?.(p.length);
    setLoading(false);
  }, [onPendingCountChange]);

  useEffect(() => { load(); }, [load]);

  async function handleRunScout() {
    setRunningScout(true);
    setScoutMessage(null);
    try {
      const { data, error } = await supabase.functions.invoke("run-scout", {
        body: { context: "Current sprint: build the Team Queue autonomous loop. CASEVOICE go-to-market targeting Carbondale PD as first pilot." },
      });
      if (error) {
        setScoutMessage("Scout failed: " + error.message);
      } else if (data?.success) {
        setScoutMessage("Scout dropped a new item in the queue.");
        await load();
        setTab("pending");
      } else {
        setScoutMessage("Scout returned no item: " + (data?.error ?? "unknown error"));
      }
    } catch (err) {
      setScoutMessage("Scout failed: " + (err instanceof Error ? err.message : "unknown error"));
    } finally {
      setRunningScout(false);
      setTimeout(() => setScoutMessage(null), 5000);
    }
  }

  function handleApprove(id: string) {
    const item = pending.find((i) => i.id === id);
    setPending((prev) => prev.filter((i) => i.id !== id));
    onPendingCountChange?.(pending.length - 1);
    if (item) setHistory((prev) => [{ ...item, status: "approved" }, ...prev]);
  }

  function handleKickBack(id: string, note: string) {
    const item = pending.find((i) => i.id === id);
    setPending((prev) => prev.filter((i) => i.id !== id));
    onPendingCountChange?.(pending.length - 1);
    if (item) setHistory((prev) => [{ ...item, status: "kicked_back", kickback_note: note }, ...prev]);
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: "#08111F" }}>
      <div
        className="flex items-center gap-3 px-5 py-4 border-b flex-shrink-0"
        style={{ borderColor: BORDER }}
      >
        <span className="text-xs font-bold tracking-widest uppercase" style={{ color: GOLD }}>
          Team Queue
        </span>
        {pending.length > 0 && (
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: "rgba(245,158,11,0.2)", color: "#F59E0B" }}
          >
            {pending.length} pending
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleRunScout}
            disabled={runningScout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all hover:opacity-90 disabled:opacity-40"
            style={{
              backgroundColor: "rgba(201,168,76,0.08)",
              color: GOLD,
              border: "1px solid rgba(201,168,76,0.25)",
            }}
          >
            {runningScout
              ? <><RefreshCw size={10} className="animate-spin" /> Running...</>
              : <><Play size={10} /> Run Scout</>
            }
          </button>
          <button
            onClick={load}
            className="p-1 rounded opacity-50 hover:opacity-80 transition-opacity"
            title="Refresh"
          >
            <RefreshCw size={11} style={{ color: MUTED }} />
          </button>
        </div>
      </div>

      {scoutMessage && (
        <div
          className="px-5 py-2 text-[11px] font-semibold border-b"
          style={{
            color: scoutMessage.startsWith("Scout dropped") ? "#4ADE80" : "#F87171",
            backgroundColor: scoutMessage.startsWith("Scout dropped")
              ? "rgba(74,222,128,0.06)"
              : "rgba(248,113,113,0.06)",
            borderColor: BORDER,
          }}
        >
          {scoutMessage}
        </div>
      )}

      <div className="flex border-b flex-shrink-0" style={{ borderColor: BORDER }}>
        <button
          onClick={() => setTab("pending")}
          className="flex-1 py-2.5 text-xs font-bold tracking-widest uppercase transition-all"
          style={{
            color: tab === "pending" ? GOLD : DIM,
            borderBottom: tab === "pending" ? `2px solid ${GOLD}` : "2px solid transparent",
          }}
        >
          Pending ({pending.length})
        </button>
        <button
          onClick={() => setTab("history")}
          className="flex-1 py-2.5 text-xs font-bold tracking-widest uppercase transition-all"
          style={{
            color: tab === "history" ? GOLD : DIM,
            borderBottom: tab === "history" ? `2px solid ${GOLD}` : "2px solid transparent",
          }}
        >
          History
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-10">
            <RefreshCw size={16} className="animate-spin" style={{ color: DIM }} />
          </div>
        )}

        {!loading && tab === "pending" && (
          <div className="p-4 flex flex-col gap-3">
            {pending.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: "rgba(74,222,128,0.08)" }}
                >
                  <Clock size={18} style={{ color: "#4ADE80", opacity: 0.6 }} />
                </div>
                <p className="text-sm font-semibold" style={{ color: MUTED }}>Queue is clear</p>
                <p className="text-[11px]" style={{ color: DIM }}>Hit Run Scout to have her check in.</p>
              </div>
            ) : (
              pending.map((item) => (
                <QueueCard
                  key={item.id}
                  item={item}
                  onApprove={handleApprove}
                  onKickBack={handleKickBack}
                />
              ))
            )}
          </div>
        )}

        {!loading && tab === "history" && (
          <div className="p-4 flex flex-col gap-3">
            {history.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: DIM }}>No history yet.</p>
            ) : (
              history.map((item) => (
                <QueueCard
                  key={item.id}
                  item={item}
                  onApprove={() => {}}
                  onKickBack={() => {}}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
