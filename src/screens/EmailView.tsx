import { useState, useEffect, useRef } from "react";
import {
  Inbox, Mail, Paperclip, Archive, Trash2, RefreshCw,
  Plus, Copy, Check, AlertTriangle, Lightbulb, MessageSquare, Shield,
  Loader, ChevronDown, ChevronUp, FileText, X, Eye, Clock, Send, User,
} from "lucide-react";
import {
  listEmails, createEmail, markEmailRead, archiveEmail,
  listEmailAttachments, addEmailAttachment, getEmailAnalysis, upsertEmailAnalysis,
  listEmailDrafts, createEmailDraft, updateEmailDraft, deleteEmailDraft,
  type Email, type EmailAttachment, type EmailAnalysis, type EmailDraft,
} from "../lib/db";
import { proposeAction, getPendingCount } from "../lib/approval";

/* ── Constants ──────────────────────────────────────────────────────────── */

const NAVY       = "#0D1B2E";
const CARD       = "#111D30";
const BORDER     = "#1B2A4A";
const GOLD       = "#C9A84C";
const MUTED      = "#A0B4CC";
const DIM        = "#607A96";
const TEXT       = "#D8E8F5";
const SIDEBAR_BG = "#090F1C";
const RAIL_BG    = "#080F1C";

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

type CenterMode = "email" | "analysis" | "draft";

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

/* ── Ingest Modal ────────────────────────────────────────────────────────── */

