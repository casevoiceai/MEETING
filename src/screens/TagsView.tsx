import { useState, useEffect } from "react";
import { Plus, Trash2, CreditCard as Edit2, Check, X, Tag, FileText, AlignLeft, ChevronRight, FolderOpen } from "lucide-react";
import {
  listAllTags, createTag, updateTag, deleteTag,
  listVaultFilesByTag, listSideNotesByTag,
  type TagEntry, type VaultFile, type SideNote,
} from "../lib/db";

const GOLD = "#C9A84C";
const NAVY = "#0D1B2E";
const CARD = "#111D30";
const BORDER = "#1B2A4A";
const MUTED = "#8A9BB5";
const DIM = "#3A4F6A";
const TEXT = "#D0DFEE";

const TAG_CATEGORIES = ["General", "App", "Safety", "Communication", "Founder Notes", "Research", "Risk", "Legal", "Technical"];

const CATEGORY_COLORS: Record<string, string> = {
  "General":        "#C9A84C",
  "App":            "#3B82F6",
  "Safety":         "#EF4444",
  "Communication":  "#10B981",
  "Founder Notes":  "#F59E0B",
  "Research":       "#8B5CF6",
  "Risk":           "#F97316",
  "Legal":          "#6B7280",
  "Technical":      "#06B6D4",
};

function TagBadge({ tag, color }: { tag: string; color?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{ backgroundColor: `${color ?? GOLD}22`, color: color ?? GOLD, border: `1px solid ${color ?? GOLD}44` }}
    >
      {tag}
    </span>
  );
}

interface TagDetailProps {
  tag: TagEntry;
  onBack: () => void;
}

