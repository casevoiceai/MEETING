import { validateTeamMemberOutput } from "./boysQueue";
import type { TeamMemberName } from "./teamMembers";

export const TEAM_MEMBER_DRAFT_RISK_LEVELS = ["low", "medium", "high"] as const;
export const TEAM_MEMBER_DRAFT_FIRE_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const TEAM_MEMBER_DRAFT_WORKFLOW_STATUSES = ["HOLD", "REVIEW", "DRAFT ONLY", "QUEUE PREVIEW ONLY"] as const;

export type TeamMemberDraftRiskLevel = (typeof TEAM_MEMBER_DRAFT_RISK_LEVELS)[number];
export type TeamMemberDraftFireLevel = (typeof TEAM_MEMBER_DRAFT_FIRE_LEVELS)[number];
export type TeamMemberDraftWorkflowStatus = (typeof TEAM_MEMBER_DRAFT_WORKFLOW_STATUSES)[number];

export interface TeamMemberDraftQueueItem {
  item_type: "team_member_draft";
  boy_name: TeamMemberName;
  content: string;
  risk_level: TeamMemberDraftRiskLevel;
  fire_level: TeamMemberDraftFireLevel;
  workflow_status: TeamMemberDraftWorkflowStatus;
  rollback_path: string;
  verification_plan: string;
}

export interface TeamMemberDraftValidationResult {
  valid: boolean;
  errors: string[];
}

const MIN_CONTENT_LENGTH = 80;
const MIN_ROLLBACK_LENGTH = 20;
const MIN_VERIFICATION_LENGTH = 20;

function isAllowedValue<T extends readonly string[]>(value: unknown, allowedValues: T): value is T[number] {
  return typeof value === "string" && allowedValues.includes(value);
}

function hasMinimumText(value: unknown, minimumLength: number): boolean {
  return typeof value === "string" && value.trim().length >= minimumLength;
}

export function validateTeamMemberDraftQueueItem(
  draft: Partial<TeamMemberDraftQueueItem>
): TeamMemberDraftValidationResult {
  const errors: string[] = [];

  if (draft.item_type !== "team_member_draft") {
    errors.push('item_type must be "team_member_draft".');
  }

  if (!draft.boy_name) {
    errors.push("boy_name is required.");
  }

  if (!hasMinimumText(draft.content, MIN_CONTENT_LENGTH)) {
    errors.push("content must contain a useful draft with at least 80 characters.");
  }

  if (!isAllowedValue(draft.risk_level, TEAM_MEMBER_DRAFT_RISK_LEVELS)) {
    errors.push("risk_level must be low, medium, or high.");
  }

  if (!isAllowedValue(draft.fire_level, TEAM_MEMBER_DRAFT_FIRE_LEVELS)) {
    errors.push("fire_level must be LOW, MEDIUM, HIGH, or CRITICAL.");
  }

  if (!isAllowedValue(draft.workflow_status, TEAM_MEMBER_DRAFT_WORKFLOW_STATUSES)) {
    errors.push("workflow_status must be HOLD, REVIEW, DRAFT ONLY, or QUEUE PREVIEW ONLY.");
  }

  if (!hasMinimumText(draft.rollback_path, MIN_ROLLBACK_LENGTH)) {
    errors.push("rollback_path must clearly explain how to reverse the proposed work.");
  }

  if (!hasMinimumText(draft.verification_plan, MIN_VERIFICATION_LENGTH)) {
    errors.push("verification_plan must clearly explain how the founder can verify the work.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateTeamMemberDraftWithMeaningGate(
  draft: Partial<TeamMemberDraftQueueItem>
): TeamMemberDraftValidationResult {
  const contractResult = validateTeamMemberDraftQueueItem(draft);
  const meaningResult = validateTeamMemberOutput(draft.content || "");
  const errors = [...contractResult.errors];

  if (!meaningResult.valid) {
    errors.push(meaningResult.reason || "Meaning Gate failed.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
