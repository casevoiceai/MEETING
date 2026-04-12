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

async function safeNotionFetch(body: Record<string, unknown>): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string; unavailable?: boolean }> {
  try {
    const res = await fetch(edgeFn("notion-sync"), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errorText = await res.text().catch(() => `HTTP ${res.status}`);
      return { success: false, error: errorText, unavailable: true };
    }
    const data = await res.json();
    if (data.error || data.success === false) {
      return { success: false, error: data.error ?? "Notion returned an error", unavailable: false, data };
    }
    return { success: true, data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    return { success: false, error: msg, unavailable: true };
  }
}

async function markNotionFallback(errorMsg: string): Promise<void> {
  try {
    await supabase
      .from("integration_settings")
      .update({
        fallback_mode: true,
        last_error: errorMsg,
        last_error_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("integration_type", "notion");
  } catch {
    // non-critical
  }
}

async function markNotionOnline(): Promise<void> {
  try {
    await supabase
      .from("integration_settings")
      .update({
        fallback_mode: false,
        last_error: "",
        last_error_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("integration_type", "notion");
  } catch {
    // non-critical
  }
}

async function markSyncLogPendingRetry(logId: string, errorMsg: string): Promise<void> {
  try {
    const retryAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    await supabase
      .from("notion_sync_log")
      .update({
        status: "notion_sync_pending",
        error_message: errorMsg,
        last_error_at: new Date().toISOString(),
        next_retry_at: retryAt,
      })
      .eq("id", logId);
  } catch {
    // non-critical
  }
}

export async function testDriveConnection(): Promise<{ success: boolean; error?: string; folders?: Record<string, string> }> {
  try {
    const res = await fetch(edgeFn("google-drive-sync"), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ action: "test_connection" }),
    });
    return await res.json();
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

export async function testNotionConnection(): Promise<{ success: boolean; error?: string; botName?: string }> {
  const result = await safeNotionFetch({ action: "test_connection" });
  if (result.success) {
    await markNotionOnline();
    return { success: true, botName: result.data?.botName as string | undefined };
  }
  await markNotionFallback(result.error ?? "Connection failed");
  return { success: false, error: result.error };
}

export async function listNotionDatabases(): Promise<{ id: string; title: string }[]> {
  const result = await safeNotionFetch({ action: "list_databases" });
  if (!result.success) return [];
  return (result.data?.databases as { id: string; title: string }[] | undefined) ?? [];
}

export async function saveNotionDbConfig(databases: { julie_reports?: string; tasks?: string; projects?: string }): Promise<void> {
  await safeNotionFetch({ action: "save_db_config", databases });
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

  try {
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
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

export async function syncTranscriptToDrive(params: {
  sessionId: string;
  sessionKey: string;
  transcript: unknown;
  julieReport?: unknown;
}): Promise<{ success: boolean; transcriptUrl?: string; reportUrl?: string; error?: string }> {
  try {
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
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

export async function syncSideNoteToDrive(params: {
  sessionId: string;
  sessionKey: string;
  noteText: string;
  noteTags: string[];
  noteMentors: string[];
}): Promise<{ success: boolean; driveUrl?: string; error?: string }> {
  try {
    const res = await fetch(edgeFn("google-drive-sync"), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ action: "sync_side_note", ...params }),
    });
    return await res.json();
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Network error" };
  }
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
}): Promise<{ success: boolean; notionPageId?: string; error?: string; queued?: boolean }> {
  const result = await safeNotionFetch({ action: "sync_julie_report", syncLogId, ...params });

  if (result.success) {
    await markNotionOnline();
    return { success: true, notionPageId: result.data?.notionPageId as string | undefined };
  }

  await markNotionFallback(result.error ?? "Push failed");
  await markSyncLogPendingRetry(syncLogId, result.error ?? "Notion unavailable");

  return { success: false, error: result.error, queued: true };
}

export async function pushTaskToNotion(params: {
  taskText: string;
  owner: string;
  sessionKey: string;
  sessionId?: string;
  projectName?: string;
}): Promise<{ success: boolean; notionPageId?: string; error?: string; queued?: boolean }> {
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

  const result = await safeNotionFetch({ action: "sync_task", syncLogId, ...params });

  if (result.success) {
    await markNotionOnline();
    return { success: true, notionPageId: result.data?.notionPageId as string | undefined };
  }

  await markNotionFallback(result.error ?? "Push failed");
  if (syncLogId) await markSyncLogPendingRetry(syncLogId, result.error ?? "Notion unavailable");

  return { success: false, error: result.error, queued: true };
}

export async function pushProjectToNotion(params: {
  projectId: string;
  projectName: string;
  summary: string;
  tags: string[];
  driveFileUrls: string[];
  sessionKeys: string[];
}): Promise<{ success: boolean; notionPageId?: string; error?: string; queued?: boolean }> {
  let syncLogId: string | undefined;
  try {
    const log = await createNotionSyncLog({
      notion_db: "projects",
      local_id: params.projectId,
      local_type: "project",
      session_id: null,
      payload: params as unknown as Record<string, unknown>,
      status: "notion_sync_pending",
    });
    syncLogId = log.id;
  } catch {
    // non-critical
  }

  const result = await safeNotionFetch({ action: "sync_project", syncLogId, ...params });

  if (result.success) {
    await markNotionOnline();
    if (syncLogId) {
      await supabase.from("notion_sync_log").update({ status: "synced", synced_at: new Date().toISOString() }).eq("id", syncLogId);
    }
    return { success: true, notionPageId: result.data?.notionPageId as string | undefined };
  }

  await markNotionFallback(result.error ?? "Push failed");
  if (syncLogId) await markSyncLogPendingRetry(syncLogId, result.error ?? "Notion unavailable");

  return { success: false, error: result.error, queued: true };
}

export async function retryNotionPendingItems(): Promise<{ retried: number; succeeded: number; stillFailing: number }> {
  const { data: pending } = await supabase
    .from("notion_sync_log")
    .select("*")
    .in("status", ["notion_sync_pending", "failed"])
    .order("created_at", { ascending: true })
    .limit(20);

  if (!pending || pending.length === 0) return { retried: 0, succeeded: 0, stillFailing: 0 };

  let succeeded = 0;
  let stillFailing = 0;

  for (const item of pending) {
    const payload = item.payload as Record<string, unknown>;
    const result = await safeNotionFetch({
      action: item.notion_db === "julie_reports" ? "sync_julie_report"
            : item.notion_db === "tasks" ? "sync_task"
            : "sync_project",
      syncLogId: item.id,
      ...payload,
    });

    if (result.success) {
      await supabase
        .from("notion_sync_log")
        .update({ status: "synced", synced_at: new Date().toISOString(), error_message: "" })
        .eq("id", item.id);
      succeeded++;
    } else {
      await markSyncLogPendingRetry(item.id, result.error ?? "Still unavailable");
      stillFailing++;
    }
  }

  if (succeeded > 0 && stillFailing === 0) await markNotionOnline();

  return { retried: pending.length, succeeded, stillFailing };
}

export async function getNotionFallbackStatus(): Promise<{
  inFallback: boolean;
  lastError: string;
  lastErrorAt: string | null;
  pendingCount: number;
}> {
  const [settingsRes, pendingRes] = await Promise.all([
    supabase.from("integration_settings").select("fallback_mode,last_error,last_error_at").eq("integration_type", "notion").maybeSingle(),
    supabase.from("notion_sync_log").select("id", { count: "exact", head: true }).in("status", ["notion_sync_pending", "failed"]),
  ]);

  return {
    inFallback: settingsRes.data?.fallback_mode ?? false,
    lastError: settingsRes.data?.last_error ?? "",
    lastErrorAt: settingsRes.data?.last_error_at ?? null,
    pendingCount: pendingRes.count ?? 0,
  };
}

export async function getSyncStatusForSession(sessionId: string): Promise<{
  drive: DriveSyncLog[];
  notion: NotionSyncLog[];
}> {
  const result = await safeNotionFetch({ action: "get_sync_status", sessionId });
  if (!result.success) {
    const { data } = await supabase
      .from("notion_sync_log")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false });
    return { drive: [], notion: (data ?? []) as NotionSyncLog[] };
  }
  return { drive: (result.data?.drive ?? []) as DriveSyncLog[], notion: (result.data?.notion ?? []) as NotionSyncLog[] };
}
