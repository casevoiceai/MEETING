import { createClient } from '@supabase/supabase-js';

// This bypasses Vercel and forces the app to use the correct key
const supabaseUrl = 'https://lzkiwsqezugptwugcehg.supabase.co';
const supabaseAnonKey = 'sb_publishable_btVRhvhpBvfdpM0EIlvngQ_A4gMMwxA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
