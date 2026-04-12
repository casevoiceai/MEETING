import { useState, useEffect, useRef, useCallback } from "react";
import { Trash2, Search, Plus, Folder, FolderOpen, FileText, CreditCard as Edit2, Check, X, Table, LayoutGrid, ChevronRight, Tag, AlignLeft, Printer, Upload, Eye, EyeOff } from "lucide-react";
import {
  listSideNotes, deleteSideNote, listAllTags,
  listVaultFolders, createVaultFolder, renameVaultFolder, deleteVaultFolder,
  listVaultFiles, createVaultFile, updateVaultFile, deleteVaultFile,
  type SideNote, type TagEntry, type VaultFolder, type VaultFile,
} from "../lib/db";

type MainTab = "files" | "notes";
type ViewMode = "grid" | "table";

const GOLD = "#C9A84C";
const NAVY = "#0D1B2E";
const CARD = "#111D30";
const BORDER = "#1B2A4A";
const MUTED = "#8A9BB5";
const DIM = "#3A4F6A";

function TagBadge({ tag, onRemove }: { tag: string; onRemove?: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[9px] tracking-widest uppercase font-semibold px-2 py-0.5 rounded-full"
      style={{ backgroundColor: "rgba(201,168,76,0.15)", color: GOLD }}
    >
      {tag}
      {onRemove && (
        <button onClick={onRemove} className="opacity-60 hover:opacity-100 leading-none">×</button>
      )}
    </span>
  );
}

function InlineEdit({
  value, onSave, className, style,
}: { value: string; onSave: (v: string) => void; className?: string; style?: React.CSSProperties }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  function commit() {
    if (draft.trim()) onSave(draft.trim());
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        className={className}
        style={{ ...style, background: "transparent", outline: "none", borderBottom: `1px solid ${GOLD}` }}
      />
    );
  }
  return (
    <span
      className={`cursor-pointer group ${className ?? ""}`}
      style={style}
      onDoubleClick={() => { setDraft(value); setEditing(true); }}
      title="Double-click to rename"
    >
      {value}
      <Edit2 size={9} className="inline ml-1 opacity-0 group-hover:opacity-40" />
    </span>
  );
}

