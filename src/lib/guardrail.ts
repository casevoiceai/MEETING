import { supabase } from "./supabase";

export type GuardrailRisk = "high" | "medium" | "low";

export interface GuardrailConfig {
  actionType: string;
  risk: GuardrailRisk;
  title: string;
  consequence: string;
  requireTypedConfirmation: boolean;
  typedConfirmationWord?: string;
  requireBackupConfirmation: boolean;
  targetId: string;
  targetLabel: string;
  snapshotData?: Record<string, unknown>;
}

export interface SnapshotRecord {
  id: string;
  action_type: string;
  target_id: string;
  target_label: string;
  confirmation_text: string;
  backup_confirmed: boolean;
  snapshot_data: Record<string, unknown>;
  confirmed_at: string;
}

export async function saveSnapshot(config: {
  actionType: string;
  targetId: string;
  targetLabel: string;
  confirmationText: string;
  backupConfirmed: boolean;
  snapshotData?: Record<string, unknown>;
}): Promise<void> {
  await supabase.from("action_snapshots").insert({
    action_type: config.actionType,
    target_id: config.targetId,
    target_label: config.targetLabel,
    confirmation_text: config.confirmationText,
    backup_confirmed: config.backupConfirmed,
    snapshot_data: config.snapshotData ?? {},
  });
}

export function getRiskColors(risk: GuardrailRisk): { color: string; bg: string; border: string; buttonBg: string } {
  switch (risk) {
    case "high":
      return { color: "#F87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.3)", buttonBg: "#DC2626" };
    case "medium":
      return { color: "#F59E0B", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.3)", buttonBg: "#B45309" };
    case "low":
      return { color: "#60A5FA", bg: "rgba(96,165,250,0.08)", border: "rgba(96,165,250,0.25)", buttonBg: "#2563EB" };
  }
}

export function getRiskLabel(risk: GuardrailRisk): string {
  switch (risk) {
    case "high":   return "High Risk";
    case "medium": return "Medium Risk";
    case "low":    return "Low Risk";
  }
}

export function getDefaultConfirmWord(actionType: string): string {
  if (actionType.includes("delete")) return "DELETE";
  if (actionType.includes("archive")) return "ARCHIVE";
  if (actionType.includes("move")) return "MOVE";
  if (actionType.includes("overwrite")) return "OVERWRITE";
  return "CONFIRM";
}
