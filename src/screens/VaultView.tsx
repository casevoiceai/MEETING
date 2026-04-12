import { useState, useEffect, useRef, useCallback, DragEvent, useMemo } from "react";
import {
  Trash2, Search, Plus, Folder, FolderOpen, FileText, Check, X,
  Table, LayoutGrid, Tag, Printer, Upload, Eye, EyeOff, Link, ChevronRight,
} from "lucide-react";
import {
  listSideNotes, deleteSideNote, saveSideNote, updateSideNote, listAllTags, upsertTags,
  listVaultFolders, createVaultFolder, renameVaultFolder, deleteVaultFolder,
  listVaultFiles, createVaultFile, updateVaultFile, deleteVaultFile,
  listProjects, addProjectTask,
  type SideNote, type TagEntry, type VaultFolder, type VaultFile, type Project,
} from "../lib/db";
import { ALL_MENTOR_NAMES, FALLBACK_MENTOR_NAMES } from "../lib/mentors";

type MainTab = "files" | "notes";
type ViewMode = "grid" | "table";

const GOLD = "#C9A84C";
const NAVY = "#0D1B2E";
const CARD = "#111D30";
const BORDER = "#1B2A4A";
const MUTED = "#8A9BB5";
const DIM = "#3A4F6A";
const TEXT = "#D0DFEE";

function TagBadge({ tag, onRemove }: { tag: string; onRemove?: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-xs tracking-wider font-semibold px-2.5 py-0.5 rounded-full"
      style={{ backgroundColor: "rgba(201,168,76,0.15)", color: GOLD }}
    >
      {tag}
      {onRemove && (
        <button onClick={onRemove} className="opacity-60 hover:opacity-100 leading-none ml-0.5">×</button>
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
    </span>
  );
}

function renderMarkdown(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    if (line.startsWith("# ")) return <h1 key={i} className="text-xl font-bold mt-4 mb-2" style={{ color: "#FFFFFF" }}>{line.slice(2)}</h1>;
    if (line.startsWith("## ")) return <h2 key={i} className="text-lg font-semibold mt-3 mb-1" style={{ color: TEXT }}>{line.slice(3)}</h2>;
    if (line.startsWith("### ")) return <h3 key={i} className="text-base font-semibold mt-2 mb-1" style={{ color: TEXT }}>{line.slice(4)}</h3>;
    if (line.startsWith("- ") || line.startsWith("* ")) return <li key={i} className="ml-4 text-sm" style={{ color: TEXT }}>{line.slice(2)}</li>;
    if (/^\d+\. /.test(line)) return <li key={i} className="ml-4 text-sm list-decimal" style={{ color: TEXT }}>{line.replace(/^\d+\. /, "")}</li>;
    if (line === "") return <div key={i} className="h-2" />;
    return <p key={i} className="text-sm leading-relaxed" style={{ color: TEXT }}>{line}</p>;
  });
}

