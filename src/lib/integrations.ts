import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase";

const DRIVE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/google-drive-sync`;

function driveHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    Apikey: SUPABASE_ANON_KEY,
  };
}

async function callDriveFunction(action: string, extra: Record<string, unknown> = {}) {
  const res = await fetch(DRIVE_FUNCTION_URL, {
    method: "POST",
    headers: driveHeaders(),
    body: JSON.stringify({ action, ...extra }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`Drive function returned ${res.status}: ${text}`);
  }

  return res.json();
}

export async function testDriveConnection(folderId?: string) {
  try {
    const result = await callDriveFunction("test_connection", folderId ? { folderId } : {});
    return result;
  } catch (err) {
    return {
      success: false,
      connected: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function saveMeetingToDrive(
  title = "Test Meeting",
  content = "Julie: What are we building?\nFounder: A founder operating system."
) {
  try {
    const result = await callDriveFunction("save_meeting", { title, content });
    return { success: true, data: result };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function syncFileToDrive(_params: {
  localFileId: string;
  sessionId: string;
  fileName: string;
  fileContent: string;
  mimeType: string;
  driveFolder: string;
}): Promise<never> {
  throw new Error("Drive sync not configured.");
}

// Notion integration — not yet configured. Safe fallbacks below.

export async function getNotionFallbackStatus(): Promise<{
  inFallback: boolean;
  lastError: string;
  lastErrorAt: string | null;
  pendingCount: number;
}> {
  return { inFallback: false, lastError: "", lastErrorAt: null, pendingCount: 0 };
}

export async function testNotionConnection(): Promise<{ success: boolean; error?: string }> {
  return { success: false, error: "Notion integration not configured." };
}

export async function listNotionDatabases(): Promise<{ id: string; name: string }[]> {
  return [];
}

export async function saveNotionDbConfig(
  _config: { julie_reports?: string; tasks?: string; projects?: string }
): Promise<void> {
  // no-op until Notion integration is implemented
}

export async function pushJulieReportToNotion(
  _logId: string,
  _payload: {
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
  }
): Promise<{ success: boolean; error?: string }> {
  return { success: false, error: "Notion integration not configured." };
}

export async function retryNotionPendingItems(): Promise<{
  retried: number;
  succeeded: number;
  stillFailing: number;
}> {
  return { retried: 0, succeeded: 0, stillFailing: 0 };
}
