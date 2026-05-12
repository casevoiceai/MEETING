import { supabase } from "./supabase";
import {
  validateTeamMemberDraftWithMeaningGate,
  type TeamMemberDraftQueueItem,
} from "./teamMemberDraftContract";

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

  risk_level?: string | null;
  fire_level?: string | null;
  workflow_status?: string | null;
  rollback_path?: string | null;
  verification_plan?: string | null;
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
  throw new Error("Boys Queue is locked in read-only safe mode. Approval writes are disabled.");
}

export async function kickBackQueueItem(id: string, note: string): Promise<void> {
  throw new Error("Boys Queue is locked in read-only safe mode. Kickback writes are disabled.");
}

export async function addQueueItem(
  item: Pick<BoysQueueItem, "item_type" | "boy_name" | "content">
): Promise<BoysQueueItem> {
  throw new Error("Boys Queue is locked in read-only safe mode. Queue creation writes are disabled.");
}


export type TeamMemberDraftQueueInsertShape = Pick<
  BoysQueueItem,
  | "item_type"
  | "boy_name"
  | "content"
  | "status"
  | "kickback_note"
  | "risk_level"
  | "fire_level"
  | "workflow_status"
  | "rollback_path"
  | "verification_plan"
>;

export function prepareTeamMemberDraftQueueInsert(
  draft: TeamMemberDraftQueueItem
): TeamMemberDraftQueueInsertShape {
  const validation = validateTeamMemberDraftWithMeaningGate(draft);

  if (!validation.valid) {
    const details =
      Array.isArray((validation as any).errors) && (validation as any).errors.length > 0
        ? (validation as any).errors.join("; ")
        : (validation as any).reason || "Meaning Gate validation failed.";

    throw new Error(`Team Member draft failed Meaning Gate: ${details}`);
  }

  return {
    item_type: draft.item_type,
    boy_name: draft.boy_name,
    content: draft.content,
    status: "pending",
    kickback_note: null,
    risk_level: draft.risk_level,
    fire_level: draft.fire_level,
    workflow_status: draft.workflow_status,
    rollback_path: draft.rollback_path,
    verification_plan: draft.verification_plan,
  };
}

export async function createTeamMemberDraftQueueItem(
  draft: TeamMemberDraftQueueItem
): Promise<BoysQueueItem> {
  prepareTeamMemberDraftQueueInsert(draft);
  throw new Error("Boys Queue is locked in read-only safe mode. Team Member draft queue writes are disabled.");
}
export async function getPendingQueueCount(): Promise<number> {
  const { count, error } = await supabase
    .from("boys_queue")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) return 0;
  return count ?? 0;
}


/* ===== Stage 7: Meaning helpers (no side effects) ===== */

export function getRiskMeaning(risk_level?: string) {
  switch ((risk_level || "").toLowerCase()) {
    case "low": return "Low risk. Safe to review with minimal concern.";
    case "medium": return "Moderate risk. Review carefully before approval.";
    case "high": return "High risk. Requires strong verification before approval.";
    default: return "Risk level not specified.";
  }
}

export function getFireMeaning(fire_level?: string) {
  switch ((fire_level || "").toLowerCase()) {
    case "cold": return "No urgency. Can be scheduled.";
    case "warm": return "Moderate urgency. Address soon.";
    case "hot": return "High urgency. Prioritize review.";
    default: return "Fire level not specified.";
  }
}

export function getWorkflowMeaning(workflow_status?: string) {
  if (!workflow_status) return "Workflow status not defined.";
  return "Workflow: " + workflow_status + ". Ensure steps are complete before approval.";
}

export function getVerificationMeaning(verification_plan?: string) {
  if (!verification_plan) return "No verification plan. Add steps to confirm success.";
  return "Verification plan present. Follow steps after approval.";
}

export function getRollbackMeaning(rollback_path?: string) {
  if (!rollback_path) return "No rollback defined. Risk of no recovery.";
  return "Rollback path present. Recovery is possible if needed.";
}

export function getSafetySummary(item: any) {
  const parts = [];

  parts.push(getRiskMeaning(item?.risk_level));
  parts.push(getFireMeaning(item?.fire_level));
  parts.push(getWorkflowMeaning(item?.workflow_status));
  parts.push(getVerificationMeaning(item?.verification_plan));
  parts.push(getRollbackMeaning(item?.rollback_path));

  return parts.join(" ");
}


/* ===== Stage 8: Routing helpers (no side effects) ===== */

export type QueueRoute = "ESCALATE" | "REVIEW" | "HOLD" | "QUEUE";

export function getQueueRoute(item: any): QueueRoute {
  const missingSafety =
    !item?.risk_level ||
    !item?.fire_level ||
    !item?.workflow_status ||
    !item?.rollback_path ||
    !item?.verification_plan;

  if (missingSafety) return "HOLD";

  const risk = String(item?.risk_level || "").toLowerCase();
  const fire = String(item?.fire_level || "").toLowerCase();

  if (risk === "high" || fire === "hot" || fire === "critical") {
    return "ESCALATE";
  }

  if (risk === "medium" || fire === "warm") {
    return "REVIEW";
  }

  return "QUEUE";
}

export function getQueueRouteMeaning(route: QueueRoute): string {
  switch (route) {
    case "ESCALATE":
      return "Escalate before approval. This item needs founder attention.";
    case "REVIEW":
      return "Review carefully before approval.";
    case "HOLD":
      return "Hold until all safety fields are complete.";
    case "QUEUE":
      return "Safe to keep in normal approval queue.";
    default:
      return "Route unavailable.";
  }
}




