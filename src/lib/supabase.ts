import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lzkiwsqezugptwugcehg.supabase.co';
const supabaseAnonKey = 'sb_publishable_btVRhvhpBvfdpM0EIlvngQ_A4gMMwxA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
