import { supabase } from "./supabase";

export type ApprovalStatus =
  | "draft"
  | "suggested"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "completed";

export type ActionType =
  | "email_delete"
  | "email_archive"
  | "email_draft_send"
  | "task_complete"
  | "task_delete"
  | "project_rename"
  | "project_delete"
  | "project_update"
  | "file_delete"
  | "file_move"
  | "notion_sync"
  | "drive_sync_destructive"
  | "session_end_sync"
  | "report_publish"
  | "external_integration"
  | "other";

export interface ApprovalEntry {
  id: string;
  action_type: ActionType;
  status: ApprovalStatus;
  proposed_by: string;
  title: string;
  description: string;
  payload: Record<string, unknown>;
  context: Record<string, unknown>;
  blocked_reason: string;
  approved_at: string | null;
  rejected_at: string | null;
  completed_at: string | null;
  rejection_reason: string;
  session_id: string | null;
  auto_approved: boolean;
  created_at: string;
  updated_at: string;
}

export async function proposeAction(
  entry: Pick<ApprovalEntry, "action_type" | "title" | "description" | "proposed_by"> & {
    payload?: Record<string, unknown>;
    context?: Record<string, unknown>;
    session_id?: string | null;
    status?: ApprovalStatus;
    auto_approved?: boolean;
  }
): Promise<ApprovalEntry> {
  const { data, error } = await supabase
    .from("approval_log")
    .insert({
      action_type: entry.action_type,
      title: entry.title,
      description: entry.description,
      proposed_by: entry.proposed_by,
      payload: entry.payload ?? {},
      context: entry.context ?? {},
      session_id: entry.session_id ?? null,
      status: entry.status ?? "pending_approval",
      auto_approved: entry.auto_approved ?? false,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data as ApprovalEntry;
}

export async function approveAction(id: string): Promise<void> {
  await supabase
    .from("approval_log")
    .update({ status: "approved", approved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);
}

export async function rejectAction(id: string, reason?: string): Promise<void> {
  await supabase
    .from("approval_log")
    .update({
      status: "rejected",
      rejected_at: new Date().toISOString(),
      rejection_reason: reason ?? "Rejected by user",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
}

export async function completeAction(id: string): Promise<void> {
  await supabase
    .from("approval_log")
    .update({ status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);
}

export async function blockAction(id: string, reason: string): Promise<void> {
  await supabase
    .from("approval_log")
    .update({ status: "rejected", blocked_reason: reason, rejected_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);
}

export async function listPendingApprovals(): Promise<ApprovalEntry[]> {
  const { data } = await supabase
    .from("approval_log")
    .select("*")
    .eq("status", "pending_approval")
    .order("created_at", { ascending: false });
  return (data ?? []) as ApprovalEntry[];
}

export async function listApprovalLog(limit = 50): Promise<ApprovalEntry[]> {
  const { data } = await supabase
    .from("approval_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as ApprovalEntry[];
}

export async function getPendingCount(): Promise<number> {
  const { count } = await supabase
    .from("approval_log")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending_approval");
  return count ?? 0;
}

export const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  email_delete: "Delete Email",
  email_archive: "Archive Email",
  email_draft_send: "Send Email Reply",
  task_complete: "Complete Task",
  task_delete: "Delete Task",
  project_rename: "Rename Project",
  project_delete: "Delete Project",
  project_update: "Update Project",
  file_delete: "Delete File",
  file_move: "Move File",
  notion_sync: "Push to Notion",
  drive_sync_destructive: "Drive Destructive Change",
  session_end_sync: "End Session & Sync",
  report_publish: "Publish Report",
  external_integration: "External Integration",
  other: "Other Action",
};

export const ACTION_TYPE_RISK: Record<ActionType, "high" | "medium" | "low"> = {
  email_delete: "high",
  email_archive: "medium",
  email_draft_send: "high",
  task_complete: "low",
  task_delete: "medium",
  project_rename: "low",
  project_delete: "high",
  project_update: "low",
  file_delete: "high",
  file_move: "medium",
  notion_sync: "medium",
  drive_sync_destructive: "high",
  session_end_sync: "low",
  report_publish: "medium",
  external_integration: "medium",
  other: "medium",
};

export const RISK_COLORS = {
  high: { color: "#F87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.25)" },
  medium: { color: "#F59E0B", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.25)" },
  low: { color: "#4ADE80", bg: "rgba(74,222,128,0.06)", border: "rgba(74,222,128,0.2)" },
};
