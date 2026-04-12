import { useState, useEffect } from "react";
import { Plus, ChevronRight, Archive, Trash2, CheckCircle, Circle, Clock } from "lucide-react";
import {
  listProjects,
  createProject,
  archiveProject,
  listProjectNotes,
  addProjectNote,
  deleteProjectNote,
  listProjectTasks,
  addProjectTask,
  updateTaskStatus,
  deleteProjectTask,
  type Project,
  type ProjectNote,
  type ProjectTask,
  type TaskStatus,
} from "../lib/db";

const STATUS_ICONS: Record<TaskStatus, React.ReactNode> = {
  open: <Circle size={13} style={{ color: "#3A4F6A" }} />,
  in_progress: <Clock size={13} style={{ color: "#C9A84C" }} />,
  done: <CheckCircle size={13} style={{ color: "#4ADE80" }} />,
};

const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  open: "in_progress",
  in_progress: "done",
  done: "open",
};

export default function ProjectsView() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<Project | null>(null);
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [newProjectName, setNewProjectName] = useState("");
  const [newNoteText, setNewNoteText] = useState("");
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskOwner, setNewTaskOwner] = useState("");
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
    const [n, t] = await Promise.all([listProjectNotes(p.id), listProjectTasks(p.id)]);
    setNotes(n);
    setTasks(t);
  }

  async function handleCreateProject() {
    if (!newProjectName.trim()) return;
    const p = await createProject(newProjectName.trim());
    setProjects((prev) => [p, ...prev]);
    setNewProjectName("");
    setCreating(false);
    handleSelectProject(p);
  }

  async function handleArchiveProject(p: Project, e: React.MouseEvent) {
    e.stopPropagation();
    await archiveProject(p.id);
    setProjects((prev) => prev.filter((proj) => proj.id !== p.id));
    if (selected?.id === p.id) setSelected(null);
  }

  async function handleAddNote() {
    if (!selected || !newNoteText.trim()) return;
    const n = await addProjectNote(selected.id, newNoteText.trim(), []);
    setNotes((prev) => [n, ...prev]);
    setNewNoteText("");
  }

  async function handleAddTask() {
    if (!selected || !newTaskText.trim()) return;
    const t = await addProjectTask(selected.id, newTaskText.trim(), newTaskOwner.trim());
    setTasks((prev) => [...prev, t]);
    setNewTaskText("");
    setNewTaskOwner("");
  }

  async function handleCycleStatus(task: ProjectTask) {
    const next = NEXT_STATUS[task.status];
    await updateTaskStatus(task.id, next);
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: next } : t));
  }

  async function handleDeleteNote(id: string) {
    await deleteProjectNote(id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  async function handleDeleteTask(id: string) {
    await deleteProjectTask(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="flex-1 flex min-h-0">
      <div className="w-48 border-r flex-shrink-0 overflow-y-auto py-5 px-4" style={{ borderColor: "#1B2A4A" }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] tracking-widest uppercase" style={{ color: "#8A9BB5" }}>Projects</p>
          <button onClick={() => setCreating(true)} className="p-1 rounded transition-opacity hover:opacity-70">
            <Plus size={13} style={{ color: "#C9A84C" }} />
          </button>
        </div>

        {creating && (
          <div className="mb-3 flex flex-col gap-1.5">
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateProject(); if (e.key === "Escape") setCreating(false); }}
              placeholder="Project name..."
              autoFocus
              className="w-full px-3 py-2 rounded-lg text-xs outline-none"
              style={{ backgroundColor: "#111D30", color: "#FFFFFF", border: "1px solid #C9A84C" }}
            />
            <div className="flex gap-1">
              <button
                onClick={handleCreateProject}
                className="flex-1 py-1.5 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-opacity hover:opacity-80"
                style={{ backgroundColor: "#C9A84C", color: "#0D1B2E" }}
              >
                Create
              </button>
              <button
                onClick={() => setCreating(false)}
                className="px-2 py-1.5 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-opacity hover:opacity-80"
                style={{ backgroundColor: "#1B2A4A", color: "#8A9BB5" }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading && <p className="text-xs" style={{ color: "#3A4F6A" }}>Loading...</p>}

        <div className="flex flex-col gap-1">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => handleSelectProject(p)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all group"
              style={{
                backgroundColor: selected?.id === p.id ? "#1B2A4A" : "transparent",
                border: selected?.id === p.id ? "1px solid #2A3D5E" : "1px solid transparent",
              }}
            >
              <span className="text-xs font-semibold truncate" style={{ color: selected?.id === p.id ? "#FFFFFF" : "#8A9BB5" }}>
                {p.name}
              </span>
              <div className="flex items-center gap-1">
                <button onClick={(e) => handleArchiveProject(p, e)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <Archive size={11} style={{ color: "#3A4F6A" }} />
                </button>
                <ChevronRight size={11} style={{ color: "#3A4F6A" }} />
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {!selected && (
          <p className="text-sm" style={{ color: "#3A4F6A" }}>Select or create a project to get started.</p>
        )}

        {selected && (
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-xs tracking-widest uppercase mb-3" style={{ color: "#8A9BB5" }}>
                {selected.name} — Tasks
              </p>

              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  placeholder="Task description..."
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddTask(); }}
                  className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ backgroundColor: "#111D30", color: "#FFFFFF", border: "1px solid #1B2A4A" }}
                />
                <input
                  type="text"
                  placeholder="Owner..."
                  value={newTaskOwner}
                  onChange={(e) => setNewTaskOwner(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddTask(); }}
                  className="w-24 px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ backgroundColor: "#111D30", color: "#FFFFFF", border: "1px solid #1B2A4A" }}
                />
                <button
                  onClick={handleAddTask}
                  className="px-4 py-2 rounded-lg text-sm font-semibold tracking-wider uppercase transition-opacity hover:opacity-80"
                  style={{ backgroundColor: "#C9A84C", color: "#0D1B2E" }}
                >
                  Add
                </button>
              </div>

              {tasks.length === 0 && (
                <p className="text-sm" style={{ color: "#3A4F6A" }}>No tasks yet.</p>
              )}

              <div className="flex flex-col gap-1.5">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl group"
                    style={{ backgroundColor: "#111D30", border: "1px solid #1B2A4A" }}
                  >
                    <button onClick={() => handleCycleStatus(task)} className="flex-shrink-0">
                      {STATUS_ICONS[task.status]}
                    </button>
                    <span
                      className="flex-1 text-sm"
                      style={{
                        color: task.status === "done" ? "#3A4F6A" : "#D0DFEE",
                        textDecoration: task.status === "done" ? "line-through" : "none",
                      }}
                    >
                      {task.text}
                    </span>
                    {task.owner && (
                      <span className="text-[10px] tracking-widest uppercase px-2 py-0.5 rounded-full" style={{ backgroundColor: "#1B2A4A", color: "#8A9BB5" }}>
                        {task.owner}
                      </span>
                    )}
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={12} style={{ color: "#F87171" }} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs tracking-widest uppercase mb-3" style={{ color: "#8A9BB5" }}>
                {selected.name} — Notes
              </p>

              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  placeholder="Add a note..."
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddNote(); }}
                  className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ backgroundColor: "#111D30", color: "#FFFFFF", border: "1px solid #1B2A4A" }}
                />
                <button
                  onClick={handleAddNote}
                  className="px-4 py-2 rounded-lg text-sm font-semibold tracking-wider uppercase transition-opacity hover:opacity-80"
                  style={{ backgroundColor: "#1B2A4A", color: "#8A9BB5", border: "1px solid #2A3D5E" }}
                >
                  Add
                </button>
              </div>

              {notes.length === 0 && (
                <p className="text-sm" style={{ color: "#3A4F6A" }}>No notes yet.</p>
              )}

              <div className="flex flex-col gap-1.5">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="flex items-start gap-3 px-4 py-3 rounded-xl group"
                    style={{ backgroundColor: "#111D30", border: "1px solid #1B2A4A" }}
                  >
                    <p className="flex-1 text-sm leading-relaxed" style={{ color: "#D0DFEE" }}>{note.text}</p>
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity mt-0.5"
                    >
                      <Trash2 size={12} style={{ color: "#F87171" }} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