function TagDetail({ tag, onBack }: TagDetailProps) {
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [notes, setSideNotes] = useState<SideNote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listVaultFilesByTag(tag.tag), listSideNotesByTag(tag.tag)]).then(([f, n]) => {
      setFiles(f);
      setSideNotes(n);
      setLoading(false);
    });
  }, [tag.tag]);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto px-6 py-5">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-70"
          style={{ color: MUTED }}
        >
          <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} />
          All Tags
        </button>
        <span style={{ color: DIM }}>/</span>
        <TagBadge tag={tag.tag} color={CATEGORY_COLORS[tag.category] ?? GOLD} />
        <span className="text-sm ml-auto" style={{ color: DIM }}>{tag.usage_count} uses · {tag.category}</span>
      </div>

      {loading && <p className="text-sm" style={{ color: DIM }}>Loading linked items...</p>}

      {!loading && (
        <div className="flex flex-col gap-8">
          <div>
            <p className="text-xs font-bold tracking-widest uppercase mb-3 flex items-center gap-2" style={{ color: MUTED }}>
              <FileText size={13} />
              Files ({files.length})
            </p>
            {files.length === 0 && <p className="text-sm" style={{ color: DIM }}>No files tagged with this.</p>}
            <div className="flex flex-col gap-2">
              {files.map((f) => (
                <div key={f.id} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
                  <FileText size={14} style={{ color: GOLD, opacity: 0.7 }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: "#FFFFFF" }}>{f.name}</p>
                    {f.summary && <p className="text-xs truncate mt-0.5" style={{ color: MUTED }}>{f.summary}</p>}
                  </div>
                  <span className="text-xs" style={{ color: DIM }}>{new Date(f.updated_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold tracking-widest uppercase mb-3 flex items-center gap-2" style={{ color: MUTED }}>
              <AlignLeft size={13} />
              Notes ({notes.length})
            </p>
            {notes.length === 0 && <p className="text-sm" style={{ color: DIM }}>No notes tagged with this.</p>}
            <div className="flex flex-col gap-2">
              {notes.map((n) => (
                <div key={n.id} className="px-4 py-3 rounded-xl" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
                  <p className="text-sm leading-relaxed" style={{ color: TEXT }}>{n.text}</p>
                  <p className="text-xs mt-1.5" style={{ color: DIM }}>{new Date(n.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TagsView() {
  const [tags, setTags] = useState<TagEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTag, setSelectedTag] = useState<TagEntry | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagCategory, setNewTagCategory] = useState("General");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ tag: string; category: string }>({ tag: "", category: "General" });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const t = await listAllTags();
    setTags(t);
    setLoading(false);
  }

  async function handleCreate() {
    if (!newTagName.trim()) return;
    const color = CATEGORY_COLORS[newTagCategory] ?? GOLD;
    const t = await createTag(newTagName.trim(), newTagCategory, color);
    setTags((prev) => [t, ...prev]);
    setNewTagName("");
    setCreating(false);
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await deleteTag(id);
    setTags((prev) => prev.filter((t) => t.id !== id));
    if (selectedTag?.id === id) setSelectedTag(null);
  }

  function startEdit(tag: TagEntry, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingId(tag.id);
    setEditDraft({ tag: tag.tag, category: tag.category });
  }

  async function commitEdit(id: string) {
    const color = CATEGORY_COLORS[editDraft.category] ?? GOLD;
    await updateTag(id, { tag: editDraft.tag, category: editDraft.category, color });
    setTags((prev) => prev.map((t) => t.id === id ? { ...t, tag: editDraft.tag, category: editDraft.category, color } : t));
    setEditingId(null);
  }

  const categories = Array.from(new Set(tags.map((t) => t.category)));
  const filtered = activeCategory ? tags.filter((t) => t.category === activeCategory) : tags;

  if (selectedTag) {
    return (
      <div className="flex-1 flex flex-col min-h-0" style={{ backgroundColor: NAVY, color: "#FFFFFF" }}>
        <TagDetail tag={selectedTag} onBack={() => setSelectedTag(null)} />
      </div>
    );
  }

  return (
    <div className="flex-1 flex min-h-0" style={{ backgroundColor: NAVY, color: "#FFFFFF" }}>
      <div className="w-52 flex-shrink-0 border-r flex flex-col" style={{ borderColor: BORDER }}>
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: BORDER }}>
          <span className="text-xs font-bold tracking-widest uppercase" style={{ color: MUTED }}>Categories</span>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          <button
            onClick={() => setActiveCategory(null)}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-all"
            style={{
              backgroundColor: activeCategory === null ? "rgba(201,168,76,0.08)" : "transparent",
              color: activeCategory === null ? GOLD : MUTED,
            }}
          >
            <Tag size={13} />
            <span className="flex-1 text-left font-medium">All Tags</span>
            <span className="text-xs" style={{ color: DIM }}>{tags.length}</span>
          </button>
          {TAG_CATEGORIES.filter((c) => categories.includes(c) || true).map((cat) => {
            const count = tags.filter((t) => t.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-all"
                style={{
                  backgroundColor: activeCategory === cat ? "rgba(201,168,76,0.08)" : "transparent",
                  color: activeCategory === cat ? GOLD : MUTED,
                }}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: CATEGORY_COLORS[cat] ?? GOLD }}
                />
                <span className="flex-1 text-left font-medium">{cat}</span>
                {count > 0 && <span className="text-xs" style={{ color: DIM }}>{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-5 py-4 border-b flex items-center gap-3" style={{ borderColor: BORDER }}>
          <span className="text-sm font-bold" style={{ color: "#FFFFFF" }}>
            {activeCategory ?? "All Tags"}
          </span>
          <span className="text-sm" style={{ color: DIM }}>— {filtered.length} tags</span>
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold tracking-wider uppercase transition-all hover:opacity-90"
              style={{ backgroundColor: GOLD, color: NAVY }}
            >
              <Plus size={13} />
              New Tag
            </button>
          </div>
        </div>

        {creating && (
          <div className="px-5 py-4 border-b flex items-center gap-3" style={{ borderColor: BORDER, backgroundColor: "rgba(201,168,76,0.04)" }}>
            <input
              autoFocus
              className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
              style={{ backgroundColor: CARD, color: "#FFFFFF", border: `1px solid ${GOLD}` }}
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setCreating(false); }}
              placeholder="Tag name..."
            />
            <select
              className="px-3 py-2 rounded-lg text-sm outline-none"
              style={{ backgroundColor: CARD, color: "#FFFFFF", border: `1px solid ${BORDER}` }}
              value={newTagCategory}
              onChange={(e) => setNewTagCategory(e.target.value)}
            >
              {TAG_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={handleCreate} className="p-2 rounded-lg" style={{ backgroundColor: "rgba(201,168,76,0.15)", color: GOLD }}>
              <Check size={15} />
            </button>
            <button onClick={() => setCreating(false)} className="p-2 rounded-lg" style={{ backgroundColor: "rgba(255,255,255,0.05)", color: MUTED }}>
              <X size={15} />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5">
          {loading && <p className="text-sm" style={{ color: DIM }}>Loading...</p>}
          {!loading && filtered.length === 0 && (
            <p className="text-sm" style={{ color: DIM }}>No tags in this category yet.</p>
          )}

          <div className="flex flex-col gap-2">
            {filtered.map((t) => {
              const catColor = CATEGORY_COLORS[t.category] ?? GOLD;
              const isEditing = editingId === t.id;

              return (
                <div
                  key={t.id}
                  className="group flex items-center gap-4 px-4 py-3 rounded-xl cursor-pointer transition-all"
                  style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}
                  onClick={() => !isEditing && setSelectedTag(t)}
                  onMouseEnter={(e) => { if (!isEditing) e.currentTarget.style.borderColor = `${catColor}44`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = BORDER; }}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: catColor }}
                  />

                  {isEditing ? (
                    <div className="flex items-center gap-2 flex-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        autoFocus
                        className="flex-1 px-2 py-1 rounded text-sm outline-none"
                        style={{ backgroundColor: "#0D1B2E", color: "#FFFFFF", border: `1px solid ${GOLD}` }}
                        value={editDraft.tag}
                        onChange={(e) => setEditDraft((d) => ({ ...d, tag: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === "Enter") commitEdit(t.id); if (e.key === "Escape") setEditingId(null); }}
                      />
                      <select
                        className="px-2 py-1 rounded text-sm outline-none"
                        style={{ backgroundColor: "#0D1B2E", color: "#FFFFFF", border: `1px solid ${BORDER}` }}
                        value={editDraft.category}
                        onChange={(e) => setEditDraft((d) => ({ ...d, category: e.target.value }))}
                      >
                        {TAG_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <button onClick={() => commitEdit(t.id)} className="p-1" style={{ color: GOLD }}><Check size={13} /></button>
                      <button onClick={() => setEditingId(null)} className="p-1" style={{ color: MUTED }}><X size={13} /></button>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-semibold" style={{ color: "#FFFFFF" }}>{t.tag}</span>
                        <span className="text-xs ml-3" style={{ color: catColor, opacity: 0.8 }}>{t.category}</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-semibold"
                          style={{ backgroundColor: `${catColor}18`, color: catColor }}
                        >
                          {t.usage_count} uses
                        </span>
                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                          <button
                            onClick={(e) => startEdit(t, e)}
                            className="p-1.5 rounded transition-colors hover:opacity-70"
                            style={{ color: MUTED }}
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={(e) => handleDelete(t.id, e)}
                            className="p-1.5 rounded transition-colors hover:opacity-70"
                          >
                            <Trash2 size={12} style={{ color: "#F87171" }} />
                          </button>
                        </div>
                        <FolderOpen size={13} style={{ color: DIM }} className="opacity-0 group-hover:opacity-60 transition-opacity" />
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
