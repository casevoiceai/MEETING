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

    return {
      success: true,
      connected: true,
    };
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
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      console.error("[Integrations] API failed:", response.status);
      return { success: false, status: response.status };
    }

    const data = await response.json();

    console.log("[Integrations] API success:", data);

    return { success: true, data };
  } catch (err) {
    console.error("[Integrations] Save failed:", err);
    return { success: false };
  }
}
