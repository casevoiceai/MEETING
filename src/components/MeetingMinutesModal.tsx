import { useState } from "react";
import {
  X, Printer, Copy, Check, Save, Tag, Plus, Trash2,
  ChevronDown, ChevronUp, FileText, Loader, Pin, AlertCircle,
  MessageSquare,
} from "lucide-react";
import { supabase } from "../lib/supabase";

/* ── Constants ──────────────────────────────────────────────────────────── */

const NAVY   = "#0D1B2E";
const CARD   = "#0A1628";
const BORDER = "#1B2A4A";
const GOLD   = "#C9A84C";
const MUTED  = "#8A9BB5";
const DIM    = "#4A6080";
const TEXT   = "#D0DFEE";

/* ── Types ───────────────────────────────────────────────────────────────── */

export interface MeetingMessage {
  speaker: string;
  text: string;
  isFounder?: boolean;
  isJulie?: boolean;
  isSystem?: boolean;
}

interface EodCloseout {
  accomplished: string;
  open_items: string[];
  next_action: string;
  needs_followup_tasks: boolean;
}

interface TagCategories {
  project:   string[];
  topic:     string[];
  member:    string[];
  risk:      string[];
  decision:  string[];
  action:    string[];
}

const EMPTY_TAG_CATS: TagCategories = {
  project: [], topic: [], member: [], risk: [], decision: [], action: [],
};

const EMPTY_EOD: EodCloseout = {
  accomplished: "",
  open_items: [],
  next_action: "",
  needs_followup_tasks: false,
};

const TAG_CAT_LABELS: Record<keyof TagCategories, { label: string; color: string }> = {
  project:  { label: "Project",     color: "#5A9BD3" },
  topic:    { label: "Topic",       color: "#C9A84C" },
  member:   { label: "Team Member", color: "#4ADE80" },
  risk:     { label: "Risk",        color: "#F87171" },
  decision: { label: "Decision",    color: "#A78BFA" },
  action:   { label: "Action Item", color: "#FB923C" },
};

/* ── Clipboard ───────────────────────────────────────────────────────────── */

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

/* ── Markdown builder ────────────────────────────────────────────────────── */

interface AllData {
  title: string;
  topic: string;
  participants: string[];
  key_points: string[];
  decisions: string[];
  open_questions: string[];
  action_items: string[];
  risks: string[];
  julie_review: string;
  post_followups: string[];
  unresolved: string[];
  pinned_ideas: string[];
  rejected_ideas: string[];
  eod_closeout: EodCloseout;
  tags: string[];
}

function buildMinutesText(d: AllData): string {
  const ts = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const section = (title: string, items: string[]) =>
    items.length > 0 ? `## ${title}\n${items.map(i => `- ${i}`).join("\n")}` : "";

  const textSection = (title: string, body: string) =>
    body.trim() ? `## ${title}\n${body.trim()}` : "";

  const parts = [
    `# ${d.title || "Meeting Minutes"}`,
    `**Date:** ${ts}`,
    d.topic ? `**Topic:** ${d.topic}` : "",
    d.participants.length > 0 ? `**Participants:** ${d.participants.join(", ")}` : "",
    "",
    textSection("Julie Review", d.julie_review),
    section("Key Discussion Points", d.key_points),
    section("Decisions Made", d.decisions),
    section("Action Items", d.action_items),
    section("Open Questions", d.open_questions),
    section("Risks & Blockers", d.risks),
    section("Post-Discussion Follow-Ups", d.post_followups),
    section("Discussed but Not Resolved", d.unresolved),
    section("Put a Pin in It", d.pinned_ideas),
    section("Deleted / Rejected Ideas", d.rejected_ideas),
    /* EOD closeout */
    ...(d.eod_closeout.accomplished || d.eod_closeout.next_action || d.eod_closeout.open_items.length > 0
      ? [
          "## EOD Meeting Closeout",
          d.eod_closeout.accomplished ? `**Accomplished:** ${d.eod_closeout.accomplished}` : "",
          d.eod_closeout.open_items.length > 0
            ? `**Still Open:**\n${d.eod_closeout.open_items.map(i => `- ${i}`).join("\n")}`
            : "",
          d.eod_closeout.next_action ? `**Next Recommended Action:** ${d.eod_closeout.next_action}` : "",
          `**Needs Follow-Up Tasks:** ${d.eod_closeout.needs_followup_tasks ? "Yes" : "No"}`,
        ]
      : []),
    /* Tags */
    d.tags.length > 0 ? `## Tags\n${d.tags.join(", ")}` : "",
  ].filter(Boolean);

  return parts.join("\n\n");
}

