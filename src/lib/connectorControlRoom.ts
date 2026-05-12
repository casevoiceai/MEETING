/**
 * CASEVOICE_CONNECTOR_CONTROL_ROOM_CONTRACT_V1
 *
 * Read-only source contract for CASEVOICE local-first connector boundaries.
 *
 * This file intentionally performs:
 * - no network calls
 * - no database calls
 * - no Drive calls
 * - no GitHub calls
 * - no email calls
 * - no execution actions
 */

export type ConnectorExposureLevel =
  | "local"
  | "cloud_read"
  | "cloud_write_locked"
  | "execution_locked";

export type ConnectorWritePolicy =
  | "not_applicable"
  | "locked_until_founder_approval"
  | "draft_only_until_founder_approval"
  | "never_without_explicit_founder_approval";

export interface ConnectorBoundary {
  key: string;
  name: string;
  exposureLevel: ConnectorExposureLevel;
  currentRole: string;
  allowedReads: string[];
  lockedWrites: string[];
  approvalRequiredFor: string[];
  teamMemberAccess: string;
  founderBoundaryNote: string;
  writePolicy: ConnectorWritePolicy;
}

export const CONNECTOR_CONTROL_ROOM_VERSION =
  "CASEVOICE_CONNECTOR_CONTROL_ROOM_CONTRACT_V1";

export const CONNECTOR_CONTROL_ROOM_RULES = {
  localFirstPrinciple:
    "CASEVOICE runs locally as the founder control room. External systems may be read through scoped connector lanes, but external writes require visible founder approval.",
  teamMemberBoundary:
    "Team Members may receive scoped evidence packets and task context. They do not receive broad account access by default.",
  noSilentExternalWrites:
    "No connector may send, delete, push, merge, write, archive, or execute silently.",
  healthBoundary:
    "Health and diagnostics report system truth only. Interpretation and recommendations belong in decision layers.",
  approvalBoundary:
    "Approval gates must be visible, specific, and founder-controlled before any external write or execution action.",
} as const;

