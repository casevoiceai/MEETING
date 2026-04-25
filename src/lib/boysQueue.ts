import { supabase } from "./supabase";

export type QueueStatus = "pending" | "approved" | "kicked_back";

const VALID_FIRE_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const REQUIRED_SECTIONS = ["ISSUE:", "RECOMMENDED FIX:", "QUESTIONS FOR FOUNDER:", "FIRE LEVEL:"] as const;
const MIN_CONTENT_LENGTH = 80;

export interface MeaningGateResult {
  valid: boolean;
  reason?: string;
}

export function validateTeamMemberOutput(content: string): MeaningGateResult {
  if (!content || content.trim().length < MIN_CONTENT_LENGTH) {
    return { valid: false, reason: "Output is too short or empty to be trusted." };
  }

  for (const section of REQUIRED_SECTIONS) {
    if (!content.includes(section)) {
      return { valid: false, reason: `Missing required section: ${section}` };
    }
  }

  const fireLevelMatch = content.match(/FIRE LEVEL:\s*([A-Z]+)/);
  if (!fireLevelMatch) {
    return { valid: false, reason: "FIRE LEVEL value is missing or unreadable." };
  }
  const level = fireLevelMatch[1].trim() as string;
  if (!(VALID_FIRE_LEVELS as readonly string[]).includes(level)) {
    return { valid: false, reason: `Invalid FIRE LEVEL "${level}". Must be LOW, MEDIUM, HIGH, or CRITICAL.` };
  }

  return { valid: true };
}

export interface BoysQueueItem {
  id: string;
  item_type: string;
  boy_name: string;
  content: string;
  status: QueueStatus;
  kickback_note: string | null;
  created_at: string;
  updated_at: string;
}

export async function listPendingQueueItems(): Promise<BoysQueueItem[]> {
  const { data, error } = await supabase
    .from("boys_queue")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BoysQueueItem[];
}

export async function listAllQueueItems(limit = 50): Promise<BoysQueueItem[]> {
  const { data, error } = await supabase
    .from("boys_queue")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as BoysQueueItem[];
}

export async function approveQueueItem(id: string): Promise<void> {
  const { error } = await supabase
    .from("boys_queue")
    .update({ status: "approved", kickback_note: null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function kickBackQueueItem(id: string, note: string): Promise<void> {
  const { error } = await supabase
    .from("boys_queue")
    .update({ status: "kicked_back", kickback_note: note, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function addQueueItem(
  item: Pick<BoysQueueItem, "item_type" | "boy_name" | "content">
): Promise<BoysQueueItem> {
  const { data, error } = await supabase
    .from("boys_queue")
    .insert({ ...item, status: "pending", updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data as BoysQueueItem;
}

export async function getPendingQueueCount(): Promise<number> {
  const { count, error } = await supabase
    .from("boys_queue")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) return 0;
  return count ?? 0;
}
