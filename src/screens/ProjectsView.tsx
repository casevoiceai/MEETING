import { useState, useEffect, useRef } from "react";
import {
  Plus, ChevronRight, Archive, Trash2, CheckCircle, Circle, Clock,
  FileText, AlignLeft, Tag, Link, Pencil, Check, X, Layers, Upload,
  Image as ImageIcon, File, Shield,
} from "lucide-react";
import {
  listProjects, createProject, archiveProject, renameProject, deleteProject,
  listProjectNotes, addProjectNote, deleteProjectNote,
  listProjectTasks, addProjectTask, updateTaskStatus, deleteProjectTask,
  listVaultFilesByProject, listSideNotes, listTagsForProject, listVaultFolders, deleteVaultFile,
  type Project, type ProjectNote, type ProjectTask, type TaskStatus, type VaultFile, type SideNote, type TagEntry, type LinkableType, type VaultFolder,
} from "../lib/db";
import { proposeAction } from "../lib/approval";
import { useGuardrail } from "../lib/useGuardrail";
import DestructiveConfirmModal from "../components/DestructiveConfirmModal";
import LinkedItemsPanel from "../components/LinkedItemsPanel";
import FileUploadModal from "../components/FileUploadModal";
import FilePreviewModal from "../components/FilePreviewModal";

type DetailTab = "overview" | "files" | "notes" | "tasks" | "sessions" | "tags";

const GOLD = "#C9A84C";
const NAVY = "#0D1B2E";
const CARD = "#111D30";
const BORDER = "#1B2A4A";
const MUTED = "#8A9BB5";
const DIM = "#3A4F6A";
const TEXT = "#D0DFEE";

const CATEGORY_COLORS: Record<string, string> = {
  "App": "#3B82F6",
  "Safety": "#EF4444",
  "Communication": "#10B981",
  "Founder Notes": "#F59E0B",
  "Research": "#60A5FA",
  "Risk": "#F97316",
  "Legal": "#6B7280",
  "Technical": "#06B6D4",
};

const STATUS_ICONS: Record<TaskStatus, React.ReactNode> = {
  open: <Circle size={15} style={{ color: DIM }} />,
  in_progress: <Clock size={15} style={{ color: GOLD }} />,
  done: <CheckCircle size={15} style={{ color: "#4ADE80" }} />,
};

const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  open: "in_progress",
  in_progress: "done",
  done: "open",
};

