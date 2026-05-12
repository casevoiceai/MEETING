export const CASEVOICE_MINI_BRAIN = {
  schemaVersion: "casevoice-mini-brain-v1",
  mode: "local-read-only",
  currentNorthStar:
    "Build CASEVOICE into a safe local-first command center that can read evidence, understand current project state, route work to Team Members, and keep all execution behind explicit approval gates.",
  immediatePriorityOrder: [
    "Startup Lock and CRM connection integrity",
    "Mini-Brain v1 local read-only truth layer",
    "Team Member Queue autonomy from grounded context",
    "Company Health / ER Monitor truth-only hardening",
    "Conference / Meeting workflow that turns founder intent into scoped work packets",
    "Drive Brain evidence retrieval before answering",
    "Approval-to-execution only after guardrails are ready",
  ],
  teamMemberMode: "read-only / screen-only unless explicitly approved",
  nextSafeAction:
    "Consume Mini-Brain from the safest existing room without touching App.tsx, then use it to ground Team Member discussion/work packets.",
} as const;

export function getCasevoiceMiniBrain() {
  return CASEVOICE_MINI_BRAIN;
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
