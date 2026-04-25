import { ensureSupabaseSession } from "./supabase";

export async function testDriveConnection() {
  try {
    console.log("[Integrations] Starting testDriveConnection");

    const session = await ensureSupabaseSession();

    if (!session?.access_token) {
      console.error("[Integrations] No Supabase session for drive test");
      return {
        success: false,
        connected: false,
        error: "No Supabase session",
      };
    }

    console.log("[Integrations] Drive test session OK:", session.user?.id);

    const response = await fetch("/api/save-meeting", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        action: "check_auth",
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("[Integrations] Drive test API failed:", response.status, text);
      return {
        success: false,
        connected: false,
        error: text,
      };
    }

    const data = await response.json();

    console.log("[Integrations] Drive test API success:", data);

    return data;
  } catch (err) {
    console.error("[Integrations] Drive test failed:", err);
    return {
      success: false,
      connected: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function saveMeetingToDrive() {
  try {
    console.log("[Integrations] Starting saveMeetingToDrive");

    const session = await ensureSupabaseSession();

    if (!session?.access_token) {
      console.error("[Integrations] No Supabase session");
      return { success: false };
    }

    console.log("[Integrations] Session OK:", session.user?.id);

    const response = await fetch("/api/save-meeting", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        action: "save_meeting",
        title: "Test Meeting",
        content:
          "Julie: What are we building?\nFounder: A founder operating system.\nScout: What competitors exist?\n(no answer yet)",
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("[Integrations] API failed:", response.status, text);
      return { success: false, status: response.status, error: text };
    }

    const data = await response.json();

    console.log("[Integrations] API success:", data);

    return { success: true, data };
  } catch (err) {
    console.error("[Integrations] Save failed:", err);
    return { success: false };
  }
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
