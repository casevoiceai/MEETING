import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://lzkiwsqezugptwugcehg.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_btVRhvhpBvfdpM0EIlvngQ_A4gMMwxA";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function ensureSupabaseSession() {
  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) throw error;

    if (!session) {
      const { data, error: signInError } = await supabase.auth.signInAnonymously();
      if (signInError) throw signInError;
      return data.session;
    }

    return session;
  } catch (err) {
    console.error("Auth failed:", err);
    return null;
  }
}