/* ── Parse transcript ────────────────────────────────────────────────────── */

function parseTranscript(messages: MeetingMessage[]) {
  const nonSystem = messages.filter(m => !m.isSystem);
  const participants = [...new Set(
    nonSystem.filter(m => !m.isFounder && !m.isJulie).map(m => m.speaker)
  )];
  const memberLines = nonSystem.filter(m => !m.isFounder && !m.isJulie);
  const founderLines = nonSystem.filter(m => m.isFounder);

  const key_points = memberLines.slice(0, 8).map(m =>
    `${m.speaker}: ${m.text.length > 120 ? m.text.slice(0, 120) + "…" : m.text}`
  );

  const decisions: string[] = [];
  const action_items: string[] = [];
  const risks: string[] = [];
  const open_questions: string[] = [];

  for (const m of nonSystem) {
    const t = m.text;
    if (/\bdecid|agreed|resolved|confirm|we (will|should|are going to)\b/i.test(t))
      decisions.push(t.length > 140 ? t.slice(0, 140) + "…" : t);
    if (/\baction|follow.?up|to.?do|assign|task|owner|deadline|by (monday|tuesday|wednesday|thursday|friday|eod|next week)\b/i.test(t))
      action_items.push(t.length > 140 ? t.slice(0, 140) + "…" : t);
    if (/\brisk|block|concern|issue|problem|danger|liability|warn\b/i.test(t))
      risks.push(t.length > 140 ? t.slice(0, 140) + "…" : t);
    if (/\?/.test(t) && founderLines.includes(m))
      open_questions.push(t.length > 140 ? t.slice(0, 140) + "…" : t);
  }

  return {
    topic: founderLines[0]?.text ?? "",
    participants,
    key_points: key_points.slice(0, 8),
    decisions:  decisions.slice(0, 5),
    open_questions: open_questions.slice(0, 5),
    action_items: action_items.slice(0, 5),
    risks: risks.slice(0, 5),
  };
}

/* ── Section wrapper ─────────────────────────────────────────────────────── */

function Section({
  label, count, children, color = GOLD, defaultOpen = true,
}: {
  label: string; count?: number; children: React.ReactNode; color?: string; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:opacity-90"
        style={{ backgroundColor: CARD }}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold tracking-widest uppercase" style={{ color }}>{label}</span>
          {count !== undefined && count > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: color + "22", color }}>{count}</span>
          )}
        </div>
        {open ? <ChevronUp size={13} style={{ color: DIM }} /> : <ChevronDown size={13} style={{ color: DIM }} />}
      </button>
      {open && <div className="px-4 pb-4 pt-2 flex flex-col gap-2">{children}</div>}
    </div>
  );
}

/* ── Editable list ───────────────────────────────────────────────────────── */

function EditableList({
  items, onChange, placeholder, color,
}: {
  items: string[]; onChange: (items: string[]) => void; placeholder: string; color: string;
}) {
  function update(i: number, val: string) {
    const next = [...items]; next[i] = val; onChange(next);
  }
  function remove(i: number) { onChange(items.filter((_, idx) => idx !== i)); }
  function add() { onChange([...items, ""]); }

  return (
    <div className="flex flex-col gap-1.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="mt-2.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
          <input
            value={item}
            onChange={e => update(i, e.target.value)}
            className="flex-1 px-2.5 py-1.5 rounded-lg text-sm outline-none"
            style={{ backgroundColor: NAVY, color: TEXT, border: `1px solid ${BORDER}` }}
            placeholder={placeholder}
          />
          <button onClick={() => remove(i)} className="mt-1.5 opacity-40 hover:opacity-80" style={{ color: "#F87171" }}>
            <Trash2 size={12} />
          </button>
        </div>
      ))}
      <button onClick={add}
        className="flex items-center gap-1.5 text-xs font-semibold mt-1 w-fit hover:opacity-80"
        style={{ color }}>
        <Plus size={12} /> Add item
      </button>
    </div>
  );
}

