import { TEAM_MEMBERS, type TeamMemberName } from "./teamMembers";
import {
  validateTeamMemberDraftWithMeaningGate,
  type TeamMemberDraftFireLevel,
  type TeamMemberDraftQueueItem,
  type TeamMemberDraftRiskLevel,
  type TeamMemberDraftValidationResult,
  type TeamMemberDraftWorkflowStatus,
} from "./teamMemberDraftContract";

export interface TeamMemberDraftGenerationInput {
  boy_name: string;
  issue: string;
  evidence?: string;
  requested_by?: string;
  risk_level?: TeamMemberDraftRiskLevel;
  fire_level?: TeamMemberDraftFireLevel;
  workflow_status?: TeamMemberDraftWorkflowStatus;
  rollback_path?: string;
  verification_plan?: string;
}

export interface TeamMemberDraftGenerationResult extends TeamMemberDraftValidationResult {
  draft: TeamMemberDraftQueueItem | null;
}

const DEFAULT_RISK_LEVEL: TeamMemberDraftRiskLevel = "medium";
const DEFAULT_FIRE_LEVEL: TeamMemberDraftFireLevel = "MEDIUM";
const DEFAULT_WORKFLOW_STATUS: TeamMemberDraftWorkflowStatus = "DRAFT ONLY";

const DEFAULT_ROLLBACK_PATH =
  "Do not apply changes. Return to the last verified hard save before any future implementation work.";

const DEFAULT_VERIFICATION_PLAN =
  "Founder reviews the draft, confirms the affected file or room, runs the build, and verifies the expected screen behavior.";

export function isTeamMemberName(value: unknown): value is TeamMemberName {
  return typeof value === "string" && (TEAM_MEMBERS as readonly string[]).includes(value);
}

function cleanMultilineText(value: unknown): string {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function fallbackText(value: unknown, fallback: string): string {
  const cleaned = cleanMultilineText(value);
  return cleaned.length > 0 ? cleaned : fallback;
}

export function createTeamMemberDraft(
  input: TeamMemberDraftGenerationInput
): TeamMemberDraftGenerationResult {
  if (!isTeamMemberName(input.boy_name)) {
    return {
      draft: null,
      valid: false,
      errors: [`Unknown Team Member: ${input.boy_name || "missing"}.`],
    };
  }

  const issue = fallbackText(input.issue, "No issue provided. Hold until the founder defines the request.");
  const evidence = fallbackText(input.evidence, "No evidence provided. Hold until readable evidence is attached.");
  const requestedBy = fallbackText(input.requested_by, "Founder");

  const riskLevel = input.risk_level || DEFAULT_RISK_LEVEL;
  const fireLevel = input.fire_level || DEFAULT_FIRE_LEVEL;
  const workflowStatus = input.workflow_status || DEFAULT_WORKFLOW_STATUS;
  const rollbackPath = fallbackText(input.rollback_path, DEFAULT_ROLLBACK_PATH);
  const verificationPlan = fallbackText(input.verification_plan, DEFAULT_VERIFICATION_PLAN);

  const content = [
    "ISSUE:",
    issue,
    "",
    "RECOMMENDED FIX:",
    "Draft only. Prepare a founder-reviewed plan before any code, Drive, queue, or external action is considered.",
    "",
    "QUESTIONS FOR FOUNDER:",
    "1. Should this remain research-only?",
    "2. Which file, room, or workflow should this affect?",
    "3. What screenshot or report proves success?",
    "",
    `FIRE LEVEL: ${fireLevel}`,
    "",
    "EVIDENCE:",
    evidence,
    "",
    "REQUESTED BY:",
    requestedBy,
    "",
    "ROLLBACK PATH:",
    rollbackPath,
    "",
    "VERIFICATION PLAN:",
    verificationPlan,
  ].join("\n");

  const draft: TeamMemberDraftQueueItem = {
    item_type: "team_member_draft",
    boy_name: input.boy_name,
    content,
    risk_level: riskLevel,
    fire_level: fireLevel,
    workflow_status: workflowStatus,
    rollback_path: rollbackPath,
    verification_plan: verificationPlan,
  };

  const validation = validateTeamMemberDraftWithMeaningGate(draft);

  return {
    draft,
    valid: validation.valid,
    errors: validation.errors,
  };
}