function IngestModal({ onClose, onSave }: { onClose: () => void; onSave: (email: Email) => void }) {
  const [senderName,   setSenderName]   = useState("");
  const [senderEmail,  setSenderEmail]  = useState("");
  const [subject,      setSubject]      = useState("");
  const [body,         setBody]         = useState("");
  const [attachment,   setAttachment]   = useState<AttachmentDraft | null>(null);
  const [saving,       setSaving]       = useState(false);
  const [contacts,     setContacts]     = useState<SavedContact[]>([]);
  const [showContacts, setShowContacts] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setContacts(loadContacts()); }, []);

  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachment(await readFileAsText(file));
  }

  function selectContact(c: SavedContact) {
    setSenderName(c.name);
    setSenderEmail(c.email);
    setShowContacts(false);
  }

  async function handleSave() {
    if (!subject.trim() || !body.trim()) return;
    setSaving(true);
    try {
      const email = await createEmail({
        subject:      subject.trim(),
        sender_name:  senderName.trim()  || "Unknown Sender",
        sender_email: senderEmail.trim() || "unknown@example.com",
        body:         body.trim(),
        received_at:  new Date().toISOString(),
      });
      saveContact(senderName.trim(), senderEmail.trim());
      if (attachment) {
        await addEmailAttachment({
          email_id:     email.id,
          filename:     attachment.filename,
          content_type: attachment.readable ? "text/plain" : "application/octet-stream",
          content:      attachment.content,
        });
      }
      onSave(email);
    } finally {
      setSaving(false);
    }
  }

  const canSave = subject.trim().length > 0 && body.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.80)" }}>
      <div className="flex flex-col rounded-2xl overflow-hidden" style={{ width: "580px", maxHeight: "90vh", backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0" style={{ borderColor: BORDER }}>
          <span className="text-sm font-bold tracking-widest uppercase" style={{ color: GOLD }}>Add Email</span>
          <button onClick={onClose} className="opacity-40 hover:opacity-80 transition-opacity" style={{ color: MUTED }}><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {/* FIX 7: Contact recall */}
          {contacts.length > 0 && (
            <div>
              <button onClick={() => setShowContacts(v => !v)}
                className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase transition-opacity hover:opacity-80"
                style={{ color: GOLD }}>
                <User size={12} />
                {showContacts ? "Hide" : "Use Previous Sender"} ({contacts.length})
                {showContacts ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </button>
              {showContacts && (
                <div className="mt-2 flex flex-col gap-1 max-h-36 overflow-y-auto rounded-xl border p-2" style={{ borderColor: BORDER, backgroundColor: NAVY }}>
                  {contacts.map((c) => (
                    <button key={c.email} onClick={() => selectContact(c)}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:opacity-80 transition-opacity"
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
              <label className="text-[11px] tracking-widest uppercase font-bold" style={{ color: MUTED }}>Sender Name</label>
              <input value={senderName} onChange={e => setSenderName(e.target.value)} placeholder="Jane Smith"
                className="px-3 py-2.5 rounded-lg text-sm outline-none" style={{ backgroundColor: NAVY, color: TEXT, border: `1px solid ${BORDER}` }} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] tracking-widest uppercase font-bold" style={{ color: MUTED }}>Sender Email</label>
              <input value={senderEmail} onChange={e => setSenderEmail(e.target.value)} placeholder="jane@example.com"
                className="px-3 py-2.5 rounded-lg text-sm outline-none" style={{ backgroundColor: NAVY, color: TEXT, border: `1px solid ${BORDER}` }} />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] tracking-widest uppercase font-bold" style={{ color: MUTED }}>Subject <span style={{ color: "#F87171" }}>*</span></label>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject line"
              className="px-3 py-2.5 rounded-lg text-sm outline-none" style={{ backgroundColor: NAVY, color: TEXT, border: `1px solid ${BORDER}` }} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] tracking-widest uppercase font-bold" style={{ color: MUTED }}>Email Body <span style={{ color: "#F87171" }}>*</span></label>
            <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Paste the full email body here..."
              rows={9} className="px-3 py-2.5 rounded-lg text-sm outline-none resize-none leading-relaxed"
              style={{ backgroundColor: NAVY, color: TEXT, border: `1px solid ${BORDER}` }} />
          </div>

          {/* FIX 6: Real file picker */}
          <div className="border-t pt-3" style={{ borderColor: BORDER }}>
            <p className="text-[10px] tracking-widest uppercase font-semibold mb-2" style={{ color: DIM }}>Attachment (optional)</p>
            <input ref={fileRef} type="file" className="hidden" onChange={pickFile} />
            {!attachment ? (
              <button onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80 w-full justify-center border-2 border-dashed"
                style={{ borderColor: BORDER, color: DIM, backgroundColor: "transparent" }}>
                <Paperclip size={14} /> Choose File
              </button>
            ) : (
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ backgroundColor: NAVY, border: `1px solid ${BORDER}` }}>
                <FileText size={14} style={{ color: GOLD, flexShrink: 0 }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: TEXT }}>{attachment.filename}</p>
                  <p className="text-xs mt-0.5" style={{ color: attachment.readable ? "#4ADE80" : DIM }}>
                    {attachment.readable ? "Text content will be saved and searchable" : "Preview not available — filename stored only"}
                  </p>
                </div>
                <button onClick={() => { setAttachment(null); if (fileRef.current) fileRef.current.value = ""; }}
                  className="flex-shrink-0 opacity-50 hover:opacity-100" style={{ color: MUTED }}><X size={14} /></button>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 px-5 py-4 border-t flex-shrink-0" style={{ borderColor: BORDER }}>
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold tracking-wider uppercase transition-opacity hover:opacity-70"
            style={{ backgroundColor: NAVY, color: MUTED, border: `1px solid ${BORDER}` }}>Cancel</button>
          <button onClick={handleSave} disabled={saving || !canSave}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold tracking-wider uppercase transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ backgroundColor: GOLD, color: NAVY }}>
            {saving ? "Saving..." : "Save Email"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Analysis View (renders in CENTER panel) ────────────────────────────── */

interface AnalysisViewProps {
  email: Email;
  analysis: EmailAnalysis | null;
  onAnalysisDone: (a: EmailAnalysis) => void;
  onClear: () => void;
  onBack: () => void;
}

function AnalysisView({ email, analysis, onAnalysisDone, onClear, onBack }: AnalysisViewProps) {
  const [loading,   setLoading]   = useState(false);
  const [rerunMsg,  setRerunMsg]  = useState<string | null>(null);
  const [mlLoading, setMlLoading] = useState<string | null>(null);
  const [insights,  setInsights]  = useState<Record<string, string>>(analysis?.mentor_insights ?? {});
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => { setInsights(analysis?.mentor_insights ?? {}); }, [analysis]);

  function toggle(key: string) {
    setCollapsed(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }

  /* FIX 2: Re-run with visible feedback */
  async function handleAnalyze(isRerun = false) {
    setLoading(true);
    if (isRerun) setRerunMsg(null);
    try {
      const result = await callEmailAnalysis("analyze", {
        email: { subject: email.subject, sender_name: email.sender_name, sender_email: email.sender_email, body: email.body },
      });
      if (result.analysis) {
        await upsertEmailAnalysis(email.id, {
          summary:        result.analysis.summary        ?? "",
          intent:         result.analysis.intent         ?? "",
          risks:          result.analysis.risks          ?? [],
          opportunities:  result.analysis.opportunities  ?? [],
          suggested_tone: result.analysis.suggested_tone ?? "",
          key_points:     result.analysis.key_points     ?? [],
          tags:           result.analysis.tags           ?? [],
          mentor_insights: insights,
        });
        const saved = await getEmailAnalysis(email.id);
        if (saved) onAnalysisDone(saved);
        if (isRerun) {
          setRerunMsg(`Re-run complete · ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`);
          setTimeout(() => setRerunMsg(null), 5000);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleMentorInsight(mentor: string) {
    setMlLoading(mentor);
    try {
      const result = await callEmailAnalysis("mentor_insight", {
        email: { subject: email.subject, sender_name: email.sender_name, sender_email: email.sender_email, body: email.body },
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

  const routedMentors = (analysis as ({ routed_mentors?: string[] } & EmailAnalysis) | null)?.routed_mentors ?? ["JAMES", "RICK", "MARK"];

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-6 py-4 border-b flex items-center gap-3 flex-shrink-0" style={{ borderColor: BORDER }}>
        <button onClick={onBack} className="text-xs font-bold tracking-widest uppercase transition-opacity hover:opacity-70 flex items-center gap-1.5"
          style={{ color: DIM }}>
          <ChevronDown size={12} style={{ transform: "rotate(90deg)" }} /> Back
        </button>
        <div className="w-px h-4" style={{ backgroundColor: BORDER }} />
        <Lightbulb size={14} style={{ color: GOLD }} />
        <span className="text-sm font-bold" style={{ color: "#FFF" }}>Team Insights</span>
        <span className="text-xs truncate" style={{ color: DIM }}>{email.subject}</span>
        {analysis && (
          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            {rerunMsg && <span className="text-xs" style={{ color: "#4ADE80" }}>{rerunMsg}</span>}
            <button onClick={() => handleAnalyze(true)} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider uppercase transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{ backgroundColor: NAVY, color: MUTED, border: `1px solid ${BORDER}` }}>
              <RefreshCw size={11} className={loading ? "animate-spin" : ""} /> Re-run
            </button>
            {/* FIX 3: Clear wipes all state */}
            <button onClick={onClear}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider uppercase transition-opacity hover:opacity-80"
              style={{ backgroundColor: "rgba(248,113,113,0.08)", color: "#F87171", border: "1px solid rgba(248,113,113,0.2)" }}>
              <X size={11} /> Clear
            </button>
          </div>
        )}
      </div>

      {/* FIX 5: center panel scrolls independently */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {!analysis ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "rgba(201,168,76,0.08)", border: `1px solid rgba(201,168,76,0.15)` }}>
              <Lightbulb size={22} style={{ color: GOLD, opacity: 0.6 }} />
            </div>
            <p className="text-sm" style={{ color: MUTED }}>Team hasn't analyzed this email yet.</p>
            <button onClick={() => handleAnalyze(false)} disabled={loading}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold tracking-wider uppercase transition-all hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: GOLD, color: NAVY }}>
              {loading ? <Loader size={14} className="animate-spin" /> : <Eye size={14} />}
              {loading ? "Analyzing..." : "Analyze Email"}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 max-w-2xl">
            {/* Summary */}
            {analysis.summary && (
              <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(201,168,76,0.2)" }}>
                <button onClick={() => toggle("summary")}
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: "rgba(201,168,76,0.07)" }}>
                  <span className="text-xs font-bold tracking-widest uppercase" style={{ color: GOLD }}>Summary</span>
                  {collapsed.has("summary") ? <ChevronDown size={13} style={{ color: DIM }} /> : <ChevronUp size={13} style={{ color: DIM }} />}
                </button>
                {!collapsed.has("summary") && (
                  <div className="px-5 py-4">
                    <p className="text-sm leading-relaxed" style={{ color: TEXT }}>{analysis.summary}</p>
                  </div>
                )}
              </div>
            )}

            {/* Intent */}
            {analysis.intent && (
              <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
                <button onClick={() => toggle("intent")}
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: CARD }}>
                  <span className="text-xs font-bold tracking-widest uppercase" style={{ color: DIM }}>Intent</span>
                  {collapsed.has("intent") ? <ChevronDown size={13} style={{ color: DIM }} /> : <ChevronUp size={13} style={{ color: DIM }} />}
                </button>
                {!collapsed.has("intent") && (
                  <div className="px-5 py-4" style={{ backgroundColor: CARD }}>
                    <p className="text-sm leading-relaxed" style={{ color: MUTED }}>{analysis.intent}</p>
                  </div>
                )}
              </div>
            )}

            {/* Key Points */}
            {analysis.key_points?.length > 0 && (
              <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
                <button onClick={() => toggle("keypoints")}
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: CARD }}>
                  <span className="text-xs font-bold tracking-widest uppercase" style={{ color: DIM }}>Key Points</span>
                  {collapsed.has("keypoints") ? <ChevronDown size={13} style={{ color: DIM }} /> : <ChevronUp size={13} style={{ color: DIM }} />}
                </button>
                {!collapsed.has("keypoints") && (
                  <div className="px-5 py-4 flex flex-col gap-2" style={{ backgroundColor: CARD }}>
                    {analysis.key_points.map((p, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="font-bold flex-shrink-0 mt-0.5" style={{ color: GOLD }}>·</span>
                        <p className="text-sm leading-relaxed" style={{ color: TEXT }}>{p}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Risks */}
            {analysis.risks?.length > 0 && (
              <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(249,115,22,0.25)" }}>
                <button onClick={() => toggle("risks")}
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: "rgba(249,115,22,0.06)" }}>
                  <span className="text-xs font-bold tracking-widest uppercase flex items-center gap-1.5" style={{ color: "#F87171" }}>
                    <AlertTriangle size={12} /> Risks
                  </span>
                  {collapsed.has("risks") ? <ChevronDown size={13} style={{ color: DIM }} /> : <ChevronUp size={13} style={{ color: DIM }} />}
                </button>
                {!collapsed.has("risks") && (
                  <div className="px-5 py-4 flex flex-col gap-2" style={{ backgroundColor: "rgba(249,115,22,0.03)" }}>
                    {analysis.risks.map((r, i) => (
                      <p key={i} className="text-sm leading-relaxed" style={{ color: "#FB923C" }}>{r}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Opportunities */}
            {analysis.opportunities?.length > 0 && (
              <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(74,222,128,0.25)" }}>
                <button onClick={() => toggle("opps")}
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: "rgba(74,222,128,0.06)" }}>
                  <span className="text-xs font-bold tracking-widest uppercase flex items-center gap-1.5" style={{ color: "#4ADE80" }}>
                    <Lightbulb size={12} /> Opportunities
                  </span>
                  {collapsed.has("opps") ? <ChevronDown size={13} style={{ color: DIM }} /> : <ChevronUp size={13} style={{ color: DIM }} />}
                </button>
                {!collapsed.has("opps") && (
                  <div className="px-5 py-4 flex flex-col gap-2" style={{ backgroundColor: "rgba(74,222,128,0.03)" }}>
                    {analysis.opportunities.map((o, i) => (
                      <p key={i} className="text-sm leading-relaxed" style={{ color: "#4ADE80" }}>{o}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Suggested Tone */}
            {analysis.suggested_tone && (
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold tracking-widest uppercase" style={{ color: DIM }}>Suggested Tone:</p>
                <span className="text-xs font-bold tracking-widest uppercase px-2.5 py-1 rounded-lg"
                  style={{ backgroundColor: GOLD + "22", color: GOLD }}>{analysis.suggested_tone}</span>
              </div>
            )}

            {/* Team Insights */}
            <div className="border-t pt-4" style={{ borderColor: BORDER }}>
              <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: DIM }}>Team Insights</p>
              <div className="flex flex-col gap-3">
                {routedMentors.map((mentor) => {
                  const color   = ROUTED_MENTOR_COLORS[mentor] ?? GOLD;
                  const exists  = insights[mentor];
                  const loading = mlLoading === mentor;
                  const isCollapsed = collapsed.has(`m-${mentor}`);
                  return (
                    <div key={mentor} className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${BORDER}`, backgroundColor: NAVY }}>
                      <div className="flex items-center justify-between px-4 py-3">
                        <span className="text-xs font-bold tracking-widest uppercase" style={{ color }}>{mentor}</span>
                        <div className="flex items-center gap-2">
                          {exists && (
                            <button onClick={() => toggle(`m-${mentor}`)}
                              className="text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-lg transition-opacity hover:opacity-70"
                              style={{ color: DIM, backgroundColor: "rgba(255,255,255,0.04)" }}>
                              {isCollapsed ? "Show" : "Hide"}
                            </button>
                          )}
                          <button onClick={() => handleMentorInsight(mentor)} disabled={!!mlLoading}
                            className="text-xs font-bold tracking-widests uppercase px-3 py-1.5 rounded-lg transition-opacity hover:opacity-70 disabled:opacity-40"
                            style={{ color: GOLD, backgroundColor: GOLD + "15" }}>
                            {loading ? "..." : exists ? "Re-ask" : "Ask"}
                          </button>
                        </div>
                      </div>
                      {exists && !isCollapsed && (
                        <div className="px-4 pb-4">
                          <p className="text-sm leading-relaxed" style={{ color: MUTED }}>{exists}</p>
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
    </div>
  );
}

/* ── Draft View (renders in CENTER panel) ───────────────────────────────── */

interface DraftViewProps {
  email: Email;
  drafts: EmailDraft[];
  onDraftCreated: (d: EmailDraft) => void;
  onDraftUpdated: (id: string, body: string) => void;
  onDraftDeleted: (id: string) => void;
  onApprovalCreated?: () => void;
  onBack: () => void;
}

function DraftView({ email, drafts, onDraftCreated, onDraftUpdated, onDraftDeleted, onApprovalCreated, onBack }: DraftViewProps) {
  const [selectedTone,    setSelectedTone]    = useState("direct");
  const [generating,      setGenerating]      = useState(false);
  const [editingId,       setEditingId]       = useState<string | null>(null);
  const [editBody,        setEditBody]        = useState("");
  const [copiedId,        setCopiedId]        = useState<string | null>(null);
  const [proposedSendIds, setProposedSendIds] = useState<Set<string>>(new Set());
  const [injectedId,      setInjectedId]      = useState<string | null>(null);
  const [replyBody,       setReplyBody]       = useState("");

  async function handleGenerate() {
    setGenerating(true);
    try {
      const toneToMentor: Record<string, string> = {
        formal: "JAMES", direct: "PAUL", friendly: "MAILMAN", assertive: "MARK",
      };
      const draftedBy = toneToMentor[selectedTone] ?? "JAMES";
      const result = await callEmailAnalysis("draft_reply", {
        email: { subject: email.subject, sender_name: email.sender_name, sender_email: email.sender_email, body: email.body },
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

  async function handleSaveEdit(draftId: string) {
    await updateEmailDraft(draftId, { body: editBody });
    onDraftUpdated(draftId, editBody);
    setEditingId(null);
  }

  async function handleCopy(draft: EmailDraft) {
    await navigator.clipboard.writeText(draft.body);
    setCopiedId(draft.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function handleProposeSend(draft: EmailDraft) {
    await proposeAction({
      action_type: "email_draft_send",
      title: `Send reply to "${email.subject}"`,
      description: `Propose sending the ${draft.tone} draft by ${draft.drafted_by} to ${email.sender_name} <${email.sender_email}>. Copy and send from your own email client.`,
      proposed_by: draft.drafted_by,
      payload: { email_id: email.id, draft_id: draft.id, subject: email.subject, recipient: email.sender_email, tone: draft.tone, body_preview: draft.body.slice(0, 200) },
    });
    setProposedSendIds(prev => new Set(prev).add(draft.id));
    onApprovalCreated?.();
  }

  function handleUseDraft(draft: EmailDraft) {
    setInjectedId(draft.id);
    setReplyBody(draft.body);
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-6 py-4 border-b flex items-center gap-3 flex-shrink-0" style={{ borderColor: BORDER }}>
        <button onClick={onBack} className="text-xs font-bold tracking-widest uppercase transition-opacity hover:opacity-70 flex items-center gap-1.5"
          style={{ color: DIM }}>
          <ChevronDown size={12} style={{ transform: "rotate(90deg)" }} /> Back
        </button>
        <div className="w-px h-4" style={{ backgroundColor: BORDER }} />
        <MessageSquare size={14} style={{ color: GOLD }} />
        <span className="text-sm font-bold" style={{ color: "#FFF" }}>Draft Reply</span>
        <span className="text-xs truncate" style={{ color: DIM }}>to {email.sender_name}</span>
        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          <Shield size={12} style={{ color: GOLD }} />
          <span className="text-xs" style={{ color: DIM }}>
            <span style={{ color: GOLD, fontWeight: 700 }}>Send Lock</span> — you send, team drafts
          </span>
        </div>
      </div>

      {/* FIX 5: scrollable center */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="max-w-2xl flex flex-col gap-5">
          {/* Tone selector + generate */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-bold tracking-widests uppercase" style={{ color: DIM }}>Select Tone</p>
            <div className="flex gap-2 flex-wrap">
              {TONE_OPTIONS.map(t => (
                <button key={t.id} onClick={() => setSelectedTone(t.id)}
                  className="px-4 py-2 rounded-xl text-xs font-bold tracking-wider uppercase transition-all"
                  style={selectedTone === t.id
                    ? { backgroundColor: t.color + "22", color: t.color, border: `1px solid ${t.color}66` }
                    : { backgroundColor: CARD, color: MUTED, border: `1px solid ${BORDER}` }}>
                  {t.label}
                </button>
              ))}
            </div>
            <button onClick={handleGenerate} disabled={generating}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold tracking-wider uppercase transition-all hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: GOLD, color: NAVY }}>
              {generating ? <Loader size={14} className="animate-spin" /> : <MessageSquare size={14} />}
              {generating ? "Drafting..." : "Generate Draft"}
            </button>
          </div>

          {/* FIX 4: Reply editor — shows injected draft */}
          {injectedId && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold tracking-widests uppercase" style={{ color: DIM }}>Reply Editor</p>
                <button onClick={() => { setInjectedId(null); setReplyBody(""); }}
                  className="text-xs opacity-50 hover:opacity-80" style={{ color: MUTED }}>Clear</button>
              </div>
              <textarea value={replyBody} onChange={e => setReplyBody(e.target.value)} rows={10}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-y leading-relaxed"
                style={{ backgroundColor: NAVY, color: TEXT, border: `1px solid ${GOLD}44`, lineHeight: "1.8" }} />
              <div className="flex gap-2">
                <button onClick={async () => { await navigator.clipboard.writeText(replyBody); }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold tracking-wider uppercase"
                  style={{ backgroundColor: GOLD, color: NAVY }}>
                  <Copy size={12} /> Copy to Send
                </button>
                <button onClick={() => { setInjectedId(null); setReplyBody(""); }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold tracking-wider uppercase"
                  style={{ backgroundColor: CARD, color: MUTED, border: `1px solid ${BORDER}` }}>
                  <X size={12} /> Discard
                </button>
              </div>
            </div>
          )}

          {/* Draft list — full readable blocks */}
          {drafts.length > 0 && (
            <div className="flex flex-col gap-4">
              <p className="text-xs font-bold tracking-widests uppercase" style={{ color: DIM }}>Generated Drafts ({drafts.length})</p>
              {drafts.map(draft => {
                const toneColor = TONE_OPTIONS.find(t => t.id === draft.tone)?.color ?? GOLD;
                const isEditing = editingId === draft.id;
                return (
                  <div key={draft.id} className="rounded-2xl overflow-hidden"
                    style={{ border: `1px solid ${draft.approved_by_user ? "rgba(74,222,128,0.3)" : BORDER}`, backgroundColor: CARD }}>
                    {/* Draft header */}
                    <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: BORDER }}>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-lg"
                          style={{ backgroundColor: toneColor + "22", color: toneColor }}>{draft.tone}</span>
                        <span className="text-xs" style={{ color: MUTED }}>by {draft.drafted_by}</span>
                        {draft.approved_by_user && (
                          <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "#4ADE80" }}>Approved</span>
                        )}
                      </div>
                      {/* FIX 4: Use Draft button */}
                      {!isEditing && (
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => handleUseDraft(draft)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider uppercase transition-opacity hover:opacity-90"
                            style={{ backgroundColor: GOLD, color: NAVY }}>
                            <Check size={11} /> Use Draft
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Full draft body — no clipping */}
                    <div className="px-5 py-4">
                      {isEditing ? (
                        <div className="flex flex-col gap-3">
                          <textarea value={editBody} onChange={e => setEditBody(e.target.value)}
                            rows={12} className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-y leading-relaxed"
                            style={{ backgroundColor: NAVY, color: TEXT, border: `1px solid ${BORDER}` }} />
                          <div className="flex gap-2">
                            <button onClick={() => handleSaveEdit(draft.id)}
                              className="flex-1 px-4 py-2 rounded-lg text-sm font-bold tracking-wider uppercase"
                              style={{ backgroundColor: GOLD, color: NAVY }}>Save</button>
                            <button onClick={() => setEditingId(null)}
                              className="flex-1 px-4 py-2 rounded-lg text-sm font-bold tracking-wider uppercase"
                              style={{ backgroundColor: NAVY, color: MUTED, border: `1px solid ${BORDER}` }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* FIX 4: Full readable draft body */}
                          <p className="text-sm leading-relaxed whitespace-pre-wrap mb-4" style={{ color: TEXT, lineHeight: "1.8" }}>
                            {draft.body}
                          </p>
                          <div className="flex gap-2 flex-wrap pt-2 border-t" style={{ borderColor: BORDER }}>
                            <button onClick={() => handleCopy(draft)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider uppercase transition-opacity hover:opacity-90"
                              style={{ backgroundColor: "#1B2A4A", color: MUTED, border: `1px solid ${BORDER}` }}>
                              {copiedId === draft.id ? <Check size={11} style={{ color: "#4ADE80" }} /> : <Copy size={11} />}
                              {copiedId === draft.id ? "Copied!" : "Copy"}
                            </button>
                            <button onClick={() => { setEditingId(draft.id); setEditBody(draft.body); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider uppercase transition-opacity hover:opacity-90"
                              style={{ backgroundColor: "#1B2A4A", color: MUTED, border: `1px solid ${BORDER}` }}>
                              <FileText size={11} /> Edit
                            </button>
                            {proposedSendIds.has(draft.id) ? (
                              <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-widest uppercase"
                                style={{ color: "#F59E0B", backgroundColor: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
                                <Clock size={10} /> Queued
                              </span>
                            ) : (
                              <button onClick={() => handleProposeSend(draft)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider uppercase transition-opacity hover:opacity-90"
                                style={{ backgroundColor: "rgba(245,158,11,0.08)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.2)" }}>
                                <Shield size={11} /> Propose Send
                              </button>
                            )}
                            <button onClick={() => { onDraftDeleted(draft.id); deleteEmailDraft(draft.id); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider uppercase transition-opacity hover:opacity-70"
                              style={{ color: "#F87171" }}>
                              <Trash2 size={11} /> Discard
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Email Reader (renders in CENTER panel) ─────────────────────────────── */

interface EmailReaderProps {
  email: Email;
  attachments: EmailAttachment[];
  onArchive: (e: React.MouseEvent) => void;
}

function EmailReader({ email, attachments, onArchive }: EmailReaderProps) {
  const [previewAttId, setPreviewAttId] = useState<string | null>(null);
  const previewAtt = attachments.find(a => a.id === previewAttId) ?? null;

  return (
    <>
      {/* FIX 5: scrollable center */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: TEXT, lineHeight: "1.85" }}>
          {email.body}
        </p>

        {attachments.length > 0 && (
          <div className="mt-7 pt-5 border-t" style={{ borderColor: BORDER }}>
            <div className="flex items-center gap-2 mb-3">
              <Paperclip size={13} style={{ color: MUTED }} />
              <p className="text-xs font-bold tracking-widest uppercase" style={{ color: MUTED }}>Attachments ({attachments.length})</p>
            </div>
            <div className="flex flex-col gap-2">
              {attachments.map(att => (
                <div key={att.id}>
                  <div
                    className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setPreviewAttId(previewAttId === att.id ? null : att.id)}
                    style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
                    <FileText size={14} style={{ color: att.routed_to ? ROUTED_MENTOR_COLORS[att.routed_to] ?? GOLD : MUTED }} />
                    <p className="flex-1 text-sm font-semibold" style={{ color: TEXT }}>{att.filename}</p>
                    {att.routed_to && (
                      <span className="text-xs font-bold tracking-widest uppercase px-2 py-0.5 rounded"
                        style={{ backgroundColor: (ROUTED_MENTOR_COLORS[att.routed_to] ?? GOLD) + "22", color: ROUTED_MENTOR_COLORS[att.routed_to] ?? GOLD }}>
                        {att.routed_to}
                      </span>
                    )}
                    {/* FIX 6: clickable if readable */}
                    {att.content
                      ? <span className="text-[10px] font-bold tracking-widests uppercase" style={{ color: "#4ADE80" }}>Preview</span>
                      : <span className="text-[10px]" style={{ color: DIM }}>No preview</span>
                    }
                  </div>
                  {/* FIX 6: inline preview */}
                  {previewAtt?.id === att.id && (
                    <div className="mt-1 rounded-xl px-4 py-3" style={{ backgroundColor: NAVY, border: `1px solid ${BORDER}` }}>
                      {att.content ? (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap font-mono" style={{ color: MUTED }}>
                          {att.content.slice(0, 2000)}{att.content.length > 2000 ? "\n\n[truncated…]" : ""}
                        </p>
                      ) : (
                        <p className="text-sm" style={{ color: DIM }}>Preview not available — filename stored only</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Send Lock bar */}
      <div className="px-6 py-3 border-t flex-shrink-0" style={{ borderColor: BORDER }}>
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg"
          style={{ backgroundColor: "rgba(201,168,76,0.05)", border: "1px solid rgba(201,168,76,0.12)" }}>
          <Shield size={11} style={{ color: GOLD, flexShrink: 0 }} />
          <p className="text-xs" style={{ color: MUTED }}>
            <span style={{ color: GOLD, fontWeight: 700 }}>SEND LOCK —</span> Use Draft Reply in the right rail. Copy and send from your email client.
          </p>
        </div>
      </div>
    </>
  );
}

/* ── Main Email View ─────────────────────────────────────────────────────── */

export default function EmailView({ onPendingChange }: { onPendingChange?: (count: number) => void }) {
  const [emails,            setEmails]            = useState<Email[]>([]);
  const [loading,           setLoading]           = useState(true);
  const [selectedEmail,     setSelectedEmail]     = useState<Email | null>(null);
  const [attachments,       setAttachments]       = useState<EmailAttachment[]>([]);
  const [analysis,          setAnalysis]          = useState<EmailAnalysis | null>(null);
  const [drafts,            setDrafts]            = useState<EmailDraft[]>([]);
  const [showIngest,        setShowIngest]        = useState(false);
  const [showArchived,      setShowArchived]      = useState(false);
  const [deleteProposedIds, setDeleteProposedIds] = useState<Set<string>>(new Set());
  const [centerMode,        setCenterMode]        = useState<CenterMode>("email");
  const loadedEmailId = useRef<string | null>(null);

  async function handleApprovalCreated() {
    const count = await getPendingCount();
    onPendingChange?.(count);
  }

  useEffect(() => {
    listEmails().then(data => { setEmails(data); setLoading(false); });
  }, []);

  async function handleSelectEmail(email: Email) {
    if (loadedEmailId.current === email.id) return;
    loadedEmailId.current = email.id;
    setSelectedEmail(email);
    setAttachments([]);
    setAnalysis(null);
    setDrafts([]);
    setCenterMode("email");

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

  async function handleArchive(email: Email, e: React.MouseEvent) {
    e.stopPropagation();
    await archiveEmail(email.id);
    setEmails(prev => prev.map(em => em.id === email.id ? { ...em, archived: true } : em));
    if (selectedEmail?.id === email.id) { setSelectedEmail(null); loadedEmailId.current = null; setCenterMode("email"); }
  }

  async function handleDelete(email: Email, e: React.MouseEvent) {
    e.stopPropagation();
    await proposeAction({
      action_type: "email_delete",
      title: `Delete email: "${email.subject}"`,
      description: `Permanently delete email from ${email.sender_name}. Cannot be undone.`,
      proposed_by: "SYSTEM",
      payload: { email_id: email.id, subject: email.subject, sender: email.sender_email },
    });
    const newCount = await getPendingCount();
    onPendingChange?.(newCount);
    setDeleteProposedIds(prev => new Set(prev).add(email.id));
  }

  function handleIngestSaved(email: Email) {
    setEmails(prev => [email, ...prev]);
    setShowIngest(false);
    loadedEmailId.current = null;
    handleSelectEmail(email);
  }

  /* FIX 3: Clear wipes all analysis state completely */
  function handleClearAnalysis() {
    setAnalysis(null);
    setCenterMode("email");
  }

  const active      = emails.filter(e => !e.archived);
  const archived    = emails.filter(e => e.archived);
  const displayed   = showArchived ? archived : active;
  const unreadCount = active.filter(e => !e.is_read).length;

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden" style={{ backgroundColor: NAVY, color: "#FFF" }}>
      {showIngest && <IngestModal onClose={() => setShowIngest(false)} onSave={handleIngestSaved} />}

      {/* ── LEFT: Inbox sidebar (260px, fixed) ──────────────────────────── */}
      <div className="flex-shrink-0 flex flex-col border-r" style={{ width: "260px", minWidth: "260px", borderColor: BORDER, backgroundColor: SIDEBAR_BG }}>
        <div className="px-4 py-3.5 border-b flex items-center justify-between flex-shrink-0" style={{ borderColor: BORDER }}>
          <div className="flex items-center gap-2">
            <Inbox size={14} style={{ color: GOLD }} />
            <span className="text-xs font-bold tracking-widest uppercase" style={{ color: MUTED }}>Inbox</span>
            {unreadCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: GOLD, color: NAVY }}>{unreadCount}</span>
            )}
          </div>
          <button onClick={() => setShowIngest(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold tracking-widest uppercase transition-opacity hover:opacity-90"
            style={{ backgroundColor: GOLD, color: NAVY }}>
            <Plus size={11} /> Add
          </button>
        </div>

        <div className="flex border-b flex-shrink-0" style={{ borderColor: BORDER }}>
          <button onClick={() => setShowArchived(false)}
            className="flex-1 py-2.5 text-[11px] font-bold tracking-widest uppercase transition-all"
            style={{ color: !showArchived ? GOLD : DIM, borderBottom: !showArchived ? `2px solid ${GOLD}` : "2px solid transparent" }}>
            Active ({active.length})
          </button>
          <button onClick={() => setShowArchived(true)}
            className="flex-1 py-2.5 text-[11px] font-bold tracking-widest uppercase transition-all"
            style={{ color: showArchived ? GOLD : DIM, borderBottom: showArchived ? `2px solid ${GOLD}` : "2px solid transparent" }}>
            Archived ({archived.length})
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && <p className="text-sm p-4" style={{ color: MUTED }}>Loading...</p>}
          {!loading && displayed.length === 0 && (
            <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
              <Mail size={22} style={{ color: DIM }} />
              <p className="text-sm" style={{ color: MUTED }}>
                {showArchived ? "No archived emails." : "No emails yet.\nClick Add to paste one in."}
              </p>
            </div>
          )}
          {displayed.map(email => {
            const isSelected = selectedEmail?.id === email.id;
            return (
              <button key={email.id} onClick={() => handleSelectEmail(email)}
                className="w-full text-left px-3.5 py-3.5 border-b transition-all hover:opacity-90 group relative"
                style={{
                  borderColor: BORDER,
                  backgroundColor: isSelected ? "rgba(201,168,76,0.07)" : "transparent",
                  borderLeft: isSelected ? `3px solid ${GOLD}` : "3px solid transparent",
                }}>
                <div className="flex items-start gap-2">
                  {!email.is_read && (
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-2" style={{ backgroundColor: GOLD }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: email.is_read ? MUTED : "#FFF" }}>
                      {email.sender_name || email.sender_email}
                    </p>
                    <p className="text-xs truncate mt-0.5" style={{ color: email.is_read ? DIM : TEXT }}>
                      {email.subject}
                    </p>
                    <p className="text-[10px] mt-1" style={{ color: DIM }}>
                      {new Date(email.received_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <div className="flex-shrink-0 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={e => handleArchive(email, e)} className="p-1.5 rounded hover:bg-white/5" title="Archive">
                      <Archive size={11} style={{ color: DIM }} />
                    </button>
                    {deleteProposedIds.has(email.id)
                      ? <span className="p-1.5 rounded"><Clock size={11} style={{ color: "#F59E0B" }} /></span>
                      : <button onClick={e => handleDelete(email, e)} className="p-1.5 rounded hover:bg-white/5" title="Queue delete">
                          <Trash2 size={11} style={{ color: "#F87171" }} />
                        </button>
                    }
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="px-4 py-3 border-t flex-shrink-0" style={{ borderColor: BORDER }}>
          <div className="flex items-center gap-1.5">
            <Shield size={11} style={{ color: GOLD, flexShrink: 0 }} />
            <p className="text-[11px]" style={{ color: DIM }}>
              <span style={{ color: GOLD, fontWeight: 700 }}>Send Lock</span> — Team drafts. You send.
            </p>
          </div>
        </div>
      </div>

      {/* ── CENTER: full-height mode-switched panel ──────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden border-r" style={{ borderColor: BORDER }}>
        {!selectedEmail ? (
          /* Empty state */
          <div className="flex flex-col h-full">
            <div className="px-6 py-4 border-b flex-shrink-0" style={{ borderColor: BORDER }}>
              <div className="flex items-center gap-2" style={{ color: DIM }}>
                <Mail size={14} /> <span className="text-sm font-semibold">No email selected</span>
              </div>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center gap-6 px-10">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "rgba(201,168,76,0.06)", border: `1px solid rgba(201,168,76,0.12)` }}>
                <Mail size={28} style={{ color: GOLD, opacity: 0.4 }} />
              </div>
              <div className="text-center max-w-sm">
                <p className="text-base font-semibold mb-2" style={{ color: MUTED }}>Email workspace ready</p>
                <p className="text-sm leading-relaxed" style={{ color: DIM }}>
                  Select an email from the inbox or add one. Analysis and drafting open in this panel for full readability.
                </p>
              </div>
              <button onClick={() => setShowIngest(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold tracking-wider uppercase hover:opacity-90"
                style={{ backgroundColor: GOLD, color: NAVY }}>
                <Plus size={14} /> Add First Email
              </button>
            </div>
          </div>
        ) : centerMode === "email" ? (
          <>
            {/* Email header */}
            <div className="px-6 py-4 border-b flex-shrink-0" style={{ borderColor: BORDER }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold leading-snug" style={{ color: "#FFF" }}>{selectedEmail.subject}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-sm font-semibold" style={{ color: GOLD }}>{selectedEmail.sender_name}</span>
                    <span className="text-sm" style={{ color: MUTED }}>&lt;{selectedEmail.sender_email}&gt;</span>
                    <span className="text-xs" style={{ color: DIM }}>
                      {new Date(selectedEmail.received_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
                <button onClick={e => handleArchive(selectedEmail, e)}
                  className="p-2 rounded-lg transition-opacity hover:opacity-70 flex-shrink-0"
                  style={{ backgroundColor: "#1B2A4A" }}>
                  <Archive size={13} style={{ color: MUTED }} />
                </button>
              </div>
            </div>
            <EmailReader email={selectedEmail} attachments={attachments} onArchive={e => handleArchive(selectedEmail, e)} />
          </>
        ) : centerMode === "analysis" ? (
          <AnalysisView
            email={selectedEmail}
            analysis={analysis}
            onAnalysisDone={a => setAnalysis(a)}
            onClear={handleClearAnalysis}
            onBack={() => setCenterMode("email")}
          />
        ) : (
          <DraftView
            email={selectedEmail}
            drafts={drafts}
            onDraftCreated={d => setDrafts(prev => [d, ...prev])}
            onDraftUpdated={(id, body) => setDrafts(prev => prev.map(d => d.id === id ? { ...d, body } : d))}
            onDraftDeleted={id => setDrafts(prev => prev.filter(d => d.id !== id))}
            onApprovalCreated={handleApprovalCreated}
            onBack={() => setCenterMode("email")}
          />
        )}
      </div>

      {/* ── RIGHT: Control rail (140px, always visible) ──────────────────── */}
      <div className="flex-shrink-0 flex flex-col" style={{ width: "140px", minWidth: "140px", backgroundColor: RAIL_BG, borderLeft: `1px solid ${BORDER}` }}>
        <div className="px-3 py-3.5 border-b flex-shrink-0" style={{ borderColor: BORDER }}>
          <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: DIM }}>Actions</p>
        </div>

        <div className="flex-1 flex flex-col gap-2 p-3 overflow-y-auto">
          {/* Email button */}
          <button
            onClick={() => setCenterMode("email")}
            disabled={!selectedEmail}
            className="flex flex-col items-center gap-2 px-2 py-3.5 rounded-xl text-center transition-all hover:opacity-90 disabled:opacity-30"
            style={centerMode === "email" && selectedEmail
              ? { backgroundColor: "rgba(201,168,76,0.12)", border: `1px solid rgba(201,168,76,0.3)`, color: GOLD }
              : { backgroundColor: CARD, border: `1px solid ${BORDER}`, color: MUTED }}>
            <Mail size={16} />
            <span className="text-[10px] font-bold tracking-widest uppercase leading-tight">Email</span>
          </button>

          {/* Analysis button */}
          <button
            onClick={() => selectedEmail && setCenterMode("analysis")}
            disabled={!selectedEmail}
            className="flex flex-col items-center gap-2 px-2 py-3.5 rounded-xl text-center transition-all hover:opacity-90 disabled:opacity-30"
            style={centerMode === "analysis"
              ? { backgroundColor: "rgba(201,168,76,0.12)", border: `1px solid rgba(201,168,76,0.3)`, color: GOLD }
              : { backgroundColor: CARD, border: `1px solid ${BORDER}`, color: MUTED }}>
            <Lightbulb size={16} />
            <span className="text-[10px] font-bold tracking-widest uppercase leading-tight">Insights</span>
            {analysis && <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: "#4ADE80" }}>Done</span>}
          </button>

          {/* Draft button */}
          <button
            onClick={() => selectedEmail && setCenterMode("draft")}
            disabled={!selectedEmail}
            className="flex flex-col items-center gap-2 px-2 py-3.5 rounded-xl text-center transition-all hover:opacity-90 disabled:opacity-30"
            style={centerMode === "draft"
              ? { backgroundColor: "rgba(201,168,76,0.12)", border: `1px solid rgba(201,168,76,0.3)`, color: GOLD }
              : { backgroundColor: CARD, border: `1px solid ${BORDER}`, color: MUTED }}>
            <MessageSquare size={16} />
            <span className="text-[10px] font-bold tracking-widest uppercase leading-tight">Draft</span>
            {drafts.length > 0 && (
              <span className="text-[9px] font-bold" style={{ color: GOLD }}>{drafts.length}</span>
            )}
          </button>

          <div className="border-t mt-1 pt-3" style={{ borderColor: BORDER }}>
            {/* Archive */}
            <button
              onClick={e => selectedEmail && handleArchive(selectedEmail, e)}
              disabled={!selectedEmail}
              className="flex flex-col items-center gap-2 px-2 py-3 rounded-xl text-center w-full transition-all hover:opacity-90 disabled:opacity-30"
              style={{ backgroundColor: CARD, border: `1px solid ${BORDER}`, color: DIM }}>
              <Archive size={14} />
              <span className="text-[10px] font-bold tracking-widest uppercase leading-tight">Archive</span>
            </button>
          </div>
        </div>

        {/* Status area */}
        {selectedEmail && (
          <div className="px-3 py-3 border-t flex-shrink-0" style={{ borderColor: BORDER }}>
            <div className="flex flex-col gap-1">
              <Shield size={11} style={{ color: GOLD }} />
              <p className="text-[9px] leading-tight" style={{ color: DIM }}>Send Lock Active</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
