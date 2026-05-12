import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Check, CornerDownLeft, Clock, ChevronDown, Play, Users } from "lucide-react";
import {
  listPendingQueueItems,
  listAllQueueItems,
  getSafetySummary,
  getRiskMeaning,
  getFireMeaning,
  getWorkflowMeaning,
  getVerificationMeaning,
  getRollbackMeaning,
  getQueueRoute,
  getQueueRouteMeaning,
  type BoysQueueItem,
  type QueueStatus,
} from "../lib/boysQueue";
import { TEAM_MEMBERS } from "../lib/teamMembers";
import { createTeamMemberDraft } from "../lib/teamMemberDraftGenerator";
import { supabase } from '../lib/supabase';
type ReadOnlyLiveQueueRow = {
  id: string;
  item_type: string | null;
  boy_name: string | null;
  content: string | null;
  status: string | null;
  risk_level: string | null;
  fire_level: string | null;
  workflow_status: string | null;
  rollback_path: string | null;
  verification_plan: string | null;
  created_at: string | null;
};


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
    <span className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full"
      style={{ color: s.color, backgroundColor: s.bg }}>
      {s.label}
    </span>
  );
}

interface QueueCardProps {
  item: BoysQueueItem;
  onApprove: (id: string) => void;
  onKickBack: (id: string, note: string) => void;
}

function getApplyGateChecklist(item: BoysQueueItem) {
  return [
    `OK Risk: ${item.risk_level || "missing"}`,
    `OK Fire: ${item.fire_level || "missing"}`,
    `OK Workflow: ${item.workflow_status || "missing"}`,
    `OK Rollback: ${item.rollback_path ? "present" : "missing"}`,
    `OK Verify: ${item.verification_plan ? "present" : "missing"}`,
  ];
}


const CASEVOICE_QUEUE_SIGNAL_CLEANUP_V1 = true;

type QueueSignalBucket = "actionable" | "needs_context";

function getQueueSignalBucket(item: BoysQueueItem): QueueSignalBucket {
  const rawContent = String(item?.content ?? "").toLowerCase();
  const rawType = String(item?.item_type ?? "").toLowerCase();
  const rawWorkflow = String(item?.workflow_status ?? "").toLowerCase();

  const hasIssue = rawContent.includes("issue:");
  const hasFix = rawContent.includes("recommended fix:");
  const hasFounderQuestion = rawContent.includes("questions for founder:");
  const hasFireLevel = rawContent.includes("fire level:");
  const hasMeaningGateShape = hasIssue && hasFix && hasFounderQuestion && hasFireLevel;

  const looksLikePlaceholder =
    rawContent.includes("no issue provided") ||
    rawContent.includes("no evidence provided") ||
    rawContent.includes("none fire level") ||
    rawContent.includes("draft only") ||
    rawContent.includes("test") ||
    rawWorkflow.includes("draft only") ||
    rawType.includes("accessibility_flag");

  return hasMeaningGateShape && !looksLikePlaceholder ? "actionable" : "needs_context";
}

function getQueueSignalLabel(item: BoysQueueItem): string {
  return getQueueSignalBucket(item) === "actionable"
    ? "Actionable"
    : "Needs Founder Context";
}

/* QUEUE STALE BACKLOG UI PATCH HELPERS START */
const QUEUE_STALE_BACKLOG_DAYS = 30;

function getQueueItemCreatedTime(item: BoysQueueItem): number | null {
  const createdAt = item.created_at;
  if (!createdAt) return null;
  const time = new Date(createdAt).getTime();
  return Number.isFinite(time) ? time : null;
}

function getQueueItemAgeDays(item: BoysQueueItem): number | null {
  const createdTime = getQueueItemCreatedTime(item);
  if (createdTime === null) return null;
  return Math.max(0, Math.floor((Date.now() - createdTime) / 86400000));
}

function getQueueItemAgeLabel(item: BoysQueueItem): string {
  const ageDays = getQueueItemAgeDays(item);
  if (ageDays === null) return "Age unknown";
  if (ageDays === 1) return "1 day old";
  return `${ageDays} days old`;
}

function getQueueIssueText(item: BoysQueueItem): string {
  return String(item.content ?? "").trim();
}

function getQueueIssueSnippet(item: BoysQueueItem): string {
  const text = getQueueIssueText(item).replace(/\s+/g, " ").trim() || "No issue provided";
  return text.length > 140 ? `${text.slice(0, 140)}...` : text;
}

