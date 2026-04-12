import { supabase } from "./supabase";

export type TaskStatus = "open" | "in_progress" | "done";

export interface Session {
  id: string;
  session_date: string;
  session_key: string;
  created_at: string;
  archived: boolean;
  session_summary?: string;
  key_topics?: string[];
  mentors_involved?: string[];
}

export interface SessionTranscript {
  id: string;
  session_id: string;
  messages: TranscriptMessage[];
  updated_at: string;
}

export interface TranscriptMessage {
  id: number;
  text: string;
  speaker: "you" | "mentor";
  sender?: string;
  targets?: string[];
}

export interface JulieReport {
  id: string;
  session_id: string;
  open_questions: string[];
  answered_questions: { question: string; answer: string }[];
  assigned_tasks: { task: string; owner: string }[];
  unresolved_topics: string[];
  active_topics: string[];
  decisions_made: string[];
  pending_decisions: string[];
  mentor_participation: Record<string, number>;
  dropped_ideas: string[];
  updated_at: string;
}

export interface SideNote {
  id: string;
  session_id: string | null;
  project_id: string | null;
  text: string;
  mentors: string[];
  tags: string[];
  archived: boolean;
  created_at: string;
}

export interface TagEntry {
  id: string;
  tag: string;
  usage_count: number;
  category: string;
  color: string;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  archived: boolean;
  created_at: string;
}

export interface ProjectNote {
  id: string;
  project_id: string;
  text: string;
  tags: string[];
  archived: boolean;
  created_at: string;
}

export interface ProjectTask {
  id: string;
  project_id: string;
  text: string;
  owner: string;
  status: TaskStatus;
  archived: boolean;
  created_at: string;
}

export interface VaultFolder {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
}

