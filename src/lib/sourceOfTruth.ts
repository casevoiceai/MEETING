import { supabase } from "./supabase";

export type EntryType = "decision" | "rule" | "architecture" | "constraint";

export interface SourceOfTruthEntry {
  id: string;
  entry_date: string;
  decision_title: string;
  summary: string;
  affected_systems: string[];
  approved_by_user: boolean;
  entry_type: EntryType;
  session_key: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface NewSourceOfTruthEntry {
  decision_title: string;
  summary: string;
  affected_systems: string[];
  approved_by_user?: boolean;
  entry_type: EntryType;
  session_key?: string | null;
  tags?: string[];
  entry_date?: string;
}

export async function appendToSourceOfTruth(entry: NewSourceOfTruthEntry): Promise<SourceOfTruthEntry> {
  const { data, error } = await supabase
    .from("source_of_truth")
    .insert({
      decision_title: entry.decision_title,
      summary: entry.summary,
      affected_systems: entry.affected_systems,
      approved_by_user: entry.approved_by_user ?? false,
      entry_type: entry.entry_type,
      session_key: entry.session_key ?? null,
      tags: entry.tags ?? [],
      entry_date: entry.entry_date ?? new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data as SourceOfTruthEntry;
}

export async function readSourceOfTruth(limit = 100): Promise<SourceOfTruthEntry[]> {
  const { data, error } = await supabase
    .from("source_of_truth")
    .select("*")
    .order("entry_date", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as SourceOfTruthEntry[];
}

export async function readSourceOfTruthByType(type: EntryType): Promise<SourceOfTruthEntry[]> {
  const { data, error } = await supabase
    .from("source_of_truth")
    .select("*")
    .eq("entry_type", type)
    .order("entry_date", { ascending: false });

  if (error) throw error;
  return (data ?? []) as SourceOfTruthEntry[];
}

export async function markApproved(id: string): Promise<void> {
  const { error } = await supabase
    .from("source_of_truth")
    .update({ approved_by_user: true, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

export function formatSourceOfTruthForJulie(entries: SourceOfTruthEntry[]): string {
  if (entries.length === 0) return "No entries in Source of Truth yet.";

  const lines: string[] = [
    "=== SOURCE OF TRUTH (Anti-Drift Grounding Record) ===",
    "",
  ];

  for (const e of entries) {
    const date = new Date(e.entry_date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    const approved = e.approved_by_user ? "[USER APPROVED]" : "[SYSTEM LOGGED]";
    lines.push(`[${date}] ${e.entry_type.toUpperCase()}: ${e.decision_title} ${approved}`);
    lines.push(`  Summary: ${e.summary}`);
    if (e.affected_systems.length > 0) {
      lines.push(`  Affects: ${e.affected_systems.join(", ")}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function detectConflicts(
  proposedTitle: string,
  proposedSummary: string,
  existingEntries: SourceOfTruthEntry[]
): SourceOfTruthEntry[] {
  const proposedText = `${proposedTitle} ${proposedSummary}`.toLowerCase();
  const proposedWords = proposedText.split(/\s+/).filter((w) => w.length > 4);

  return existingEntries.filter((entry) => {
    const entryText = `${entry.decision_title} ${entry.summary}`.toLowerCase();
    const matchCount = proposedWords.filter((w) => entryText.includes(w)).length;
    return matchCount >= 3;
  });
}
