import { createClient } from '@supabase/supabase-js';

/**
 * HARD-CODED RECOVERY: 
 * We are bypassing environment variables temporarily to fix the 'Invalid value' crash.
 */
const RECOVERY_URL = 'https://lzkiwsqezugptwugcehg.supabase.co';
const RECOVERY_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6a2l3c3FlenVncHR3dWdjZWhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTI5ODgyMTAsImV4cCI6MjAyODU2NDIxMH0.8-X6Xq6X6X6X6X6X6X6X6X6X6X6X6X6X6X6X6X6X6X6'; 
// Note: Use your actual 'anon' 'public' key from Supabase here.

export const supabase = createClient(RECOVERY_URL, RECOVERY_KEY);

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
    console.error("Auth initialization failed:", err);
    return null;
  }
}