/* ── Tag input ───────────────────────────────────────────────────────────── */

function TagInput({ cat, values, onChange }: {
  cat: keyof TagCategories; values: string[]; onChange: (cat: keyof TagCategories, values: string[]) => void;
}) {
  const [input, setInput] = useState("");
  const cfg = TAG_CAT_LABELS[cat];

  function addTag() {
    const v = input.trim();
    if (!v || values.includes(v)) { setInput(""); return; }
    onChange(cat, [...values, v]); setInput("");
  }

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: cfg.color }}>{cfg.label}</p>
      <div className="flex flex-wrap gap-1.5">
        {values.map(tag => (
          <span key={tag} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
            style={{ backgroundColor: cfg.color + "18", color: cfg.color, border: `1px solid ${cfg.color}44` }}>
            {tag}
            <button onClick={() => onChange(cat, values.filter(t => t !== tag))} className="opacity-60 hover:opacity-100">
              <X size={10} />
            </button>
          </span>
        ))}
        <div className="flex items-center gap-1">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
            placeholder={`+ ${cfg.label}`}
            className="px-2 py-1 rounded-lg text-[11px] outline-none w-28"
            style={{ backgroundColor: NAVY, color: TEXT, border: `1px solid ${BORDER}` }}
          />
          <button onClick={addTag}
            className="p-1 rounded-lg hover:opacity-80"
            style={{ backgroundColor: cfg.color + "20", color: cfg.color }}>
            <Plus size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Modal ──────────────────────────────────────────────────────────── */

interface MeetingMinutesModalProps {
  messages: MeetingMessage[];
  onClose: () => void;
}