function getQueueStaleBacklogReason(item: BoysQueueItem): string {
  const ageDays = getQueueItemAgeDays(item);
  const content = getQueueIssueText(item).toLowerCase();
  const boyName = String(item.boy_name ?? "").toLowerCase();
  const itemType = String(item.item_type ?? "").toLowerCase();
  const workflow = String(item.workflow_status ?? "").toLowerCase();

  const placeholderPattern = /\b(test request|testing queue|test artifact|placeholder|sample|dummy|ignore|dev only)\b/i;
  const hasPlaceholderText = placeholderPattern.test(content) || placeholderPattern.test(itemType);
  const hasNoIssue = content === "" || content === "no issue provided" || content === "none";
  const hasDraftMarker = /\b(draft only|draft|incomplete)\b/i.test(content) || /\b(draft only|draft|incomplete)\b/i.test(workflow);
  const hasKnownBuildName = /\b(scout|sam|max|mailman|tech)\b/i.test(boyName);
  const isOld = ageDays !== null && ageDays > QUEUE_STALE_BACKLOG_DAYS;
  const hasMissingRequiredContext = !item.created_at || !item.boy_name || hasNoIssue;
  const needsFounderContextAgedOut =
    getQueueSignalBucket(item) === "needs_context" &&
    ageDays !== null &&
    ageDays > QUEUE_STALE_BACKLOG_DAYS;

  if (isOld) return "Older than 30 days";
  if (hasPlaceholderText) return "Test placeholder language";
  if (hasNoIssue) return "No issue provided";
  if (hasDraftMarker) return "Draft or incomplete marker";
  if (hasKnownBuildName && (hasPlaceholderText || hasNoIssue || needsFounderContextAgedOut)) return "Known build artifact pattern";
  if (hasMissingRequiredContext) return "Missing required context";
  if (needsFounderContextAgedOut) return "Needs founder context, stale";
  return "Test backlog";
}

function isQueueStaleBacklogItem(item: BoysQueueItem): boolean {
  const ageDays = getQueueItemAgeDays(item);
  const content = getQueueIssueText(item).toLowerCase();
  const boyName = String(item.boy_name ?? "").toLowerCase();
  const itemType = String(item.item_type ?? "").toLowerCase();
  const workflow = String(item.workflow_status ?? "").toLowerCase();

  const placeholderPattern = /\b(test request|testing queue|test artifact|placeholder|sample|dummy|ignore|dev only)\b/i;
  const hasPlaceholderText = placeholderPattern.test(content) || placeholderPattern.test(itemType);
  const hasNoIssue = content === "" || content === "no issue provided" || content === "none";
  const hasDraftMarker = /\b(draft only|draft|incomplete)\b/i.test(content) || /\b(draft only|draft|incomplete)\b/i.test(workflow);
  const hasKnownBuildName = /\b(scout|sam|max|mailman|tech)\b/i.test(boyName);
  const isOld = ageDays !== null && ageDays > QUEUE_STALE_BACKLOG_DAYS;
  const hasMissingRequiredContext = !item.created_at || !item.boy_name || hasNoIssue;
  const needsFounderContextAgedOut =
    getQueueSignalBucket(item) === "needs_context" &&
    ageDays !== null &&
    ageDays > QUEUE_STALE_BACKLOG_DAYS;

  return (
    isOld ||
    hasPlaceholderText ||
    hasNoIssue ||
    hasDraftMarker ||
    hasMissingRequiredContext ||
    needsFounderContextAgedOut ||
    (hasKnownBuildName && (isOld || hasPlaceholderText || hasNoIssue || needsFounderContextAgedOut))
  );
}