export const CONNECTOR_BOUNDARIES: ConnectorBoundary[] = [
  {
    key: "local-crm",
    name: "Local CRM",
    exposureLevel: "local",
    currentRole:
      "Primary local operating room for founder review, evidence display, project context, and decisions.",
    allowedReads: [
      "Read local source files.",
      "Read local UI state.",
      "Read local configuration names without exposing secret values.",
      "Read local source contracts and boundary rules.",
    ],
    lockedWrites: [
      "Do not silently rewrite protected files.",
      "Do not edit App.tsx without explicit approval.",
      "Do not create temp archives without cleanup.",
    ],
    approvalRequiredFor: [
      "Replacing protected source files.",
      "Changing navigation or app shell behavior.",
      "Creating full runtime hard saves.",
    ],
    teamMemberAccess:
      "Team Members may see scoped CRM context selected by the founder or prepared by a safe evidence packet.",
    founderBoundaryNote:
      "The CRM is the control room. It should organize work without becoming a silent executor.",
    writePolicy: "locked_until_founder_approval",
  },
  {
    key: "local-ai",
    name: "Local AI",
    exposureLevel: "local",
    currentRole:
      "Local reasoning and support service for CRM assistance where available.",
    allowedReads: [
      "Read local status endpoint.",
      "Read scoped local CRM context prepared for the request.",
      "Read local evidence packets that were intentionally provided.",
    ],
    lockedWrites: [
      "Do not write CRM source code.",
      "Do not write database records.",
      "Do not call cloud connectors directly.",
    ],
    approvalRequiredFor: [
      "Any action outside local response generation.",
      "Any workflow that would trigger DB, Drive, GitHub, or Email writes.",
    ],
    teamMemberAccess:
      "Team Member use of Local AI must stay scoped to the current task and evidence packet.",
    founderBoundaryNote:
      "Local AI supports reasoning. It is not a broad-access automation agent.",
    writePolicy: "not_applicable",
  },
  {
    key: "google-drive",
    name: "Google Drive",
    exposureLevel: "cloud_read",
    currentRole:
      "Evidence source for files, reports, project context, and readable document previews.",
    allowedReads: [
      "List scoped Drive files when requested.",
      "Read file metadata.",
      "Read file content by Drive file ID for evidence preview.",
      "Use readable text for founder-visible evidence review.",
    ],
    lockedWrites: [
      "Do not delete Drive files.",
      "Do not overwrite Drive files.",
      "Do not move Drive files.",
      "Do not create reports unless the founder asks for a report.",
    ],
    approvalRequiredFor: [
      "Creating a Google Doc report.",
      "Renaming Drive files.",
      "Moving Drive files.",
      "Deleting Drive files.",
      "Changing Drive permissions.",
    ],
    teamMemberAccess:
      "Team Members may receive quoted or summarized Drive evidence. They should not receive broad Drive access.",
    founderBoundaryNote:
      "Drive is an evidence library. Reads are useful. Writes must stay explicit.",
    writePolicy: "never_without_explicit_founder_approval",
  },
  {
    key: "github",
    name: "GitHub",
    exposureLevel: "cloud_read",
    currentRole:
      "Repository, issue, pull request, and code comparison lane for app-building work.",
    allowedReads: [
      "List accessible repositories.",
      "Read repository metadata.",
      "Read files, commits, branches, issues, and pull requests.",
      "Compare local source identity against repository identity.",
    ],
    lockedWrites: [
      "Do not push commits.",
      "Do not create or update files.",
      "Do not create pull requests.",
      "Do not merge pull requests.",
      "Do not reconnect a local folder to a repository until identity is confirmed.",
    ],
    approvalRequiredFor: [
      "git init.",
      "Adding a remote.",
      "Creating a branch.",
      "Committing.",
      "Pushing.",
      "Opening a pull request.",
      "Merging.",
    ],
    teamMemberAccess:
      "Team Members may inspect scoped repo evidence and propose plans. They do not get automatic write authority.",
    founderBoundaryNote:
      "GitHub should be integrated as a controlled build lane, not as a silent publish path.",
    writePolicy: "never_without_explicit_founder_approval",
  },
  {
    key: "email",
    name: "Email",
    exposureLevel: "cloud_read",
    currentRole:
      "Communication context lane for relevant threads, outreach, approvals, and drafts.",
    allowedReads: [
      "Search relevant messages.",
      "Read selected threads.",
      "Read attachments only when needed for the current task.",
      "Use email context to draft founder-reviewed replies.",
    ],
    lockedWrites: [
      "Do not send emails.",
      "Do not delete emails.",
      "Do not archive emails.",
      "Do not forward emails.",
      "Do not label or modify email state without approval.",
    ],
    approvalRequiredFor: [
      "Sending an email.",
      "Forwarding an email.",
      "Archiving email.",
      "Deleting email.",
      "Creating or changing labels.",
      "Sending a saved draft.",
    ],
    teamMemberAccess:
      "Team Members may receive summarized email context only when it is relevant and scoped.",
    founderBoundaryNote:
      "Email is sensitive. Default behavior is read and draft, not send.",
    writePolicy: "draft_only_until_founder_approval",
  },
  {
    key: "supabase",
    name: "Supabase",
    exposureLevel: "cloud_write_locked",
    currentRole:
      "Cloud app-state layer for CRM records, file metadata, queue records, and Edge Function routes.",
    allowedReads: [
      "Read app state needed for CRM screens.",
      "Read file metadata records.",
      "Read queue state.",
      "Read health state.",
    ],
    lockedWrites: [
      "Do not insert queue records without a current approved workflow.",
      "Do not update records silently.",
      "Do not delete records casually.",
      "Do not run migrations without explicit approval.",
    ],
    approvalRequiredFor: [
      "Database inserts.",
      "Database updates.",
      "Database deletes.",
      "Schema migrations.",
      "Edge Function deployment.",
      "Queue writes.",
    ],
    teamMemberAccess:
      "Team Members may receive scoped DB-derived context. They do not receive broad database authority.",
    founderBoundaryNote:
      "Supabase is useful, but it is cloud state. Writes must be gated and visible.",
    writePolicy: "locked_until_founder_approval",
  },
  {
    key: "team-members",
    name: "Team Members",
    exposureLevel: "execution_locked",
    currentRole:
      "AI work-planning layer for drafts, recommendations, QA, and founder approval preparation.",
    allowedReads: [
      "Read scoped evidence packets.",
      "Read task-specific project context.",
      "Read founder-provided instructions.",
      "Read safe source contracts.",
    ],
    lockedWrites: [
      "Do not execute code changes directly.",
      "Do not approve queue items.",
      "Do not kick back queue items.",
      "Do not call run-team-member automatically.",
      "Do not access broad GitHub, Email, Drive, or Supabase context by default.",
    ],
    approvalRequiredFor: [
      "Creating real queue records.",
      "Running a Team Member function.",
      "Sending work outside the CRM.",
      "Applying a recommendation.",
      "Executing any external write.",
    ],
    teamMemberAccess:
      "Team Members operate from scoped packets, not whole-account access.",
    founderBoundaryNote:
      "Team Members should help think and prepare. Founder approval remains the gate.",
    writePolicy: "never_without_explicit_founder_approval",
  },
];

export const CONNECTOR_CONTROL_ROOM_SUMMARY = {
  safeNow: [
    "Local CRM can display connector boundaries.",
    "Drive evidence can be read on demand in VAULT.",
    "Local AI and frontend can run locally.",
    "Connector status can be shown read-only.",
  ],
  holdUntilApproved: [
    "GitHub reconnect, commit, push, or pull request.",
    "Email send, archive, delete, or forward.",
    "Drive delete, move, overwrite, or permission change.",
    "Supabase migrations or queue writes.",
    "Team Member execution paths.",
  ],
  nextSafeUiMove:
    "Display this contract in a read-only Connector Control Room before enabling any connector writes.",
} as const;
