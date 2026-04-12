export function validateEnv() {
  const url = import.meta.env.VITE_SUPABASE_URL;

  if (!url) {
    throw new Error("Missing VITE_SUPABASE_URL");
  }

  // HARD LOCK: only allow your known project
  if (!url.includes("casevoice") && !url.includes("mystatement")) {
    throw new Error(
      "INVALID SUPABASE PROJECT: This app is trying to connect to an unknown database."
    );
  }

  return true;
}
