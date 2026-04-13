import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url) {
  throw new Error("Missing VITE_SUPABASE_URL");
}

if (!key) {
  throw new Error("Missing VITE_SUPABASE_ANON_KEY");
}

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

let signingInPromise: Promise<void> | null = null;

export async function ensureSupabaseSession(): Promise<void> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  if (session) {
    return;
  }

  if (!signingInPromise) {
    signingInPromise = (async () => {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) {
        throw error;
      }
    })().finally(() => {
      signingInPromise = null;
    });
  }

  await signingInPromise;
}
