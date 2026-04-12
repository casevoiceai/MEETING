import { supabase } from "./supabase";
import { createDriveSyncLog, createNotionSyncLog, type DriveSyncLog, type NotionSyncLog } from "./db";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

function edgeFn(slug: string) {
  return `${SUPABASE_URL}/functions/v1/${slug}`;
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };
}

export async function testDriveConnection(): Promise<{ success: boolean; error?: string; folders?: Record<string, string> }> {
  const res = await fetch(edgeFn("google-drive-sync"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ action: "test_connection" }),
  });
  return await res.json();
}

export async function testNotionConnection(): Promise<{ success: boolean; error?: string; botName?: string }> {
  const res = await fetch(edgeFn("notion-sync"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ action: "test_connection" }),
  });
  return await res.json();
}

export async function listNotionDatabases(): Promise<{ id: string; title: string }[]> {
  const res = await fetch(edgeFn("notion-sync"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ action: "list_databases" }),
  });
  const data = await res.json();
  return data.databases ?? [];
}

export async function saveNotionDbConfig(databases: { julie_reports?: string; tasks?: string; projects?: string }): Promise<void> {
  await fetch(edgeFn("notion-sync"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ action: "save_db_config", databases }),
  });
}

export async function syncFileToDrive(params: {
  localFileId: string;
  sessionId: string;
  fileName: string;
  fileContent: string;
  mimeType: string;
  driveFolder?: string;
}): Promise<{ success: boolean; driveUrl?: string; error?: string }> {
  let syncLog: DriveSyncLog;
  try {
    syncLog = await createDriveSyncLog({
      local_file_id: params.localFileId,
      session_id: params.sessionId,
      file_name: params.fileName,
      file_type: "vault_file",
      drive_folder: params.driveFolder ?? "files",
    });
  } catch {
    return { success: false, error: "Failed to create sync log" };
  }

  const res = await fetch(edgeFn("google-drive-sync"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      action: "sync_file",
      syncLogId: syncLog.id,
      localFileId: params.localFileId,
      fileName: params.fileName,
      fileContent: params.fileContent,
      mimeType: params.mimeType,
      driveFolder: params.driveFolder ?? "files",
    }),
  });
  return await res.json();
}

export async function syncTranscriptToDrive(params: {
  sessionId: string;
  sessionKey: string;
  transcript: unknown;
  julieReport?: unknown;
}): Promise<{ success: boolean; transcriptUrl?: string; reportUrl?: string; error?: string }> {
  const res = await fetch(edgeFn("google-drive-sync"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      action: "sync_transcript",
      sessionId: params.sessionId,
      sessionKey: params.sessionKey,
      transcriptJson: params.transcript,
      julieReportJson: params.julieReport,
    }),
  });
  return await res.json();
}

export async function syncSideNoteToDrive(params: {
  sessionId: string;
  sessionKey: string;
  noteText: string;
  noteTags: string[];
  noteMentors: string[];
}): Promise<{ success: boolean; driveUrl?: string; error?: string }> {
  const res = await fetch(edgeFn("google-drive-sync"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ action: "sync_side_note", ...params }),
  });
  return await res.json();
}

export async function queueJulieReportForNotion(params: {
  sessionId: string;
  sessionKey: string;
  sessionDate: string;
  summary: string;
  decisions: string[];
  openQuestions: string[];
  assignedTasks: { task: string; owner: string }[];
  activeTopics: string[];
  mentorsInvolved: string[];
  driveLinks: { transcript?: string; report?: string };
}): Promise<NotionSyncLog> {
  const log = await createNotionSyncLog({
    notion_db: "julie_reports",
    local_id: params.sessionId,
    local_type: "session",
    session_id: params.sessionId,
    payload: params as unknown as Record<string, unknown>,
    drive_links: Object.values(params.driveLinks).filter(Boolean) as string[],
    status: "pending_approval",
  });
  return log;
}

export async function pushJulieReportToNotion(syncLogId: string, params: {
  sessionId: string;
  sessionKey: string;
  sessionDate: string;
  summary: string;
  decisions: string[];
  openQuestions: string[];
  assignedTasks: { task: string; owner: string }[];
  activeTopics: string[];
  mentorsInvolved: string[];
  driveLinks: { transcript?: string; report?: string };
}): Promise<{ success: boolean; notionPageId?: string; error?: string }> {
  const res = await fetch(edgeFn("notion-sync"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ action: "sync_julie_report", syncLogId, ...params }),
  });
  return await res.json();
}

export async function pushTaskToNotion(params: {
  taskText: string;
  owner: string;
  sessionKey: string;
  sessionId?: string;
  projectName?: string;
}): Promise<{ success: boolean; notionPageId?: string; error?: string }> {
  let syncLogId: string | undefined;
  try {
    const log = await createNotionSyncLog({
      notion_db: "tasks",
      local_id: params.sessionId ?? "unknown",
      local_type: "task",
      session_id: params.sessionId ?? null,
      payload: params as unknown as Record<string, unknown>,
      status: "approved",
    });
    syncLogId = log.id;
    await supabase.from("notion_sync_log").update({ approved_by_user: true }).eq("id", log.id);
  } catch {
    // continue without log
  }

  const res = await fetch(edgeFn("notion-sync"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ action: "sync_task", syncLogId, ...params }),
  });
  return await res.json();
}

export async function pushProjectToNotion(params: {
  projectId: string;
  projectName: string;
  summary: string;
  tags: string[];
  driveFileUrls: string[];
  sessionKeys: string[];
}): Promise<{ success: boolean; notionPageId?: string; error?: string }> {
  const res = await fetch(edgeFn("notion-sync"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ action: "sync_project", ...params }),
  });
  return await res.json();
}

export async function getSyncStatusForSession(sessionId: string): Promise<{
  drive: DriveSyncLog[];
  notion: NotionSyncLog[];
}> {
  const res = await fetch(edgeFn("notion-sync"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ action: "get_sync_status", sessionId }),
  });
  const data = await res.json();
  return { drive: data.drive ?? [], notion: data.notion ?? [] };
}
