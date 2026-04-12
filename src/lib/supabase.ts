import { createClient } from "@supabase/supabase-js";
import { validateEnv } from "./envGuard";

validateEnv();

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(url, key);
