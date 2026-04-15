import { supabase } from "./supabase";

const SUPABASE_FUNCTION_URL =
  "https://lzkiwsqezugptwugcehg.supabase.co/functions/v1";

async function getAccessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token ?? null;
}

export async function testDriveConnection(): Promise<{
  success: boolean;
  error?: string;
  folders?: Record<string, string>;
}> {
  try {
    const token = await getAccessToken();

    if (!token) {
      return { success: false, error: "No auth token" };
    }

    const response = await fetch(`${SUPABASE_FUNCTION_URL}/google-drive-sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: "test_connection",
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        success: false,
        error: data?.error || `HTTP ${response.status}`,
      };
    }

    return {
      success: true,
      folders: data?.folders ?? {},
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Drive check failed",
    };
  }
}

export async function saveMeetingToDrive(): Promise<{
  success: boolean;
  error?: string;
  transcriptUrl?: string;
  summaryUrl?: string;
}> {
  try {
    console.log("[DRIVE] Starting save...");

    const token = await getAccessToken();

    if (!token) {
      console.error("[DRIVE] No auth token found");
      return { success: false, error: "No auth token" };
    }

    const today = new Date().toISOString().split("T")[0];

    const transcript = `Julie: What are we building?
Founder: A founder operating system.

Scout: What competitors exist?
(no answer yet)
`;

    const summary = `# Meeting Summary

## Goals
- Build founder workspace
- Integrate Google Drive + Notion

## Decisions
- Manual + Auto Save
- Store in dated folders

## Open Questions
- How should tasks sync?
- Founder health tracking?
- What competitors exist?

## Action Items
- Build Drive integration
- Test system
`;

    const response = await fetch(`${SUPABASE_FUNCTION_URL}/google-drive-sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: "save_meeting",
        date: today,
        transcript,
        summary,
      }),
    });

    const data = await response.json().catch(() => ({}));

    console.log("[DRIVE] Response:", data);

    if (!response.ok) {
      return {
        success: false,
        error: data?.error || `HTTP ${response.status}`,
      };
    }

    return {
      success: true,
      transcriptUrl: data?.transcriptUrl,
      summaryUrl: data?.summaryUrl,
    };
  } catch (error) {
    console.error("[DRIVE ERROR]", error);

    return {
      success: false,
      error: error instanceof Error ? error.message : "Save failed",
    };
  }
}

export async function syncFileToDrive(): Promise<{
  success: boolean;
  error?: string;
}> {
  return { success: true };
}

export async function syncTranscriptToDrive(): Promise<{
  success: boolean;
  error?: string;
}> {
  return { success: true };
}

export async function syncSideNoteToDrive(): Promise<{
  success: boolean;
  error?: string;
}> {
  return { success: true };
}

export async function queueJulieReportForNotion(): Promise<{
  success: boolean;
  error?: string;
}> {
  return { success: true };
}
