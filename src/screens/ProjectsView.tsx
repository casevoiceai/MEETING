import { useState, useEffect } from "react";
import {
  Plus, ChevronRight, Archive, Trash2, CheckCircle, Circle, Clock,
  FileText, AlignLeft, Tag, Link,
} from "lucide-react";
import {
  listProjects, createProject, archiveProject,
  listProjectNotes, addProjectNote, deleteProjectNote,
  listProjectTasks, addProjectTask, updateTaskStatus, deleteProjectTask,
  listVaultFilesByProject, listSideNotes,
  type Project, type ProjectNote, type ProjectTask, type TaskStatus, type VaultFile, type SideNote,
} from "../lib/db";

type DetailTab = "overview" | "files" | "notes" | "tasks" | "sessions";

const GOLD = "#C9A84C";
const NAVY = "#0D1B2E";
const CARD = "#111D30";
const BORDER = "#1B2A4A";
const MUTED = "#8A9BB5";
const DIM = "#3A4F6A";
const TEXT = "#D0DFEE";

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

interface ProjectDetailProps {
  project: Project;
}

function ProjectDetail({ project }: ProjectDetailProps) {
  const [tab, setTab] = useState<DetailTab>("overview");
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [sideNotes, setSideNotes] = useState<SideNote[]>([]);
  const [newNoteText, setNewNoteText] = useState("");
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskOwner, setNewTaskOwner] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    Promise.all([
      listProjectNotes(project.id),
      listProjectTasks(project.id),
      listVaultFilesByProject(project.id),
      listSideNotes({ projectId: project.id, archived: false }),
    ]).then(([n, t, f, sn]) => {
      setNotes(n);
      setTasks(t);
      setFiles(f);
      setSideNotes(sn);
      setLoaded(true);
    });
  }, [project.id]);

  async function handleAddNote() {
    if (!newNoteText.trim()) return;
    const n = await addProjectNote(project.id, newNoteText.trim(), []);
    setNotes((prev) => [n, ...prev]);
    setNewNoteText("");
  }

  async function handleDeleteNote(id: string) {
    await deleteProjectNote(id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
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

  async function handleDeleteTask(id: string) {
    await deleteProjectTask(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  const openTasks = tasks.filter((t) => t.status !== "done");
  const doneTasks = tasks.filter((t) => t.status === "done");

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: BORDER }}>
        <TabButton active={tab === "overview"} onClick={() => setTab("overview")} icon={<FileText size={13} />} label="Overview" />
        <TabButton active={tab === "tasks"} onClick={() => setTab("tasks")} icon={<Clock size={13} />} label="Tasks" count={openTasks.length} />
        <TabButton active={tab === "notes"} onClick={() => setTab("notes")} icon={<AlignLeft size={13} />} label="Notes" count={notes.length} />
        <TabButton active={tab === "files"} onClick={() => setTab("files")} icon={<Link size={13} />} label="Files" count={files.length} />
        <TabButton active={tab === "sessions"} onClick={() => setTab("sessions")} icon={<Tag size={13} />} label="Side Notes" count={sideNotes.length} />
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {!loaded && <p className="text-sm" style={{ color: DIM }}>Loading...</p>}
        {loaded && (
          <>
            {tab === "overview" && (
              <div className="flex flex-col gap-5">
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

                {openTasks.length === 0 && notes.length === 0 && files.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-40 gap-3">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(201,168,76,0.08)" }}>
                      <FileText size={24} style={{ color: DIM }} />
                    </div>
                    <p className="text-sm" style={{ color: DIM }}>Empty project. Add tasks, notes, or link files.</p>
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

                {tasks.length === 0 && <p className="text-sm" style={{ color: DIM }}>No tasks yet.</p>}

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
                      <button onClick={() => handleDeleteTask(task.id)} className="opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity">
                        <Trash2 size={13} style={{ color: "#F87171" }} />
                      </button>
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

                {notes.length === 0 && <p className="text-sm" style={{ color: DIM }}>No notes yet.</p>}

                <div className="flex flex-col gap-2">
                  {notes.map((note) => (
                    <div
                      key={note.id}
                      className="flex items-start gap-3 px-4 py-3.5 rounded-xl group"
                      style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}
                    >
                      <p className="flex-1 text-sm leading-relaxed" style={{ color: TEXT }}>{note.text}</p>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity mt-0.5"
                      >
                        <Trash2 size={13} style={{ color: "#F87171" }} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === "files" && (
              <div>
                {files.length === 0 && (
                  <p className="text-sm" style={{ color: DIM }}>
                    No files linked to this project. Open a file in the Vault and link it to this project.
                  </p>
                )}
                <div className="flex flex-col gap-2">
                  {files.map((f) => (
                    <div key={f.id} className="flex items-center gap-3 px-4 py-3.5 rounded-xl" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
                      <FileText size={15} style={{ color: GOLD, opacity: 0.7 }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold" style={{ color: "#FFFFFF" }}>{f.name}</p>
                        {f.summary && <p className="text-xs mt-0.5 truncate" style={{ color: MUTED }}>{f.summary}</p>}
                        {f.tags.length > 0 && (
                          <div className="flex gap-1 mt-1.5 flex-wrap">
                            {f.tags.map((t) => (
                              <span key={t} className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "rgba(201,168,76,0.12)", color: GOLD }}>{t}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="text-xs" style={{ color: DIM }}>{new Date(f.updated_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === "sessions" && (
              <div>
                <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: MUTED }}>Side Notes Linked to This Project</p>
                {sideNotes.length === 0 && (
                  <p className="text-sm" style={{ color: DIM }}>No side notes linked to this project yet.</p>
                )}
                <div className="flex flex-col gap-2">
                  {sideNotes.map((n) => (
                    <div key={n.id} className="px-4 py-3.5 rounded-xl" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
                      <p className="text-sm leading-relaxed" style={{ color: TEXT }}>{n.text}</p>
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
    </div>
  );
}

export default function ProjectsView() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<Project | null>(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    listProjects().then((p) => {
      setProjects(p);
      setLoading(false);
    });
  }, []);

  async function handleSelectProject(p: Project) {
    setSelected(p);
  }

  async function handleCreateProject() {
    if (!newProjectName.trim()) return;
    const p = await createProject(newProjectName.trim());
    setProjects((prev) => [p, ...prev]);
    setNewProjectName("");
    setCreating(false);
    setSelected(p);
  }

  async function handleArchiveProject(p: Project, e: React.MouseEvent) {
    e.stopPropagation();
    await archiveProject(p.id);
    setProjects((prev) => prev.filter((proj) => proj.id !== p.id));
    if (selected?.id === p.id) setSelected(null);
  }

  return (
    <div className="flex-1 flex min-h-0" style={{ backgroundColor: NAVY, color: "#FFFFFF" }}>
      <div className="w-56 border-r flex-shrink-0 flex flex-col" style={{ borderColor: BORDER }}>
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

        <div className="flex-1 overflow-y-auto py-2">
          {projects.map((p) => (
            <div key={p.id} className="group flex items-center gap-1 px-1">
              <button
                onClick={() => handleSelectProject(p)}
                className="flex-1 flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-all"
                style={{
                  backgroundColor: selected?.id === p.id ? "#1B2A4A" : "transparent",
                }}
              >
                <span className="text-sm font-medium truncate" style={{ color: selected?.id === p.id ? "#FFFFFF" : MUTED }}>
                  {p.name}
                </span>
                {selected?.id === p.id && <ChevronRight size={12} style={{ color: DIM }} />}
              </button>
              <button onClick={(e) => handleArchiveProject(p, e)} className="opacity-0 group-hover:opacity-60 hover:opacity-100 p-1 transition-opacity">
                <Archive size={11} style={{ color: DIM }} />
              </button>
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
          <div className="flex-1 flex flex-col min-h-0">
            <div className="px-5 py-4 border-b flex items-center gap-3" style={{ borderColor: BORDER }}>
              <div>
                <h2 className="text-base font-bold" style={{ color: "#FFFFFF" }}>{selected.name}</h2>
                <p className="text-xs" style={{ color: DIM }}>Created {new Date(selected.created_at).toLocaleDateString()}</p>
              </div>
              <div className="ml-auto flex gap-2">
                <button
                  onClick={(e) => handleArchiveProject(selected, e)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm hover:opacity-70 transition-opacity"
                  style={{ color: DIM }}
                >
                  <Archive size={13} />
                  Archive
                </button>
              </div>
            </div>
            <ProjectDetail project={selected} />
          </div>
        )}
      </div>
    </div>
  );
}
