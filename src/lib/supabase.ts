import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

let signingInPromise: Promise<void> | null = null;

export async function ensureSupabaseSession(): Promise<void> {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  if (data.session) {
    return;
  }

  if (!signingInPromise) {
    signingInPromise = supabase.auth
      .signInAnonymously()
      .then(({ error: signInError }) => {
        if (signInError) {
          throw signInError;
        }
      })
      .finally(() => {
        signingInPromise = null;
      });
  }

  await signingInPromise;
}
