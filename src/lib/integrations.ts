import { supabase } from "./supabase";

const SUPABASE_FUNCTION_URL =
  "https://lzkiwsqezugptwugcehg.supabase.co/functions/v1";

export async function callDriveFunction(action: string, payload: any = {}) {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      console.error("[DRIVE] No session found");
      return { error: "No session" };
    }

    console.log("[DRIVE] session OK");

    const res = await fetch(
      `${SUPABASE_FUNCTION_URL}/google-drive-sync`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey:
            "sb_publishable_btVRhvhpBvfdpM0EIlvngQ_A4gMMwxA",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          ...payload,
        }),
      }
    );

    const data = await res.json();

    console.log("[DRIVE RESPONSE]", data);

    return data;
  } catch (err) {
    console.error("[DRIVE ERROR]", err);
    return { error: err.message };
  }
}
