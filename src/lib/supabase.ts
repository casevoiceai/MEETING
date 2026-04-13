import { createClient } from '@supabase/supabase-js';

// This version adds a literal fallback to check if variables are actually flowing
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || supabaseUrl.includes('undefined')) {
  console.error("🚨 Vercel URL is still undefined after redeploy!");
}

export const supabase = createClient(
  supabaseUrl || 'https://lzkiwsqezugptwugcehg.supabase.co', 
  supabaseAnonKey || ''
);

export async function ensureSupabaseSession() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      const { data } = await supabase.auth.signInAnonymously();
      return data?.session;
    }
    return session;
  } catch (e) {
    console.error("Auth helper failed", e);
    return null;
  }
}