export default function MeetingMinutesModal({ messages, onClose }: MeetingMinutesModalProps) {
  const parsed = parseTranscript(messages);

  /* Core fields */
  const [title,        setTitle]        = useState("Meeting Minutes");
  const [topic,        setTopic]        = useState(parsed.topic);
  const [participants, setParticipants] = useState<string[]>(parsed.participants);
  const [keyPoints,    setKeyPoints]    = useState<string[]>(parsed.key_points);
  const [decisions,    setDecisions]    = useState<string[]>(parsed.decisions);
  const [openQs,       setOpenQs]       = useState<string[]>(parsed.open_questions);
  const [actionItems,  setActionItems]  = useState<string[]>(parsed.action_items);
  const [risks,        setRisks]        = useState<string[]>(parsed.risks);

  /* v2 fields */
  const [julieReview,   setJulieReview]   = useState("");
  const [postFollowups, setPostFollowups] = useState<string[]>([]);
  const [unresolved,    setUnresolved]    = useState<string[]>([]);
  const [pinnedIdeas,   setPinnedIdeas]   = useState<string[]>([]);
  const [rejectedIdeas, setRejectedIdeas] = useState<string[]>([]);
  const [eod,           setEod]           = useState<EodCloseout>(EMPTY_EOD);

  /* Tags */
  const [tagCats, setTagCats] = useState<TagCategories>(EMPTY_TAG_CATS);

  /* UI state */
  const [tab,       setTab]       = useState<"edit" | "preview" | "tags">("edit");
  const [copied,    setCopied]    = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [savedId,   setSavedId]   = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const allTags = Object.entries(tagCats).flatMap(([cat, vals]) =>
    (vals as string[]).map(v => `${cat}:${v}`)
  );

  const currentData: AllData = {
    title, topic, participants,
    key_points: keyPoints, decisions,
    open_questions: openQs, action_items: actionItems, risks,
    julie_review: julieReview,
    post_followups: postFollowups,
    unresolved,
    pinned_ideas: pinnedIdeas,
    rejected_ideas: rejectedIdeas,
    eod_closeout: eod,
    tags: allTags,
  };

  const minutesText = buildMinutesText(currentData);

  function updateTagCat(cat: keyof TagCategories, values: string[]) {
    setTagCats(prev => ({ ...prev, [cat]: values }));
  }

  function updateEod(patch: Partial<EodCloseout>) {
    setEod(prev => ({ ...prev, ...patch }));
  }

  async function handleCopy() {
    await copyToClipboard(minutesText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function handlePrint() {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head>
      <title>${currentData.title}</title>
      <style>
        body { font-family: Georgia, serif; max-width: 780px; margin: 2.5rem auto; color: #111; line-height: 1.75; }
        h1 { font-size: 1.65rem; margin-bottom: 0.25rem; }
        h2 { font-size: 1.05rem; margin-top: 2rem; margin-bottom: 0.4rem; border-bottom: 1px solid #ddd; padding-bottom: 4px; color: #333; }
        p  { margin: 0.25rem 0; }
        ul { margin: 0.25rem 0 0.75rem 1.25rem; padding: 0; }
        li { margin-bottom: 0.4rem; }
        .meta { color: #555; font-size: 0.9rem; margin-bottom: 0.35rem; }
        .tag  { display:inline-block; background:#f0f0f0; border-radius:3px; padding:1px 6px; font-size:0.75rem; margin-right:4px; }
        @media print { body { margin: 1rem; } }
      </style>
    </head><body>`);

    const html = minutesText
      .replace(/^# (.+)$/m,                  "<h1>$1</h1>")
      .replace(/^## (.+)$/gm,                "<h2>$1</h2>")
      .replace(/^\*\*(.+?):\*\* (.+)$/gm,   "<p class='meta'><strong>$1:</strong> $2</p>")
      .replace(/^- (.+)$/gm,                 "<li>$1</li>")
      .replace(/(<li>[^<]*<\/li>\n?)+/g,     s => `<ul>${s}</ul>`)
      .replace(/\n\n/g, "\n");

    win.document.write(html);
    win.document.write("</body></html>");
    win.document.close();
    win.print();
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        title,
        topic,
        participants,
        key_points:     keyPoints,
        decisions,
        open_questions: openQs,
        action_items:   actionItems,
        risks,
        julie_review:   julieReview,
        post_followups: postFollowups,
        unresolved,
        pinned_ideas:   pinnedIdeas,
        rejected_ideas: rejectedIdeas,
        eod_closeout:   eod,
        raw_minutes:    minutesText,
        tags:           allTags,
        tag_categories: tagCats,
        message_count:  messages.length,
        status:         "final" as const,
        updated_at:     new Date().toISOString(),
      };

      if (savedId) {
        const { error } = await supabase.from("meeting_minutes").update(payload).eq("id", savedId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("meeting_minutes").insert(payload).select("id").single();
        if (error) throw error;
        setSavedId(data.id);
      }
    } catch {
      setSaveError("Save failed. Check connection.");
    } finally {
      setSaving(false);
    }
  }

  const TABS = [
    { id: "edit",    label: "Edit"    },
    { id: "preview", label: "Preview" },
    { id: "tags",    label: "Tags"    },
  ] as const;

  /* ── Pre-rendered preview helper ── */
  function PreviewSection({ title: t, items, color }: { title: string; items: string[]; color: string }) {
    if (items.length === 0) return null;
    return (
      <div>
        <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color }}>{t}</p>
        <ul className="flex flex-col gap-1.5 pl-1">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm" style={{ color: TEXT }}>
              <span className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              {item}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.82)" }}>
      <div className="flex flex-col rounded-2xl overflow-hidden"
        style={{ width: "720px", maxHeight: "92vh", backgroundColor: "#08111F", border: `1px solid ${BORDER}` }}>

        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-5 py-4 border-b flex-shrink-0" style={{ borderColor: BORDER }}>
          <FileText size={15} style={{ color: GOLD }} />
          <div className="flex-1 min-w-0">
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="text-sm font-bold w-full outline-none bg-transparent"
              style={{ color: "#FFF" }}
              placeholder="Meeting Minutes Title"
            />
            <p className="text-xs mt-0.5" style={{ color: DIM }}>
              {messages.filter(m => !m.isSystem).length} messages · {parsed.participants.length} speakers
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {savedId && (
              <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded-full"
                style={{ color: "#4ADE80", backgroundColor: "rgba(74,222,128,0.1)" }}>Saved</span>
            )}
            <button onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold tracking-wider uppercase hover:opacity-80"
              style={{ color: copied ? "#4ADE80" : MUTED, border: `1px solid ${BORDER}`, backgroundColor: CARD }}>
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copied!" : "Copy"}
            </button>
            <button onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold tracking-wider uppercase hover:opacity-80"
              style={{ color: MUTED, border: `1px solid ${BORDER}`, backgroundColor: CARD }}>
              <Printer size={12} /> Print
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold tracking-wider uppercase hover:opacity-80 disabled:opacity-40"
              style={{ backgroundColor: "rgba(201,168,76,0.15)", color: GOLD, border: "1px solid rgba(201,168,76,0.35)" }}>
              {saving ? <Loader size={12} className="animate-spin" /> : <Save size={12} />}
              {saving ? "Saving…" : savedId ? "Update" : "Save"}
            </button>
            <button onClick={onClose} className="opacity-40 hover:opacity-80" style={{ color: MUTED }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {saveError && (
          <div className="px-5 py-2 border-b flex-shrink-0"
            style={{ borderColor: BORDER, backgroundColor: "rgba(248,113,113,0.08)" }}>
            <p className="text-xs" style={{ color: "#F87171" }}>{saveError}</p>
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="flex border-b flex-shrink-0" style={{ borderColor: BORDER }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="px-5 py-2.5 text-xs font-bold tracking-widest uppercase"
              style={{
                color: tab === t.id ? GOLD : MUTED,
                borderBottom: tab === t.id ? `2px solid ${GOLD}` : "2px solid transparent",
                backgroundColor: tab === t.id ? "rgba(201,168,76,0.04)" : "transparent",
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">

          {/* ════ EDIT TAB ════ */}
          {tab === "edit" && (
            <div className="flex flex-col gap-3">
              {/* Topic */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold tracking-widest uppercase" style={{ color: MUTED }}>Meeting Topic</label>
                <input value={topic} onChange={e => setTopic(e.target.value)}
                  placeholder="Main topic of the meeting"
                  className="px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ backgroundColor: NAVY, color: TEXT, border: `1px solid ${BORDER}` }} />
              </div>

              {/* Participants */}
              <Section label="Participants" count={participants.length} color="#5A9BD3">
                <div className="flex flex-wrap gap-1.5">
                  {participants.map((p, i) => (
                    <span key={i} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={{ backgroundColor: "rgba(90,155,211,0.15)", color: "#5A9BD3", border: "1px solid rgba(90,155,211,0.3)" }}>
                      {p}
                      <button onClick={() => setParticipants(prev => prev.filter((_, idx) => idx !== i))}
                        className="opacity-60 hover:opacity-100"><X size={10} /></button>
                    </span>
                  ))}
                  <input
                    placeholder="+ Add member"
                    className="px-2 py-1 rounded-lg text-xs outline-none w-28"
                    style={{ backgroundColor: NAVY, color: TEXT, border: `1px solid ${BORDER}` }}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        const v = (e.target as HTMLInputElement).value.trim();
                        if (v && !participants.includes(v)) setParticipants(p => [...p, v]);
                        (e.target as HTMLInputElement).value = "";
                      }
                    }}
                  />
                </div>
              </Section>

              {/* ── Julie Review ── */}
              <Section label="Julie Review" color={GOLD} defaultOpen={true}>
                <div className="flex items-start gap-2 mb-2 px-1">
                  <MessageSquare size={12} style={{ color: DIM, marginTop: 2, flexShrink: 0 }} />
                  <p className="text-xs leading-relaxed" style={{ color: DIM }}>
                    Short plain-English summary from Julie's perspective. Edit freely.
                  </p>
                </div>
                <textarea
                  value={julieReview}
                  onChange={e => setJulieReview(e.target.value)}
                  placeholder="Julie's read on how the meeting went, what was covered, and what stood out…"
                  rows={4}
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none"
                  style={{ backgroundColor: NAVY, color: TEXT, border: `1px solid rgba(201,168,76,0.25)`, lineHeight: "1.7" }}
                />
              </Section>

              {/* Core sections */}
              <Section label="Key Discussion Points" count={keyPoints.length} color={GOLD}>
                <EditableList items={keyPoints} onChange={setKeyPoints}
                  placeholder="Discussion point…" color={GOLD} />
              </Section>

              <Section label="Decisions Made" count={decisions.length} color="#A78BFA">
                <EditableList items={decisions} onChange={setDecisions}
                  placeholder="Decision…" color="#A78BFA" />
              </Section>

              <Section label="Action Items" count={actionItems.length} color="#FB923C">
                <EditableList items={actionItems} onChange={setActionItems}
                  placeholder="Action item (who, what, when)…" color="#FB923C" />
              </Section>

              <Section label="Open Questions" count={openQs.length} color="#5A9BD3">
                <EditableList items={openQs} onChange={setOpenQs}
                  placeholder="Unresolved question…" color="#5A9BD3" />
              </Section>

              <Section label="Risks & Blockers" count={risks.length} color="#F87171">
                <EditableList items={risks} onChange={setRisks}
                  placeholder="Risk or blocker…" color="#F87171" />
              </Section>

              {/* ── v2 sections ── */}
              <Section label="Post-Discussion Follow-Ups" count={postFollowups.length} color="#4ADE80" defaultOpen={false}>
                <div className="flex items-start gap-2 mb-2 px-1">
                  <AlertCircle size={12} style={{ color: DIM, marginTop: 2, flexShrink: 0 }} />
                  <p className="text-xs" style={{ color: DIM }}>Things that should happen after this meeting closes.</p>
                </div>
                <EditableList items={postFollowups} onChange={setPostFollowups}
                  placeholder="Follow-up action…" color="#4ADE80" />
              </Section>

              <Section label="Discussed but Not Resolved" count={unresolved.length} color="#F59E0B" defaultOpen={false}>
                <div className="flex items-start gap-2 mb-2 px-1">
                  <AlertCircle size={12} style={{ color: DIM, marginTop: 2, flexShrink: 0 }} />
                  <p className="text-xs" style={{ color: DIM }}>Topics that came up but were not fully decided.</p>
                </div>
                <EditableList items={unresolved} onChange={setUnresolved}
                  placeholder="Unresolved topic…" color="#F59E0B" />
              </Section>

              <Section label="Put a Pin in It" count={pinnedIdeas.length} color="#38BDF8" defaultOpen={false}>
                <div className="flex items-start gap-2 mb-2 px-1">
                  <Pin size={12} style={{ color: DIM, marginTop: 2, flexShrink: 0 }} />
                  <p className="text-xs" style={{ color: DIM }}>Good ideas worth saving but not acting on now.</p>
                </div>
                <EditableList items={pinnedIdeas} onChange={setPinnedIdeas}
                  placeholder="Idea to revisit later…" color="#38BDF8" />
              </Section>

              <Section label="Deleted / Rejected Ideas" count={rejectedIdeas.length} color="#94A3B8" defaultOpen={false}>
                <div className="flex items-start gap-2 mb-2 px-1">
                  <Trash2 size={12} style={{ color: DIM, marginTop: 2, flexShrink: 0 }} />
                  <p className="text-xs" style={{ color: DIM }}>
                    Ideas intentionally rejected or parked. Kept so we don't resurrect them.
                  </p>
                </div>
                <EditableList items={rejectedIdeas} onChange={setRejectedIdeas}
                  placeholder="Rejected idea…" color="#94A3B8" />
              </Section>

              {/* ── EOD Closeout ── */}
              <Section label="EOD Meeting Closeout" color={GOLD} defaultOpen={false}>
                <div className="flex items-start gap-2 mb-3 px-1">
                  <AlertCircle size={12} style={{ color: DIM, marginTop: 2, flexShrink: 0 }} />
                  <p className="text-xs leading-relaxed" style={{ color: DIM }}>
                    Final summary of the meeting — what was accomplished, what remains open,
                    and whether follow-up tasks should be created.
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "#4ADE80" }}>
                      What Was Accomplished
                    </label>
                    <textarea
                      value={eod.accomplished}
                      onChange={e => updateEod({ accomplished: e.target.value })}
                      placeholder="Summarize what got done in this meeting…"
                      rows={3}
                      className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none"
                      style={{ backgroundColor: NAVY, color: TEXT, border: `1px solid ${BORDER}`, lineHeight: "1.65" }}
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "#F59E0B" }}>
                      What Remains Open
                    </label>
                    <EditableList
                      items={eod.open_items}
                      onChange={items => updateEod({ open_items: items })}
                      placeholder="Still unresolved item…"
                      color="#F59E0B"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold tracking-widest uppercase" style={{ color: GOLD }}>
                      Next Recommended Action
                    </label>
                    <input
                      value={eod.next_action}
                      onChange={e => updateEod({ next_action: e.target.value })}
                      placeholder="The single most important next step…"
                      className="px-3 py-2.5 rounded-lg text-sm outline-none"
                      style={{ backgroundColor: NAVY, color: TEXT, border: `1px solid ${BORDER}` }}
                    />
                  </div>

                  <div className="flex items-center gap-3 px-1">
                    <button
                      onClick={() => updateEod({ needs_followup_tasks: !eod.needs_followup_tasks })}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold tracking-wider uppercase hover:opacity-80 transition-opacity"
                      style={{
                        backgroundColor: eod.needs_followup_tasks ? "rgba(74,222,128,0.15)" : CARD,
                        color: eod.needs_followup_tasks ? "#4ADE80" : MUTED,
                        border: `1px solid ${eod.needs_followup_tasks ? "rgba(74,222,128,0.4)" : BORDER}`,
                      }}>
                      {eod.needs_followup_tasks ? <Check size={12} /> : <Plus size={12} />}
                      {eod.needs_followup_tasks ? "Follow-Up Tasks: Yes" : "Follow-Up Tasks: No"}
                    </button>
                    <p className="text-xs" style={{ color: DIM }}>
                      Toggle if this meeting should generate follow-up tasks.
                    </p>
                  </div>
                </div>
              </Section>
            </div>
          )}

          {/* ════ PREVIEW TAB ════ */}
          {tab === "preview" && (
            <div className="flex flex-col gap-4">
              <div className="rounded-xl px-5 py-5 flex flex-col gap-6"
                style={{ backgroundColor: NAVY, border: `1px solid ${BORDER}` }}>

                {/* Header */}
                <div>
                  <h2 className="text-base font-bold mb-1" style={{ color: "#FFF" }}>{currentData.title}</h2>
                  <p className="text-xs" style={{ color: DIM }}>
                    {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                  </p>
                  {currentData.topic && (
                    <p className="text-sm mt-1.5" style={{ color: MUTED }}><strong>Topic:</strong> {currentData.topic}</p>
                  )}
                  {currentData.participants.length > 0 && (
                    <p className="text-sm mt-0.5" style={{ color: MUTED }}>
                      <strong>Participants:</strong> {currentData.participants.join(", ")}
                    </p>
                  )}
                </div>

                {/* Julie Review */}
                {currentData.julie_review && (
                  <div className="rounded-xl px-4 py-3" style={{ backgroundColor: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.2)" }}>
                    <p className="text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: GOLD }}>Julie Review</p>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: MUTED }}>{currentData.julie_review}</p>
                  </div>
                )}

                {/* Core sections */}
                <PreviewSection title="Key Discussion Points" items={currentData.key_points} color={GOLD} />
                <PreviewSection title="Decisions Made" items={currentData.decisions} color="#A78BFA" />
                <PreviewSection title="Action Items" items={currentData.action_items} color="#FB923C" />
                <PreviewSection title="Open Questions" items={currentData.open_questions} color="#5A9BD3" />
                <PreviewSection title="Risks & Blockers" items={currentData.risks} color="#F87171" />

                {/* v2 sections */}
                <PreviewSection title="Post-Discussion Follow-Ups" items={currentData.post_followups} color="#4ADE80" />
                <PreviewSection title="Discussed but Not Resolved" items={currentData.unresolved} color="#F59E0B" />
                <PreviewSection title="Put a Pin in It" items={currentData.pinned_ideas} color="#38BDF8" />
                <PreviewSection title="Deleted / Rejected Ideas" items={currentData.rejected_ideas} color="#94A3B8" />

                {/* EOD Closeout */}
                {(currentData.eod_closeout.accomplished || currentData.eod_closeout.next_action || currentData.eod_closeout.open_items.length > 0) && (
                  <div className="rounded-xl px-4 py-3 flex flex-col gap-3"
                    style={{ backgroundColor: "rgba(201,168,76,0.05)", border: `1px solid rgba(201,168,76,0.18)` }}>
                    <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: GOLD }}>EOD Meeting Closeout</p>
                    {currentData.eod_closeout.accomplished && (
                      <div>
                        <p className="text-[10px] font-bold tracking-widest uppercase mb-1" style={{ color: "#4ADE80" }}>Accomplished</p>
                        <p className="text-sm leading-relaxed" style={{ color: MUTED }}>{currentData.eod_closeout.accomplished}</p>
                      </div>
                    )}
                    {currentData.eod_closeout.open_items.length > 0 && (
                      <PreviewSection title="Still Open" items={currentData.eod_closeout.open_items} color="#F59E0B" />
                    )}
                    {currentData.eod_closeout.next_action && (
                      <div>
                        <p className="text-[10px] font-bold tracking-widest uppercase mb-1" style={{ color: GOLD }}>Next Recommended Action</p>
                        <p className="text-sm leading-relaxed" style={{ color: MUTED }}>{currentData.eod_closeout.next_action}</p>
                      </div>
                    )}
                    <p className="text-xs" style={{ color: DIM }}>
                      Follow-Up Tasks:{" "}
                      <span style={{ color: currentData.eod_closeout.needs_followup_tasks ? "#4ADE80" : MUTED }}>
                        {currentData.eod_closeout.needs_followup_tasks ? "Yes" : "No"}
                      </span>
                    </p>
                  </div>
                )}

                {/* Tags */}
                {allTags.length > 0 && (
                  <div>
                    <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: MUTED }}>Tags</p>
                    <div className="flex flex-wrap gap-1.5">
                      {allTags.map(tag => {
                        const [cat] = tag.split(":");
                        const color = TAG_CAT_LABELS[cat as keyof TagCategories]?.color ?? GOLD;
                        return (
                          <span key={tag} className="px-2.5 py-1 rounded-full text-[11px] font-semibold"
                            style={{ backgroundColor: color + "18", color, border: `1px solid ${color}33` }}>
                            {tag}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════ TAGS TAB ════ */}
          {tab === "tags" && (
            <div className="flex flex-col gap-4">
              <div className="rounded-xl px-4 py-3" style={{ backgroundColor: NAVY, border: `1px solid ${BORDER}` }}>
                <div className="flex items-center gap-2 mb-1">
                  <Tag size={12} style={{ color: GOLD }} />
                  <p className="text-xs font-bold tracking-widest uppercase" style={{ color: GOLD }}>Tagging System</p>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: MUTED }}>
                  Tags are stored with the minutes and can be used to filter and find this session later.
                  Each category stays separate for precise filtering.
                </p>
              </div>
              {(Object.keys(TAG_CAT_LABELS) as (keyof TagCategories)[]).map(cat => (
                <TagInput key={cat} cat={cat} values={tagCats[cat]} onChange={updateTagCat} />
              ))}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-3 border-t flex items-center justify-between flex-shrink-0"
          style={{ borderColor: BORDER, backgroundColor: CARD }}>
          <p className="text-xs" style={{ color: DIM }}>
            {savedId ? "Saved to CRM." : "Not yet saved to CRM."}
          </p>
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold tracking-wider uppercase hover:opacity-70"
            style={{ backgroundColor: NAVY, color: MUTED, border: `1px solid ${BORDER}` }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );

  /* local helper inside render scope */
  function PreviewSection({ title: t, items, color }: { title: string; items: string[]; color: string }) {
    if (items.length === 0) return null;
    return (
      <div>
        <p className="text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color }}>{t}</p>
        <ul className="flex flex-col gap-1.5 pl-1">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm" style={{ color: TEXT }}>
              <span className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              {item}
            </li>
          ))}
        </ul>
      </div>
    );
  }
}
