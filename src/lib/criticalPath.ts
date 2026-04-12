import { supabase } from "./supabase";

export interface Tier0Item {
  id: string;
  label: string;
  description: string;
  table: string | null;
  category: "knowledge" | "config" | "data" | "rules";
}

export const TIER0_ITEMS: Tier0Item[] = [
  {
    id: "source_of_truth",
    label: "Source of Truth",
    description: "Decision log, architecture rules, and anti-drift grounding record",
    table: "source_of_truth",
    category: "knowledge",
  },
  {
    id: "team_config",
    label: "Team Configuration",
    description: "Mentor roster, roles, departments, and weights",
    table: null,
    category: "config",
  },
  {
    id: "julie_rules",
    label: "Julie Rules",
    description: "Routing logic, carryover behavior, memory and facilitation rules",
    table: "julie_reports",
    category: "rules",
  },
  {
    id: "projects",
    label: "Projects",
    description: "All projects, tasks, and project notes",
    table: "projects",
    category: "data",
  },
  {
    id: "sessions",
    label: "Sessions",
    description: "All meeting sessions, transcripts, and carryover data",
    table: "sessions",
    category: "data",
  },
  {
    id: "side_notes",
    label: "Side Notes",
    description: "Quick notes, tags, and mentor associations",
    table: "side_notes",
    category: "data",
  },
  {
    id: "tags",
    label: "Tags",
    description: "Tag registry with categories and usage counts",
    table: "tag_registry",
    category: "data",
  },
  {
    id: "vault_metadata",
    label: "Vault File Metadata",
    description: "File names, types, summaries, tags, and folder structure",
    table: "vault_files",
    category: "data",
  },
  {
    id: "integration_settings",
    label: "Integration Settings",
    description: "Google Drive and Notion OAuth tokens and configuration",
    table: "integration_settings",
    category: "config",
  },
  {
    id: "approval_rules",
    label: "Approval Rules & Log",
    description: "Approval log and all recorded guardrail decisions",
    table: "approval_log",
    category: "rules",
  },
];

export const CATEGORY_COLORS: Record<Tier0Item["category"], { bg: string; text: string; border: string }> = {
  knowledge: { bg: "rgba(201,168,76,0.08)",  text: "#C9A84C", border: "rgba(201,168,76,0.25)" },
  config:    { bg: "rgba(90,155,211,0.08)",  text: "#5A9BD3", border: "rgba(90,155,211,0.25)" },
  data:      { bg: "rgba(107,175,142,0.08)", text: "#6BAF8E", border: "rgba(107,175,142,0.25)" },
  rules:     { bg: "rgba(224,123,90,0.08)",  text: "#E07B5A", border: "rgba(224,123,90,0.25)" },
};

export interface ChecklistStep {
  id: string;
  label: string;
  description: string;
}

export const CHECKLIST_STEPS: ChecklistStep[] = [
  { id: "exported",       label: "Export Tier 0 Data",        description: "Run the full Tier 0 backup export from the system" },
  { id: "local_drive",    label: "Save to Local Drive",        description: "Download the export file to an encrypted local drive" },
  { id: "external_drive", label: "Copy to External Drive",     description: "Copy backup file to a separate external or cloud drive" },
  { id: "verified",       label: "Verify Files Open",          description: "Open the downloaded file and confirm data is readable" },
  { id: "logged",         label: "Log Backup Completion",      description: "Record this backup run with date in the system" },
];

export interface BackupLog {
  id: string;
  backup_date: string;
  tier: "tier0" | "partial";
  items_exported: string[];
  checklist_steps: Record<string, boolean>;
  notes: string;
  created_at: string;
}

export async function getLastBackupLog(): Promise<BackupLog | null> {
  const { data, error } = await supabase
    .from("backup_logs")
    .select("*")
    .eq("tier", "tier0")
    .order("backup_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as BackupLog | null;
}

export async function getAllBackupLogs(limit = 20): Promise<BackupLog[]> {
  const { data, error } = await supabase
    .from("backup_logs")
    .select("*")
    .order("backup_date", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as BackupLog[];
}

export async function logBackupCompletion(
  steps: Record<string, boolean>,
  itemsExported: string[],
  notes?: string
): Promise<BackupLog> {
  const allDone = CHECKLIST_STEPS.every((s) => steps[s.id]);
  const tier = allDone && itemsExported.length >= TIER0_ITEMS.length * 0.8 ? "tier0" : "partial";

  const { data, error } = await supabase
    .from("backup_logs")
    .insert({
      backup_date: new Date().toISOString(),
      tier,
      items_exported: itemsExported,
      checklist_steps: steps,
      notes: notes ?? "",
    })
    .select()
    .single();

  if (error) throw error;
  return data as BackupLog;
}

export function isBackupOverdue(lastLog: BackupLog | null): boolean {
  if (!lastLog) return true;
  const lastDate = new Date(lastLog.backup_date);
  const now = new Date();
  const diffDays = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays > 7;
}

export function daysSinceBackup(lastLog: BackupLog | null): number | null {
  if (!lastLog) return null;
  const lastDate = new Date(lastLog.backup_date);
  const now = new Date();
  return Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
}