function TabButton({ active, onClick, icon, label, count }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold tracking-wider uppercase rounded-lg transition-all"
      style={
        active
          ? { backgroundColor: "rgba(201,168,76,0.15)", color: GOLD, border: `1px solid rgba(201,168,76,0.3)` }
          : { color: MUTED, border: "1px solid transparent" }
      }
    >
      {icon}
      {label}
      {count !== undefined && (
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
          style={{ backgroundColor: active ? "rgba(201,168,76,0.2)" : "rgba(255,255,255,0.06)", color: active ? GOLD : DIM }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function EmptySection({ message }: { message: string }) {
  return <p className="text-sm" style={{ color: DIM }}>{message}</p>;
}

interface ProjectDetailProps {
  project: Project;
  onProjectRenamed: (id: string, name: string) => void;
  onNavigate?: (type: LinkableType, id: string) => void;
}

function VaultFileIcon({ file, size = 15 }: { file: VaultFile; size?: number }) {
  const ft = file.file_type ?? "note";
  const mt = file.mime_type ?? "";
  if (ft === "image" || mt.startsWith("image/")) return <ImageIcon size={size} style={{ color: "#60A5FA" }} />;
  if (ft === "pdf" || mt === "application/pdf") return <FileText size={size} style={{ color: "#F87171" }} />;
  if (ft === "document") return <File size={size} style={{ color: "#A78BFA" }} />;
  return <FileText size={size} style={{ color: GOLD, opacity: 0.7 }} />;
}

function ProjectDetail({ project, onProjectRenamed, onNavigate }: ProjectDetailProps) {
  const [tab, setTab] = useState<DetailTab>("overview");
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [folders, setFolders] = useState<VaultFolder[]>([]);
  const [sideNotes, setSideNotes] = useState<SideNote[]>([]);
  const [tags, setTags] = useState<TagEntry[]>([]);
  const [newNoteText, setNewNoteText] = useState("");
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskOwner, setNewTaskOwner] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [renamingProject, setRenamingProject] = useState(false);
  const [renameDraft, setRenameDraft] = useState(project.name);
  const renameRef = useRef<HTMLInputElement>(null);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [previewFile, setPreviewFile] = useState<VaultFile | null>(null);
  const [taskDeleteProposed, setTaskDeleteProposed] = useState<Set<string>>(new Set());
  const [renameProposed, setRenameProposed] = useState(false);
  const guardrail = useGuardrail();

  useEffect(() => {
    setLoaded(false);
    setRenameDraft(project.name);
    Promise.all([
      listProjectNotes(project.id),
      listProjectTasks(project.id),
      listVaultFilesByProject(project.id),
      listSideNotes({ projectId: project.id, archived: false }),
      listTagsForProject(project.id),
      listVaultFolders(),
    ]).then(([n, t, f, sn, tg, fld]) => {
      setNotes(n);
      setTasks(t);
      setFiles(f);
      setSideNotes(sn);
      setTags(tg);
      setFolders(fld);
      setLoaded(true);
    });
  }, [project.id]);

  useEffect(() => {
    if (renamingProject) renameRef.current?.focus();
  }, [renamingProject]);

  async function commitRename() {
    const name = renameDraft.trim();
    if (!name || name === project.name) { setRenamingProject(false); return; }
    await proposeAction({
      action_type: "project_rename",
      title: `Rename project: "${project.name}" → "${name}"`,
      description: `Rename the project from "${project.name}" to "${name}". Approve in Integrations → Approvals to apply.`,
      proposed_by: "USER",
      payload: { project_id: project.id, old_name: project.name, new_name: name },
    });
    setRenameProposed(true);
    setRenamingProject(false);
  }

  async function handleAddNote() {
    if (!newNoteText.trim()) return;
    const n = await addProjectNote(project.id, newNoteText.trim(), []);
    setNotes((prev) => [n, ...prev]);
    setNewNoteText("");
  }

  function handleDeleteNote(id: string) {
    const note = notes.find((n) => n.id === id);
    guardrail.request(
      {
        actionType: "delete_project_note",
        risk: "medium",
        title: `Delete note from "${project.name}"`,
        consequence: `This will permanently delete the note "${(note?.text ?? "").slice(0, 60)}". This cannot be undone.`,
        requireTypedConfirmation: false,
        requireBackupConfirmation: false,
        targetId: id,
        targetLabel: (note?.text ?? "").slice(0, 60),
        snapshotData: note ? { id: note.id, text: note.text, project_id: note.project_id } : {},
      },
      async () => {
        await deleteProjectNote(id);
        setNotes((prev) => prev.filter((n) => n.id !== id));
      }
    );
  }

  async function handleAddTask() {
    if (!newTaskText.trim()) return;
    const t = await addProjectTask(project.id, newTaskText.trim(), newTaskOwner.trim());
    setTasks((prev) => [...prev, t]);
    setNewTaskText("");
    setNewTaskOwner("");
  }

  async function handleCycleStatus(task: ProjectTask) {
    const next = NEXT_STATUS[task.status];
    await updateTaskStatus(task.id, next);
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: next } : t));
  }

  function handleDeleteTask(id: string) {
    const task = tasks.find((t) => t.id === id);
    guardrail.request(
      {
        actionType: "task_delete",
        risk: "medium",
        title: `Delete task: "${task?.text?.slice(0, 60) ?? id}"`,
        consequence: `This will permanently delete the task "${task?.text?.slice(0, 80) ?? id}" from project "${project.name}". This cannot be undone.`,
        requireTypedConfirmation: false,
        requireBackupConfirmation: false,
        targetId: id,
        targetLabel: task?.text?.slice(0, 60) ?? id,
        snapshotData: task ? { id: task.id, text: task.text, owner: task.owner, status: task.status } : {},
      },
      async () => {
        await proposeAction({
          action_type: "task_delete",
          title: `Delete task: "${task?.text?.slice(0, 60) ?? id}"`,
          description: `Permanently delete task from project "${project.name}". This cannot be undone.`,
          proposed_by: "USER",
          payload: { task_id: id, task_text: task?.text, project_id: project.id, project_name: project.name },
        });
        setTaskDeleteProposed((prev) => new Set(prev).add(id));
      }
    );
  }

  const openTasks = tasks.filter((t) => t.status !== "done");
  const doneTasks = tasks.filter((t) => t.status === "done");

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-5 py-4 border-b flex items-center gap-3" style={{ borderColor: BORDER }}>
        <div className="flex-1 min-w-0 flex items-center gap-2">
          {renamingProject ? (
            <div className="flex items-center gap-2">
              <input
                ref={renameRef}
                className="text-base font-bold px-2 py-1 rounded outline-none"
                style={{ backgroundColor: CARD, color: "#FFFFFF", border: `1px solid ${GOLD}`, minWidth: "180px" }}
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenamingProject(false); }}
              />
              <button onClick={commitRename} className="p-1.5 rounded" style={{ color: GOLD }}><Check size={14} /></button>
              <button onClick={() => setRenamingProject(false)} className="p-1.5 rounded" style={{ color: MUTED }}><X size={14} /></button>
            </div>
          ) : (
            <>
              <h2 className="text-base font-bold truncate" style={{ color: "#FFFFFF" }}>{project.name}</h2>
              <button
                onClick={() => { setRenameDraft(project.name); setRenamingProject(true); }}
                className="p-1 rounded opacity-50 hover:opacity-100 transition-opacity"
                style={{ color: MUTED }}
                title="Rename project"
              >
                <Pencil size={12} />
              </button>
            </>
          )}
          <span className="text-xs" style={{ color: DIM }}>Created {new Date(project.created_at).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="px-5 py-2 border-b flex items-center gap-1 flex-wrap" style={{ borderColor: BORDER }}>
        <TabButton active={tab === "overview"} onClick={() => setTab("overview")} icon={<FileText size={13} />} label="Overview" />
        <TabButton active={tab === "tasks"} onClick={() => setTab("tasks")} icon={<Clock size={13} />} label="Tasks" count={openTasks.length} />
        <TabButton active={tab === "notes"} onClick={() => setTab("notes")} icon={<AlignLeft size={13} />} label="Notes" count={notes.length} />
        <TabButton active={tab === "files"} onClick={() => setTab("files")} icon={<Link size={13} />} label="Files" count={files.length} />
        <TabButton active={tab === "tags"} onClick={() => setTab("tags")} icon={<Tag size={13} />} label="Tags" count={tags.length} />
        <TabButton active={tab === "sessions"} onClick={() => setTab("sessions")} icon={<Layers size={13} />} label="Side Notes" count={sideNotes.length} />
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {!loaded && <p className="text-sm" style={{ color: DIM }}>Loading...</p>}
        {loaded && (
          <>
            {tab === "overview" && (
              <div className="flex flex-col gap-6">
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: "Open Tasks", value: openTasks.length, color: GOLD },
                    { label: "Done Tasks", value: doneTasks.length, color: "#4ADE80" },
                    { label: "Notes", value: notes.length, color: MUTED },
                    { label: "Files", value: files.length, color: "#3B82F6" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="px-4 py-4 rounded-xl" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
                      <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: MUTED }}>{label}</p>
                      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
                    </div>
                  ))}
                </div>

                {tags.length > 0 && (
                  <div>
                    <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: MUTED }}>Tags In Use</p>
                    <div className="flex flex-wrap gap-2">
                      {tags.map((t) => {
                        const color = CATEGORY_COLORS[t.category] ?? GOLD;
                        return (
                          <span
                            key={t.id}
                            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
                            style={{ backgroundColor: `${color}18`, color, border: `1px solid ${color}33` }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                            {t.tag}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {openTasks.length > 0 && (
                  <div>
                    <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: MUTED }}>Open Tasks</p>
                    <div className="flex flex-col gap-2">
                      {openTasks.map((task) => (
                        <div key={task.id} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
                          <button onClick={() => handleCycleStatus(task)}>{STATUS_ICONS[task.status]}</button>
                          <span className="flex-1 text-sm" style={{ color: TEXT }}>{task.text}</span>
                          {task.owner && <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "#1B2A4A", color: MUTED }}>{task.owner}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {notes.length > 0 && (
                  <div>
                    <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: MUTED }}>Recent Notes</p>
                    <div className="flex flex-col gap-2">
                      {notes.slice(0, 3).map((n) => (
                        <div key={n.id} className="px-4 py-3 rounded-xl" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
                          <p className="text-sm" style={{ color: TEXT }}>{n.text}</p>
                          {n.tags.length > 0 && (
                            <div className="flex gap-1 mt-2 flex-wrap">
                              {n.tags.map((t) => (
                                <span key={t} className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "rgba(201,168,76,0.12)", color: GOLD }}>{t}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {files.length > 0 && (
                  <div>
                    <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: MUTED }}>Linked Files</p>
                    <div className="flex flex-col gap-2">
                      {files.map((f) => (
                        <div key={f.id} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
                          <FileText size={14} style={{ color: GOLD, opacity: 0.6 }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: "#FFFFFF" }}>{f.name}</p>
                            {f.summary && <p className="text-xs truncate" style={{ color: MUTED }}>{f.summary}</p>}
                          </div>
                          <span className="text-xs" style={{ color: DIM }}>{new Date(f.updated_at).toLocaleDateString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <LinkedItemsPanel sourceType="project" sourceId={project.id} onNavigate={onNavigate} />

                {openTasks.length === 0 && notes.length === 0 && files.length === 0 && tags.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-40 gap-3">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(201,168,76,0.08)" }}>
                      <FileText size={24} style={{ color: DIM }} />
                    </div>
                    <p className="text-sm" style={{ color: DIM }}>Empty project. Add tasks, notes, or link files from the Vault.</p>
                  </div>
                )}
              </div>
            )}

            {tab === "tasks" && (
              <div className="flex flex-col gap-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Task description..."
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddTask(); }}
                    className="flex-1 px-4 py-2.5 rounded-lg text-sm outline-none"
                    style={{ backgroundColor: CARD, color: "#FFFFFF", border: `1px solid ${BORDER}` }}
                  />
                  <input
                    type="text"
                    placeholder="Owner..."
                    value={newTaskOwner}
                    onChange={(e) => setNewTaskOwner(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddTask(); }}
                    className="w-28 px-4 py-2.5 rounded-lg text-sm outline-none"
                    style={{ backgroundColor: CARD, color: "#FFFFFF", border: `1px solid ${BORDER}` }}
                  />
                  <button
                    onClick={handleAddTask}
                    className="px-5 py-2.5 rounded-lg text-sm font-semibold tracking-wider uppercase hover:opacity-90"
                    style={{ backgroundColor: GOLD, color: NAVY }}
                  >
                    Add
                  </button>
                </div>

                {tasks.length === 0 && <EmptySection message="No tasks yet. Add a task above." />}

                <div className="flex flex-col gap-2">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl group"
                      style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}
                    >
                      <button onClick={() => handleCycleStatus(task)} className="flex-shrink-0">
                        {STATUS_ICONS[task.status]}
                      </button>
                      <span
                        className="flex-1 text-sm"
                        style={{
                          color: task.status === "done" ? DIM : TEXT,
                          textDecoration: task.status === "done" ? "line-through" : "none",
                        }}
                      >
                        {task.text}
                      </span>
                      {task.owner && (
                        <span className="text-xs tracking-widest uppercase px-2.5 py-1 rounded-full" style={{ backgroundColor: "#1B2A4A", color: MUTED }}>
                          {task.owner}
                        </span>
                      )}
                      {taskDeleteProposed.has(task.id) ? (
                        <span title="Delete queued for approval">
                          <Clock size={13} style={{ color: "#F59E0B", opacity: 0.8 }} />
                        </span>
                      ) : (
                        <button onClick={() => handleDeleteTask(task.id)} className="opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity" title="Queue delete for approval">
                          <Trash2 size={13} style={{ color: "#F87171" }} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === "notes" && (
              <div className="flex flex-col gap-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add a note..."
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddNote(); }}
                    className="flex-1 px-4 py-2.5 rounded-lg text-sm outline-none"
                    style={{ backgroundColor: CARD, color: "#FFFFFF", border: `1px solid ${BORDER}` }}
                  />
                  <button
                    onClick={handleAddNote}
                    className="px-5 py-2.5 rounded-lg text-sm font-semibold tracking-wider uppercase hover:opacity-90"
                    style={{ backgroundColor: GOLD, color: NAVY }}
                  >
                    Add
                  </button>
                </div>

                {notes.length === 0 && <EmptySection message="No notes yet. Type above and hit Add or Enter." />}

                <div className="flex flex-col gap-2">
                  {notes.map((note) => (
                    <div
                      key={note.id}
                      className="flex items-start gap-3 px-4 py-3.5 rounded-xl group"
                      style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-relaxed" style={{ color: TEXT }}>{note.text}</p>
                        {note.tags.length > 0 && (
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {note.tags.map((t) => (
                              <span key={t} className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "rgba(201,168,76,0.12)", color: GOLD }}>{t}</span>
                            ))}
                          </div>
                        )}
                        <p className="text-xs mt-2" style={{ color: DIM }}>{new Date(note.created_at).toLocaleDateString()}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity mt-0.5 flex-shrink-0"
                      >
                        <Trash2 size={13} style={{ color: "#F87171" }} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === "files" && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold tracking-widest uppercase" style={{ color: MUTED }}>
                    {files.length} file{files.length !== 1 ? "s" : ""} linked to this project
                  </p>
                  <button
                    onClick={() => setShowFileUpload(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold tracking-wider uppercase transition-all hover:opacity-80"
                    style={{ backgroundColor: GOLD, color: NAVY }}
                  >
                    <Upload size={13} />
                    Upload File
                  </button>
                </div>
                {files.length === 0 && (
                  <div
                    className="flex flex-col items-center justify-center gap-3 py-10 rounded-2xl border-2 border-dashed cursor-pointer transition-all hover:border-opacity-60"
                    style={{ borderColor: BORDER, color: DIM }}
                    onClick={() => setShowFileUpload(true)}
                  >
                    <Upload size={28} style={{ color: DIM }} />
                    <p className="text-sm">No files yet. Click to upload or link from Vault.</p>
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  {files.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center gap-3 px-4 py-3.5 rounded-xl group cursor-pointer transition-all hover:border-opacity-60"
                      style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}
                      onClick={() => setPreviewFile(f)}
                    >
                      <VaultFileIcon file={f} size={17} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold" style={{ color: "#FFFFFF" }}>{f.name}</p>
                        {f.summary && <p className="text-xs mt-0.5 truncate" style={{ color: MUTED }}>{f.summary}</p>}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] px-1.5 py-0.5 rounded uppercase tracking-widest font-semibold" style={{ backgroundColor: "rgba(255,255,255,0.05)", color: DIM }}>{f.file_type ?? "note"}</span>
                          {f.tags.slice(0, 2).map((t) => (
                            <span key={t} className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "rgba(201,168,76,0.12)", color: GOLD }}>{t}</span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs" style={{ color: DIM }}>{new Date(f.updated_at).toLocaleDateString()}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteVaultFile(f.id).then(() => setFiles((p) => p.filter((x) => x.id !== f.id))); }}
                          className="opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity p-1"
                        >
                          <Trash2 size={12} style={{ color: "#F87171" }} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {showFileUpload && (
                  <FileUploadModal
                    folders={folders}
                    projects={[project]}
                    defaultProjectId={project.id}
                    onClose={() => setShowFileUpload(false)}
                    onUploaded={(record) => {
                      setFiles((prev) => [record, ...prev]);
                    }}
                  />
                )}

                {previewFile && (
                  <FilePreviewModal
                    file={previewFile}
                    projects={[project]}
                    sessions={[]}
                    onClose={() => setPreviewFile(null)}
                    onUpdated={(patch) => setFiles((prev) => prev.map((f) => f.id === previewFile.id ? { ...f, ...patch } : f))}
                  />
                )}
              </div>
            )}

            {tab === "tags" && (
              <div>
                {tags.length === 0 ? (
                  <p className="text-sm" style={{ color: DIM }}>
                    No tags found across this project's files, notes, or side notes yet.
                  </p>
                ) : (
                  <div className="flex flex-col gap-4">
                    <p className="text-xs" style={{ color: MUTED }}>Tags collected from all files, notes, and side notes linked to this project.</p>
                    <div className="flex flex-wrap gap-3">
                      {tags.map((t) => {
                        const color = CATEGORY_COLORS[t.category] ?? GOLD;
                        return (
                          <div
                            key={t.id}
                            className="flex flex-col gap-1 px-4 py-3 rounded-xl"
                            style={{ backgroundColor: CARD, border: `1px solid ${color}33` }}
                          >
                            <span className="text-sm font-bold" style={{ color: "#FFFFFF" }}>{t.tag}</span>
                            <span
                              className="text-xs px-2 py-0.5 rounded-full font-semibold self-start"
                              style={{ backgroundColor: `${color}18`, color }}
                            >
                              {t.category}
                            </span>
                            <span className="text-xs mt-1" style={{ color: DIM }}>{t.usage_count} total uses</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === "sessions" && (
              <div>
                <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: MUTED }}>Side Notes Linked to This Project</p>
                {sideNotes.length === 0 && (
                  <EmptySection message="No side notes linked to this project yet. Link a side note from the Vault." />
                )}
                <div className="flex flex-col gap-2">
                  {sideNotes.map((n) => (
                    <div key={n.id} className="px-4 py-3.5 rounded-xl" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
                      <p className="text-sm leading-relaxed" style={{ color: TEXT }}>{n.text}</p>
                      {n.mentors.length > 0 && (
                        <p className="text-xs mt-1.5 font-semibold" style={{ color: GOLD }}>{n.mentors.join(", ")}</p>
                      )}
                      {n.tags.length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {n.tags.map((t) => (
                            <span key={t} className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "rgba(201,168,76,0.12)", color: GOLD }}>{t}</span>
                          ))}
                        </div>
                      )}
                      <p className="text-xs mt-2" style={{ color: DIM }}>{new Date(n.created_at).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {guardrail.pending && (
        <DestructiveConfirmModal
          config={guardrail.pending.config}
          onConfirm={guardrail.handleConfirm}
          onCancel={guardrail.handleCancel}
        />
      )}
    </div>
  );
}

interface ProjectsViewProps {
  onNavigateLinked?: (type: LinkableType, id: string) => void;
  linkedTarget?: string;
}

export default function ProjectsView({ onNavigateLinked, linkedTarget }: ProjectsViewProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<Project | null>(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [projectDeleteProposed, setProjectDeleteProposed] = useState<Set<string>>(new Set());
  const guardrail = useGuardrail();

  useEffect(() => {
    listProjects().then((p) => {
      setProjects(p);
      setLoading(false);
      if (linkedTarget) {
        const target = p.find((proj) => proj.id === linkedTarget);
        if (target) setSelected(target);
      }
    });
  }, [linkedTarget]);

  async function handleCreateProject() {
    if (!newProjectName.trim()) return;
    const p = await createProject(newProjectName.trim());
    setProjects((prev) => [p, ...prev]);
    setNewProjectName("");
    setCreating(false);
    setSelected(p);
  }

  function handleArchiveProject(p: Project, e: React.MouseEvent) {
    e.stopPropagation();
    guardrail.request(
      {
        actionType: "archive_project",
        risk: "medium",
        title: `Archive project: "${p.name}"`,
        consequence: `This will archive the project "${p.name}". It will no longer appear in the active list. All tasks, notes, and files linked to it will be preserved and remain accessible through search. You can restore it from the archive later.`,
        requireTypedConfirmation: false,
        requireBackupConfirmation: false,
        targetId: p.id,
        targetLabel: p.name,
        snapshotData: { id: p.id, name: p.name },
      },
      async () => {
        await archiveProject(p.id);
        setProjects((prev) => prev.filter((proj) => proj.id !== p.id));
        if (selected?.id === p.id) setSelected(null);
      }
    );
  }

  function handleDeleteProject(id: string) {
    const proj = projects.find((p) => p.id === id);
    guardrail.request(
      {
        actionType: "project_delete",
        risk: "high",
        title: `Delete project: "${proj?.name ?? id}"`,
        consequence: `This will permanently delete the project "${proj?.name ?? id}" and all its tasks and notes. Linked vault files and side notes will remain but lose their project association. This action goes to the approval queue and cannot be undone once approved.`,
        requireTypedConfirmation: true,
        typedConfirmationWord: "DELETE",
        requireBackupConfirmation: true,
        targetId: id,
        targetLabel: proj?.name ?? id,
        snapshotData: { project_id: id, project_name: proj?.name },
      },
      async () => {
        await proposeAction({
          action_type: "project_delete",
          title: `Delete project: "${proj?.name ?? id}"`,
          description: `Permanently delete the project "${proj?.name ?? id}" and all its tasks, notes, and links. This cannot be undone.`,
          proposed_by: "USER",
          payload: { project_id: id, project_name: proj?.name },
        });
        setProjectDeleteProposed((prev) => new Set(prev).add(id));
        setConfirmDeleteId(null);
      }
    );
  }

  function handleProjectRenamed(id: string, name: string) {
    setProjects((prev) => prev.map((p) => p.id === id ? { ...p, name } : p));
    if (selected?.id === id) setSelected((prev) => prev ? { ...prev, name } : prev);
  }

  return (
    <div className="flex-1 flex min-h-0" style={{ backgroundColor: NAVY, color: "#FFFFFF" }}>
      <div className="w-60 border-r flex-shrink-0 flex flex-col" style={{ borderColor: BORDER }}>
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: BORDER }}>
          <p className="text-xs font-bold tracking-widest uppercase" style={{ color: MUTED }}>Projects</p>
          <button onClick={() => setCreating(true)} className="p-1.5 rounded transition-opacity hover:opacity-70" style={{ color: GOLD }}>
            <Plus size={14} />
          </button>
        </div>

        {creating && (
          <div className="px-3 py-3 border-b flex flex-col gap-2" style={{ borderColor: BORDER }}>
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateProject(); if (e.key === "Escape") setCreating(false); }}
              placeholder="Project name..."
              autoFocus
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
              style={{ backgroundColor: CARD, color: "#FFFFFF", border: `1px solid ${GOLD}` }}
            />
            <div className="flex gap-1.5">
              <button
                onClick={handleCreateProject}
                className="flex-1 py-2 rounded-lg text-xs font-bold tracking-widest uppercase hover:opacity-80"
                style={{ backgroundColor: GOLD, color: NAVY }}
              >
                Create
              </button>
              <button
                onClick={() => setCreating(false)}
                className="px-3 py-2 rounded-lg text-xs font-bold tracking-widest uppercase hover:opacity-80"
                style={{ backgroundColor: "#1B2A4A", color: MUTED }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading && <p className="text-xs px-4 py-3" style={{ color: DIM }}>Loading...</p>}
        {!loading && projects.length === 0 && (
          <div className="px-4 py-6 flex flex-col items-center gap-3">
            <p className="text-xs text-center" style={{ color: DIM }}>No projects yet.</p>
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold tracking-wider uppercase hover:opacity-90"
              style={{ backgroundColor: GOLD, color: NAVY }}
            >
              <Plus size={12} />
              Create First
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto py-2">
          {projects.map((p) => (
            <div key={p.id} className="group flex items-center gap-1 px-1">
              <button
                onClick={() => setSelected(p)}
                className="flex-1 flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-all"
                style={{ backgroundColor: selected?.id === p.id ? "#1B2A4A" : "transparent" }}
              >
                <span className="text-sm font-medium truncate" style={{ color: selected?.id === p.id ? "#FFFFFF" : MUTED }}>
                  {p.name}
                </span>
                {selected?.id === p.id && <ChevronRight size={12} style={{ color: DIM }} />}
              </button>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                <button
                  onClick={(e) => handleArchiveProject(p, e)}
                  className="p-1 rounded hover:opacity-70 transition-opacity"
                  title="Archive"
                >
                  <Archive size={11} style={{ color: DIM }} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(p.id); }}
                  className="p-1 rounded hover:opacity-70 transition-opacity"
                  title="Delete permanently"
                >
                  <Trash2 size={11} style={{ color: "#F87171" }} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(201,168,76,0.06)" }}>
              <FileText size={24} style={{ color: DIM }} />
            </div>
            <p className="text-sm" style={{ color: DIM }}>Select or create a project to get started.</p>
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold tracking-wider uppercase hover:opacity-90"
              style={{ backgroundColor: GOLD, color: NAVY }}
            >
              <Plus size={14} />
              New Project
            </button>
          </div>
        ) : (
          <ProjectDetail
            key={selected.id}
            project={selected}
            onProjectRenamed={handleProjectRenamed}
            onNavigate={onNavigateLinked}
          />
        )}
      </div>

      {guardrail.pending && (
        <DestructiveConfirmModal
          config={guardrail.pending.config}
          onConfirm={guardrail.handleConfirm}
          onCancel={guardrail.handleCancel}
        />
      )}
    </div>
  );
}
