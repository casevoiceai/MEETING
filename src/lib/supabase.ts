import { createClient, type Session } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://lzkiwsqezugptwugcehg.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_btVRhvhpBvfdpM0EIlvngQ_A4gMMwxA";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

supabase.auth.onAuthStateChange((event, session) => {
  console.log("[Supabase Auth Event]", event, session?.user?.id ?? "no-user");
});

let cachedSession: Session | null = null;

export async function ensureSupabaseSession(): Promise<Session | null> {
  try {
    if (cachedSession?.access_token) {
      console.log("[Supabase] Using cached session");
      return cachedSession;
    }

    console.log("[Supabase] Creating fresh anonymous session...");

    const { data, error } = await supabase.auth.signInAnonymously();

    if (error) {
      console.error("[Supabase] Anonymous sign-in failed:", error);
      throw error;
    }

    if (data.session?.access_token) {
      cachedSession = data.session;
      console.log("[Supabase] Anonymous session created");
      return data.session;
    }

    console.error("[Supabase] No session returned");
    return null;
  } catch (err) {
    console.error("[Supabase] Auth failed:", err);
    return null;
  }
}
