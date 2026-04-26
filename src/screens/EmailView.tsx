import { useState, useEffect, useRef, useCallback } from "react";
import {
  Inbox, Mail, Paperclip, Archive, Trash2, RefreshCw,
  Plus, Copy, Check, AlertTriangle, Lightbulb, MessageSquare, Shield,
  Loader, ChevronDown, ChevronUp, FileText, X, Eye, User, Send,
} from "lucide-react";
import {
  listEmails, createEmail, markEmailRead, archiveEmail, deleteEmail,
  listEmailAttachments, addEmailAttachment, getEmailAnalysis, upsertEmailAnalysis,
  listEmailDrafts, createEmailDraft, deleteEmailDraft,
  type Email, type EmailAttachment, type EmailAnalysis, type EmailDraft,
} from "../lib/db";
import { supabase } from "../lib/supabase";

/* ── Constants ──────────────────────────────────────────────────────────── */

const NAVY       = "#0D1B2E";
const CARD       = "#111D30";
const BORDER     = "#1B2A4A";
const GOLD       = "#C9A84C";
const MUTED      = "#A0B4CC";
const DIM        = "#607A96";
const TEXT       = "#D8E8F5";
const SIDEBAR_BG = "#090F1C";
const PANEL_BG   = "#080F1C";

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const CONTACTS_KEY = "crm_email_contacts";
interface SavedContact { name: string; email: string; }

function loadContacts(): SavedContact[] {
  try { return JSON.parse(localStorage.getItem(CONTACTS_KEY) ?? "[]"); } catch { return []; }
}
function saveContact(name: string, email: string) {
  if (!email.trim()) return;
  const existing = loadContacts();
  const deduped = [{ name, email }, ...existing.filter(c => c.email !== email)].slice(0, 30);
  localStorage.setItem(CONTACTS_KEY, JSON.stringify(deduped));
}

const TONE_OPTIONS = [
  { id: "formal",    label: "Formal",    color: "#5A9BD3" },
  { id: "direct",    label: "Direct",    color: "#C9A84C" },
  { id: "friendly",  label: "Friendly",  color: "#4ADE80" },
  { id: "assertive", label: "Assertive", color: "#F87171" },
];

const ROUTED_MENTOR_COLORS: Record<string, string> = {
  JAMES: "#6BAF8E", MAILMAN: "#6BAF8E", TECHGUY: "#5A9BD3",
  DOC: "#E07B5A", ALEX: "#5AB8A8", CIPHER: "#C97B7B",
  RICK: "#F87171", MARK: "#C9A84C", ATK: "#C97B7B",
  DEF: "#7B8FA8", PAUL: "#5A9BD3", SCOUT: "#C9A84C",
};

/* ── API helper ─────────────────────────────────────────────────────────── */

