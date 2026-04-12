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
  carryover_tasks?: { task: string; owner: string }[];
  carryover_questions?: string[];
  carryover_topics?: string[];
  files_discussed?: string[];
  notes_created?: string[];
  participants?: string[];
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
  sideNotes: SideNote[];
  vaultFiles: VaultFile[];
  tagNames: string[];
} | null> {
  const { data: session } = await supabase
    .from("sessions")
    .select("*")
    .eq("session_key", sessionKey)
    .maybeSingle();

  if (!session) return null;

  const [transcriptRes, julieReportRes, sideNotesRes, vaultFilesRes] = await Promise.all([
    supabase.from("session_transcripts").select("*").eq("session_id", session.id).maybeSingle(),
    supabase.from("julie_reports").select("*").eq("session_id", session.id).maybeSingle(),
    supabase.from("side_notes").select("*").eq("session_id", session.id).eq("archived", false).order("created_at", { ascending: true }),
    supabase.from("vault_files").select("*").eq("linked_session_id", session.id).eq("archived", false).order("updated_at", { ascending: false }),
  ]);

  const keyTopics: string[] = (session as Session).key_topics ?? [];
  const sideNoteTags: string[] = ((sideNotesRes.data ?? []) as SideNote[]).flatMap((n) => n.tags ?? []);
  const allTagNames = Array.from(new Set([...keyTopics, ...sideNoteTags])).filter(Boolean);

  return {
    session: session as Session,
    transcript: transcriptRes.data as SessionTranscript | null,
    julieReport: julieReportRes.data as JulieReport | null,
    sideNotes: (sideNotesRes.data ?? []) as SideNote[],
    vaultFiles: (vaultFilesRes.data ?? []) as VaultFile[],
    tagNames: allTagNames,
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
  const normalizedTags = (note.tags ?? []).map((t) => t.trim()).filter(Boolean);
  const record = { ...note, tags: normalizedTags };

  const { data, error } = await supabase
    .from("side_notes")
    .insert(record)
    .select()
    .single();
  if (error) throw error;

  if (normalizedTags.length > 0) {
    upsertTags(normalizedTags).catch(() => {});
  }

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
  const normalized = tags.map((t) => t.trim()).filter(Boolean);
  for (const tag of normalized) {
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
  const trimmed = name.trim();
  const slug = trimmed
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

  const { data: existing } = await supabase
    .from("projects")
    .select("*")
    .ilike("name", trimmed)
    .eq("archived", false)
    .maybeSingle();
  if (existing) return existing as Project;

  const { data, error } = await supabase
    .from("projects")
    .insert({ name: trimmed, slug })
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

export async function renameProject(projectId: string, name: string): Promise<void> {
  const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  await supabase.from("projects").update({ name, slug }).eq("id", projectId);
}

export async function deleteProject(projectId: string): Promise<void> {
  await supabase.from("projects").delete().eq("id", projectId);
}

export async function listTagsForProject(projectId: string): Promise<TagEntry[]> {
  const [filesRes, notesRes, sideNotesRes] = await Promise.all([
    supabase.from("vault_files").select("tags").eq("linked_project_id", projectId).eq("archived", false),
    supabase.from("project_notes").select("tags").eq("project_id", projectId).eq("archived", false),
    supabase.from("side_notes").select("tags").eq("project_id", projectId).eq("archived", false),
  ]);
  const allTags = new Set<string>();
  (filesRes.data ?? []).forEach((r: { tags: string[] }) => (r.tags ?? []).forEach((t) => allTags.add(t)));
  (notesRes.data ?? []).forEach((r: { tags: string[] }) => (r.tags ?? []).forEach((t) => allTags.add(t)));
  (sideNotesRes.data ?? []).forEach((r: { tags: string[] }) => (r.tags ?? []).forEach((t) => allTags.add(t)));
  if (allTags.size === 0) return [];
  const { data } = await supabase
    .from("tag_registry")
    .select("*")
    .in("tag", Array.from(allTags));
  return (data ?? []) as TagEntry[];
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

export async function listSessionsByTag(tag: string): Promise<Session[]> {
  const { data } = await supabase
    .from("sessions")
    .select("*")
    .eq("archived", false)
    .contains("key_topics", [tag])
    .order("session_date", { ascending: false });
  return (data ?? []) as Session[];
}

export async function listProjectsByTag(tag: string): Promise<Project[]> {
  const { data: notes } = await supabase
    .from("project_notes")
    .select("project_id")
    .contains("tags", [tag]);
  const projectIds = Array.from(new Set((notes ?? []).map((n: { project_id: string }) => n.project_id)));
  if (projectIds.length === 0) return [];
  const { data } = await supabase
    .from("projects")
    .select("*")
    .eq("archived", false)
    .in("id", projectIds);
  return (data ?? []) as Project[];
}

export async function listEmailsByTag(tag: string): Promise<Email[]> {
  const { data } = await supabase
    .from("emails")
    .select("*")
    .eq("archived", false)
    .contains("tags", [tag])
    .order("received_at", { ascending: false });
  return (data ?? []) as Email[];
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

export async function updateSession(
  sessionId: string,
  patch: Partial<Pick<Session, "session_summary" | "key_topics" | "mentors_involved" | "carryover_tasks" | "carryover_questions" | "carryover_topics" | "files_discussed" | "notes_created" | "participants">>
): Promise<void> {
  await supabase.from("sessions").update(patch).eq("id", sessionId);
}

export interface Email {
  id: string;
  subject: string;
  sender_name: string;
  sender_email: string;
  body: string;
  received_at: string;
  is_read: boolean;
  archived: boolean;
  tags: string[];
  linked_session_id: string | null;
  linked_project_id: string | null;
  created_at: string;
}

export interface EmailAttachment {
  id: string;
  email_id: string;
  filename: string;
  content_type: string;
  content: string;
  routed_to: string | null;
  created_at: string;
}

export interface EmailAnalysis {
  id: string;
  email_id: string;
  summary: string;
  intent: string;
  risks: string[];
  opportunities: string[];
  suggested_tone: string;
  key_points: string[];
  tags: string[];
  mentor_insights: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface EmailDraft {
  id: string;
  email_id: string;
  tone: string;
  body: string;
  drafted_by: string;
  approved_by_user: boolean;
  created_at: string;
  updated_at: string;
}

export async function listEmails(includeArchived = false): Promise<Email[]> {
  let q = supabase.from("emails").select("*");
  if (!includeArchived) q = q.eq("archived", false);
  const { data } = await q.order("received_at", { ascending: false });
  return (data ?? []) as Email[];
}

export async function createEmail(
  email: Pick<Email, "subject" | "sender_name" | "sender_email" | "body"> & { received_at?: string }
): Promise<Email> {
  const { data, error } = await supabase
    .from("emails")
    .insert({ ...email, received_at: email.received_at ?? new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data as Email;
}

export async function markEmailRead(emailId: string): Promise<void> {
  await supabase.from("emails").update({ is_read: true }).eq("id", emailId);
}

export async function archiveEmail(emailId: string): Promise<void> {
  await supabase.from("emails").update({ archived: true }).eq("id", emailId);
}

export async function deleteEmail(emailId: string): Promise<void> {
  await supabase.from("emails").delete().eq("id", emailId);
}

export async function addEmailAttachment(
  attachment: Pick<EmailAttachment, "email_id" | "filename" | "content_type" | "content">
): Promise<EmailAttachment> {
  const { data, error } = await supabase
    .from("email_attachments")
    .insert(attachment)
    .select()
    .single();
  if (error) throw error;
  return data as EmailAttachment;
}

export async function listEmailAttachments(emailId: string): Promise<EmailAttachment[]> {
  const { data } = await supabase
    .from("email_attachments")
    .select("*")
    .eq("email_id", emailId)
    .order("created_at", { ascending: true });
  return (data ?? []) as EmailAttachment[];
}

export async function getEmailAnalysis(emailId: string): Promise<EmailAnalysis | null> {
  const { data } = await supabase
    .from("email_analyses")
    .select("*")
    .eq("email_id", emailId)
    .maybeSingle();
  return data as EmailAnalysis | null;
}

export async function upsertEmailAnalysis(
  emailId: string,
  analysis: Partial<Omit<EmailAnalysis, "id" | "email_id" | "created_at" | "updated_at">>
): Promise<void> {
  const { data: existing } = await supabase
    .from("email_analyses")
    .select("id")
    .eq("email_id", emailId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("email_analyses")
      .update({ ...analysis, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await supabase
      .from("email_analyses")
      .insert({ email_id: emailId, ...analysis });
  }
}

export async function listEmailDrafts(emailId: string): Promise<EmailDraft[]> {
  const { data } = await supabase
    .from("email_drafts")
    .select("*")
    .eq("email_id", emailId)
    .order("created_at", { ascending: false });
  return (data ?? []) as EmailDraft[];
}

export async function createEmailDraft(
  draft: Pick<EmailDraft, "email_id" | "tone" | "body" | "drafted_by">
): Promise<EmailDraft> {
  const { data, error } = await supabase
    .from("email_drafts")
    .insert(draft)
    .select()
    .single();
  if (error) throw error;
  return data as EmailDraft;
}

export async function updateEmailDraft(
  draftId: string,
  patch: Partial<Pick<EmailDraft, "body" | "approved_by_user">>
): Promise<void> {
  await supabase
    .from("email_drafts")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", draftId);
}

export async function deleteEmailDraft(draftId: string): Promise<void> {
  await supabase.from("email_drafts").delete().eq("id", draftId);
}

export type LinkableType = "file" | "note" | "tag" | "session" | "project";

export interface LinkedItem {
  id: string;
  source_type: LinkableType;
  source_id: string;
  target_type: LinkableType;
  target_id: string;
  created_at: string;
  resolved?: ResolvedLinkTarget;
}

export interface ResolvedLinkTarget {
  type: LinkableType;
  id: string;
  title: string;
  subtitle?: string;
  tags?: string[];
}

export async function addLink(
  sourceType: LinkableType,
  sourceId: string,
  targetType: LinkableType,
  targetId: string
): Promise<void> {
  await supabase.from("linked_items").upsert(
    { source_type: sourceType, source_id: sourceId, target_type: targetType, target_id: targetId },
    { onConflict: "source_type,source_id,target_type,target_id" }
  );
  await supabase.from("linked_items").upsert(
    { source_type: targetType, source_id: targetId, target_type: sourceType, target_id: sourceId },
    { onConflict: "source_type,source_id,target_type,target_id" }
  );
}

export async function removeLink(
  sourceType: LinkableType,
  sourceId: string,
  targetType: LinkableType,
  targetId: string
): Promise<void> {
  await Promise.all([
    supabase.from("linked_items")
      .delete()
      .eq("source_type", sourceType)
      .eq("source_id", sourceId)
      .eq("target_type", targetType)
      .eq("target_id", targetId),
    supabase.from("linked_items")
      .delete()
      .eq("source_type", targetType)
      .eq("source_id", targetId)
      .eq("target_type", sourceType)
      .eq("target_id", sourceId),
  ]);
}

async function resolveLinkedTarget(type: LinkableType, id: string): Promise<ResolvedLinkTarget | null> {
  if (type === "file") {
    const { data } = await supabase.from("vault_files").select("id,name,tags,summary").eq("id", id).maybeSingle();
    if (!data) return null;
    return { type, id, title: data.name, subtitle: data.summary?.slice(0, 60) || undefined, tags: data.tags };
  }
  if (type === "note") {
    const { data } = await supabase.from("side_notes").select("id,text,tags,mentors").eq("id", id).maybeSingle();
    if (!data) return null;
    return { type, id, title: data.text.slice(0, 80), subtitle: (data.mentors ?? []).join(", ") || undefined, tags: data.tags };
  }
  if (type === "tag") {
    const { data } = await supabase.from("tag_registry").select("id,tag,category").eq("id", id).maybeSingle();
    if (!data) return null;
    return { type, id, title: data.tag, subtitle: data.category };
  }
  if (type === "session") {
    const { data } = await supabase.from("sessions").select("id,session_key,session_summary").eq("id", id).maybeSingle();
    if (!data) return null;
    return { type, id, title: data.session_key, subtitle: data.session_summary?.slice(0, 60) || undefined };
  }
  if (type === "project") {
    const { data } = await supabase.from("projects").select("id,name").eq("id", id).maybeSingle();
    if (!data) return null;
    return { type, id, title: data.name };
  }
  return null;
}

export async function getLinkedItems(
  sourceType: LinkableType,
  sourceId: string,
  filterType?: LinkableType
): Promise<LinkedItem[]> {
  let q = supabase.from("linked_items").select("*").eq("source_type", sourceType).eq("source_id", sourceId);
  if (filterType) q = q.eq("target_type", filterType);
  const { data } = await q.order("created_at", { ascending: false });
  const rows = (data ?? []) as LinkedItem[];
  const resolved = await Promise.all(
    rows.map(async (row) => {
      const r = await resolveLinkedTarget(row.target_type, row.target_id);
      return { ...row, resolved: r ?? undefined };
    })
  );
  return resolved.filter((r) => r.resolved);
}

export async function searchLinkCandidates(query: string, excludeType?: LinkableType, excludeId?: string): Promise<ResolvedLinkTarget[]> {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  const results: ResolvedLinkTarget[] = [];

  const [files, notes, tags, sessions, projects] = await Promise.all([
    supabase.from("vault_files").select("id,name,tags,summary").eq("archived", false),
    supabase.from("side_notes").select("id,text,tags,mentors").eq("archived", false),
    supabase.from("tag_registry").select("id,tag,category"),
    supabase.from("sessions").select("id,session_key,session_summary").eq("archived", false),
    supabase.from("projects").select("id,name").eq("archived", false),
  ]);

  (files.data ?? []).forEach((f: { id: string; name: string; tags: string[]; summary: string }) => {
    if (excludeType === "file" && f.id === excludeId) return;
    if (f.name?.toLowerCase().includes(q) || f.summary?.toLowerCase().includes(q))
      results.push({ type: "file", id: f.id, title: f.name, subtitle: f.summary?.slice(0, 60) || undefined, tags: f.tags });
  });

  (notes.data ?? []).forEach((n: { id: string; text: string; tags: string[]; mentors: string[] }) => {
    if (excludeType === "note" && n.id === excludeId) return;
    if (n.text?.toLowerCase().includes(q))
      results.push({ type: "note", id: n.id, title: n.text.slice(0, 80), subtitle: (n.mentors ?? []).join(", ") || undefined, tags: n.tags });
  });

  (tags.data ?? []).forEach((t: { id: string; tag: string; category: string }) => {
    if (excludeType === "tag" && t.id === excludeId) return;
    if (t.tag?.toLowerCase().includes(q))
      results.push({ type: "tag", id: t.id, title: t.tag, subtitle: t.category });
  });

  (sessions.data ?? []).forEach((s: { id: string; session_key: string; session_summary: string }) => {
    if (excludeType === "session" && s.id === excludeId) return;
    if (s.session_key?.toLowerCase().includes(q) || s.session_summary?.toLowerCase().includes(q))
      results.push({ type: "session", id: s.id, title: s.session_key, subtitle: s.session_summary?.slice(0, 60) || undefined });
  });

  (projects.data ?? []).forEach((p: { id: string; name: string }) => {
    if (excludeType === "project" && p.id === excludeId) return;
    if (p.name?.toLowerCase().includes(q))
      results.push({ type: "project", id: p.id, title: p.name });
  });

  return results.slice(0, 20);
}

export interface SearchResult {
  type: "file" | "note" | "tag" | "session" | "project";
  id: string;
  title: string;
  subtitle?: string;
  tags?: string[];
}

export async function globalSearch(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  const results: SearchResult[] = [];

  const [files, notes, tags, sessions, projects] = await Promise.all([
    supabase.from("vault_files").select("id,name,summary,tags").eq("archived", false),
    supabase.from("side_notes").select("id,text,tags,mentors").eq("archived", false),
    supabase.from("tag_registry").select("id,tag,category,usage_count"),
    supabase.from("sessions").select("id,session_key,session_date,session_summary").eq("archived", false),
    supabase.from("projects").select("id,name,slug").eq("archived", false),
  ]);

  (files.data ?? []).forEach((f: { id: string; name: string; summary: string; tags: string[] }) => {
    if (f.name?.toLowerCase().includes(q) || f.summary?.toLowerCase().includes(q) || (f.tags ?? []).some((t: string) => t.toLowerCase().includes(q))) {
      results.push({ type: "file", id: f.id, title: f.name, subtitle: f.summary?.slice(0, 80) || undefined, tags: f.tags });
    }
  });

  (notes.data ?? []).forEach((n: { id: string; text: string; tags: string[]; mentors: string[] }) => {
    if (n.text?.toLowerCase().includes(q) || (n.tags ?? []).some((t: string) => t.toLowerCase().includes(q)) || (n.mentors ?? []).some((m: string) => m.toLowerCase().includes(q))) {
      results.push({ type: "note", id: n.id, title: n.text.slice(0, 80), subtitle: (n.mentors ?? []).join(", ") || undefined, tags: n.tags });
    }
  });

  (tags.data ?? []).forEach((t: { id: string; tag: string; category: string; usage_count: number }) => {
    if (t.tag?.toLowerCase().includes(q)) {
      results.push({ type: "tag", id: t.id, title: t.tag, subtitle: `${t.category} · ${t.usage_count} uses` });
    }
  });

  (sessions.data ?? []).forEach((s: { id: string; session_key: string; session_date: string; session_summary: string }) => {
    if (s.session_key?.toLowerCase().includes(q) || s.session_summary?.toLowerCase().includes(q)) {
      results.push({ type: "session", id: s.id, title: s.session_key, subtitle: s.session_summary?.slice(0, 80) || undefined });
    }
  });

  (projects.data ?? []).forEach((p: { id: string; name: string; slug: string }) => {
    if (p.name?.toLowerCase().includes(q) || p.slug?.toLowerCase().includes(q)) {
      results.push({ type: "project", id: p.id, title: p.name });
    }
  });

  return results;
}
