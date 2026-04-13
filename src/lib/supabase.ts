import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("DEBUG: Supabase credentials missing! Check Vercel Env Vars.");
} else {
  console.log("DEBUG: Supabase initialized with URL:", supabaseUrl);
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

export async function ensureSupabaseSession() {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !session) {
    console.log("DEBUG: No session found, attempting anonymous sign-in...");
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.error("DEBUG: Anonymous sign-in failed:", error.message);
      return null;
    }
    return data.session;
  }
  
  return session;
}