async function callEmailAnalysis(action: string, payload: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/email-analysis`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ action, ...payload }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* ── File reading helper ─────────────────────────────────────────────────── */

interface AttachmentDraft { filename: string; content: string; readable: boolean; }

async function readFileAsText(file: File): Promise<AttachmentDraft> {
  const readable = file.type.startsWith("text/") || /\.(txt|md|csv|json|xml|log|html|js|ts|py|sql)$/i.test(file.name);
  if (!readable) return { filename: file.name, content: "", readable: false };
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload  = (e) => resolve({ filename: file.name, content: (e.target?.result as string) ?? "", readable: true });
    reader.onerror = ()  => resolve({ filename: file.name, content: "", readable: false });
    reader.readAsText(file);
  });
}

/* ── Clip helper ─────────────────────────────────────────────────────────── */

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const el = document.createElement("textarea");
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
  }
}

/* ── Email status label (Fix 7) ─────────────────────────────────────────── */

type EmailStatus = "composing" | "saved" | "analyzed";

function StatusBadge({ status }: { status: EmailStatus }) {
  const cfg = {
    composing: { color: "#F59E0B", bg: "rgba(245,158,11,0.12)", label: "Composing" },
    saved:     { color: MUTED,     bg: "rgba(160,180,204,0.08)", label: "Saved" },
    analyzed:  { color: "#4ADE80", bg: "rgba(74,222,128,0.1)",   label: "Analyzed" },
  }[status];
  return (
    <span className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full"
      style={{ color: cfg.color, backgroundColor: cfg.bg }}>
      {cfg.label}
    </span>
  );
}

/* ── Right AI Panel ──────────────────────────────────────────────────────── */

interface AIPanelProps {
  email: Email | null;
  emailBody: string;
  analysis: EmailAnalysis | null;
  drafts: EmailDraft[];
  onAnalysisDone: (a: EmailAnalysis) => void;
  onDraftCreated: (d: EmailDraft) => void;
  onDraftDeleted: (id: string) => void;
  onReplaceBody: (text: string) => void;
  onInsertBelow: (text: string) => void;
}

function AIPanel({
  email, emailBody, analysis, drafts,
  onAnalysisDone, onDraftCreated, onDraftDeleted,
  onReplaceBody, onInsertBelow,
}: AIPanelProps) {
  const [analyzing,    setAnalyzing]    = useState(false);
  const [generating,   setGenerating]   = useState(false);
  const [selectedTone, setSelectedTone] = useState("direct");
  const [copiedId,     setCopiedId]     = useState<string | null>(null);
  const [collapsed,    setCollapsed]    = useState<Set<string>>(new Set());
  const [mlLoading,    setMlLoading]    = useState<string | null>(null);
  const [insights,     setInsights]     = useState<Record<string, string>>(analysis?.mentor_insights ?? {});

  useEffect(() => { setInsights(analysis?.mentor_insights ?? {}); }, [analysis]);

  function toggle(key: string) {
    setCollapsed(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }

  async function handleAnalyze() {
    if (!email) return;
    setAnalyzing(true);
    try {
      const result = await callEmailAnalysis("analyze", {
        email: { subject: email.subject, sender_name: email.sender_name, sender_email: email.sender_email, body: emailBody },
      });
      if (result.analysis) {
        await upsertEmailAnalysis(email.id, {
          summary:         result.analysis.summary        ?? "",
          intent:          result.analysis.intent         ?? "",
          risks:           result.analysis.risks          ?? [],
          opportunities:   result.analysis.opportunities  ?? [],
          suggested_tone:  result.analysis.suggested_tone ?? "",
          key_points:      result.analysis.key_points     ?? [],
          tags:            result.analysis.tags           ?? [],
          mentor_insights: insights,
        });
        const saved = await getEmailAnalysis(email.id);
        if (saved) onAnalysisDone(saved);
      }
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSuggestReply() {
    if (!email) return;
    setGenerating(true);
    try {
      const toneToMentor: Record<string, string> = {
        formal: "JAMES", direct: "PAUL", friendly: "MAILMAN", assertive: "MARK",
      };
      const draftedBy = toneToMentor[selectedTone] ?? "JAMES";
      const result = await callEmailAnalysis("draft_reply", {
        email: { subject: email.subject, sender_name: email.sender_name, sender_email: email.sender_email, body: emailBody },
        tone: selectedTone, mentor: draftedBy,
      });
      if (result.draft) {
        const saved = await createEmailDraft({ email_id: email.id, tone: selectedTone, body: result.draft, drafted_by: draftedBy });
        onDraftCreated(saved);
      }
    } finally {
      setGenerating(false);
    }
  }

  async function handleMentorInsight(mentor: string) {
    if (!email) return;
    setMlLoading(mentor);
    try {
      const result = await callEmailAnalysis("mentor_insight", {
        email: { subject: email.subject, sender_name: email.sender_name, sender_email: email.sender_email, body: emailBody },
        mentor,
      });
      if (result.insight) {
        const updated = { ...insights, [mentor]: result.insight };
        setInsights(updated);
        await upsertEmailAnalysis(email.id, { mentor_insights: updated });
      }
    } finally {
      setMlLoading(null);
    }
  }

  async function handleCopy(text: string, key: string) {
    await copyToClipboard(text);
    setCopiedId(key);
    setTimeout(() => setCopiedId(null), 2500);
  }

  const routedMentors = (analysis as ({ routed_mentors?: string[] } & EmailAnalysis) | null)?.routed_mentors ?? ["JAMES", "RICK", "MARK"];

  if (!email) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-4">
        <Lightbulb size={24} style={{ color: DIM }} />
        <p className="text-xs text-center" style={{ color: DIM }}>Select an email to use AI tools</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Panel header */}
      <div className="px-4 py-3 border-b flex-shrink-0" style={{ borderColor: BORDER }}>
        <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: DIM }}>AI Assistant</p>
        <p className="text-[10px] mt-0.5" style={{ color: DIM }}>Reads center. Never overwrites without you.</p>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 px-4 py-4">
        <div className="flex flex-col gap-5">

          {/* Analyze */}
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: DIM }}>Analyze Email</p>
            <button onClick={handleAnalyze} disabled={analyzing}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-bold tracking-wider uppercase transition-all hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: analysis ? CARD : "rgba(201,168,76,0.15)", color: GOLD, border: `1px solid rgba(201,168,76,0.3)` }}>
              {analyzing ? <Loader size={12} className="animate-spin" /> : <Eye size={12} />}
              {analyzing ? "Analyzing..." : analysis ? "Re-analyze" : "Analyze"}
            </button>

            {analysis && (
              <div className="flex flex-col gap-2 mt-1">
                {analysis.summary && (
                  <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(201,168,76,0.15)" }}>
                    <button onClick={() => toggle("summary")}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:opacity-90"
                      style={{ backgroundColor: "rgba(201,168,76,0.06)" }}>
                      <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: GOLD }}>Summary</span>
                      {collapsed.has("summary") ? <ChevronDown size={11} style={{ color: DIM }} /> : <ChevronUp size={11} style={{ color: DIM }} />}
                    </button>
                    {!collapsed.has("summary") && (
                      <div className="px-3 py-2.5">
                        <p className="text-xs leading-relaxed" style={{ color: MUTED }}>{analysis.summary}</p>
                      </div>
                    )}
                  </div>
                )}

                {analysis.intent && (
                  <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
                    <button onClick={() => toggle("intent")}
                      className="w-full flex items-center justify-between px-3 py-2.5 hover:opacity-90"
                      style={{ backgroundColor: CARD }}>
                      <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: DIM }}>Intent</span>
                      {collapsed.has("intent") ? <ChevronDown size={11} style={{ color: DIM }} /> : <ChevronUp size={11} style={{ color: DIM }} />}
                    </button>
                    {!collapsed.has("intent") && (
                      <div className="px-3 py-2.5" style={{ backgroundColor: CARD }}>
                        <p className="text-xs leading-relaxed" style={{ color: MUTED }}>{analysis.intent}</p>
                      </div>
                    )}
                  </div>
                )}

                {analysis.risks?.length > 0 && (
                  <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(249,115,22,0.2)" }}>
                    <button onClick={() => toggle("risks")}
                      className="w-full flex items-center justify-between px-3 py-2.5 hover:opacity-90"
                      style={{ backgroundColor: "rgba(249,115,22,0.05)" }}>
                      <span className="text-[10px] font-bold tracking-widest uppercase flex items-center gap-1" style={{ color: "#F87171" }}>
                        <AlertTriangle size={10} /> Risks
                      </span>
                      {collapsed.has("risks") ? <ChevronDown size={11} style={{ color: DIM }} /> : <ChevronUp size={11} style={{ color: DIM }} />}
                    </button>
                    {!collapsed.has("risks") && (
                      <div className="px-3 py-2.5 flex flex-col gap-1" style={{ backgroundColor: "rgba(249,115,22,0.02)" }}>
                        {analysis.risks.map((r, i) => (
                          <p key={i} className="text-xs leading-relaxed" style={{ color: "#FB923C" }}>{r}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {analysis.opportunities?.length > 0 && (
                  <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(74,222,128,0.2)" }}>
                    <button onClick={() => toggle("opps")}
                      className="w-full flex items-center justify-between px-3 py-2.5 hover:opacity-90"
                      style={{ backgroundColor: "rgba(74,222,128,0.05)" }}>
                      <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "#4ADE80" }}>Opportunities</span>
                      {collapsed.has("opps") ? <ChevronDown size={11} style={{ color: DIM }} /> : <ChevronUp size={11} style={{ color: DIM }} />}
                    </button>
                    {!collapsed.has("opps") && (
                      <div className="px-3 py-2.5 flex flex-col gap-1" style={{ backgroundColor: "rgba(74,222,128,0.02)" }}>
                        {analysis.opportunities.map((o, i) => (
                          <p key={i} className="text-xs leading-relaxed" style={{ color: "#4ADE80" }}>{o}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Team insights */}
                <div className="border-t pt-3" style={{ borderColor: BORDER }}>
                  <p className="text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: DIM }}>Team Insights</p>
                  <div className="flex flex-col gap-2">
                    {routedMentors.map(mentor => {
                      const color   = ROUTED_MENTOR_COLORS[mentor] ?? GOLD;
                      const exists  = insights[mentor];
                      const loading = mlLoading === mentor;
                      const isColl  = collapsed.has(`m-${mentor}`);
                      return (
                        <div key={mentor} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${BORDER}`, backgroundColor: NAVY }}>
                          <div className="flex items-center justify-between px-3 py-2">
                            <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color }}>{mentor}</span>
                            <div className="flex items-center gap-1">
                              {exists && (
                                <button onClick={() => toggle(`m-${mentor}`)}
                                  className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded transition-opacity hover:opacity-70"
                                  style={{ color: DIM, backgroundColor: "rgba(255,255,255,0.04)" }}>
                                  {isColl ? "Show" : "Hide"}
                                </button>
                              )}
                              <button onClick={() => handleMentorInsight(mentor)} disabled={!!mlLoading}
                                className="text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded transition-opacity hover:opacity-70 disabled:opacity-40"
                                style={{ color: GOLD, backgroundColor: GOLD + "15" }}>
                                {loading ? "..." : exists ? "Re-ask" : "Ask"}
                              </button>
                            </div>
                          </div>
                          {exists && !isColl && (
                            <div className="px-3 pb-3">
                              <p className="text-xs leading-relaxed" style={{ color: MUTED }}>{exists}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Suggest Reply */}
          <div className="flex flex-col gap-2 border-t pt-4" style={{ borderColor: BORDER }}>
            <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: DIM }}>Suggest Reply</p>
            <div className="flex gap-1 flex-wrap">
              {TONE_OPTIONS.map(t => (
                <button key={t.id} onClick={() => setSelectedTone(t.id)}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all"
                  style={selectedTone === t.id
                    ? { backgroundColor: t.color + "22", color: t.color, border: `1px solid ${t.color}55` }
                    : { backgroundColor: CARD, color: DIM, border: `1px solid ${BORDER}` }}>
                  {t.label}
                </button>
              ))}
            </div>
            <button onClick={handleSuggestReply} disabled={generating}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-bold tracking-wider uppercase transition-all hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "rgba(90,155,211,0.12)", color: "#5A9BD3", border: "1px solid rgba(90,155,211,0.3)" }}>
              {generating ? <Loader size={12} className="animate-spin" /> : <MessageSquare size={12} />}
              {generating ? "Drafting..." : "Suggest Reply"}
            </button>

            {/* Suggested drafts — Fix 4: Replace or Insert Below */}
            {drafts.length > 0 && (
              <div className="flex flex-col gap-2 mt-1">
                <p className="text-[9px] font-bold tracking-widest uppercase" style={{ color: DIM }}>Suggestions ({drafts.length})</p>
                {drafts.map(draft => {
                  const toneColor = TONE_OPTIONS.find(t => t.id === draft.tone)?.color ?? GOLD;
                  const isCopied  = copiedId === draft.id;
                  return (
                    <div key={draft.id} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${BORDER}`, backgroundColor: CARD }}>
                      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: BORDER }}>
                        <span className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded"
                          style={{ backgroundColor: toneColor + "22", color: toneColor }}>{draft.tone}</span>
                        <button onClick={() => { onDraftDeleted(draft.id); deleteEmailDraft(draft.id); }}
                          className="opacity-40 hover:opacity-80 transition-opacity" style={{ color: "#F87171" }}>
                          <X size={11} />
                        </button>
                      </div>
                      <div className="px-3 py-2.5">
                        <p className="text-[11px] leading-relaxed line-clamp-3" style={{ color: MUTED }}>{draft.body}</p>
                      </div>
                      <div className="flex border-t" style={{ borderColor: BORDER }}>
                        <button onClick={() => onReplaceBody(draft.body)}
                          className="flex-1 py-2 text-[10px] font-bold tracking-widest uppercase transition-opacity hover:opacity-80 border-r"
                          style={{ color: GOLD, borderColor: BORDER }}>
                          Replace
                        </button>
                        <button onClick={() => onInsertBelow(draft.body)}
                          className="flex-1 py-2 text-[10px] font-bold tracking-widests uppercase transition-opacity hover:opacity-80 border-r"
                          style={{ color: "#5A9BD3", borderColor: BORDER }}>
                          Insert
                        </button>
                        <button onClick={() => handleCopy(draft.body, draft.id)}
                          className="flex-1 py-2 text-[10px] font-bold tracking-widest uppercase transition-opacity hover:opacity-80"
                          style={{ color: isCopied ? "#4ADE80" : MUTED }}>
                          {isCopied ? "Copied!" : "Copy"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Send Lock notice */}
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl border-t pt-4" style={{ borderColor: BORDER }}>
            <Shield size={11} style={{ color: GOLD, flexShrink: 0, marginTop: 2 }} />
            <p className="text-[10px] leading-relaxed" style={{ color: DIM }}>
              <span style={{ color: GOLD, fontWeight: 700 }}>Send Lock</span> — Copy the body and send from your own email client.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}

/* ── Center Email Workspace ──────────────────────────────────────────────── */

interface EmailWorkspaceProps {
  email: Email;
  attachments: EmailAttachment[];
  analysis: EmailAnalysis | null;
  bodyValue: string;
  onBodyChange: (v: string) => void;
  onArchive: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onSave: () => void;
  saving: boolean;
}

function EmailWorkspace({
  email, attachments, analysis,
  bodyValue, onBodyChange,
  onArchive, onDelete, onSave, saving,
}: EmailWorkspaceProps) {
  const [previewAttId, setPreviewAttId] = useState<string | null>(null);

  const status: EmailStatus = analysis ? "analyzed" : "saved";

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-6 py-4 border-b flex-shrink-0" style={{ borderColor: BORDER }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-base font-bold" style={{ color: "#FFF" }}>{email.subject}</p>
              <StatusBadge status={status} />
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-sm font-semibold" style={{ color: GOLD }}>{email.sender_name}</span>
              <span className="text-sm" style={{ color: MUTED }}>&lt;{email.sender_email}&gt;</span>
              <span className="text-xs" style={{ color: DIM }}>
                {new Date(email.received_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={onArchive} className="p-2 rounded-lg transition-opacity hover:opacity-70"
              style={{ backgroundColor: "#1B2A4A" }} title="Archive">
              <Archive size={13} style={{ color: MUTED }} />
            </button>
            <button onClick={onDelete} className="p-2 rounded-lg transition-opacity hover:opacity-70"
              style={{ backgroundColor: "rgba(248,113,113,0.08)" }} title="Delete">
              <Trash2 size={13} style={{ color: "#F87171" }} />
            </button>
          </div>
        </div>
      </div>

      {/* Editable body — Fix 1+2: center always shows editable content */}
      <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: DIM }}>Email Body</p>
          <button onClick={onSave} disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ backgroundColor: GOLD + "22", color: GOLD, border: `1px solid ${GOLD}44` }}>
            {saving ? <Loader size={10} className="animate-spin" /> : <Check size={10} />}
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
        <textarea
          value={bodyValue}
          onChange={e => onBodyChange(e.target.value)}
          className="flex-1 w-full px-4 py-3 rounded-xl text-sm outline-none resize-none leading-relaxed"
          style={{
            backgroundColor: NAVY,
            color: TEXT,
            border: `1px solid ${BORDER}`,
            lineHeight: "1.85",
            minHeight: "280px",
          }}
          placeholder="Email body…"
        />

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="border-t pt-4" style={{ borderColor: BORDER }}>
            <div className="flex items-center gap-2 mb-2">
              <Paperclip size={12} style={{ color: MUTED }} />
              <p className="text-xs font-bold tracking-widest uppercase" style={{ color: MUTED }}>Attachments ({attachments.length})</p>
            </div>
            <div className="flex flex-col gap-2 pb-4">
              {attachments.map(att => (
                <div key={att.id}>
                  <div onClick={() => setPreviewAttId(previewAttId === att.id ? null : att.id)}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl cursor-pointer hover:opacity-90"
                    style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
                    <FileText size={13} style={{ color: att.routed_to ? ROUTED_MENTOR_COLORS[att.routed_to] ?? GOLD : MUTED }} />
                    <p className="flex-1 text-xs font-semibold" style={{ color: TEXT }}>{att.filename}</p>
                    {att.content
                      ? <span className="text-[9px] font-bold uppercase" style={{ color: "#4ADE80" }}>Preview</span>
                      : <span className="text-[9px]" style={{ color: DIM }}>No preview</span>
                    }
                  </div>
                  {previewAttId === att.id && (
                    <div className="mt-1 rounded-xl px-4 py-3" style={{ backgroundColor: NAVY, border: `1px solid ${BORDER}` }}>
                      {att.content
                        ? <p className="text-xs leading-relaxed whitespace-pre-wrap font-mono" style={{ color: MUTED }}>
                            {att.content.slice(0, 2000)}{att.content.length > 2000 ? "\n\n[truncated…]" : ""}
                          </p>
                        : <p className="text-xs" style={{ color: DIM }}>Preview not available — filename stored only</p>
                      }
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Compose Workspace ───────────────────────────────────────────────────── */

interface ComposeWorkspaceProps {
  onSaved: (email: Email) => void;
  onCancel: () => void;
}

function ComposeWorkspace({ onSaved, onCancel }: ComposeWorkspaceProps) {
  const [to,           setTo]           = useState("");
  const [toEmail,      setToEmail]      = useState("");
  const [subject,      setSubject]      = useState("");
  const [body,         setBody]         = useState("");
  const [attachment,   setAttachment]   = useState<AttachmentDraft | null>(null);
  const [saving,       setSaving]       = useState(false);
  const [contacts,     setContacts]     = useState<SavedContact[]>([]);
  const [showContacts, setShowContacts] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setContacts(loadContacts()); }, []);

  function selectContact(c: SavedContact) {
    setTo(c.name);
    setToEmail(c.email);
    setShowContacts(false);
  }

  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachment(await readFileAsText(file));
  }

  async function handleSave() {
    if (!subject.trim() || !body.trim()) return;
    setSaving(true);
    try {
      const email = await createEmail({
        subject:      subject.trim(),
        sender_name:  to.trim()      || "Unknown",
        sender_email: toEmail.trim() || "unknown@example.com",
        body:         body.trim(),
        received_at:  new Date().toISOString(),
      });
      saveContact(to.trim(), toEmail.trim());
      if (attachment) {
        await addEmailAttachment({
          email_id:     email.id,
          filename:     attachment.filename,
          content_type: attachment.readable ? "text/plain" : "application/octet-stream",
          content:      attachment.content,
        });
      }
      onSaved(email);
    } finally {
      setSaving(false);
    }
  }

  const canSave = subject.trim().length > 0 && body.trim().length > 0;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0" style={{ borderColor: BORDER }}>
        <div className="flex items-center gap-2">
          <Send size={14} style={{ color: GOLD }} />
          <span className="text-sm font-bold" style={{ color: "#FFF" }}>Compose Email</span>
          <StatusBadge status="composing" />
        </div>
        <button onClick={onCancel} className="opacity-40 hover:opacity-80 transition-opacity" style={{ color: MUTED }}>
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4 flex flex-col gap-3">
        {/* Contact recall */}
        {contacts.length > 0 && (
          <div>
            <button onClick={() => setShowContacts(v => !v)}
              className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase transition-opacity hover:opacity-80"
              style={{ color: GOLD }}>
              <User size={11} />
              {showContacts ? "Hide" : "Use Previous Contact"} ({contacts.length})
              {showContacts ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>
            {showContacts && (
              <div className="mt-2 flex flex-col gap-1 max-h-32 overflow-y-auto rounded-xl border p-2" style={{ borderColor: BORDER, backgroundColor: NAVY }}>
                {contacts.map(c => (
                  <button key={c.email} onClick={() => selectContact(c)}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:opacity-80"
                    style={{ backgroundColor: CARD }}>
                    <span className="text-sm font-semibold" style={{ color: TEXT }}>{c.name || c.email}</span>
                    {c.name && <span className="text-xs" style={{ color: DIM }}>{c.email}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] tracking-widest uppercase font-bold" style={{ color: MUTED }}>To (Name)</label>
            <input value={to} onChange={e => setTo(e.target.value)} placeholder="Jane Smith"
              className="px-3 py-2.5 rounded-lg text-sm outline-none" style={{ backgroundColor: NAVY, color: TEXT, border: `1px solid ${BORDER}` }} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] tracking-widest uppercase font-bold" style={{ color: MUTED }}>To (Email)</label>
            <input value={toEmail} onChange={e => setToEmail(e.target.value)} placeholder="jane@example.com"
              className="px-3 py-2.5 rounded-lg text-sm outline-none" style={{ backgroundColor: NAVY, color: TEXT, border: `1px solid ${BORDER}` }} />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] tracking-widest uppercase font-bold" style={{ color: MUTED }}>Subject <span style={{ color: "#F87171" }}>*</span></label>
          <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject line"
            className="px-3 py-2.5 rounded-lg text-sm outline-none" style={{ backgroundColor: NAVY, color: TEXT, border: `1px solid ${BORDER}` }} />
        </div>

        <div className="flex flex-col gap-1 flex-1">
          <label className="text-[10px] tracking-widest uppercase font-bold" style={{ color: MUTED }}>Body <span style={{ color: "#F87171" }}>*</span></label>
          <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Write your email…"
            className="flex-1 px-3 py-2.5 rounded-lg text-sm outline-none resize-none leading-relaxed"
            style={{ backgroundColor: NAVY, color: TEXT, border: `1px solid ${BORDER}`, lineHeight: "1.85", minHeight: "220px" }} />
        </div>

        {/* Attachment */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] tracking-widest uppercase font-bold" style={{ color: MUTED }}>Attachment (optional)</label>
          <input ref={fileRef} type="file" className="hidden" onChange={pickFile} />
          {!attachment ? (
            <button onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80 justify-center border-2 border-dashed"
              style={{ borderColor: BORDER, color: DIM }}>
              <Paperclip size={14} /> Choose File
            </button>
          ) : (
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ backgroundColor: NAVY, border: `1px solid ${BORDER}` }}>
              <FileText size={14} style={{ color: GOLD, flexShrink: 0 }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: TEXT }}>{attachment.filename}</p>
                <p className="text-xs mt-0.5" style={{ color: attachment.readable ? "#4ADE80" : DIM }}>
                  {attachment.readable ? "Text — will be saved" : "Binary — filename stored only"}
                </p>
              </div>
              <button onClick={() => { setAttachment(null); if (fileRef.current) fileRef.current.value = ""; }}
                className="opacity-50 hover:opacity-100" style={{ color: MUTED }}><X size={14} /></button>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 px-6 py-4 border-t flex-shrink-0" style={{ borderColor: BORDER }}>
        <button onClick={onCancel}
          className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold tracking-wider uppercase transition-opacity hover:opacity-70"
          style={{ backgroundColor: NAVY, color: MUTED, border: `1px solid ${BORDER}` }}>Cancel</button>
        <button onClick={handleSave} disabled={saving || !canSave}
          className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold tracking-wider uppercase transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{ backgroundColor: GOLD, color: NAVY }}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

/* ── Main Email View ─────────────────────────────────────────────────────── */

type CenterState = { mode: "empty" } | { mode: "compose" } | { mode: "email"; emailId: string };

export default function EmailView({ onPendingChange: _onPendingChange }: { onPendingChange?: (count: number) => void }) {
  const [emails,        setEmails]        = useState<Email[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [centerState,   setCenterState]   = useState<CenterState>({ mode: "empty" });
  const [attachments,   setAttachments]   = useState<EmailAttachment[]>([]);
  const [analysis,      setAnalysis]      = useState<EmailAnalysis | null>(null);
  const [drafts,        setDrafts]        = useState<EmailDraft[]>([]);
  const [bodyValue,     setBodyValue]     = useState("");
  const [saving,        setSaving]        = useState(false);
  const [showArchived,  setShowArchived]  = useState(false);
  const loadedId = useRef<string | null>(null);

  useEffect(() => {
    listEmails().then(data => { setEmails(data); setLoading(false); });
  }, []);

  const selectedEmail = centerState.mode === "email"
    ? emails.find(e => e.id === centerState.emailId) ?? null
    : null;

  async function handleSelectEmail(email: Email) {
    if (loadedId.current === email.id) return;
    loadedId.current = email.id;
    setCenterState({ mode: "email", emailId: email.id });
    setBodyValue(email.body);
    setAttachments([]);
    setAnalysis(null);
    setDrafts([]);

    if (!email.is_read) {
      await markEmailRead(email.id);
      setEmails(prev => prev.map(e => e.id === email.id ? { ...e, is_read: true } : e));
    }

    const [atts, ana, drs] = await Promise.all([
      listEmailAttachments(email.id),
      getEmailAnalysis(email.id),
      listEmailDrafts(email.id),
    ]);
    setAttachments(atts);
    setAnalysis(ana);
    setDrafts(drs);
  }

  /* Save body edits back to DB */
  async function handleSaveBody() {
    if (!selectedEmail) return;
    setSaving(true);
    try {
      await supabase
        .from("emails")
        .update({ body: bodyValue })
        .eq("id", selectedEmail.id);
      setEmails(prev => prev.map(e => e.id === selectedEmail.id ? { ...e, body: bodyValue } : e));
    } finally {
      setSaving(false);
    }
  }

  function clearSelection() {
    loadedId.current = null;
    setCenterState({ mode: "empty" });
    setBodyValue("");
    setAnalysis(null);
    setDrafts([]);
  }

  async function handleArchive(email: Email, e: React.MouseEvent) {
    e.stopPropagation();
    await archiveEmail(email.id);
    setEmails(prev => prev.map(em => em.id === email.id ? { ...em, archived: true } : em));
    if (selectedEmail?.id === email.id) clearSelection();
  }

  function handleDelete(email: Email, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm(`Delete "${email.subject}"?\n\nThis cannot be undone.`)) return;
    deleteEmail(email.id).catch(() => {});
    setEmails(prev => prev.filter(em => em.id !== email.id));
    if (selectedEmail?.id === email.id) clearSelection();
  }

  function handleComposeSaved(email: Email) {
    setEmails(prev => [email, ...prev]);
    loadedId.current = null;
    handleSelectEmail(email);
  }

  /* Fix 4: Replace or Insert body from AI suggestion */
  const handleReplaceBody = useCallback((text: string) => {
    setBodyValue(text);
  }, []);

  const handleInsertBelow = useCallback((text: string) => {
    setBodyValue(prev => prev ? `${prev}\n\n---\n\n${text}` : text);
  }, []);

  const active      = emails.filter(e => !e.archived);
  const archived    = emails.filter(e => e.archived);
  const displayed   = showArchived ? archived : active;
  const unreadCount = active.filter(e => !e.is_read).length;

  return (
    <div className="flex h-full min-h-0 overflow-hidden" style={{ backgroundColor: NAVY, color: "#FFF" }}>

      {/* ── LEFT: Inbox sidebar ─────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex flex-col border-r"
        style={{ width: "240px", minWidth: "240px", borderColor: BORDER, backgroundColor: SIDEBAR_BG }}>
        <div className="px-4 py-3.5 border-b flex items-center justify-between flex-shrink-0" style={{ borderColor: BORDER }}>
          <div className="flex items-center gap-2">
            <Inbox size={13} style={{ color: GOLD }} />
            <span className="text-xs font-bold tracking-widest uppercase" style={{ color: MUTED }}>Inbox</span>
            {unreadCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: GOLD, color: NAVY }}>{unreadCount}</span>
            )}
          </div>
          <button onClick={() => { loadedId.current = null; setCenterState({ mode: "compose" }); setAnalysis(null); setDrafts([]); }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold tracking-widest uppercase transition-opacity hover:opacity-90"
            style={{ backgroundColor: GOLD, color: NAVY }}>
            <Plus size={11} /> New
          </button>
        </div>

        <div className="flex border-b flex-shrink-0" style={{ borderColor: BORDER }}>
          <button onClick={() => setShowArchived(false)}
            className="flex-1 py-2.5 text-[11px] font-bold tracking-widest uppercase"
            style={{ color: !showArchived ? GOLD : DIM, borderBottom: !showArchived ? `2px solid ${GOLD}` : "2px solid transparent" }}>
            Active ({active.length})
          </button>
          <button onClick={() => setShowArchived(true)}
            className="flex-1 py-2.5 text-[11px] font-bold tracking-widest uppercase"
            style={{ color: showArchived ? GOLD : DIM, borderBottom: showArchived ? `2px solid ${GOLD}` : "2px solid transparent" }}>
            Archived ({archived.length})
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && <p className="text-sm p-4" style={{ color: MUTED }}>Loading…</p>}
          {!loading && displayed.length === 0 && (
            <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
              <Mail size={20} style={{ color: DIM }} />
              <p className="text-xs" style={{ color: MUTED }}>
                {showArchived ? "No archived emails." : "No emails yet. Click New."}
              </p>
            </div>
          )}
          {displayed.map(email => {
            const isSel = selectedEmail?.id === email.id;
            return (
              <button key={email.id} onClick={() => handleSelectEmail(email)}
                className="w-full text-left px-3.5 py-3.5 border-b transition-all hover:opacity-90 group relative"
                style={{
                  borderColor: BORDER,
                  backgroundColor: isSel ? "rgba(201,168,76,0.07)" : "transparent",
                  borderLeft: isSel ? `3px solid ${GOLD}` : "3px solid transparent",
                }}>
                <div className="flex items-start gap-2">
                  {!email.is_read && (
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ backgroundColor: GOLD }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: email.is_read ? MUTED : "#FFF" }}>
                      {email.sender_name || email.sender_email}
                    </p>
                    <p className="text-xs truncate mt-0.5" style={{ color: email.is_read ? DIM : TEXT }}>{email.subject}</p>
                    <p className="text-[10px] mt-1" style={{ color: DIM }}>
                      {new Date(email.received_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <div className="flex-shrink-0 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={e => handleArchive(email, e)} title="Archive" className="p-1.5 rounded hover:bg-white/5">
                      <Archive size={11} style={{ color: DIM }} />
                    </button>
                    <button onClick={e => handleDelete(email, e)} title="Delete" className="p-1.5 rounded hover:bg-white/5">
                      <Trash2 size={11} style={{ color: "#F87171" }} />
                    </button>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── CENTER: Always the workspace ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden border-r" style={{ borderColor: BORDER }}>
        {centerState.mode === "empty" && (
          <div className="flex flex-col h-full items-center justify-center gap-6 px-10">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: "rgba(201,168,76,0.06)", border: `1px solid rgba(201,168,76,0.12)` }}>
              <Mail size={28} style={{ color: GOLD, opacity: 0.4 }} />
            </div>
            <div className="text-center max-w-sm">
              <p className="text-base font-semibold mb-2" style={{ color: MUTED }}>Email Workspace</p>
              <p className="text-sm leading-relaxed" style={{ color: DIM }}>
                Select an email to read and edit it here, or compose a new one. AI suggestions appear on the right and never overwrite without you.
              </p>
            </div>
            <button onClick={() => setCenterState({ mode: "compose" })}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold tracking-wider uppercase hover:opacity-90"
              style={{ backgroundColor: GOLD, color: NAVY }}>
              <Plus size={14} /> Compose Email
            </button>
          </div>
        )}

        {centerState.mode === "compose" && (
          <ComposeWorkspace
            onSaved={handleComposeSaved}
            onCancel={() => setCenterState({ mode: "empty" })}
          />
        )}

        {centerState.mode === "email" && selectedEmail && (
          <EmailWorkspace
            email={selectedEmail}
            attachments={attachments}
            analysis={analysis}
            bodyValue={bodyValue}
            onBodyChange={setBodyValue}
            onArchive={e => handleArchive(selectedEmail, e)}
            onDelete={e => handleDelete(selectedEmail, e)}
            onSave={handleSaveBody}
            saving={saving}
          />
        )}
      </div>

      {/* ── RIGHT: AI panel — suggestions only ───────────────────────────── */}
      <div className="flex-shrink-0 flex flex-col border-l min-h-0"
        style={{ width: "280px", minWidth: "280px", backgroundColor: PANEL_BG, borderColor: BORDER }}>
        <AIPanel
          email={selectedEmail}
          emailBody={bodyValue}
          analysis={analysis}
          drafts={drafts}
          onAnalysisDone={a => setAnalysis(a)}
          onDraftCreated={d => setDrafts(prev => [d, ...prev])}
          onDraftDeleted={id => setDrafts(prev => prev.filter(d => d.id !== id))}
          onReplaceBody={handleReplaceBody}
          onInsertBelow={handleInsertBelow}
        />
      </div>
    </div>
  );
}