export interface VaultFile {
  id: string;
  folder_id: string | null;
  name: string;
  content: string;
  summary: string;
  tags: string[];
  file_type: string;
  linked_project_id: string | null;
  linked_session_id: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getOrCreateSession(): Promise<Session> {
  const key = todayKey();
  const { data: existing } = await supabase
    .from("sessions")
    .select("*")
    .eq("session_key", key)
    .maybeSingle();

  if (existing) return existing as Session;

  const { data, error } = await supabase
    .from("sessions")
    .insert({ session_key: key, session_date: key })
    .select()
    .single();

  if (error) throw error;
  return data as Session;
}

export async function upsertTranscript(sessionId: string, messages: TranscriptMessage[]): Promise<void> {
  const { data: existing } = await supabase
    .from("session_transcripts")
    .select("id")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("session_transcripts")
      .update({ messages, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await supabase
      .from("session_transcripts")
      .insert({ session_id: sessionId, messages });
  }
}

export async function upsertJulieReport(
  sessionId: string,
  report: Omit<JulieReport, "id" | "session_id" | "updated_at">
): Promise<void> {
  const { data: existing } = await supabase
    .from("julie_reports")
    .select("id")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("julie_reports")
      .update({ ...report, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await supabase
      .from("julie_reports")
      .insert({ session_id: sessionId, ...report });
  }
}

export async function loadSession(sessionKey: string): Promise<{
  session: Session;
  transcript: SessionTranscript | null;
  julieReport: JulieReport | null;
} | null> {
  const { data: session } = await supabase
    .from("sessions")
    .select("*")
    .eq("session_key", sessionKey)
    .maybeSingle();

  if (!session) return null;

  const { data: transcript } = await supabase
    .from("session_transcripts")
    .select("*")
    .eq("session_id", session.id)
    .maybeSingle();

  const { data: julieReport } = await supabase
    .from("julie_reports")
    .select("*")
    .eq("session_id", session.id)
    .maybeSingle();

  return {
    session: session as Session,
    transcript: transcript as SessionTranscript | null,
    julieReport: julieReport as JulieReport | null,
  };
}

export async function listSessions(): Promise<Session[]> {
  const { data } = await supabase
    .from("sessions")
    .select("*")
    .order("session_date", { ascending: false });
  return (data ?? []) as Session[];
}

export async function archiveSession(sessionId: string): Promise<void> {
  await supabase.from("sessions").update({ archived: true }).eq("id", sessionId);
}

export async function saveSideNote(note: Omit<SideNote, "id" | "created_at">): Promise<SideNote> {
  const { data, error } = await supabase
    .from("side_notes")
    .insert(note)
    .select()
    .single();
  if (error) throw error;
  return data as SideNote;
}

export async function updateSideNote(id: string, patch: Partial<Pick<SideNote, "text" | "tags" | "mentors" | "project_id" | "session_id">>): Promise<void> {
  await supabase.from("side_notes").update(patch).eq("id", id);
}

export async function listSideNotes(filters?: {
  sessionId?: string;
  projectId?: string;
  archived?: boolean;
}): Promise<SideNote[]> {
  let q = supabase.from("side_notes").select("*");
  if (filters?.sessionId) q = q.eq("session_id", filters.sessionId);
  if (filters?.projectId) q = q.eq("project_id", filters.projectId);
  if (filters?.archived !== undefined) q = q.eq("archived", filters.archived);
  const { data } = await q.order("created_at", { ascending: false });
  return (data ?? []) as SideNote[];
}

export async function deleteSideNote(id: string): Promise<void> {
  await supabase.from("side_notes").delete().eq("id", id);
}

export async function listAllTags(): Promise<TagEntry[]> {
  const { data } = await supabase
    .from("tag_registry")
    .select("*")
    .order("usage_count", { ascending: false });
  return (data ?? []) as TagEntry[];
}

export async function createTag(tag: string, category = "General", color = "#C9A84C"): Promise<TagEntry> {
  const { data: existing } = await supabase
    .from("tag_registry")
    .select("*")
    .eq("tag", tag)
    .maybeSingle();
  if (existing) return existing as TagEntry;
  const { data, error } = await supabase
    .from("tag_registry")
    .insert({ tag, usage_count: 0, category, color })
    .select()
    .single();
  if (error) throw error;
  return data as TagEntry;
}

export async function updateTag(id: string, patch: Partial<Pick<TagEntry, "tag" | "category" | "color">>): Promise<void> {
  await supabase.from("tag_registry").update(patch).eq("id", id);
}

export async function deleteTag(id: string): Promise<void> {
  await supabase.from("tag_registry").delete().eq("id", id);
}

export async function upsertTags(tags: string[]): Promise<void> {
  for (const tag of tags) {
    const { data: existing } = await supabase
      .from("tag_registry")
      .select("id, usage_count")
      .eq("tag", tag)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("tag_registry")
        .update({ usage_count: existing.usage_count + 1 })
        .eq("id", existing.id);
    } else {
      await supabase.from("tag_registry").insert({ tag, usage_count: 1, category: "General", color: "#C9A84C" });
    }
  }
}

export async function createProject(name: string): Promise<Project> {
  const slug = name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  const { data, error } = await supabase
    .from("projects")
    .insert({ name, slug })
    .select()
    .single();
  if (error) throw error;
  return data as Project;
}

export async function listProjects(includeArchived = false): Promise<Project[]> {
  let q = supabase.from("projects").select("*");
  if (!includeArchived) q = q.eq("archived", false);
  const { data } = await q.order("created_at", { ascending: false });
  return (data ?? []) as Project[];
}

export async function archiveProject(projectId: string): Promise<void> {
  await supabase.from("projects").update({ archived: true }).eq("id", projectId);
}

export async function addProjectNote(
  projectId: string,
  text: string,
  tags: string[]
): Promise<ProjectNote> {
  const { data, error } = await supabase
    .from("project_notes")
    .insert({ project_id: projectId, text, tags })
    .select()
    .single();
  if (error) throw error;
  return data as ProjectNote;
}

export async function listProjectNotes(projectId: string): Promise<ProjectNote[]> {
  const { data } = await supabase
    .from("project_notes")
    .select("*")
    .eq("project_id", projectId)
    .eq("archived", false)
    .order("created_at", { ascending: false });
  return (data ?? []) as ProjectNote[];
}

export async function deleteProjectNote(id: string): Promise<void> {
  await supabase.from("project_notes").delete().eq("id", id);
}

export async function addProjectTask(
  projectId: string,
  text: string,
  owner = ""
): Promise<ProjectTask> {
  const { data, error } = await supabase
    .from("project_tasks")
    .insert({ project_id: projectId, text, owner })
    .select()
    .single();
  if (error) throw error;
  return data as ProjectTask;
}

export async function listProjectTasks(projectId: string): Promise<ProjectTask[]> {
  const { data } = await supabase
    .from("project_tasks")
    .select("*")
    .eq("project_id", projectId)
    .eq("archived", false)
    .order("created_at", { ascending: true });
  return (data ?? []) as ProjectTask[];
}

export async function updateTaskStatus(taskId: string, status: TaskStatus): Promise<void> {
  await supabase.from("project_tasks").update({ status }).eq("id", taskId);
}

export async function deleteProjectTask(id: string): Promise<void> {
  await supabase.from("project_tasks").delete().eq("id", id);
}

export async function listVaultFolders(): Promise<VaultFolder[]> {
  const { data } = await supabase.from("vault_folders").select("*").order("name");
  return (data ?? []) as VaultFolder[];
}

export async function createVaultFolder(name: string, parentId?: string): Promise<VaultFolder> {
  const { data, error } = await supabase
    .from("vault_folders")
    .insert({ name, parent_id: parentId ?? null })
    .select()
    .single();
  if (error) throw error;
  return data as VaultFolder;
}

export async function renameVaultFolder(id: string, name: string): Promise<void> {
  await supabase.from("vault_folders").update({ name }).eq("id", id);
}

export async function deleteVaultFolder(id: string): Promise<void> {
  await supabase.from("vault_folders").delete().eq("id", id);
}

export async function listVaultFiles(folderId?: string | null): Promise<VaultFile[]> {
  let q = supabase.from("vault_files").select("*").eq("archived", false);
  if (folderId !== undefined) {
    if (folderId === null) q = q.is("folder_id", null);
    else q = q.eq("folder_id", folderId);
  }
  const { data } = await q.order("updated_at", { ascending: false });
  return (data ?? []) as VaultFile[];
}

export async function listVaultFilesByProject(projectId: string): Promise<VaultFile[]> {
  const { data } = await supabase
    .from("vault_files")
    .select("*")
    .eq("archived", false)
    .eq("linked_project_id", projectId)
    .order("updated_at", { ascending: false });
  return (data ?? []) as VaultFile[];
}

export async function listVaultFilesByTag(tag: string): Promise<VaultFile[]> {
  const { data } = await supabase
    .from("vault_files")
    .select("*")
    .eq("archived", false)
    .contains("tags", [tag])
    .order("updated_at", { ascending: false });
  return (data ?? []) as VaultFile[];
}

export async function listSideNotesByTag(tag: string): Promise<SideNote[]> {
  const { data } = await supabase
    .from("side_notes")
    .select("*")
    .eq("archived", false)
    .contains("tags", [tag])
    .order("created_at", { ascending: false });
  return (data ?? []) as SideNote[];
}

export async function createVaultFile(name: string, folderId?: string | null): Promise<VaultFile> {
  const { data, error } = await supabase
    .from("vault_files")
    .insert({ name, folder_id: folderId ?? null, content: "", summary: "", tags: [], file_type: "note", linked_project_id: null, linked_session_id: null })
    .select()
    .single();
  if (error) throw error;
  return data as VaultFile;
}

export async function updateVaultFile(
  id: string,
  patch: Partial<Pick<VaultFile, "name" | "content" | "summary" | "tags" | "folder_id" | "linked_project_id" | "linked_session_id" | "file_type">>
): Promise<void> {
  await supabase
    .from("vault_files")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
}

export async function deleteVaultFile(id: string): Promise<void> {
  await supabase.from("vault_files").delete().eq("id", id);
}
