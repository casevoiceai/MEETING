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

const NAVY    = "#0D1B2E";
const CARD    = "#111D30";
const BORDER  = "#1B2A4A";
const GOLD    = "#C9A84C";
const MUTED   = "#A0B4CC";
const DIM     = "#607A96";
const TEXT    = "#D8E8F5";
const SIDEBAR_BG = "#090F1C";
const RIGHT_BG   = "#080F1C";

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

interface AttachmentDraft {
  filename: string;
  content: string;   // text content if readable, empty string otherwise
  readable: boolean;
}

async function readFileAsText(file: File): Promise<AttachmentDraft> {
  const readable = file.type.startsWith("text/") || /\.(txt|md|csv|json|xml|log|html|js|ts|py)$/i.test(file.name);
  if (!readable) return { filename: file.name, content: "", readable: false };
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve({ filename: file.name, content: (e.target?.result as string) ?? "", readable: true });
    reader.onerror = () => resolve({ filename: file.name, content: "", readable: false });
    reader.readAsText(file);
  });
}

/* ── Ingest Modal ────────────────────────────────────────────────────────── */

function IngestModal({ onClose, onSave }: { onClose: () => void; onSave: (email: Email) => void }) {
  const [senderName,  setSenderName]  = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [subject,     setSubject]     = useState("");
  const [body,        setBody]        = useState("");
  const [attachment,  setAttachment]  = useState<AttachmentDraft | null>(null);
  const [saving,      setSaving]      = useState(false);
  const [contacts,    setContacts]    = useState<SavedContact[]>([]);
  const [showContacts, setShowContacts] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setContacts(loadContacts()); }, []);

  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const draft = await readFileAsText(file);
    setAttachment(draft);
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
        subject:     subject.trim(),
        sender_name: senderName.trim()  || "Unknown Sender",
        sender_email:senderEmail.trim() || "unknown@example.com",
        body:        body.trim(),
        received_at: new Date().toISOString(),   // FIX 1: auto timestamp
      });
      saveContact(senderName.trim(), senderEmail.trim());  // FIX 2: remember contact
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
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.78)" }}>
      <div className="flex flex-col rounded-2xl overflow-hidden" style={{ width: "560px", maxHeight: "88vh", backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0" style={{ borderColor: BORDER }}>
          <span className="text-sm font-bold tracking-widest uppercase" style={{ color: GOLD }}>Add Email</span>
          <button onClick={onClose} className="opacity-40 hover:opacity-80 transition-opacity" style={{ color: MUTED }}><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">

          {/* Contact recall banner */}
          {contacts.length > 0 && (
            <div>
              <button
                onClick={() => setShowContacts(v => !v)}
                className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase transition-opacity hover:opacity-80"
                style={{ color: GOLD }}
              >
                <User size={12} />
                {showContacts ? "Hide" : "Use Previous Sender"} ({contacts.length})
                {showContacts ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              {showContacts && (
                <div className="mt-2 flex flex-col gap-1.5 max-h-36 overflow-y-auto rounded-lg border p-2" style={{ borderColor: BORDER, backgroundColor: NAVY }}>
                  {contacts.map((c) => (
                    <button
                      key={c.email}
                      onClick={() => selectContact(c)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-left hover:opacity-80 transition-opacity"
                      style={{ backgroundColor: CARD }}
                    >
                      <span className="text-sm font-semibold" style={{ color: TEXT }}>{c.name || c.email}</span>
                      {c.name && <span className="text-xs" style={{ color: DIM }}>{c.email}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sender row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] tracking-widest uppercase font-bold" style={{ color: MUTED }}>Sender Name</label>
              <input
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="Jane Smith"
                className="px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{ backgroundColor: NAVY, color: TEXT, border: `1px solid ${BORDER}` }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] tracking-widest uppercase font-bold" style={{ color: MUTED }}>Sender Email</label>
              <input
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                placeholder="jane@example.com"
                className="px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{ backgroundColor: NAVY, color: TEXT, border: `1px solid ${BORDER}` }}
              />
            </div>
          </div>

          {/* Subject */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] tracking-widest uppercase font-bold" style={{ color: MUTED }}>
              Subject <span style={{ color: "#F87171" }}>*</span>
            </label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject line"
              className="px-3 py-2.5 rounded-lg text-sm outline-none"
              style={{ backgroundColor: NAVY, color: TEXT, border: `1px solid ${BORDER}` }}
            />
          </div>

          {/* Body */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] tracking-widest uppercase font-bold" style={{ color: MUTED }}>
              Email Body <span style={{ color: "#F87171" }}>*</span>
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Paste the full email body here..."
              rows={8}
              className="px-3 py-2.5 rounded-lg text-sm outline-none resize-none leading-relaxed"
              style={{ backgroundColor: NAVY, color: TEXT, border: `1px solid ${BORDER}` }}
            />
          </div>

          {/* FIX 3: Real file picker */}
          <div className="border-t pt-3" style={{ borderColor: BORDER }}>
            <p className="text-[10px] tracking-widest uppercase font-semibold mb-2" style={{ color: DIM }}>
              Attachment (optional)
            </p>
            <input ref={fileRef} type="file" className="hidden" onChange={pickFile} />
            {!attachment ? (
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80 w-full justify-center border-2 border-dashed"
                style={{ borderColor: BORDER, color: DIM, backgroundColor: "transparent" }}
              >
                <Paperclip size={14} /> Choose File
              </button>
            ) : (
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ backgroundColor: NAVY, border: `1px solid ${BORDER}` }}>
                <FileText size={14} style={{ color: GOLD, flexShrink: 0 }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: TEXT }}>{attachment.filename}</p>
                  <p className="text-xs mt-0.5" style={{ color: attachment.readable ? "#4ADE80" : DIM }}>
                    {attachment.readable ? "Text content will be saved" : "Binary file — filename stored only"}
                  </p>
                </div>
                <button onClick={() => { setAttachment(null); if (fileRef.current) fileRef.current.value = ""; }}
                  className="flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity" style={{ color: MUTED }}>
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t flex-shrink-0" style={{ borderColor: BORDER }}>
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold tracking-wider uppercase transition-opacity hover:opacity-70"
            style={{ backgroundColor: NAVY, color: MUTED, border: `1px solid ${BORDER}` }}>
            Cancel
          </button>
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

/* ── Draft Panel ─────────────────────────────────────────────────────────── */

interface DraftPanelProps {
  email: Email | null;
  drafts: EmailDraft[];
  onDraftCreated: (draft: EmailDraft) => void;
  onDraftUpdated: (draftId: string, body: string) => void;
  onDraftDeleted: (draftId: string) => void;
  onApprovalCreated?: () => void;
}

function DraftPanel({ email, drafts, onDraftCreated, onDraftUpdated, onDraftDeleted, onApprovalCreated }: DraftPanelProps) {
  const [selectedTone,    setSelectedTone]    = useState("direct");
  const [generating,      setGenerating]      = useState(false);
  const [editingId,       setEditingId]       = useState<string | null>(null);
  const [editBody,        setEditBody]        = useState("");
  const [copiedId,        setCopiedId]        = useState<string | null>(null);
  const [expandedId,      setExpandedId]      = useState<string | null>(null);
  const [proposedSendIds, setProposedSendIds] = useState<Set<string>>(new Set());

  async function handleGenerate() {
    if (!email) return;
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
        setExpandedId(saved.id);
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

  async function handleApprove(draft: EmailDraft) {
    await updateEmailDraft(draft.id, { approved_by_user: true });
    onDraftUpdated(draft.id, draft.body);
  }

  async function handleProposeSend(draft: EmailDraft) {
    if (!email) return;
    await proposeAction({
      action_type: "email_draft_send",
      title: `Send reply to "${email.subject}"`,
      description: `Propose sending the ${draft.tone} draft (by ${draft.drafted_by}) as a reply to ${email.sender_name} <${email.sender_email}>. Copy this draft and send from your own email client.`,
      proposed_by: draft.drafted_by,
      payload: { email_id: email.id, draft_id: draft.id, subject: email.subject, recipient: email.sender_email, tone: draft.tone, body_preview: draft.body.slice(0, 200) },
    });
    setProposedSendIds((prev) => new Set(prev).add(draft.id));
    onApprovalCreated?.();
  }

  if (!email) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 px-4 text-center">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(201,168,76,0.07)", border: `1px solid rgba(201,168,76,0.12)` }}>
          <Send size={18} style={{ color: DIM }} />
        </div>
        <p className="text-sm" style={{ color: DIM }}>Select an email to compose a draft reply.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Send lock */}
      <div className="px-4 py-3 rounded-xl" style={{ backgroundColor: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.18)" }}>
        <div className="flex items-center gap-1.5 mb-1">
          <Shield size={12} style={{ color: GOLD }} />
          <p className="text-[11px] font-bold tracking-widest uppercase" style={{ color: GOLD }}>Send Lock Active</p>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: MUTED }}>
          Team drafts replies. Only you send. Copy your chosen draft to your email client.
        </p>
      </div>

      {/* Tone + Generate */}
      <div className="flex flex-col gap-2">
        <p className="text-[11px] tracking-widest uppercase font-bold" style={{ color: DIM }}>Tone</p>
        <div className="flex gap-1.5 flex-wrap">
          {TONE_OPTIONS.map((t) => (
            <button key={t.id} onClick={() => setSelectedTone(t.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider uppercase transition-all"
              style={selectedTone === t.id
                ? { backgroundColor: t.color + "22", color: t.color, border: `1px solid ${t.color}55` }
                : { backgroundColor: NAVY, color: MUTED, border: `1px solid ${BORDER}` }}>
              {t.label}
            </button>
          ))}
        </div>
        <button onClick={handleGenerate} disabled={generating}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold tracking-wider uppercase transition-all hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: GOLD, color: NAVY }}>
          {generating ? <Loader size={13} className="animate-spin" /> : <MessageSquare size={13} />}
          {generating ? "Drafting..." : "Generate Draft"}
        </button>
      </div>

      {/* Draft list */}
      {drafts.length > 0 && (
        <div className="flex flex-col gap-2 pt-1">
          <p className="text-[11px] tracking-widest uppercase font-bold" style={{ color: DIM }}>
            Drafts ({drafts.length})
          </p>
          {drafts.map((draft) => {
            const toneColor = TONE_OPTIONS.find((t) => t.id === draft.tone)?.color ?? GOLD;
            const isExpanded = expandedId === draft.id;
            const isEditing  = editingId  === draft.id;
            return (
              <div key={draft.id} className="rounded-xl overflow-hidden"
                style={{ border: `1px solid ${draft.approved_by_user ? "rgba(74,222,128,0.3)" : BORDER}`, backgroundColor: draft.approved_by_user ? "rgba(74,222,128,0.04)" : CARD }}>
                <button onClick={() => setExpandedId(isExpanded ? null : draft.id)}
                  className="w-full flex items-center justify-between px-3 py-2.5 hover:opacity-90 transition-opacity">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded"
                      style={{ backgroundColor: toneColor + "22", color: toneColor }}>{draft.tone}</span>
                    <span className="text-xs" style={{ color: MUTED }}>by {draft.drafted_by}</span>
                    {draft.approved_by_user && (
                      <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "#4ADE80" }}>Approved</span>
                    )}
                  </div>
                  <ChevronDown size={12} style={{ color: DIM, transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
                </button>

                {isExpanded && (
                  <div className="px-3 pb-3 border-t" style={{ borderColor: BORDER }}>
                    {isEditing ? (
                      <div className="flex flex-col gap-2 pt-2">
                        <textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={6}
                          className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none leading-relaxed"
                          style={{ backgroundColor: NAVY, color: TEXT, border: `1px solid ${BORDER}` }} />
                        <div className="flex gap-2">
                          <button onClick={() => handleSaveEdit(draft.id)}
                            className="flex-1 px-3 py-2 rounded-lg text-xs font-bold tracking-wider uppercase"
                            style={{ backgroundColor: GOLD, color: NAVY }}>Save</button>
                          <button onClick={() => setEditingId(null)}
                            className="flex-1 px-3 py-2 rounded-lg text-xs font-bold tracking-wider uppercase"
                            style={{ backgroundColor: NAVY, color: MUTED, border: `1px solid ${BORDER}` }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-2">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap mb-3" style={{ color: TEXT }}>{draft.body}</p>
                        <div className="flex gap-1.5 flex-wrap">
                          <button onClick={() => handleCopy(draft)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider uppercase transition-all hover:opacity-90"
                            style={{ backgroundColor: "#1B2A4A", color: MUTED, border: `1px solid ${BORDER}` }}>
                            {copiedId === draft.id ? <Check size={11} style={{ color: "#4ADE80" }} /> : <Copy size={11} />}
                            {copiedId === draft.id ? "Copied!" : "Copy"}
                          </button>
                          <button onClick={() => { setEditingId(draft.id); setEditBody(draft.body); }}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider uppercase transition-all hover:opacity-90"
                            style={{ backgroundColor: "#1B2A4A", color: MUTED, border: `1px solid ${BORDER}` }}>
                            <FileText size={11} /> Edit
                          </button>
                          {!draft.approved_by_user && (
                            <button onClick={() => handleApprove(draft)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider uppercase transition-all hover:opacity-90"
                              style={{ backgroundColor: "rgba(74,222,128,0.1)", color: "#4ADE80", border: "1px solid rgba(74,222,128,0.3)" }}>
                              <Check size={11} /> Approve
                            </button>
                          )}
                          {proposedSendIds.has(draft.id) ? (
                            <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-widest uppercase"
                              style={{ color: "#F59E0B", backgroundColor: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
                              <Clock size={10} /> Queued
                            </span>
                          ) : (
                            <button onClick={() => handleProposeSend(draft)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider uppercase transition-all hover:opacity-90"
                              style={{ backgroundColor: "rgba(245,158,11,0.08)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.2)" }}>
                              <Shield size={11} /> Propose Send
                            </button>
                          )}
                          <button onClick={() => { onDraftDeleted(draft.id); deleteEmailDraft(draft.id); }}
                            className="p-1.5 rounded-lg transition-opacity hover:opacity-70" style={{ color: "#F87171" }}>
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Analysis Panel ──────────────────────────────────────────────────────── */

interface AnalysisPanelProps {
  email: Email | null;
  analysis: EmailAnalysis | null;
  onAnalysisDone: (a: EmailAnalysis) => void;
  onClearAnalysis: () => void;
}

function AnalysisPanel({ email, analysis, onAnalysisDone, onClearAnalysis }: AnalysisPanelProps) {
  const [loading,              setLoading]              = useState(false);
  const [mentorInsightLoading, setMentorInsightLoading] = useState<string | null>(null);
  const [insights,             setInsights]             = useState<Record<string, string>>({});
  const [collapsed,            setCollapsed]            = useState<Set<string>>(new Set());

  useEffect(() => {
    setInsights(analysis?.mentor_insights ?? {});
  }, [analysis]);

  function toggleCollapse(key: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  async function handleAnalyze() {
    if (!email) return;
    setLoading(true);
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
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleMentorInsight(mentorName: string) {
    if (!email) return;
    setMentorInsightLoading(mentorName);
    try {
      const result = await callEmailAnalysis("mentor_insight", {
        email: { subject: email.subject, sender_name: email.sender_name, sender_email: email.sender_email, body: email.body },
        mentor: mentorName,
      });
      if (result.insight) {
        const updated = { ...insights, [mentorName]: result.insight };
        setInsights(updated);
        await upsertEmailAnalysis(email.id, { mentor_insights: updated });
      }
    } finally {
      setMentorInsightLoading(null);
    }
  }

  if (!email) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 px-4 text-center">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(201,168,76,0.07)", border: `1px solid rgba(201,168,76,0.12)` }}>
          <Lightbulb size={18} style={{ color: DIM }} />
        </div>
        <p className="text-sm" style={{ color: DIM }}>Select an email to run team analysis.</p>
      </div>
    );
  }

  const routedMentors = (analysis as { routed_mentors?: string[] } & EmailAnalysis | null)?.routed_mentors ?? ["JAMES", "RICK", "MARK"];

  return (
    <div className="flex flex-col gap-3">
      {!analysis ? (
        /* No analysis yet */
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(201,168,76,0.09)" }}>
            <Lightbulb size={18} style={{ color: GOLD }} />
          </div>
          <p className="text-sm" style={{ color: MUTED }}>Team hasn't analyzed this email yet.</p>
          <button onClick={handleAnalyze} disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold tracking-wider uppercase transition-all hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: GOLD, color: NAVY }}>
            {loading ? <Loader size={13} className="animate-spin" /> : <Eye size={13} />}
            {loading ? "Analyzing..." : "Analyze Email"}
          </button>
        </div>
      ) : (
        /* Analysis results */
        <div className="flex flex-col gap-3">

          {/* FIX 5: Clear analysis + re-analyze controls */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded"
              style={{ color: "#4ADE80", backgroundColor: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)" }}>
              Analysis Complete
            </span>
            <div className="flex gap-1.5">
              <button onClick={handleAnalyze} disabled={loading}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-wider uppercase transition-all hover:opacity-80 disabled:opacity-40"
                style={{ backgroundColor: NAVY, color: MUTED, border: `1px solid ${BORDER}` }}>
                <RefreshCw size={11} /> Re-run
              </button>
              <button onClick={onClearAnalysis}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-wider uppercase transition-all hover:opacity-80"
                style={{ backgroundColor: "rgba(248,113,113,0.08)", color: "#F87171", border: "1px solid rgba(248,113,113,0.2)" }}>
                <X size={11} /> Clear
              </button>
            </div>
          </div>

          {/* Summary */}
          {analysis.summary && (
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(201,168,76,0.15)" }}>
              <button onClick={() => toggleCollapse("summary")}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:opacity-90 transition-opacity"
                style={{ backgroundColor: "rgba(201,168,76,0.06)" }}>
                <span className="text-[11px] font-bold tracking-widest uppercase" style={{ color: GOLD }}>Summary</span>
                {collapsed.has("summary") ? <ChevronDown size={12} style={{ color: DIM }} /> : <ChevronUp size={12} style={{ color: DIM }} />}
              </button>
              {!collapsed.has("summary") && (
                <div className="px-4 py-3" style={{ backgroundColor: "rgba(201,168,76,0.04)" }}>
                  <p className="text-sm leading-relaxed" style={{ color: TEXT }}>{analysis.summary}</p>
                </div>
              )}
            </div>
          )}

          {/* Intent */}
          {analysis.intent && (
            <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
              <button onClick={() => toggleCollapse("intent")}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:opacity-90 transition-opacity"
                style={{ backgroundColor: CARD }}>
                <span className="text-[11px] font-bold tracking-widest uppercase" style={{ color: DIM }}>Intent</span>
                {collapsed.has("intent") ? <ChevronDown size={12} style={{ color: DIM }} /> : <ChevronUp size={12} style={{ color: DIM }} />}
              </button>
              {!collapsed.has("intent") && (
                <div className="px-4 py-3" style={{ backgroundColor: CARD }}>
                  <p className="text-sm leading-relaxed" style={{ color: MUTED }}>{analysis.intent}</p>
                </div>
              )}
            </div>
          )}

          {/* Key Points */}
          {analysis.key_points?.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
              <button onClick={() => toggleCollapse("keypoints")}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:opacity-90 transition-opacity"
                style={{ backgroundColor: CARD }}>
                <span className="text-[11px] font-bold tracking-widest uppercase" style={{ color: DIM }}>Key Points</span>
                {collapsed.has("keypoints") ? <ChevronDown size={12} style={{ color: DIM }} /> : <ChevronUp size={12} style={{ color: DIM }} />}
              </button>
              {!collapsed.has("keypoints") && (
                <div className="px-4 py-3 flex flex-col gap-1.5" style={{ backgroundColor: CARD }}>
                  {analysis.key_points.map((p, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="font-bold flex-shrink-0 mt-0.5" style={{ color: GOLD }}>·</span>
                      <p className="text-sm leading-snug" style={{ color: TEXT }}>{p}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Risks */}
          {analysis.risks?.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(249,115,22,0.2)" }}>
              <button onClick={() => toggleCollapse("risks")}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:opacity-90 transition-opacity"
                style={{ backgroundColor: "rgba(249,115,22,0.05)" }}>
                <span className="text-[11px] font-bold tracking-widest uppercase flex items-center gap-1" style={{ color: "#F87171" }}>
                  <AlertTriangle size={11} /> Risks
                </span>
                {collapsed.has("risks") ? <ChevronDown size={12} style={{ color: DIM }} /> : <ChevronUp size={12} style={{ color: DIM }} />}
              </button>
              {!collapsed.has("risks") && (
                <div className="px-4 py-3 flex flex-col gap-2" style={{ backgroundColor: "rgba(249,115,22,0.03)" }}>
                  {analysis.risks.map((r, i) => (
                    <p key={i} className="text-sm leading-snug" style={{ color: "#FB923C" }}>{r}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Opportunities */}
          {analysis.opportunities?.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(74,222,128,0.2)" }}>
              <button onClick={() => toggleCollapse("opps")}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:opacity-90 transition-opacity"
                style={{ backgroundColor: "rgba(74,222,128,0.05)" }}>
                <span className="text-[11px] font-bold tracking-widest uppercase flex items-center gap-1" style={{ color: "#4ADE80" }}>
                  <Lightbulb size={11} /> Opportunities
                </span>
                {collapsed.has("opps") ? <ChevronDown size={12} style={{ color: DIM }} /> : <ChevronUp size={12} style={{ color: DIM }} />}
              </button>
              {!collapsed.has("opps") && (
                <div className="px-4 py-3 flex flex-col gap-2" style={{ backgroundColor: "rgba(74,222,128,0.03)" }}>
                  {analysis.opportunities.map((o, i) => (
                    <p key={i} className="text-sm leading-snug" style={{ color: "#4ADE80" }}>{o}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Suggested Tone */}
          {analysis.suggested_tone && (
            <div className="flex items-center gap-2">
              <p className="text-[11px] tracking-widest uppercase font-bold" style={{ color: DIM }}>Suggested Tone:</p>
              <span className="text-xs font-bold tracking-widest uppercase px-2 py-0.5 rounded"
                style={{ backgroundColor: GOLD + "22", color: GOLD }}>{analysis.suggested_tone}</span>
            </div>
          )}

          {/* Team Insights */}
          <div className="border-t pt-3" style={{ borderColor: BORDER }}>
            <p className="text-[11px] tracking-widests uppercase font-bold mb-2" style={{ color: DIM }}>Team Insights</p>
            <div className="flex flex-col gap-2">
              {routedMentors.map((mentor) => {
                const color    = ROUTED_MENTOR_COLORS[mentor] ?? GOLD;
                const existing = insights[mentor];
                const isLoading= mentorInsightLoading === mentor;
                const isCollapsed = collapsed.has(`mentor-${mentor}`);
                return (
                  <div key={mentor} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${BORDER}`, backgroundColor: NAVY }}>
                    <div className="flex items-center justify-between px-3 py-2.5 gap-2">
                      <span className="text-[11px] font-bold tracking-widest uppercase" style={{ color }}>{mentor}</span>
                      <div className="flex items-center gap-1.5">
                        {existing && (
                          <button onClick={() => toggleCollapse(`mentor-${mentor}`)}
                            className="text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded transition-opacity hover:opacity-70"
                            style={{ color: DIM, backgroundColor: "rgba(255,255,255,0.04)" }}>
                            {isCollapsed ? "Show" : "Hide"}
                          </button>
                        )}
                        {!existing && (
                          <button onClick={() => handleMentorInsight(mentor)} disabled={!!mentorInsightLoading}
                            className="text-xs tracking-widest uppercase font-bold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-70 disabled:opacity-40"
                            style={{ color: GOLD, backgroundColor: GOLD + "15" }}>
                            {isLoading ? "..." : "Ask"}
                          </button>
                        )}
                        {existing && (
                          <button onClick={() => handleMentorInsight(mentor)} disabled={!!mentorInsightLoading}
                            className="p-1 rounded transition-opacity hover:opacity-70 disabled:opacity-40"
                            title="Re-ask">
                            <RefreshCw size={10} style={{ color: DIM }} />
                          </button>
                        )}
                      </div>
                    </div>
                    {existing && !isCollapsed && (
                      <p className="px-3 pb-3 text-sm leading-relaxed" style={{ color: MUTED }}>{existing}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main Email View ─────────────────────────────────────────────────────── */

type RightPanelTab = "analysis" | "draft";

export default function EmailView({ onPendingChange }: { onPendingChange?: (count: number) => void }) {
  const [emails,            setEmails]            = useState<Email[]>([]);
  const [loading,           setLoading]           = useState(true);
  const [selectedEmail,     setSelectedEmail]     = useState<Email | null>(null);
  const [attachments,       setAttachments]       = useState<EmailAttachment[]>([]);
  const [analysis,          setAnalysis]          = useState<EmailAnalysis | null>(null);
  const [drafts,            setDrafts]            = useState<EmailDraft[]>([]);
  const [showIngest,        setShowIngest]        = useState(false);
  const [rightTab,          setRightTab]          = useState<RightPanelTab>("analysis");
  const [showArchived,      setShowArchived]      = useState(false);
  const [deleteProposedIds, setDeleteProposedIds] = useState<Set<string>>(new Set());
  const loadedEmailId = useRef<string | null>(null);

  async function handleApprovalCreated() {
    const count = await getPendingCount();
    onPendingChange?.(count);
  }

  useEffect(() => {
    listEmails().then((data) => { setEmails(data); setLoading(false); });
  }, []);

  async function handleSelectEmail(email: Email) {
    if (loadedEmailId.current === email.id) return;
    loadedEmailId.current = email.id;
    setSelectedEmail(email);
    setAttachments([]);
    setAnalysis(null);
    setDrafts([]);

    if (!email.is_read) {
      await markEmailRead(email.id);
      setEmails((prev) => prev.map((e) => e.id === email.id ? { ...e, is_read: true } : e));
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
    setEmails((prev) => prev.map((em) => em.id === email.id ? { ...em, archived: true } : em));
    if (selectedEmail?.id === email.id) { setSelectedEmail(null); loadedEmailId.current = null; }
  }

  async function handleDelete(email: Email, e: React.MouseEvent) {
    e.stopPropagation();
    await proposeAction({
      action_type: "email_delete",
      title: `Delete email: "${email.subject}"`,
      description: `Permanently delete the email from ${email.sender_name} <${email.sender_email}>. This cannot be undone.`,
      proposed_by: "SYSTEM",
      payload: { email_id: email.id, subject: email.subject, sender: email.sender_email },
    });
    const newCount = await getPendingCount();
    onPendingChange?.(newCount);
    setDeleteProposedIds((prev) => new Set(prev).add(email.id));
  }

  // FIX 7: After saving, email is automatically selected via handleSelectEmail
  function handleIngestSaved(email: Email) {
    setEmails((prev) => [email, ...prev]);
    setShowIngest(false);
    // Reset loadedEmailId so new email always loads
    loadedEmailId.current = null;
    handleSelectEmail(email);
  }

  const active       = emails.filter((e) => !e.archived);
  const archived     = emails.filter((e) => e.archived);
  const displayed    = showArchived ? archived : active;
  const unreadCount  = active.filter((e) => !e.is_read).length;

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden" style={{ backgroundColor: NAVY, color: "#FFFFFF" }}>
      {showIngest && <IngestModal onClose={() => setShowIngest(false)} onSave={handleIngestSaved} />}

      {/* ── LEFT: Inbox sidebar ─────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex flex-col border-r" style={{ width: "280px", minWidth: "280px", borderColor: BORDER, backgroundColor: SIDEBAR_BG }}>
        <div className="px-4 py-3.5 border-b flex items-center justify-between flex-shrink-0" style={{ borderColor: BORDER }}>
          <div className="flex items-center gap-2">
            <Inbox size={14} style={{ color: GOLD }} />
            <span className="text-xs font-bold tracking-widest uppercase" style={{ color: MUTED }}>Inbox</span>
            {unreadCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: GOLD, color: NAVY }}>{unreadCount}</span>
            )}
          </div>
          <button onClick={() => setShowIngest(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold tracking-widest uppercase transition-all hover:opacity-90"
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
            <div className="flex flex-col items-center gap-3 px-5 py-8 text-center">
              <Mail size={22} style={{ color: DIM }} />
              <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
                {showArchived ? "No archived emails." : "No emails yet. Click Add to paste one in."}
              </p>
            </div>
          )}
          {displayed.map((email) => {
            const isSelected = selectedEmail?.id === email.id;
            return (
              <button key={email.id} onClick={() => handleSelectEmail(email)}
                className="w-full text-left px-4 py-3.5 border-b transition-all hover:opacity-90 group relative"
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
                    <p className="text-sm font-semibold truncate" style={{ color: email.is_read ? MUTED : "#FFFFFF" }}>
                      {email.sender_name || email.sender_email}
                    </p>
                    <p className="text-xs truncate mt-0.5" style={{ color: email.is_read ? DIM : TEXT }}>
                      {email.subject}
                    </p>
                    <p className="text-xs mt-1" style={{ color: DIM }}>
                      {new Date(email.received_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <div className="flex-shrink-0 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => handleArchive(email, e)}
                      className="p-1.5 rounded hover:bg-white/5 transition-colors" title="Archive">
                      <Archive size={12} style={{ color: DIM }} />
                    </button>
                    {deleteProposedIds.has(email.id) ? (
                      <span className="p-1.5 rounded" title="Delete queued">
                        <Clock size={12} style={{ color: "#F59E0B" }} />
                      </span>
                    ) : (
                      <button onClick={(e) => handleDelete(email, e)}
                        className="p-1.5 rounded hover:bg-white/5 transition-colors" title="Queue delete">
                        <Trash2 size={12} style={{ color: "#F87171" }} />
                      </button>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Send Lock footer */}
        <div className="px-4 py-3 border-t flex-shrink-0" style={{ borderColor: BORDER }}>
          <div className="flex items-center gap-2">
            <Shield size={11} style={{ color: GOLD, flexShrink: 0 }} />
            <p className="text-[11px] leading-tight" style={{ color: DIM }}>
              <span style={{ color: GOLD, fontWeight: 700 }}>Send Lock</span> — Team drafts. You send.
            </p>
          </div>
        </div>
      </div>

      {/* ── CENTER: Email reader ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 border-r" style={{ borderColor: BORDER }}>
        {!selectedEmail ? (
          <div className="flex-1 flex flex-col">
            <div className="px-6 py-4 border-b flex-shrink-0" style={{ borderColor: BORDER }}>
              <div className="flex items-center gap-2.5">
                <Mail size={15} style={{ color: DIM }} />
                <p className="text-sm font-semibold" style={{ color: DIM }}>No email selected</p>
              </div>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "rgba(201,168,76,0.06)", border: `1px solid rgba(201,168,76,0.12)` }}>
                <Mail size={28} style={{ color: GOLD, opacity: 0.45 }} />
              </div>
              <div className="text-center max-w-sm">
                <p className="text-base font-semibold mb-2" style={{ color: MUTED }}>Email workspace ready</p>
                <p className="text-sm leading-relaxed" style={{ color: DIM }}>
                  Select an email from the inbox to read it here. The team analysis and draft panels on the right activate when you open an email.
                </p>
              </div>
              <button onClick={() => setShowIngest(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold tracking-wider uppercase transition-all hover:opacity-90"
                style={{ backgroundColor: GOLD, color: NAVY }}>
                <Plus size={14} /> Add First Email
              </button>
              <div className="grid grid-cols-3 gap-3 w-full max-w-md mt-1">
                {[
                  { icon: <Plus size={15} style={{ color: GOLD }} />, title: "Add", desc: "Paste any email into the inbox." },
                  { icon: <Eye size={15} style={{ color: "#5A9BD3" }} />, title: "Analyze", desc: "Team flags risks and intent." },
                  { icon: <MessageSquare size={15} style={{ color: "#4ADE80" }} />, title: "Draft", desc: "Team writes a reply for you." },
                ].map((c) => (
                  <div key={c.title} className="px-3 py-3.5 rounded-xl flex flex-col gap-2"
                    style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
                    {c.icon}
                    <p className="text-xs font-bold tracking-wider uppercase" style={{ color: MUTED }}>{c.title}</p>
                    <p className="text-xs leading-relaxed" style={{ color: DIM }}>{c.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="px-6 py-4 border-b flex-shrink-0" style={{ borderColor: BORDER }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold leading-snug" style={{ color: "#FFFFFF" }}>{selectedEmail.subject}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-sm font-semibold" style={{ color: GOLD }}>{selectedEmail.sender_name}</span>
                    <span className="text-sm" style={{ color: MUTED }}>&lt;{selectedEmail.sender_email}&gt;</span>
                    <span className="text-xs" style={{ color: DIM }}>
                      {new Date(selectedEmail.received_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
                <button onClick={(e) => handleArchive(selectedEmail, e)}
                  className="p-2 rounded-lg transition-opacity hover:opacity-70 flex-shrink-0"
                  title="Archive" style={{ backgroundColor: "#1B2A4A" }}>
                  <Archive size={13} style={{ color: MUTED }} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: TEXT, lineHeight: "1.8" }}>
                {selectedEmail.body}
              </p>

              {attachments.length > 0 && (
                <div className="mt-7 pt-5 border-t" style={{ borderColor: BORDER }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Paperclip size={13} style={{ color: MUTED }} />
                    <p className="text-xs font-bold tracking-widest uppercase" style={{ color: MUTED }}>Attachments ({attachments.length})</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {attachments.map((att) => (
                      <div key={att.id} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${BORDER}`, backgroundColor: CARD }}>
                        <div className="flex items-center gap-2 px-3 py-3">
                          <FileText size={14} style={{ color: att.routed_to ? ROUTED_MENTOR_COLORS[att.routed_to] ?? GOLD : MUTED }} />
                          <p className="flex-1 text-sm font-semibold" style={{ color: TEXT }}>{att.filename}</p>
                          {att.routed_to && (
                            <span className="text-xs font-bold tracking-widest uppercase px-2 py-0.5 rounded"
                              style={{ backgroundColor: (ROUTED_MENTOR_COLORS[att.routed_to] ?? GOLD) + "22", color: ROUTED_MENTOR_COLORS[att.routed_to] ?? GOLD }}>
                              {att.routed_to}
                            </span>
                          )}
                        </div>
                        {att.content && (
                          <div className="px-3 pb-3">
                            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: MUTED }}>
                              {att.content.slice(0, 400)}{att.content.length > 400 ? "…" : ""}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t flex-shrink-0" style={{ borderColor: BORDER }}>
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg"
                style={{ backgroundColor: "rgba(201,168,76,0.05)", border: "1px solid rgba(201,168,76,0.1)" }}>
                <Shield size={11} style={{ color: GOLD, flexShrink: 0 }} />
                <p className="text-xs" style={{ color: MUTED }}>
                  <span style={{ color: GOLD, fontWeight: 700 }}>SEND LOCK —</span> Use the Draft panel on the right. Copy your draft and send from your email client.
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── RIGHT: Analysis + Draft — always visible, FIX 4: scrolls independently ── */}
      <div className="flex-shrink-0 flex flex-col min-h-0 overflow-hidden" style={{ width: "340px", minWidth: "340px", borderLeft: `1px solid ${BORDER}`, backgroundColor: RIGHT_BG }}>
        <div className="flex border-b flex-shrink-0" style={{ borderColor: BORDER }}>
          {(["analysis", "draft"] as RightPanelTab[]).map((tab) => (
            <button key={tab} onClick={() => setRightTab(tab)}
              className="flex-1 py-3.5 text-xs font-bold tracking-widest uppercase transition-all"
              style={{
                color: rightTab === tab ? GOLD : DIM,
                borderBottom: rightTab === tab ? `2px solid ${GOLD}` : "2px solid transparent",
              }}>
              {tab === "analysis" ? "Team Insights" : "Draft Reply"}
            </button>
          ))}
        </div>

        {/* FIX 4: overflow-y-auto here ensures independent scrolling */}
        <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
          {rightTab === "analysis" && (
            <AnalysisPanel
              email={selectedEmail}
              analysis={analysis}
              onAnalysisDone={(a) => { setAnalysis(a); }}
              onClearAnalysis={() => setAnalysis(null)}
            />
          )}
          {rightTab === "draft" && (
            <DraftPanel
              email={selectedEmail}
              drafts={drafts}
              onDraftCreated={(d) => setDrafts((prev) => [d, ...prev])}
              onDraftUpdated={(id, body) => setDrafts((prev) => prev.map((d) => d.id === id ? { ...d, body, approved_by_user: d.id === id && d.approved_by_user } : d))}
              onDraftDeleted={(id) => setDrafts((prev) => prev.filter((d) => d.id !== id))}
              onApprovalCreated={handleApprovalCreated}
            />
          )}
        </div>
      </div>
    </div>
  );
}
