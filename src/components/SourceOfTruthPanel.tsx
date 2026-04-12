import { useState, useEffect } from "react";
import { BookOpen, Plus, CheckCircle, Clock, X, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import {
  readSourceOfTruth,
  appendToSourceOfTruth,
  markApproved,
  detectConflicts,
  type SourceOfTruthEntry,
  type EntryType,
} from "../lib/sourceOfTruth";

const ENTRY_TYPE_COLORS: Record<EntryType, { bg: string; text: string; border: string }> = {
  decision:     { bg: "rgba(201,168,76,0.08)",  text: "#C9A84C", border: "rgba(201,168,76,0.3)" },
  rule:         { bg: "rgba(90,155,211,0.08)",  text: "#5A9BD3", border: "rgba(90,155,211,0.3)" },
  architecture: { bg: "rgba(107,175,142,0.08)", text: "#6BAF8E", border: "rgba(107,175,142,0.3)" },
  constraint:   { bg: "rgba(224,123,90,0.08)",  text: "#E07B5A", border: "rgba(224,123,90,0.3)" },
};

const ENTRY_TYPES: EntryType[] = ["decision", "rule", "architecture", "constraint"];

const SYSTEM_OPTIONS = [
  "Meeting Room", "Sessions", "Vault", "Email", "Projects", "Tags",
  "Integrations", "Julie", "Mentors", "Approval System", "Database", "Edge Functions",
];

interface NewEntryForm {
  decision_title: string;
  summary: string;
  affected_systems: string[];
  entry_type: EntryType;
  approved_by_user: boolean;
}

const EMPTY_FORM: NewEntryForm = {
  decision_title: "",
  summary: "",
  affected_systems: [],
  entry_type: "decision",
  approved_by_user: true,
};

export default function SourceOfTruthPanel({ sessionKey }: { sessionKey?: string | null }) {
  const [entries, setEntries] = useState<SourceOfTruthEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewEntryForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [conflicts, setConflicts] = useState<SourceOfTruthEntry[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<EntryType | "all">("all");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await readSourceOfTruth(200);
      setEntries(data);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  function handleFormChange(field: keyof NewEntryForm, value: string | boolean | string[]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "decision_title" || field === "summary") {
      const title = field === "decision_title" ? (value as string) : form.decision_title;
      const summary = field === "summary" ? (value as string) : form.summary;
      if (title.length > 5 || summary.length > 10) {
        setConflicts(detectConflicts(title, summary, entries));
      } else {
        setConflicts([]);
      }
    }
  }

  function toggleSystem(sys: string) {
    setForm((prev) => ({
      ...prev,
      affected_systems: prev.affected_systems.includes(sys)
        ? prev.affected_systems.filter((s) => s !== sys)
        : [...prev.affected_systems, sys],
    }));
  }

  async function handleSave() {
    if (!form.decision_title.trim() || !form.summary.trim()) return;
    setSaving(true);
    try {
      const entry = await appendToSourceOfTruth({
        ...form,
        session_key: sessionKey ?? null,
      });
      setEntries((prev) => [entry, ...prev]);
      setForm(EMPTY_FORM);
      setShowForm(false);
      setConflicts([]);
    } catch {
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove(id: string) {
    try {
      await markApproved(id);
      setEntries((prev) => prev.map((e) => e.id === id ? { ...e, approved_by_user: true } : e));
    } catch {}
  }

  const filtered = filterType === "all" ? entries : entries.filter((e) => e.entry_type === filterType);

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: "#0D1B2E" }}>
      <div
        className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0"
        style={{ borderColor: "#1B2A4A" }}
      >
        <div className="flex items-center gap-3">
          <BookOpen size={16} style={{ color: "#C9A84C" }} />
          <span className="text-sm font-bold tracking-widest uppercase" style={{ color: "#C9A84C" }}>
            Source of Truth
          </span>
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: "rgba(201,168,76,0.12)", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.25)" }}
          >
            {entries.length} entries
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {(["all", ...ENTRY_TYPES] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className="px-2.5 py-1 rounded text-[10px] font-bold tracking-wider uppercase transition-all"
                style={
                  filterType === t
                    ? { backgroundColor: "rgba(201,168,76,0.15)", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.3)" }
                    : { color: "#3A4F6A", border: "1px solid transparent" }
                }
              >
                {t}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider uppercase transition-all"
            style={{ backgroundColor: "rgba(201,168,76,0.1)", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.25)" }}
          >
            <Plus size={12} />
            Log Entry
          </button>
        </div>
      </div>

      {showForm && (
        <div
          className="border-b px-5 py-4 flex-shrink-0"
          style={{ borderColor: "#1B2A4A", backgroundColor: "#0A1628" }}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "#8A9BB5" }}>
              New Entry
            </span>
            <button onClick={() => { setShowForm(false); setConflicts([]); }}>
              <X size={14} style={{ color: "#3A4F6A" }} />
            </button>
          </div>

          <div className="flex gap-2 mb-3">
            {ENTRY_TYPES.map((t) => {
              const style = ENTRY_TYPE_COLORS[t];
              return (
                <button
                  key={t}
                  onClick={() => handleFormChange("entry_type", t)}
                  className="px-3 py-1.5 rounded text-[10px] font-bold tracking-wider uppercase transition-all"
                  style={
                    form.entry_type === t
                      ? { backgroundColor: style.bg, color: style.text, border: `1px solid ${style.border}` }
                      : { color: "#3A4F6A", border: "1px solid #1B2A4A" }
                  }
                >
                  {t}
                </button>
              );
            })}
          </div>

          <input
            className="w-full mb-2.5 px-3 py-2 rounded-lg text-sm outline-none"
            style={{ backgroundColor: "#111D30", color: "#FFFFFF", border: "1px solid #1B2A4A", caretColor: "#C9A84C" }}
            placeholder="Decision title..."
            value={form.decision_title}
            onChange={(e) => handleFormChange("decision_title", e.target.value)}
          />

          <textarea
            className="w-full mb-3 px-3 py-2 rounded-lg text-sm outline-none resize-none"
            style={{ backgroundColor: "#111D30", color: "#FFFFFF", border: "1px solid #1B2A4A", caretColor: "#C9A84C" }}
            placeholder="Plain-English summary of this decision or rule..."
            rows={3}
            value={form.summary}
            onChange={(e) => handleFormChange("summary", e.target.value)}
          />

          <div className="mb-3">
            <span className="text-[10px] font-bold tracking-widest uppercase mb-2 block" style={{ color: "#3A4F6A" }}>
              Affected Systems
            </span>
            <div className="flex flex-wrap gap-1.5">
              {SYSTEM_OPTIONS.map((sys) => (
                <button
                  key={sys}
                  onClick={() => toggleSystem(sys)}
                  className="px-2.5 py-1 rounded text-[10px] font-bold tracking-wider transition-all"
                  style={
                    form.affected_systems.includes(sys)
                      ? { backgroundColor: "rgba(90,155,211,0.15)", color: "#5A9BD3", border: "1px solid rgba(90,155,211,0.3)" }
                      : { color: "#3A4F6A", border: "1px solid #1B2A4A" }
                  }
                >
                  {sys}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.approved_by_user}
                onChange={(e) => handleFormChange("approved_by_user", e.target.checked)}
                className="rounded"
                style={{ accentColor: "#C9A84C" }}
              />
              <span className="text-xs" style={{ color: "#8A9BB5" }}>User Approved</span>
            </label>
          </div>

          {conflicts.length > 0 && (
            <div
              className="mb-3 px-3 py-2 rounded-lg flex items-start gap-2"
              style={{ backgroundColor: "rgba(224,123,90,0.08)", border: "1px solid rgba(224,123,90,0.25)" }}
            >
              <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" style={{ color: "#E07B5A" }} />
              <div>
                <span className="text-[10px] font-bold tracking-wider uppercase block mb-1" style={{ color: "#E07B5A" }}>
                  Possible conflict with {conflicts.length} existing {conflicts.length === 1 ? "entry" : "entries"}
                </span>
                {conflicts.map((c) => (
                  <span key={c.id} className="text-xs block" style={{ color: "#8A9BB5" }}>
                    — {c.decision_title}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !form.decision_title.trim() || !form.summary.trim()}
              className="px-4 py-2 rounded-lg text-xs font-bold tracking-wider uppercase transition-all disabled:opacity-40"
              style={{ backgroundColor: "#C9A84C", color: "#0D1B2E" }}
            >
              {saving ? "Saving..." : "Append to Record"}
            </button>
            <button
              onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setConflicts([]); }}
              className="px-4 py-2 rounded-lg text-xs font-bold tracking-wider uppercase transition-all"
              style={{ color: "#3A4F6A", border: "1px solid #1B2A4A" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loading ? (
          <div className="text-xs text-center py-8" style={{ color: "#3A4F6A" }}>
            Loading source of truth...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen size={28} className="mx-auto mb-3 opacity-30" style={{ color: "#C9A84C" }} />
            <p className="text-xs" style={{ color: "#3A4F6A" }}>
              No entries yet. Log your first decision to begin the grounding record.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((entry) => {
              const typeStyle = ENTRY_TYPE_COLORS[entry.entry_type];
              const isExpanded = expandedId === entry.id;
              const date = new Date(entry.entry_date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              });

              return (
                <div
                  key={entry.id}
                  className="rounded-xl overflow-hidden transition-all"
                  style={{ backgroundColor: "#0A1628", border: `1px solid ${isExpanded ? typeStyle.border : "#1B2A4A"}` }}
                >
                  <button
                    className="w-full flex items-start justify-between px-4 py-3 text-left gap-3"
                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <span
                        className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded flex-shrink-0 mt-0.5"
                        style={{ backgroundColor: typeStyle.bg, color: typeStyle.text, border: `1px solid ${typeStyle.border}` }}
                      >
                        {entry.entry_type}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-tight truncate" style={{ color: "#E8EFF7" }}>
                          {entry.decision_title}
                        </p>
                        <p className="text-[10px] mt-0.5" style={{ color: "#3A4F6A" }}>
                          {date}
                          {entry.session_key && (
                            <span className="ml-2" style={{ color: "#2A3F5A" }}>· {entry.session_key}</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {entry.approved_by_user ? (
                        <CheckCircle size={12} style={{ color: "#4ADE80" }} />
                      ) : (
                        <Clock size={12} style={{ color: "#F59E0B" }} />
                      )}
                      {isExpanded ? (
                        <ChevronUp size={12} style={{ color: "#3A4F6A" }} />
                      ) : (
                        <ChevronDown size={12} style={{ color: "#3A4F6A" }} />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t" style={{ borderColor: "#1B2A4A" }}>
                      <p className="text-sm mt-3 leading-relaxed" style={{ color: "#8A9BB5" }}>
                        {entry.summary}
                      </p>

                      {entry.affected_systems.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {entry.affected_systems.map((sys) => (
                            <span
                              key={sys}
                              className="text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 rounded"
                              style={{ backgroundColor: "rgba(90,155,211,0.08)", color: "#5A9BD3", border: "1px solid rgba(90,155,211,0.2)" }}
                            >
                              {sys}
                            </span>
                          ))}
                        </div>
                      )}

                      {entry.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {entry.tags.map((tag) => (
                            <span key={tag} className="text-[9px] px-2 py-0.5 rounded" style={{ color: "#3A4F6A", border: "1px solid #1B2A4A" }}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {!entry.approved_by_user && (
                        <button
                          onClick={() => handleApprove(entry.id)}
                          className="mt-3 px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all"
                          style={{ backgroundColor: "rgba(74,222,128,0.08)", color: "#4ADE80", border: "1px solid rgba(74,222,128,0.25)" }}
                        >
                          Mark Approved
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