function FileEditor({
  file, onUpdate, onClose, projects,
}: { file: VaultFile; onUpdate: (patch: Partial<VaultFile>) => void; onClose: () => void; projects: Project[] }) {
  const [content, setContent] = useState(file.content);
  const [summary, setSummary] = useState(file.summary);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(file.tags ?? []);
  const [showPreview, setShowPreview] = useState(false);
  const [linkedProjectId, setLinkedProjectId] = useState<string | null>(file.linked_project_id);
  const [isDragOver, setIsDragOver] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleAutoSave(patch: Partial<VaultFile>) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => onUpdate(patch), 800);
  }

  function handleContent(v: string) { setContent(v); scheduleAutoSave({ content: v }); }
  function handleSummary(v: string) { setSummary(v); scheduleAutoSave({ summary: v }); }

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

  function handleLinkProject(id: string | null) {
    setLinkedProjectId(id);
    onUpdate({ linked_project_id: id });
  }

  function handleFileDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    const f = e.dataTransfer.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const next = content + (content ? "\n\n" : "") + `[Uploaded: ${f.name}]\n${text}`;
      handleContent(next);
    };
    reader.readAsText(f);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const next = content + (content ? "\n\n" : "") + `[Uploaded: ${f.name}]\n${text}`;
      handleContent(next);
    };
    reader.readAsText(f);
  }

  function handlePrint() {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html><head><title>${file.name}</title><style>body{font-family:sans-serif;padding:2rem;max-width:800px;margin:auto;}pre{white-space:pre-wrap;}</style></head><body><h1>${file.name}</h1><pre>${content}</pre></body></html>`);
    win.document.close();
    win.print();
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: NAVY }}>
      <div className="flex items-center gap-3 px-5 py-3 border-b flex-shrink-0" style={{ borderColor: BORDER }}>
        <button onClick={onClose} className="p-1.5 rounded hover:opacity-80 transition-opacity">
          <ChevronRight size={15} style={{ color: MUTED, transform: "rotate(180deg)" }} />
        </button>
        <span className="text-base font-bold tracking-wide" style={{ color: "#FFFFFF" }}>{file.name}</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wider uppercase transition-all"
            style={{ backgroundColor: showPreview ? "rgba(201,168,76,0.15)" : "#1B2A4A", color: showPreview ? GOLD : MUTED }}
          >
            {showPreview ? <EyeOff size={12} /> : <Eye size={12} />}
            Preview
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wider uppercase hover:opacity-80"
            style={{ backgroundColor: "#1B2A4A", color: MUTED }}
          >
            <Printer size={12} />
            Print
          </button>
          <label
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wider uppercase cursor-pointer hover:opacity-80"
            style={{ backgroundColor: "#1B2A4A", color: MUTED }}
          >
            <Upload size={12} />
            Upload
            <input type="file" className="hidden" onChange={handleFileInput} />
          </label>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div
          className="flex-1 flex flex-col min-h-0 p-5 transition-colors"
          style={{ backgroundColor: isDragOver ? "rgba(201,168,76,0.04)" : "transparent" }}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleFileDrop}
        >
          {isDragOver && (
            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
              <div className="px-6 py-4 rounded-2xl text-sm font-semibold" style={{ backgroundColor: "rgba(201,168,76,0.2)", color: GOLD, border: `2px dashed ${GOLD}` }}>
                Drop file here to append content
              </div>
            </div>
          )}
          {showPreview ? (
            <div className="flex-1 overflow-y-auto rounded-xl p-5" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
              {renderMarkdown(content)}
            </div>
          ) : (
            <textarea
              className="flex-1 resize-none text-sm leading-relaxed outline-none rounded-xl p-5"
              style={{ backgroundColor: CARD, color: TEXT, border: `1px solid ${BORDER}`, fontFamily: "'JetBrains Mono', 'Courier New', monospace" }}
              value={content}
              onChange={(e) => handleContent(e.target.value)}
              placeholder={"# Title\n\nStart writing...\n\nSupports:\n- Headers (# ## ###)\n- Bullet lists\n- Numbered lists"}
            />
          )}
          <p className="text-xs mt-2" style={{ color: DIM }}>Auto-saved · Drag a file to append · Supports Markdown</p>
        </div>

        <div className="w-72 flex-shrink-0 border-l p-5 flex flex-col gap-5 overflow-y-auto" style={{ borderColor: BORDER }}>
          <div>
            <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: MUTED }}>Summary</p>
            <textarea
              className="w-full resize-none text-sm leading-relaxed outline-none rounded-xl p-3"
              style={{ backgroundColor: CARD, color: TEXT, border: `1px solid ${BORDER}`, minHeight: "90px" }}
              value={summary}
              onChange={(e) => handleSummary(e.target.value)}
              placeholder="Short summary..."
            />
          </div>

          <div>
            <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: MUTED }}>Tags</p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((t) => <TagBadge key={t} tag={t} onRemove={() => removeTag(t)} />)}
            </div>
            <div className="flex gap-1.5">
              <input
                className="flex-1 text-sm px-3 py-1.5 rounded-lg outline-none"
                style={{ backgroundColor: CARD, color: "#FFFFFF", border: `1px solid ${BORDER}` }}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addTag(); }}
                placeholder="Add tag..."
              />
              <button onClick={addTag} className="px-2.5 py-1.5 rounded-lg" style={{ backgroundColor: "rgba(201,168,76,0.15)", color: GOLD }}>
                <Plus size={12} />
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold tracking-widest uppercase mb-2 flex items-center gap-1.5" style={{ color: MUTED }}>
              <Link size={11} />
              Linked Project
            </p>
            <select
              className="w-full text-sm px-3 py-2 rounded-lg outline-none"
              style={{ backgroundColor: CARD, color: linkedProjectId ? "#FFFFFF" : MUTED, border: `1px solid ${BORDER}` }}
              value={linkedProjectId ?? ""}
              onChange={(e) => handleLinkProject(e.target.value || null)}
            >
              <option value="">— None —</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div>
            <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: MUTED }}>Created</p>
            <p className="text-sm" style={{ color: DIM }}>{new Date(file.created_at).toLocaleDateString()}</p>
            <p className="text-xs font-bold tracking-widest uppercase mt-3 mb-1" style={{ color: MUTED }}>Updated</p>
            <p className="text-sm" style={{ color: DIM }}>{new Date(file.updated_at).toLocaleDateString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilesTab() {
  const [folders, setFolders] = useState<VaultFolder[]>([]);
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null | undefined>(undefined);
  const [openFile, setOpenFile] = useState<VaultFile | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [search, setSearch] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);

  const load = useCallback(async () => {
    const [f, files, p] = await Promise.all([listVaultFolders(), listVaultFiles(selectedFolder), listProjects()]);
    setFolders(f);
    setFiles(files);
    setProjects(p);
    setLoading(false);
  }, [selectedFolder]);

  useEffect(() => { load(); }, [load]);

  async function handleCreateFile(name = "Untitled", initialContent = "") {
    const f = await createVaultFile(name, selectedFolder ?? null);
    if (initialContent) await updateVaultFile(f.id, { content: initialContent });
    const updated = { ...f, content: initialContent };
    setFiles((prev) => [updated, ...prev]);
    setOpenFile(updated);
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

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string ?? "";
      handleCreateFile(file.name, text);
    };
    if (file.type.startsWith("text") || file.name.endsWith(".md") || file.name.endsWith(".txt")) {
      reader.readAsText(file);
    } else {
      handleCreateFile(file.name, `[Binary file: ${file.name} — ${(file.size / 1024).toFixed(1)} KB]`);
    }
  }

  const filtered = files.filter((f) =>
    !search || f.name.toLowerCase().includes(search.toLowerCase()) ||
    f.summary.toLowerCase().includes(search.toLowerCase()) ||
    f.tags.some((t) => t.includes(search.toLowerCase()))
  );

  if (openFile) {
    return (
      <FileEditor
        file={openFile}
        onUpdate={(patch) => handleUpdateFile(openFile.id, patch)}
        onClose={() => setOpenFile(null)}
        projects={projects}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="w-56 flex-shrink-0 border-r flex flex-col" style={{ borderColor: BORDER }}>
        <div className="p-3 border-b flex items-center justify-between" style={{ borderColor: BORDER }}>
          <span className="text-xs font-bold tracking-widest uppercase" style={{ color: MUTED }}>Folders</span>
          <button onClick={() => setShowNewFolder(!showNewFolder)} className="p-1.5 rounded hover:opacity-80" style={{ color: GOLD }}>
            <Plus size={13} />
          </button>
        </div>
        {showNewFolder && (
          <div className="px-3 py-2 flex gap-1 border-b" style={{ borderColor: BORDER }}>
            <input
              autoFocus
              className="flex-1 text-sm px-2 py-1 rounded outline-none"
              style={{ backgroundColor: CARD, color: "#FFFFFF", border: `1px solid ${BORDER}` }}
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateFolder(); if (e.key === "Escape") setShowNewFolder(false); }}
              placeholder="Folder name..."
            />
            <button onClick={handleCreateFolder} className="p-1" style={{ color: GOLD }}><Check size={13} /></button>
            <button onClick={() => setShowNewFolder(false)} className="p-1" style={{ color: MUTED }}><X size={13} /></button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto py-1">
          <button
            onClick={() => setSelectedFolder(undefined)}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-all"
            style={{ backgroundColor: selectedFolder === undefined ? "rgba(201,168,76,0.08)" : "transparent", color: selectedFolder === undefined ? GOLD : MUTED }}
          >
            <Folder size={13} />
            <span className="flex-1 text-left font-medium">All Files</span>
          </button>
          <button
            onClick={() => setSelectedFolder(null)}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-all"
            style={{ backgroundColor: selectedFolder === null ? "rgba(201,168,76,0.08)" : "transparent", color: selectedFolder === null ? GOLD : MUTED }}
          >
            <FileText size={13} />
            <span className="flex-1 text-left font-medium">Unfiled</span>
          </button>
          {folders.map((folder) => (
            <div key={folder.id} className="group flex items-center gap-1 px-1">
              <button
                onClick={() => setSelectedFolder(folder.id)}
                className="flex-1 flex items-center gap-2 px-2 py-2.5 text-sm rounded transition-all"
                style={{ backgroundColor: selectedFolder === folder.id ? "rgba(201,168,76,0.08)" : "transparent", color: selectedFolder === folder.id ? GOLD : MUTED }}
              >
                {selectedFolder === folder.id ? <FolderOpen size={13} /> : <Folder size={13} />}
                <InlineEdit
                  value={folder.name}
                  onSave={(n) => handleRenameFolder(folder.id, n)}
                  style={{ fontSize: "13px", color: "inherit", flex: 1 }}
                />
              </button>
              <button onClick={(e) => handleDeleteFolder(folder.id, e)} className="opacity-0 group-hover:opacity-60 hover:opacity-100 p-1">
                <Trash2 size={11} style={{ color: "#F87171" }} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div
        className="flex-1 flex flex-col min-h-0 transition-colors"
        style={{ backgroundColor: isDragOver ? "rgba(201,168,76,0.03)" : "transparent" }}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        <div className="px-4 py-3 border-b flex items-center gap-3" style={{ borderColor: BORDER }}>
          <div className="flex items-center gap-2 flex-1 px-3 py-2 rounded-lg" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
            <Search size={13} style={{ color: DIM }} />
            <input
              className="flex-1 text-sm bg-transparent outline-none"
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
                className="p-2 rounded-lg transition-all"
                style={{ backgroundColor: viewMode === m ? "rgba(201,168,76,0.15)" : "transparent", color: viewMode === m ? GOLD : DIM }}
              >
                {m === "grid" ? <LayoutGrid size={14} /> : <Table size={14} />}
              </button>
            ))}
          </div>
          <button
            onClick={() => handleCreateFile()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold tracking-wider uppercase transition-all hover:opacity-90"
            style={{ backgroundColor: GOLD, color: NAVY }}
          >
            <Plus size={13} />
            New File
          </button>
        </div>

        {isDragOver && (
          <div className="mx-4 mt-3 py-4 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold" style={{ border: `2px dashed ${GOLD}`, color: GOLD, backgroundColor: "rgba(201,168,76,0.06)" }}>
            <Upload size={16} />
            Drop file to create in vault
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          {loading && <p className="text-sm" style={{ color: DIM }}>Loading...</p>}
          {!loading && filtered.length === 0 && !isDragOver && (
            <div className="flex flex-col items-center justify-center h-40 gap-3">
              <FileText size={32} style={{ color: DIM }} />
              <p className="text-sm" style={{ color: DIM }}>No files yet. Create one or drag a file here.</p>
            </div>
          )}

          {viewMode === "grid" && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {filtered.map((file) => (
                <div
                  key={file.id}
                  onClick={() => setOpenFile(file)}
                  className="group cursor-pointer rounded-xl p-4 transition-all hover:border-opacity-60"
                  style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <FileText size={16} style={{ color: GOLD, opacity: 0.7 }} />
                    <button
                      onClick={(e) => handleDeleteFile(file.id, e)}
                      className="opacity-0 group-hover:opacity-60 hover:opacity-100 p-0.5 transition-opacity"
                    >
                      <Trash2 size={12} style={{ color: "#F87171" }} />
                    </button>
                  </div>
                  <InlineEdit
                    value={file.name}
                    onSave={(n) => handleRenameFile(file.id, n)}
                    className="block text-sm font-semibold mb-1.5 w-full"
                    style={{ color: "#FFFFFF" }}
                  />
                  {file.summary && (
                    <p className="text-xs leading-snug mb-2 line-clamp-2" style={{ color: MUTED }}>{file.summary}</p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {file.tags.slice(0, 2).map((t) => <TagBadge key={t} tag={t} />)}
                  </div>
                  <p className="text-xs mt-2" style={{ color: DIM }}>{new Date(file.updated_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}

          {viewMode === "table" && (
            <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                  {["Name", "Type", "Tags", "Linked Project", "Last Updated"].map((h) => (
                    <th key={h} className="text-left py-2.5 px-3 text-xs font-bold tracking-widest uppercase" style={{ color: MUTED }}>{h}</th>
                  ))}
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((file) => {
                  const linkedProject = projects.find((p) => p.id === file.linked_project_id);
                  return (
                    <tr
                      key={file.id}
                      onClick={() => setOpenFile(file)}
                      className="group cursor-pointer transition-all"
                      style={{ borderBottom: `1px solid rgba(27,42,74,0.5)` }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.02)")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    >
                      <td className="py-3 px-3 font-semibold" style={{ color: "#FFFFFF" }}>
                        <div className="flex items-center gap-2">
                          <FileText size={13} style={{ color: GOLD, opacity: 0.6 }} />
                          {file.name}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.06)", color: MUTED }}>
                          {file.file_type || "note"}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex gap-1 flex-wrap">
                          {file.tags.slice(0, 2).map((t) => <TagBadge key={t} tag={t} />)}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-sm" style={{ color: linkedProject ? TEXT : DIM }}>
                        {linkedProject ? (
                          <span className="flex items-center gap-1.5">
                            <Link size={11} style={{ color: GOLD }} />
                            {linkedProject.name}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="py-3 px-3 text-sm" style={{ color: DIM }}>{new Date(file.updated_at).toLocaleDateString()}</td>
                      <td className="py-3 px-3">
                        <button onClick={(e) => handleDeleteFile(file.id, e)} className="opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity">
                          <Trash2 size={12} style={{ color: "#F87171" }} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function MentorPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const mentorList = useMemo(() => {
    try {
      return ALL_MENTOR_NAMES.length ? ALL_MENTOR_NAMES : FALLBACK_MENTOR_NAMES;
    } catch {
      return FALLBACK_MENTOR_NAMES;
    }
  }, []);

  const filtered = useMemo(
    () => mentorList.filter((m) => m.toLowerCase().includes(query.toLowerCase()) && !selected.includes(m)),
    [mentorList, query, selected]
  );

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function toggle(name: string) {
    onChange(selected.includes(name) ? selected.filter((n) => n !== name) : [...selected, name]);
  }

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0">
      <div
        className="flex flex-wrap gap-1.5 px-3 py-2 rounded-lg cursor-text min-h-[36px]"
        style={{ backgroundColor: NAVY, border: `1px solid ${open ? GOLD : BORDER}` }}
        onClick={() => setOpen(true)}
      >
        {selected.map((m) => (
          <span
            key={m}
            className="inline-flex items-center gap-1 text-xs font-bold tracking-widest uppercase px-2 py-0.5 rounded-full"
            style={{ backgroundColor: "rgba(201,168,76,0.15)", color: GOLD }}
          >
            {m}
            <button
              onClick={(e) => { e.stopPropagation(); toggle(m); }}
              className="opacity-60 hover:opacity-100 leading-none"
            >×</button>
          </span>
        ))}
        <input
          className="bg-transparent outline-none text-sm flex-1 min-w-[80px]"
          style={{ color: "#FFFFFF" }}
          placeholder={selected.length === 0 ? "Tag mentors..." : ""}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
      </div>

      {open && (
        <div
          className="absolute z-50 left-0 right-0 mt-1 rounded-xl overflow-hidden shadow-2xl"
          style={{ backgroundColor: "#0A1628", border: `1px solid ${BORDER}`, maxHeight: "220px", overflowY: "auto" }}
        >
          {filtered.length === 0 && (
            <p className="px-3 py-2.5 text-xs" style={{ color: DIM }}>No mentors match.</p>
          )}
          {filtered.map((name) => (
            <button
              key={name}
              onMouseDown={(e) => { e.preventDefault(); toggle(name); setQuery(""); }}
              className="w-full text-left px-3 py-2.5 text-sm font-bold tracking-widest uppercase transition-colors hover:bg-white/5"
              style={{ color: MUTED }}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NotesTab() {
  const [notes, setNotes] = useState<SideNote[]>([]);
  const [tags, setTags] = useState<TagEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newText, setNewText] = useState("");
  const [newTags, setNewTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState("");
  const [newProjectId, setNewProjectId] = useState<string | null>(null);
  const [newMentors, setNewMentors] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  useEffect(() => {
    Promise.all([listSideNotes({ archived: false }), listAllTags(), listProjects()]).then(([n, t, p]) => {
      setNotes(n);
      setTags(t);
      setProjects(p);
      setLoading(false);
    });
  }, []);

  async function handleDelete(id: string) {
    await deleteSideNote(id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  async function handleCreate() {
    if (!newText.trim()) return;
    const note = await saveSideNote({
      text: newText.trim(),
      mentors: newMentors,
      tags: newTags,
      session_id: null,
      project_id: newProjectId,
      archived: false,
    });
    if (newTags.length) await upsertTags(newTags);
    setNotes((prev) => [note, ...prev]);
    setNewText("");
    setNewTags([]);
    setNewTagInput("");
    setNewProjectId(null);
    setNewMentors([]);
    setCreating(false);
  }

  function addNewTag() {
    const t = newTagInput.trim().toLowerCase();
    if (t && !newTags.includes(t)) setNewTags((prev) => [...prev, t]);
    setNewTagInput("");
  }

  async function handleEditSave(id: string) {
    await updateSideNote(id, { text: editText });
    setNotes((prev) => prev.map((n) => n.id === id ? { ...n, text: editText } : n));
    setEditingId(null);
  }

  async function handleConvertToTask(note: SideNote) {
    const projectId = note.project_id ?? projects[0]?.id;
    if (!projectId) { alert("Link this note to a project first."); return; }
    await addProjectTask(projectId, note.text, "");
    await deleteSideNote(note.id);
    setNotes((prev) => prev.filter((n) => n.id !== note.id));
  }

  async function handleAttachProject(id: string, projectId: string | null) {
    await updateSideNote(id, { project_id: projectId });
    setNotes((prev) => prev.map((n) => n.id === id ? { ...n, project_id: projectId } : n));
  }

  const filtered = notes.filter((n) => {
    const matchesTag = activeTag ? n.tags.includes(activeTag) : true;
    const matchesSearch = search ? n.text.toLowerCase().includes(search.toLowerCase()) : true;
    return matchesTag && matchesSearch;
  });

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="px-5 py-4 border-b flex items-center gap-3" style={{ borderColor: BORDER }}>
        <div className="flex items-center gap-2 flex-1 px-3 py-2 rounded-lg" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
          <Search size={13} style={{ color: DIM }} />
          <input
            className="flex-1 text-sm bg-transparent outline-none"
            style={{ color: "#FFFFFF" }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes..."
          />
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold tracking-wider uppercase hover:opacity-90"
          style={{ backgroundColor: GOLD, color: NAVY }}
        >
          <Plus size={13} />
          New Note
        </button>
      </div>

      {creating && (
        <div className="mx-5 mt-4 p-4 rounded-xl flex flex-col gap-3" style={{ backgroundColor: CARD, border: `1px solid ${GOLD}44` }}>
          <textarea
            autoFocus
            className="w-full resize-none text-sm leading-relaxed outline-none rounded-lg p-3"
            style={{ backgroundColor: NAVY, color: TEXT, border: `1px solid ${BORDER}`, minHeight: "80px" }}
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Write your note..."
          />
          <div className="flex items-center gap-2 flex-wrap">
            <MentorPicker selected={newMentors} onChange={setNewMentors} />
            <select
              className="text-sm px-2 py-1.5 rounded-lg outline-none flex-shrink-0"
              style={{ backgroundColor: NAVY, color: newProjectId ? "#FFFFFF" : MUTED, border: `1px solid ${BORDER}` }}
              value={newProjectId ?? ""}
              onChange={(e) => setNewProjectId(e.target.value || null)}
            >
              <option value="">Link project...</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex flex-wrap gap-1.5 flex-1">
              {newTags.map((t) => <TagBadge key={t} tag={t} onRemove={() => setNewTags((prev) => prev.filter((x) => x !== t))} />)}
              <input
                className="text-sm px-2 py-1 rounded-lg outline-none min-w-[100px]"
                style={{ backgroundColor: NAVY, color: "#FFFFFF", border: `1px solid ${BORDER}` }}
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addNewTag(); } }}
                placeholder="Tag..."
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setCreating(false)} className="px-3 py-1.5 rounded-lg text-sm" style={{ color: MUTED }}>Cancel</button>
            <button onClick={handleCreate} className="px-4 py-1.5 rounded-lg text-sm font-semibold" style={{ backgroundColor: GOLD, color: NAVY }}>Save</button>
          </div>
        </div>
      )}

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-5 py-3 border-b" style={{ borderColor: BORDER }}>
          <button
            onClick={() => setActiveTag(null)}
            className="text-xs font-bold tracking-wider uppercase px-3 py-1 rounded-full transition-all"
            style={{ backgroundColor: activeTag === null ? GOLD : "rgba(201,168,76,0.1)", color: activeTag === null ? NAVY : GOLD }}
          >
            All
          </button>
          {tags.map((t) => (
            <button
              key={t.tag}
              onClick={() => setActiveTag(activeTag === t.tag ? null : t.tag)}
              className="text-xs font-bold tracking-wider uppercase px-3 py-1 rounded-full transition-all"
              style={{ backgroundColor: activeTag === t.tag ? GOLD : "rgba(201,168,76,0.1)", color: activeTag === t.tag ? NAVY : GOLD }}
            >
              {t.tag} <span style={{ opacity: 0.6 }}>({t.usage_count})</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loading && <p className="text-sm" style={{ color: DIM }}>Loading...</p>}
        {!loading && filtered.length === 0 && (
          <p className="text-sm" style={{ color: DIM }}>{search || activeTag ? "No notes match." : "No side notes yet. Create your first one."}</p>
        )}

        <div className="flex flex-col gap-3">
          {filtered.map((note) => {
            const linkedProject = projects.find((p) => p.id === note.project_id);
            const isEditing = editingId === note.id;
            return (
              <div key={note.id} className="rounded-xl px-5 py-4 group" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
                <div className="flex items-start gap-3">
                  {isEditing ? (
                    <div className="flex-1 flex flex-col gap-2">
                      <textarea
                        autoFocus
                        className="w-full resize-none text-sm leading-relaxed outline-none rounded-lg p-3"
                        style={{ backgroundColor: NAVY, color: TEXT, border: `1px solid ${GOLD}44`, minHeight: "70px" }}
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                      />
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setEditingId(null)} className="px-3 py-1.5 rounded-lg text-sm" style={{ color: MUTED }}>Cancel</button>
                        <button onClick={() => handleEditSave(note.id)} className="px-3 py-1.5 rounded-lg text-sm font-semibold" style={{ backgroundColor: GOLD, color: NAVY }}>Save</button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm leading-relaxed flex-1" style={{ color: TEXT }}>{note.text}</p>
                  )}
                  {!isEditing && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button
                        onClick={() => { setEditingId(note.id); setEditText(note.text); }}
                        className="p-1.5 rounded hover:opacity-70"
                        title="Edit"
                        style={{ color: MUTED }}
                      >
                        <Tag size={12} />
                      </button>
                      <button
                        onClick={() => handleConvertToTask(note)}
                        className="p-1.5 rounded hover:opacity-70 text-xs font-bold"
                        title="Convert to task"
                        style={{ color: GOLD }}
                      >
                        →T
                      </button>
                      <button onClick={() => handleDelete(note.id)} className="p-1.5 rounded hover:opacity-70">
                        <Trash2 size={12} style={{ color: "#F87171" }} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  {note.tags.map((tag) => <TagBadge key={tag} tag={tag} />)}
                  {note.mentors.length > 0 && (
                    <span className="text-xs tracking-widest uppercase" style={{ color: DIM }}>{note.mentors.join(", ")}</span>
                  )}
                  {linkedProject && (
                    <span className="flex items-center gap-1 text-xs" style={{ color: MUTED }}>
                      <Link size={10} style={{ color: GOLD }} />
                      {linkedProject.name}
                    </span>
                  )}
                  {!linkedProject && projects.length > 0 && (
                    <select
                      className="text-xs px-2 py-0.5 rounded-lg outline-none opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity"
                      style={{ backgroundColor: "transparent", color: DIM, border: `1px solid ${BORDER}` }}
                      value=""
                      onChange={(e) => e.target.value && handleAttachProject(note.id, e.target.value)}
                    >
                      <option value="">Attach project...</option>
                      {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  )}
                  <span className="text-xs ml-auto" style={{ color: DIM }}>{new Date(note.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function VaultView() {
  const [tab, setTab] = useState<MainTab>("files");

  return (
    <div className="flex-1 flex flex-col min-h-0" style={{ backgroundColor: NAVY, color: "#FFFFFF" }}>
      <div className="px-6 py-3 border-b flex items-center gap-1" style={{ borderColor: BORDER }}>
        <span className="text-sm font-bold tracking-widest uppercase mr-4" style={{ color: MUTED }}>Vault</span>
        {([
          { id: "files" as MainTab, icon: <FileText size={13} />, label: "Files" },
          { id: "notes" as MainTab, icon: <Tag size={13} />, label: "Side Notes" },
        ]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold tracking-wider uppercase rounded-lg transition-all"
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
          <Upload size={12} style={{ color: DIM }} />
          <span className="text-xs tracking-widest uppercase" style={{ color: DIM }}>Drag files to upload</span>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        {tab === "files" && <FilesTab />}
        {tab === "notes" && <NotesTab />}
      </div>
    </div>
  );
}