function FileEditor({
  file, onUpdate, onClose,
}: { file: VaultFile; onUpdate: (patch: Partial<VaultFile>) => void; onClose: () => void }) {
  const [content, setContent] = useState(file.content);
  const [summary, setSummary] = useState(file.summary);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(file.tags ?? []);
  const [showPreview, setShowPreview] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleAutoSave(patch: Partial<VaultFile>) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => onUpdate(patch), 800);
  }

  function handleContent(v: string) {
    setContent(v);
    scheduleAutoSave({ content: v });
  }

  function handleSummary(v: string) {
    setSummary(v);
    scheduleAutoSave({ summary: v });
  }

  function addTag() {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) {
      const next = [...tags, t];
      setTags(next);
      onUpdate({ tags: next });
    }
    setTagInput("");
  }

  function removeTag(tag: string) {
    const next = tags.filter((t) => t !== tag);
    setTags(next);
    onUpdate({ tags: next });
  }

  function handlePrint() {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html><head><title>${file.name}</title><style>body{font-family:sans-serif;padding:2rem;max-width:800px;margin:auto;}pre{white-space:pre-wrap;}</style></head><body><h1>${file.name}</h1><pre>${content}</pre></body></html>`);
    win.document.close();
    win.print();
  }

  function renderPreview(text: string) {
    const lines = text.split("\n");
    return lines.map((line, i) => {
      if (line.startsWith("# ")) return <h1 key={i} className="text-xl font-bold mt-4 mb-2" style={{ color: "#FFFFFF" }}>{line.slice(2)}</h1>;
      if (line.startsWith("## ")) return <h2 key={i} className="text-lg font-semibold mt-3 mb-1" style={{ color: "#D0DFEE" }}>{line.slice(3)}</h2>;
      if (line.startsWith("### ")) return <h3 key={i} className="text-base font-semibold mt-2 mb-1" style={{ color: "#D0DFEE" }}>{line.slice(4)}</h3>;
      if (line.startsWith("- ") || line.startsWith("* ")) return <li key={i} className="ml-4 text-sm" style={{ color: "#D0DFEE" }}>{line.slice(2)}</li>;
      if (/^\d+\. /.test(line)) return <li key={i} className="ml-4 text-sm list-decimal" style={{ color: "#D0DFEE" }}>{line.replace(/^\d+\. /, "")}</li>;
      if (line === "") return <div key={i} className="h-2" />;
      return <p key={i} className="text-sm leading-relaxed" style={{ color: "#D0DFEE" }}>{line}</p>;
    });
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: NAVY }}>
      <div className="flex items-center gap-3 px-5 py-3 border-b flex-shrink-0" style={{ borderColor: BORDER }}>
        <button onClick={onClose} className="p-1 rounded hover:opacity-80 transition-opacity">
          <ChevronRight size={14} style={{ color: MUTED, transform: "rotate(180deg)" }} />
        </button>
        <span className="text-sm font-bold tracking-wide" style={{ color: "#FFFFFF" }}>{file.name}</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold tracking-wider uppercase transition-all"
            style={{ backgroundColor: showPreview ? "rgba(201,168,76,0.15)" : "#1B2A4A", color: showPreview ? GOLD : MUTED }}
          >
            {showPreview ? <EyeOff size={11} /> : <Eye size={11} />}
            Preview
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold tracking-wider uppercase transition-all hover:opacity-80"
            style={{ backgroundColor: "#1B2A4A", color: MUTED }}
          >
            <Printer size={11} />
            Print
          </button>
          <label
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold tracking-wider uppercase cursor-pointer transition-all hover:opacity-80"
            style={{ backgroundColor: "#1B2A4A", color: MUTED }}
          >
            <Upload size={11} />
            Upload
            <input type="file" className="hidden" onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const reader = new FileReader();
              reader.onload = (ev) => {
                const text = ev.target?.result as string;
                handleContent(content + (content ? "\n\n" : "") + `[Uploaded: ${f.name}]\n${text}`);
              };
              reader.readAsText(f);
            }} />
          </label>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 flex flex-col min-h-0 p-5">
          {showPreview ? (
            <div className="flex-1 overflow-y-auto rounded-lg p-4" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
              {renderPreview(content)}
            </div>
          ) : (
            <textarea
              className="flex-1 resize-none text-sm leading-relaxed outline-none rounded-lg p-4"
              style={{ backgroundColor: CARD, color: "#D0DFEE", border: `1px solid ${BORDER}`, fontFamily: "'JetBrains Mono', 'Courier New', monospace" }}
              value={content}
              onChange={(e) => handleContent(e.target.value)}
              placeholder={"# Title\n\nStart writing...\n\nSupports:\n- Headers (# ## ###)\n- Bullet lists (- item)\n- Numbered lists (1. item)\n- Plain paragraphs"}
            />
          )}
          <div className="mt-2 text-[10px]" style={{ color: DIM }}>
            Auto-saved · Supports markdown-style headers and lists · # H1 &nbsp; ## H2 &nbsp; - list &nbsp; 1. numbered
          </div>
        </div>

        <div className="w-64 flex-shrink-0 border-l p-4 flex flex-col gap-4 overflow-y-auto" style={{ borderColor: BORDER }}>
          <div>
            <p className="text-[9px] tracking-widest uppercase font-semibold mb-2" style={{ color: MUTED }}>Summary</p>
            <textarea
              className="w-full resize-none text-xs leading-relaxed outline-none rounded p-2"
              style={{ backgroundColor: CARD, color: "#D0DFEE", border: `1px solid ${BORDER}`, minHeight: "80px" }}
              value={summary}
              onChange={(e) => handleSummary(e.target.value)}
              placeholder="Short summary..."
            />
          </div>

          <div>
            <p className="text-[9px] tracking-widest uppercase font-semibold mb-2" style={{ color: MUTED }}>Tags</p>
            <div className="flex flex-wrap gap-1 mb-2">
              {tags.map((t) => <TagBadge key={t} tag={t} onRemove={() => removeTag(t)} />)}
            </div>
            <div className="flex gap-1">
              <input
                className="flex-1 text-xs px-2 py-1 rounded outline-none"
                style={{ backgroundColor: CARD, color: "#FFFFFF", border: `1px solid ${BORDER}` }}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addTag(); }}
                placeholder="Add tag..."
              />
              <button onClick={addTag} className="px-2 py-1 rounded text-xs" style={{ backgroundColor: "rgba(201,168,76,0.15)", color: GOLD }}>
                <Plus size={10} />
              </button>
            </div>
          </div>

          <div>
            <p className="text-[9px] tracking-widest uppercase font-semibold mb-1" style={{ color: MUTED }}>Created</p>
            <p className="text-[10px]" style={{ color: DIM }}>{new Date(file.created_at).toLocaleDateString()}</p>
            <p className="text-[9px] tracking-widest uppercase font-semibold mt-2 mb-1" style={{ color: MUTED }}>Updated</p>
            <p className="text-[10px]" style={{ color: DIM }}>{new Date(file.updated_at).toLocaleDateString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilesTab() {
  const [folders, setFolders] = useState<VaultFolder[]>([]);
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null | undefined>(undefined);
  const [openFile, setOpenFile] = useState<VaultFile | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [search, setSearch] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [f, files] = await Promise.all([listVaultFolders(), listVaultFiles(selectedFolder)]);
    setFolders(f);
    setFiles(files);
    setLoading(false);
  }, [selectedFolder]);

  useEffect(() => { load(); }, [load]);

  async function handleCreateFile() {
    const f = await createVaultFile("Untitled", selectedFolder ?? null);
    setFiles((prev) => [f, ...prev]);
    setOpenFile(f);
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return;
    const f = await createVaultFolder(newFolderName.trim());
    setFolders((prev) => [...prev, f]);
    setNewFolderName("");
    setShowNewFolder(false);
  }

  async function handleDeleteFile(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await deleteVaultFile(id);
    setFiles((prev) => prev.filter((f) => f.id !== id));
    if (openFile?.id === id) setOpenFile(null);
  }

  async function handleDeleteFolder(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await deleteVaultFolder(id);
    setFolders((prev) => prev.filter((f) => f.id !== id));
    if (selectedFolder === id) setSelectedFolder(undefined);
  }

  async function handleRenameFile(id: string, name: string) {
    await updateVaultFile(id, { name });
    setFiles((prev) => prev.map((f) => f.id === id ? { ...f, name } : f));
    if (openFile?.id === id) setOpenFile((prev) => prev ? { ...prev, name } : prev);
  }

  async function handleRenameFolder(id: string, name: string) {
    await renameVaultFolder(id, name);
    setFolders((prev) => prev.map((f) => f.id === id ? { ...f, name } : f));
  }

  async function handleUpdateFile(id: string, patch: Partial<VaultFile>) {
    await updateVaultFile(id, patch);
    setFiles((prev) => prev.map((f) => f.id === id ? { ...f, ...patch, updated_at: new Date().toISOString() } : f));
    if (openFile?.id === id) setOpenFile((prev) => prev ? { ...prev, ...patch } : prev);
  }

  const filtered = files.filter((f) =>
    !search || f.name.toLowerCase().includes(search.toLowerCase()) || f.summary.toLowerCase().includes(search.toLowerCase()) || f.tags.some((t) => t.includes(search.toLowerCase()))
  );

  if (openFile) {
    return (
      <FileEditor
        file={openFile}
        onUpdate={(patch) => handleUpdateFile(openFile.id, patch)}
        onClose={() => setOpenFile(null)}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="w-52 flex-shrink-0 border-r flex flex-col" style={{ borderColor: BORDER }}>
        <div className="p-3 border-b flex items-center justify-between" style={{ borderColor: BORDER }}>
          <span className="text-[9px] tracking-widest uppercase font-semibold" style={{ color: MUTED }}>Folders</span>
          <button onClick={() => setShowNewFolder(!showNewFolder)} className="p-1 rounded hover:opacity-80" style={{ color: GOLD }}>
            <Plus size={12} />
          </button>
        </div>
        {showNewFolder && (
          <div className="px-3 py-2 flex gap-1 border-b" style={{ borderColor: BORDER }}>
            <input
              autoFocus
              className="flex-1 text-xs px-2 py-1 rounded outline-none"
              style={{ backgroundColor: CARD, color: "#FFFFFF", border: `1px solid ${BORDER}` }}
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateFolder(); if (e.key === "Escape") setShowNewFolder(false); }}
              placeholder="Folder name..."
            />
            <button onClick={handleCreateFolder} className="p-1" style={{ color: GOLD }}><Check size={12} /></button>
            <button onClick={() => setShowNewFolder(false)} className="p-1" style={{ color: MUTED }}><X size={12} /></button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto py-1">
          <button
            onClick={() => setSelectedFolder(undefined)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs transition-all"
            style={{ backgroundColor: selectedFolder === undefined ? "rgba(201,168,76,0.08)" : "transparent", color: selectedFolder === undefined ? GOLD : MUTED }}
          >
            <Folder size={12} />
            <span className="flex-1 text-left font-medium">All Files</span>
          </button>
          <button
            onClick={() => setSelectedFolder(null)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs transition-all"
            style={{ backgroundColor: selectedFolder === null ? "rgba(201,168,76,0.08)" : "transparent", color: selectedFolder === null ? GOLD : MUTED }}
          >
            <FileText size={12} />
            <span className="flex-1 text-left font-medium">Unfiled</span>
          </button>
          {folders.map((folder) => (
            <div key={folder.id} className="group flex items-center gap-1 px-1">
              <button
                onClick={() => setSelectedFolder(folder.id)}
                className="flex-1 flex items-center gap-2 px-2 py-2 text-xs rounded transition-all"
                style={{ backgroundColor: selectedFolder === folder.id ? "rgba(201,168,76,0.08)" : "transparent", color: selectedFolder === folder.id ? GOLD : MUTED }}
              >
                {selectedFolder === folder.id ? <FolderOpen size={12} /> : <Folder size={12} />}
                <InlineEdit
                  value={folder.name}
                  onSave={(n) => handleRenameFolder(folder.id, n)}
                  style={{ fontSize: "11px", color: "inherit", flex: 1 }}
                />
              </button>
              <button onClick={(e) => handleDeleteFolder(folder.id, e)} className="opacity-0 group-hover:opacity-60 hover:opacity-100 p-1">
                <Trash2 size={10} style={{ color: "#F87171" }} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-4 py-3 border-b flex items-center gap-3" style={{ borderColor: BORDER }}>
          <div className="flex items-center gap-2 flex-1 px-3 py-1.5 rounded" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
            <Search size={11} style={{ color: DIM }} />
            <input
              className="flex-1 text-xs bg-transparent outline-none"
              style={{ color: "#FFFFFF" }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search files..."
            />
          </div>
          <div className="flex gap-1">
            {(["grid", "table"] as ViewMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className="p-2 rounded transition-all"
                style={{ backgroundColor: viewMode === m ? "rgba(201,168,76,0.15)" : "transparent", color: viewMode === m ? GOLD : DIM }}
              >
                {m === "grid" ? <LayoutGrid size={13} /> : <Table size={13} />}
              </button>
            ))}
          </div>
          <button
            onClick={handleCreateFile}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold tracking-wider uppercase transition-all hover:opacity-90"
            style={{ backgroundColor: GOLD, color: NAVY }}
          >
            <Plus size={11} />
            New File
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading && <p className="text-xs" style={{ color: DIM }}>Loading...</p>}
          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 gap-3">
              <FileText size={28} style={{ color: DIM }} />
              <p className="text-xs" style={{ color: DIM }}>No files yet. Create one to get started.</p>
            </div>
          )}

          {viewMode === "grid" && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {filtered.map((file) => (
                <div
                  key={file.id}
                  onClick={() => setOpenFile(file)}
                  className="group cursor-pointer rounded-lg p-3 transition-all hover:border-opacity-60"
                  style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <FileText size={14} style={{ color: GOLD, opacity: 0.7 }} />
                    <button
                      onClick={(e) => handleDeleteFile(file.id, e)}
                      className="opacity-0 group-hover:opacity-60 hover:opacity-100 p-0.5 transition-opacity"
                    >
                      <Trash2 size={11} style={{ color: "#F87171" }} />
                    </button>
                  </div>
                  <InlineEdit
                    value={file.name}
                    onSave={(n) => { handleRenameFile(file.id, n); }}
                    className="block text-xs font-semibold mb-1 w-full"
                    style={{ color: "#FFFFFF" }}
                  />
                  {file.summary && (
                    <p className="text-[10px] leading-snug mb-2 line-clamp-2" style={{ color: MUTED }}>{file.summary}</p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {file.tags.slice(0, 3).map((t) => <TagBadge key={t} tag={t} />)}
                  </div>
                  <p className="text-[9px] mt-2" style={{ color: DIM }}>
                    {new Date(file.updated_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}

          {viewMode === "table" && (
            <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                  {["Name", "Summary", "Tags", "Updated"].map((h) => (
                    <th key={h} className="text-left py-2 px-3 text-[9px] tracking-widest uppercase font-semibold" style={{ color: MUTED }}>{h}</th>
                  ))}
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((file) => (
                  <tr
                    key={file.id}
                    onClick={() => setOpenFile(file)}
                    className="group cursor-pointer transition-all"
                    style={{ borderBottom: `1px solid rgba(27,42,74,0.5)` }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.02)")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <td className="py-2.5 px-3 font-semibold" style={{ color: "#FFFFFF" }}>
                      <div className="flex items-center gap-2">
                        <FileText size={11} style={{ color: GOLD, opacity: 0.6 }} />
                        {file.name}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 max-w-[200px]" style={{ color: MUTED }}>
                      <span className="truncate block">{file.summary || "—"}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex gap-1 flex-wrap">
                        {file.tags.slice(0, 3).map((t) => <TagBadge key={t} tag={t} />)}
                      </div>
                    </td>
                    <td className="py-2.5 px-3" style={{ color: DIM }}>{new Date(file.updated_at).toLocaleDateString()}</td>
                    <td className="py-2.5 px-3">
                      <button
                        onClick={(e) => handleDeleteFile(file.id, e)}
                        className="opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={11} style={{ color: "#F87171" }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function NotesTab() {
  const [notes, setNotes] = useState<SideNote[]>([]);
  const [tags, setTags] = useState<TagEntry[]>([]);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listSideNotes({ archived: false }), listAllTags()]).then(([n, t]) => {
      setNotes(n);
      setTags(t);
      setLoading(false);
    });
  }, []);

  async function handleDelete(id: string) {
    await deleteSideNote(id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  const filtered = notes.filter((n) => {
    const matchesTag = activeTag ? n.tags.includes(activeTag) : true;
    const matchesSearch = search ? n.text.toLowerCase().includes(search.toLowerCase()) : true;
    return matchesTag && matchesSearch;
  });

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-2 flex-1 px-3 py-2 rounded" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
          <Search size={12} style={{ color: DIM }} />
          <input
            className="flex-1 text-sm bg-transparent outline-none"
            style={{ color: "#FFFFFF" }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes..."
          />
        </div>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          <button
            onClick={() => setActiveTag(null)}
            className="text-[10px] tracking-widest uppercase font-semibold px-2.5 py-1 rounded-full transition-all"
            style={{ backgroundColor: activeTag === null ? GOLD : "rgba(201,168,76,0.1)", color: activeTag === null ? NAVY : GOLD }}
          >
            All
          </button>
          {tags.map((t) => (
            <button
              key={t.tag}
              onClick={() => setActiveTag(activeTag === t.tag ? null : t.tag)}
              className="text-[10px] tracking-widest uppercase font-semibold px-2.5 py-1 rounded-full transition-all"
              style={{ backgroundColor: activeTag === t.tag ? GOLD : "rgba(201,168,76,0.1)", color: activeTag === t.tag ? NAVY : GOLD }}
            >
              {t.tag} <span style={{ opacity: 0.6 }}>({t.usage_count})</span>
            </button>
          ))}
        </div>
      )}

      {loading && <p className="text-sm" style={{ color: DIM }}>Loading...</p>}
      {!loading && filtered.length === 0 && (
        <p className="text-sm" style={{ color: DIM }}>
          {search || activeTag ? "No notes match that filter." : "No side notes saved yet."}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {filtered.map((note) => (
          <div key={note.id} className="rounded-xl px-4 py-3 group" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm leading-relaxed flex-1" style={{ color: "#D0DFEE" }}>{note.text}</p>
              <button onClick={() => handleDelete(note.id)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded">
                <Trash2 size={13} style={{ color: "#F87171" }} />
              </button>
            </div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {note.tags.map((tag) => <TagBadge key={tag} tag={tag} />)}
              {note.mentors.length > 0 && (
                <span className="text-[9px] tracking-widest uppercase" style={{ color: DIM }}>{note.mentors.join(", ")}</span>
              )}
              <span className="text-[9px] ml-auto" style={{ color: DIM }}>{new Date(note.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function VaultView() {
  const [tab, setTab] = useState<MainTab>("files");

  return (
    <div className="flex-1 flex flex-col min-h-0" style={{ backgroundColor: NAVY, color: "#FFFFFF" }}>
      <div className="px-6 py-3 border-b flex items-center gap-1" style={{ borderColor: BORDER }}>
        <span className="text-xs font-bold tracking-widest uppercase mr-4" style={{ color: MUTED }}>Vault</span>
        {([
          { id: "files" as MainTab, icon: <FileText size={11} />, label: "Files" },
          { id: "notes" as MainTab, icon: <AlignLeft size={11} />, label: "Side Notes" },
        ]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold tracking-wider uppercase rounded transition-all"
            style={
              tab === t.id
                ? { backgroundColor: "rgba(201,168,76,0.15)", color: GOLD, border: `1px solid rgba(201,168,76,0.3)` }
                : { color: MUTED, border: "1px solid transparent" }
            }
          >
            {t.icon}
            {t.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <Tag size={11} style={{ color: DIM }} />
          <span className="text-[9px] tracking-widest uppercase" style={{ color: DIM }}>Persistent Storage</span>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        {tab === "files" && <FilesTab />}
        {tab === "notes" && <NotesTab />}
      </div>
    </div>
  );
}
