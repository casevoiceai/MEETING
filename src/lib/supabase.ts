import { createClient, type Session } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://lzkiwsqezugptwugcehg.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_btVRhvhpBvfdpM0EIlvngQ_A4gMMwxA";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

supabase.auth.onAuthStateChange((event, session) => {
  console.log("[Supabase Auth Event]", event, session?.user?.id ?? "no-user");
});

export async function ensureSupabaseSession(): Promise<Session | null> {
  try {
    console.log("[Supabase] Checking existing session...");

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      console.error("[Supabase] getSession failed:", sessionError);
      throw sessionError;
    }

    if (session?.access_token) {
      console.log("[Supabase] Existing session found");
      return session;
    }

    console.log("[Supabase] No session found. Creating anonymous session...");

    const { data, error: signInError } = await supabase.auth.signInAnonymously();

    if (signInError) {
      console.error("[Supabase] Anonymous sign-in failed:", signInError);
      throw signInError;
    }

    if (data.session?.access_token) {
      console.log("[Supabase] Anonymous session created");
      return data.session;
    }

    console.error("[Supabase] Anonymous sign-in returned no session");
    return null;
  } catch (err) {
    console.error("[Supabase] Auth failed:", err);
    return null;
  }
}
