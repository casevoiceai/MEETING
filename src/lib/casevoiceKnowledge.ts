import knowledgeBase from "../data/casevoiceKnowledgeBase.json";

export const CASEVOICE_MINI_BRAIN = {
  schemaVersion: knowledgeBase.schema_version,
  mode: knowledgeBase.mode,
  currentNorthStar: knowledgeBase.north_star.current,
  immediatePriorityOrder: knowledgeBase.north_star.immediate_priority_order,
  teamMemberMode: knowledgeBase.team_member_boundaries.current_mode,
  nextSafeAction: knowledgeBase.next_safe_action.after_mini_brain_v1,
} as const;

export function getCasevoiceMiniBrain() {
  return CASEVOICE_MINI_BRAIN;
}

export function getCurrentCanonContext(): string {
  return [
    `CURRENT NORTH STAR: ${knowledgeBase.north_star.current}`,
    "IMMEDIATE PRIORITIES:",
    ...knowledgeBase.north_star.immediate_priority_order.map((item, index) => `${index + 1}. ${item}`),
    "PARKED FOR NOW:",
    ...knowledgeBase.north_star.parked_for_now.map((item) => `- ${item}`),
    `WRITE BOUNDARY: ${knowledgeBase.protected_rules.write_boundary}`,
    `EMAIL BOUNDARY: ${knowledgeBase.protected_rules.email_boundary}`,
    `CANON SOURCE: ${knowledgeBase.protected_rules.north_star_source}`,
  ].join("\n");
}

export function getCasevoiceMiniBrainReceiptLines(): string[] {
  return [
    `Schema: ${CASEVOICE_MINI_BRAIN.schemaVersion}`,
    `Mode: ${CASEVOICE_MINI_BRAIN.mode}`,
    `North Star: ${CASEVOICE_MINI_BRAIN.currentNorthStar}`,
    `Priority 1: ${CASEVOICE_MINI_BRAIN.immediatePriorityOrder[0]}`,
    `Team Member mode: ${CASEVOICE_MINI_BRAIN.teamMemberMode}`,
    `Next safe action: ${CASEVOICE_MINI_BRAIN.nextSafeAction}`,
  ];
}

export function isCasevoiceWriteLocked(actionName: string): boolean {
  const normalized = actionName.trim().toLowerCase();
  return [
    "database write",
    "db write",
    "drive write",
    "drive delete",
    "drive merge",
    "github write",
    "email send",
    "team member execution",
    "autonomous execution",
    "supabase write",
    "approval execution",
  ].some((locked) => normalized.includes(locked));
}