function StaleBacklogQueueCard({ item }: { item: BoysQueueItem }) {
  return (
    <div
      className="rounded-xl p-3"
      style={{
        backgroundColor: "rgba(2,6,23,0.35)",
        border: "1px solid rgba(148,163,184,0.14)",
        opacity: 0.78,
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold" style={{ color: MUTED }}>
          {item.boy_name || "Unknown Team Member"}
        </div>
        <span
          className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full"
          style={{ color: "#F59E0B", backgroundColor: "rgba(245,158,11,0.12)" }}
        >
          Test backlog
        </span>
      </div>

      <p className="mt-2 text-xs leading-5" style={{ color: MUTED }}>
        {getQueueIssueSnippet(item)}
      </p>

      <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold tracking-wider uppercase">
        <span className="rounded-full px-2 py-0.5" style={{ color: DIM, backgroundColor: "rgba(255,255,255,0.04)" }}>
          {getQueueItemAgeLabel(item)}
        </span>
        <span className="rounded-full px-2 py-0.5" style={{ color: "#F59E0B", backgroundColor: "rgba(245,158,11,0.08)" }}>
          {getQueueStaleBacklogReason(item)}
        </span>
      </div>
    </div>
  );
}
/* QUEUE STALE BACKLOG UI PATCH HELPERS END */


function QueueCard({ item, onApprove, onKickBack }: QueueCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [kicking, setKicking] = useState(false);
  const [note, setNote] = useState("");
  const [acting, setActing] = useState(false);
  const isPending = item.status === "pending";
  const queueSignalBucket = getQueueSignalBucket(item);
  const queueSignalLabel = getQueueSignalLabel(item);
  const applyGateReady = Boolean(
    item.risk_level &&
    item.fire_level &&
    item.workflow_status &&
    item.rollback_path &&
    item.verification_plan
  );
  const applyGateChecklist = getApplyGateChecklist(item);

  function handleLockedApprovalPreview() { setActing(false); }

  function handleLockedKickbackPreview() { setKicking(false); setNote(""); setActing(false); }

  return (
    <div className="rounded-xl overflow-hidden transition-all"
      style={{ backgroundColor: CARD, border: isPending ? "1px solid rgba(245,158,11,0.3)" : `1px solid ${BORDER}` }}>
      <button onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start gap-3 px-4 py-3.5 hover:opacity-90 transition-opacity text-left">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded"
              style={{ color: GOLD, backgroundColor: "rgba(201,168,76,0.08)" }}>
              {item.boy_name}
            </span>
            <span className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded"
              style={{ color: MUTED, backgroundColor: "rgba(255,255,255,0.04)" }}>
              {item.item_type}
            </span>
            <StatusBadge status={item.status} />
                <span
                  data-casevoice-queue-signal-cleanup-v1={CASEVOICE_QUEUE_SIGNAL_CLEANUP_V1 ? "true" : "false"}
                  className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full"
                  style={{
                    color: queueSignalBucket === "actionable" ? "#4ADE80" : "#F59E0B",
                    backgroundColor: queueSignalBucket === "actionable" ? "rgba(74,222,128,0.1)" : "rgba(245,158,11,0.12)",
                  }}
                >
                  {queueSignalLabel}
                </span>
          </div>
          <p className="text-sm font-semibold leading-snug line-clamp-2" style={{ color: TEXT }}>
            {item.content.slice(0, 120)}{item.content.length > 120 ? "..." : ""}
          </p>
          <span className="text-[10px]" style={{ color: DIM }}>
            {new Date(item.created_at).toLocaleString()}
          </span>
        </div>
        <ChevronDown size={13} style={{ color: DIM, flexShrink: 0, transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t" style={{ borderColor: BORDER }}>
          <p className="text-sm leading-relaxed mt-3 whitespace-pre-wrap" style={{ color: MUTED }}>{item.content}</p>

          {(item.risk_level || item.fire_level || item.workflow_status || item.rollback_path || item.verification_plan) && (
            <div className="mt-3 rounded-xl p-3" style={{ backgroundColor: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.18)" }}>
              <p className="text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: GOLD }}>Workflow Safety</p>
              {item.risk_level && <p className="text-xs" style={{ color: MUTED }}>Risk: {item.risk_level}</p>}
              {item.fire_level && <p className="text-xs" style={{ color: MUTED }}>Fire: {item.fire_level}</p>}
              {item.workflow_status && <p className="text-xs" style={{ color: MUTED }}>Workflow: {item.workflow_status}</p>}
              {item.rollback_path && <p className="text-xs" style={{ color: MUTED }}>Rollback: {item.rollback_path}</p>}
              {item.verification_plan && <p className="text-xs" style={{ color: MUTED }}>Verify: {item.verification_plan}</p>}

              <div className="mt-3 rounded-lg px-3 py-2" style={{ backgroundColor: applyGateReady ? "rgba(74,222,128,0.08)" : "rgba(248,113,113,0.08)", border: applyGateReady ? "1px solid rgba(74,222,128,0.22)" : "1px solid rgba(248,113,113,0.22)" }}>
                <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: applyGateReady ? "#4ADE80" : "#F87171" }}>
                  Apply Gate: {applyGateReady ? "READY" : "NOT READY"}
                </p>
                <p className="text-xs mt-1" style={{ color: MUTED }}>
                  {applyGateReady ? "All safety fields are present. Approval still does not execute anything." : "Missing required safety fields (risk, fire, workflow, rollback, verification). Complete all fields before approval."}
                </p>
                <p className="text-xs mt-2" style={{ color: MUTED }}>
                  Meaning:
  <span className="block mt-1">Risk: {getRiskMeaning(item.risk_level)}</span>
  <span className="block">Urgency: {getFireMeaning(item.fire_level)}</span>
  <span className="block">Workflow: {getWorkflowMeaning(item.workflow_status)}</span>
  <span className="block">Verify: {getVerificationMeaning(item.verification_plan)}</span>
  <span className="block">Rollback: {getRollbackMeaning(item.rollback_path)}</span>
  <span className="block mt-1">
    Route: {getQueueRoute(item)} ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â {getQueueRouteMeaning(getQueueRoute(item))}
  </span>
                </p>
                <div className="mt-2">
                  <p className="text-[10px] font-bold tracking-widest uppercase mb-1" style={{ color: GOLD }}>Apply Gate Checklist</p>
                  <div className="mt-1">
  {applyGateChecklist.map((line, idx) => (
    <p key={idx} className="text-xs" style={{ color: MUTED, margin: 0 }}>
      {line}
    </p>
  ))}
</div>
                </div>
              </div>
            </div>
          )}

          {item.kickback_note && item.status === "kicked_back" && (
            <div className="mt-3 px-3 py-2 rounded-lg"
              style={{ backgroundColor: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)" }}>
              <p className="text-[10px] font-bold tracking-widest uppercase mb-1" style={{ color: "#F87171" }}>Kickback note</p>
              <p className="text-sm" style={{ color: "#FCA5A5" }}>{item.kickback_note}</p>
            </div>
          )}

          {isPending && (
            <div className="mt-3 flex flex-col gap-2">
              {kicking ? (
                <div className="flex flex-col gap-2">
                  <input value={note} onChange={(e) => setNote(e.target.value)}
                    placeholder="Reason for kickback (optional)"
                    className="px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ backgroundColor: NAVY, color: TEXT, border: "1px solid rgba(248,113,113,0.4)" }}
                    autoFocus />
                  <div className="flex gap-2">
                    <button disabled={true}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold tracking-wider uppercase transition-all hover:opacity-90 disabled:opacity-40"
                      style={{ backgroundColor: "rgba(248,113,113,0.12)", color: "#F87171", border: "1px solid rgba(248,113,113,0.3)" }}>
                      <CornerDownLeft size={12} /> Locked
                    </button>
                    <button onClick={() => { setKicking(false); setNote(""); }}
                      className="px-4 py-2.5 rounded-lg text-sm font-bold tracking-wider uppercase transition-all hover:opacity-80"
                      style={{ backgroundColor: "#1B2A4A", color: MUTED, border: `1px solid ${BORDER}` }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  {!applyGateReady && (
                    <div className="rounded-lg px-3 py-2 text-xs font-bold tracking-wide uppercase"
                      style={{ backgroundColor: "rgba(248,113,113,0.08)", color: "#F87171", border: "1px solid rgba(248,113,113,0.22)" }}>
                      Approval blocked until Workflow Safety is complete.
                    </div>
                  )}
                  <button disabled={true}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold tracking-wider uppercase transition-all hover:opacity-90 disabled:opacity-40"
                    style={{ backgroundColor: "rgba(74,222,128,0.12)", color: "#4ADE80", border: "1px solid rgba(74,222,128,0.3)" }}>
                    <Check size={12} /> Locked
                  </button>
                  <button disabled={true}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold tracking-wider uppercase transition-all hover:opacity-90 disabled:opacity-40"
                    style={{ backgroundColor: "rgba(248,113,113,0.08)", color: "#F87171", border: "1px solid rgba(248,113,113,0.2)" }}>
                    <CornerDownLeft size={12} /> Locked
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
  // READ ONLY LIVE QUEUE DISPLAY V4
  const [readOnlyLiveQueueRows, setReadOnlyLiveQueueRows] = useState<ReadOnlyLiveQueueRow[]>([]);
  const [readOnlyLiveQueueLoading, setReadOnlyLiveQueueLoading] = useState(false);
  const [readOnlyLiveQueueError, setReadOnlyLiveQueueError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadReadOnlyLiveQueueRows() {
      setReadOnlyLiveQueueLoading(true);
      setReadOnlyLiveQueueError(null);

      const { data, error } = await supabase
        .from("boys_queue")
        .select("id,item_type,boy_name,content,status,risk_level,fire_level,workflow_status,rollback_path,verification_plan,created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(10);

      if (cancelled) return;

      if (error) {
        setReadOnlyLiveQueueRows([]);
        setReadOnlyLiveQueueError(error.message || "Read-only queue load failed.");
      } else {
        setReadOnlyLiveQueueRows((data || []) as ReadOnlyLiveQueueRow[]);
      }

      setReadOnlyLiveQueueLoading(false);
    }

    loadReadOnlyLiveQueueRows();

    return () => {
      cancelled = true;
    };
  }, []);

  const [pending, setPending] = useState<BoysQueueItem[]>([]);
  const staleBacklogQueueItems = pending.filter(isQueueStaleBacklogItem);
  const currentPending = pending.filter((item) => !isQueueStaleBacklogItem(item));
  const blockedCount = currentPending.filter(i => !i.risk_level || !i.fire_level || !i.workflow_status || !i.rollback_path || !i.verification_plan).length;
  const highRiskCount = currentPending.filter(i => (i.risk_level||'').toLowerCase()==='high' || (i.fire_level||'').toLowerCase()==='critical').length;
  const oldestItemAge = currentPending.length === 0 ? 'None' : Math.max(...currentPending.map(i => Math.floor((Date.now() - new Date(i.created_at).getTime()) / 3600000))) + 'h';
  const [history, setHistory] = useState<BoysQueueItem[]>([]);
  const [tab, setTab] = useState<"pending" | "history" | "run">("pending");
  const [loading, setLoading] = useState(true);
  const [runningMember, setRunningMember] = useState<string | null>(null);
  const [runMessage, setRunMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [draftPreview, setDraftPreview] = useState<ReturnType<typeof createTeamMemberDraft> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [p, all] = await Promise.all([listPendingQueueItems(), listAllQueueItems(50)]);
    const currentItems = p.filter((item) => !isQueueStaleBacklogItem(item));
    setPending(p);
    setHistory(all.filter((i) => i.status !== "pending"));
    onPendingCountChange?.(currentItems.length);
    setLoading(false);
  }, [onPendingCountChange]);

  useEffect(() => { load(); }, [load]);

  async function handleRunMember(member: string) {
    setRunningMember(member);
    setRunMessage("Read-only safe mode: Team Member execution is locked.");
    setRunningMember(null);
  }

  function handlePreviewDraft(member: string) {
    const result = createTeamMemberDraft({
      boy_name: member,
      issue: `Founder requested a read-only UI preview for ${member}. This must stay on screen only and must not create a queue item.`,
      evidence: "Local UI preview only. No database write, no queue row, no function call, and no external action.",
      requested_by: "Founder",
      risk_level: "medium",
      fire_level: "MEDIUM",
      workflow_status: "DRAFT ONLY",
      rollback_path: "Clear this preview. No source file, database table, Drive file, or queue state is changed.",
      verification_plan: "Confirm the preview appears in the Run Team tab and that the queue count does not change.",
    });

    setDraftPreview(result);
    setRunMessage({
      text: result.valid
        ? `Read-only draft preview created for ${member}. No queue item was written.`
        : `Read-only draft preview for ${member} needs review.`,
      ok: result.valid,
    });
  }

  function handleApprove(id: string) {
    const item = pending.find((i) => i.id === id);
    const nextPending = pending.filter((i) => i.id !== id);
    setPending(nextPending);
    onPendingCountChange?.(nextPending.filter((i) => !isQueueStaleBacklogItem(i)).length);
    if (item) setHistory((prev) => [{ ...item, status: "approved" }, ...prev]);
  }

  function handleKickBack(id: string, note: string) {
    const item = pending.find((i) => i.id === id);
    const nextPending = pending.filter((i) => i.id !== id);
    setPending(nextPending);
    onPendingCountChange?.(nextPending.filter((i) => !isQueueStaleBacklogItem(i)).length);
    if (item) setHistory((prev) => [{ ...item, status: "kicked_back", kickback_note: note }, ...prev]);
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: "#08111F" }}>
      <div className="flex items-center gap-3 px-5 py-4 border-b flex-shrink-0" style={{ borderColor: BORDER }}>
        <span className="text-xs font-bold tracking-widest uppercase" style={{ color: GOLD }}>Team Member Queue</span>
        {currentPending.length > 0 && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: "rgba(245,158,11,0.2)", color: "#F59E0B" }}>
            {currentPending.length} current
          </span>
        )}
        {staleBacklogQueueItems.length > 0 && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: "rgba(245,158,11,0.08)", color: "#F59E0B" }}>
            {staleBacklogQueueItems.length} stale/test
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button onClick={load} className="p-1 rounded opacity-50 hover:opacity-80 transition-opacity" title="Refresh">
            <RefreshCw size={11} style={{ color: MUTED }} />
          </button>
        </div>
      </div>

      {runMessage && (
        <div className="px-5 py-2 text-[11px] font-semibold border-b"
          style={{
            color: runMessage.ok ? "#4ADE80" : "#F87171",
            backgroundColor: runMessage.ok ? "rgba(74,222,128,0.06)" : "rgba(248,113,113,0.06)",
            borderColor: BORDER,
          }}>
          {runMessage.text}
        </div>
      )}

      <div className="flex border-b flex-shrink-0" style={{ borderColor: BORDER }}>
        <button onClick={() => setTab("pending")}
          className="flex-1 py-2.5 text-xs font-bold tracking-widest uppercase transition-all"
          style={{ color: tab === "pending" ? GOLD : DIM, borderBottom: tab === "pending" ? `2px solid ${GOLD}` : "2px solid transparent" }}>
          Pending ({currentPending.length})
        </button>
        <button onClick={() => setTab("history")}
          className="flex-1 py-2.5 text-xs font-bold tracking-widest uppercase transition-all"
          style={{ color: tab === "history" ? GOLD : DIM, borderBottom: tab === "history" ? `2px solid ${GOLD}` : "2px solid transparent" }}>
          History
        </button>
        <button onClick={() => setTab("run")}
          className="flex-1 py-2.5 text-xs font-bold tracking-widest uppercase transition-all flex items-center justify-center gap-1"
          style={{ color: tab === "run" ? GOLD : DIM, borderBottom: tab === "run" ? `2px solid ${GOLD}` : "2px solid transparent" }}>
          <Users size={10} /> Run Team
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && tab !== "run" && (
          <div className="flex items-center justify-center py-10">
            <RefreshCw size={16} className="animate-spin" style={{ color: DIM }} />
          </div>
        )}

        {!loading && tab === "pending" && (
          <div className="p-4 flex flex-col gap-3">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-[10px] uppercase font-bold tracking-wider">
              <div className="rounded-lg px-3 py-2" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
                Current: {currentPending.length}
              </div>
              <div className="rounded-lg px-3 py-2" style={{ backgroundColor: "rgba(245,158,11,0.08)", color: "#F59E0B" }}>
                Stale/Test: {staleBacklogQueueItems.length}
              </div>
              <div className="rounded-lg px-3 py-2" style={{ backgroundColor: "rgba(248,113,113,0.08)", color: "#F87171" }}>
                Blocked: {blockedCount}
              </div>
              <div className="rounded-lg px-3 py-2" style={{ backgroundColor: "rgba(248,113,113,0.08)", color: "#F87171" }}>
                High Risk: {highRiskCount}
              </div>
              <div className="rounded-lg px-3 py-2" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
                Oldest: {oldestItemAge}
              </div>
            </div>

            {currentPending.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <div className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: "rgba(74,222,128,0.08)" }}>
                  <Clock size={18} style={{ color: "#4ADE80", opacity: 0.6 }} />
                </div>
                <p className="text-sm font-semibold" style={{ color: MUTED }}>No active queue items</p>
                <p className="text-[11px]" style={{ color: DIM }}>
                  Existing rows may be separated below as stale or test backlog.
                </p>
              </div>
            ) : (
              currentPending.map((item) => (
                <QueueCard key={item.id} item={item} onApprove={handleApprove} onKickBack={handleKickBack} />
              ))
            )}

            {staleBacklogQueueItems.length > 0 && (
              <section
                className="mt-3 rounded-xl p-4"
                style={{
                  backgroundColor: "rgba(255,255,255,0.025)",
                  border: "1px solid rgba(148,163,184,0.16)",
                }}
              >
                <div className="mb-3">
                  <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "#F59E0B" }}>
                    Stale / test backlog
                  </p>
                  <p className="mt-1 text-xs" style={{ color: DIM }}>
                    {staleBacklogQueueItems.length} stale/test rows in backlog. These rows stay visible for reference only.
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  {staleBacklogQueueItems.map((item) => (
                    <StaleBacklogQueueCard key={item.id} item={item} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {!loading && tab === "history" && (
          <div className="p-4 flex flex-col gap-3">
            {history.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: DIM }}>No history yet.</p>
            ) : (
              history.map((item) => (
                <QueueCard key={item.id} item={item} onApprove={() => {}} onKickBack={() => {}} />
              ))
            )}
          </div>
        )}

        {tab === "run" && (
          <div className="p-4">
            <p className="text-[11px] mb-4" style={{ color: DIM }}>
              Roster preview only. Use Preview Draft to test the local draft generator on screen. This does not create a queue item.
            </p>

        {/* READ ONLY LIVE QUEUE DISPLAY V4 */}
        <div
          className="mt-4 mb-5 rounded-xl p-4"
          style={{
            backgroundColor: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(201,168,76,0.18)",
          }}
        >
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <div className="text-[10px] font-bold tracking-widest uppercase" style={{ color: GOLD }}>
                <div
                  data-casevoice-queue-top-safety-chip="true"
                  className="mb-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-200 shadow-sm"
                >
                  Read-only safe mode active. Preview only. No queue writes.
                </div>
              <div
                data-casevoice-queue-signal-note-v1="true"
                className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3"
              >
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-amber-300">
                  Queue Signal Cleanup V1
                </div>
                <div className="mt-1 text-sm text-slate-200">
                  Rows are read-only and now marked by signal quality. Actionable means the row has the required Meaning Gate shape and is not obvious placeholder or legacy noise. Needs Founder Context means do not treat it like real work yet.
                </div>
              </div>
                Live Read-Only Queue
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Shows pending queue rows already in the database. This panel does not create, approve, or execute anything. Rows marked Needs Founder Context are not useful work yet.
              </p>
            </div>
            <span className="text-[10px] font-bold tracking-widest uppercase text-slate-500">
              {readOnlyLiveQueueLoading ? "Loading" : `${readOnlyLiveQueueRows.length} pending`}
            </span>
          </div>

          {readOnlyLiveQueueError ? (
            <div className="text-xs text-red-300">
              Read-only queue load failed: {readOnlyLiveQueueError}
            </div>
          ) : readOnlyLiveQueueRows.length === 0 ? (
            <div className="text-xs text-slate-500">
              No pending rows were returned by the read-only queue check.
            </div>
          ) : (
            <div className="space-y-3">
              {readOnlyLiveQueueRows.map((row) => (
                <div
                  key={row.id}
                  className="rounded-lg p-3"
                  style={{
                    backgroundColor: "rgba(2,6,23,0.35)",
                    border: "1px solid rgba(148,163,184,0.14)",
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-100">
                      {row.boy_name || "Unknown Team Member"}
                    </div>
                    <div className="text-[10px] font-bold tracking-widest uppercase text-slate-400">
                      {row.status || "pending"}
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                    <div>Type: {row.item_type || "unknown"}</div>
                    <div>Risk: {row.risk_level || "unknown"}</div>
                    <div>Fire: {row.fire_level || "unknown"}</div>
                    <div>Workflow: {row.workflow_status || "unknown"}</div>
                  </div>

                  <p className="mt-3 text-xs text-slate-300 line-clamp-4">
                    {row.content || "No content returned."}
                  </p>

                  <div className="mt-3 text-[10px] text-slate-500">
                    ID: {row.id}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

            <div className="grid grid-cols-2 gap-2">
              {/* TEAM MEMBER QUEUE READ-ONLY RECEIPTS V1 */}
              <div
                data-casevoice-team-member-queue-readonly-receipts-v1="true"
                className="rounded-xl p-4 md:col-span-2 lg:col-span-3"
                style={{ background: "rgba(8,17,31,0.88)", border: "1px solid rgba(201,168,76,0.45)" }}
              >
                <div className="text-sm font-semibold tracking-wide uppercase" style={{ color: "#C9A84C" }}>
                  Team Member Queue Read-Only Safety Receipt
                </div>
                <div className="mt-3 grid gap-2 text-sm md:grid-cols-2" style={{ color: "#E2E8F0" }}>
                  <div>Queue writes locked</div>
                  <div>Meaning Gate active</div>
                  <div>{TEAM_MEMBERS.length} Team Members loaded</div>
                  <div>Preview Draft is screen-only</div>
                  <div>No database write on preview</div>
                  <div>Approval, kickback, and create helpers quarantined</div>
                  <div>Drive/OAuth/Supabase secret lock active</div>
                  <div>Founder approval required before write path work</div>
                </div>
              </div>
              {TEAM_MEMBERS.map((member) => (
                <div key={member} className="flex flex-col gap-1">
                  <button
                    disabled={true}
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold tracking-wide transition-all hover:opacity-90 disabled:opacity-40"
                    style={{
                      backgroundColor: runningMember === member ? "rgba(201,168,76,0.15)" : CARD,
                      color: runningMember === member ? GOLD : TEXT,
                      border: runningMember === member ? "1px solid rgba(201,168,76,0.4)" : `1px solid ${BORDER}`,
                    }}
                  >
                    <span>{member}</span>
                    {runningMember === member
                      ? <RefreshCw size={10} className="animate-spin" style={{ color: GOLD }} />
                      : <Play size={10} style={{ color: DIM }} />
                    }
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePreviewDraft(member)}
                    className="rounded-lg px-3 py-2 text-[10px] font-bold tracking-widest uppercase transition-all hover:opacity-90"
                    style={{
                      backgroundColor: "rgba(201,168,76,0.08)",
                      color: GOLD,
                      border: "1px solid rgba(201,168,76,0.22)",
                    }}
                  >
                    Preview Draft
                  </button>
                </div>
              ))}
            </div>

            {draftPreview && (
              <div className="mt-4 rounded-xl border p-4" style={{ backgroundColor: CARD, borderColor: BORDER }}>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: GOLD }}>
                      Read-Only Draft Preview
                    </p>
                    <p className="text-xs mt-1" style={{ color: MUTED }}>
                      Local screen preview only. No database row, no queue action, no external execution.
<button
                      type="button"
                      disabled={true}
                      className="mt-3 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[10px] font-bold tracking-widest uppercase disabled:opacity-40"
                      style={{
                        backgroundColor: "rgba(201,168,76,0.08)",
                        color: GOLD,
                        border: "1px solid rgba(201,168,76,0.25)",
                      }}
                      title="Locked Phase 2 preview only. This does not create a queue item."
                    >
                      Create Queue Item Locked
                    </button>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDraftPreview(null)}
                    className="rounded-lg px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase hover:opacity-80"
                    style={{ color: MUTED, border: `1px solid ${BORDER}` }}
                  >
                    Clear
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="rounded-lg px-3 py-2" style={{ backgroundColor: "#08111F", border: `1px solid ${BORDER}` }}>
                    <p className="text-[9px] font-bold tracking-widest uppercase" style={{ color: DIM }}>Status</p>
                    <p className="text-xs font-semibold mt-1" style={{ color: draftPreview.valid ? "#4ADE80" : "#F87171" }}>
                      {draftPreview.valid ? "Valid preview" : "Needs review"}
                    </p>
                  </div>

                  <div className="rounded-lg px-3 py-2" style={{ backgroundColor: "#08111F", border: `1px solid ${BORDER}` }}>
                    <p className="text-[9px] font-bold tracking-widest uppercase" style={{ color: DIM }}>Team Member</p>
                    <p className="text-xs font-semibold mt-1" style={{ color: TEXT }}>
                      {draftPreview.draft?.boy_name || "None"}
                    </p>
                  </div>

                  <div className="rounded-lg px-3 py-2" style={{ backgroundColor: "#08111F", border: `1px solid ${BORDER}` }}>
                    <p className="text-[9px] font-bold tracking-widest uppercase" style={{ color: DIM }}>Risk</p>
                    <p className="text-xs font-semibold mt-1" style={{ color: TEXT }}>
                      {draftPreview.draft?.risk_level || "None"}
                    </p>
                  </div>

                  <div className="rounded-lg px-3 py-2" style={{ backgroundColor: "#08111F", border: `1px solid ${BORDER}` }}>
                    <p className="text-[9px] font-bold tracking-widest uppercase" style={{ color: DIM }}>Fire</p>
                    <p className="text-xs font-semibold mt-1" style={{ color: TEXT }}>
                      {draftPreview.draft?.fire_level || "None"}
                    </p>
                  </div>
                </div>

                {draftPreview.errors.length > 0 && (
                  <div className="rounded-lg p-3 mb-3" style={{ backgroundColor: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.22)" }}>
                    {draftPreview.errors.map((error, idx) => (
                      <p key={idx} className="text-xs" style={{ color: "#F87171" }}>{error}</p>
                    ))}
                  </div>
                )}

                <pre className="whitespace-pre-wrap rounded-lg p-3 text-xs leading-relaxed max-h-80 overflow-auto" style={{ backgroundColor: "#08111F", color: TEXT, border: `1px solid ${BORDER}` }}>
                  {draftPreview.draft?.content || "No preview content."}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
































