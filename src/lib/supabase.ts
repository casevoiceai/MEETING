import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lzkiwsqezugptwugcehg.supabase.co';
const supabaseAnonKey = 'sb_publishable_btVRhvhpBvfdpM0EIlvngQ_A4gMMwxA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Adding this back to fix the Vercel Build Error
export async function ensureSupabaseSession() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
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
