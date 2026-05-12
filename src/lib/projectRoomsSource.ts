export type ProjectRoomSourceConfidence =
  | "active_evidence_partial"
  | "canonical_locked"
  | "active_later_evidence_partial"
  | "parked_evidence_partial"
  | "dead_archive";

export type ProjectRoomSourceRecord = {
  key: string;
  name: string;
  detail: string;
  status: string;
  evidenceTitle: string;
  evidenceDriveId: string;
  sourceConfidence: ProjectRoomSourceConfidence;
  unresolvedGate: string;
  noStandaloneRoomNotes: string;
};

export const PROJECT_ROOM_SOURCE_RECORDS: ProjectRoomSourceRecord[] = [
  {
    key: "casevoice-mystatement",
    name: "CASEVOICE / MyStatement Cluster",
    detail: "Report workflow cluster. MyStatement and H.A.V.E.N. stay together.",
    status: "ACTIVE",
    evidenceTitle: "MYSTATEMENT SOURCE AUTHORITY CHECK v0.1 READ ONLY",
    evidenceDriveId: "173GQRuldWaSuVfWgi3aPD2T-lpsDwzExdOaOyH-EA6g",
    sourceConfidence: "active_evidence_partial",
    unresolvedGate: "GitHub-to-ZIP key-file hash comparison and runtime verification remain open.",
    noStandaloneRoomNotes: "No standalone H.A.V.E.N. room. H.A.V.E.N. stays inside the report workflow cluster.",
  },
  {
    key: "meeting-founder-crm",
    name: "MEETING / Founder CRM Source Room",
    detail: "Primary CRM source room. GitHub and Drive snapshot match.",
    status: "CANONICAL LOCKED",
    evidenceTitle: "MEETING SOURCE AUTHORITY CHECK v0.1 READ ONLY",
    evidenceDriveId: "1ClQbj0ty6e7vqrwYZ3cKx_IIqeKgkdbH8gPKIYPO_cE",
    sourceConfidence: "canonical_locked",
    unresolvedGate: "No runtime or deployment verification for this local CASEVOICE build in this audit.",
    noStandaloneRoomNotes: "Use as CRM source reference. Local Project Rooms patches are not GitHub-published yet.",
  },
  {
    key: "casevoice-site",
    name: "CASEVOICE Site Room",
    detail: "Static public site source. Exact Drive ZIP and GitHub match confirmed.",
    status: "CANONICAL LOCKED",
    evidenceTitle: "CASEVOICE SITE SOURCE AUTHORITY CHECK v0.1 READ ONLY",
    evidenceDriveId: "1wN-7Elcrhyuwl8mweFCjanjAaA8rRgjNjuOObgUOFZI",
    sourceConfidence: "canonical_locked",
    unresolvedGate: "Deployment and domain review were not completed in this session.",
    noStandaloneRoomNotes: "Static HTML only. Do not treat this as an npm or Vite app.",
  },
  {
    key: "my420journal",
    name: "my420journal / Cannabis Journal Cluster",
    detail: "Local-first direction rescued. Runtime and legal gates remain.",
    status: "ACTIVE LATER",
    evidenceTitle: "MY420JOURNAL SOURCE ZIP LOCAL-FIRST CONFLICT CONFIRMATION v0.1 FINAL EVIDENCE RECORD",
    evidenceDriveId: "1nyMLxjGqcHrXJmjucm4pJFhzBJpbHy27hEE3WF_yIek",
    sourceConfidence: "active_later_evidence_partial",
    unresolvedGate: "Fresh build, browser network check, persistence test, site-data wipe, deployment verification, and counsel review remain open.",
    noStandaloneRoomNotes: "Local-first founder lock applies here. Do not apply this architecture to MEETING or MyStatement.",
  },
  {
    key: "dnd-ttrpg",
    name: "DND / TTRPG Room",
    detail: "Card-generation prototype. Parked unless explicitly reopened.",
    status: "PARKED",
    evidenceTitle: "DND SOURCE AUTHORITY CHECK v0.1 READ ONLY",
    evidenceDriveId: "1Jol11YzhurqlZL7pR2aHJGKpXnmcVWNztHkEPC0jges",
    sourceConfidence: "parked_evidence_partial",
    unresolvedGate: "GitHub-to-ZIP exact equality is not fully proven because private repo download was blocked.",
    noStandaloneRoomNotes: "Do not mark canonical locked. Drive duplicate cleanup remains optional and requires explicit approval.",
  },
  {
    key: "shiftsync",
    name: "ShiftSync",
    detail: "Cancelled project. Archive only unless explicitly reopened.",
    status: "DEAD / ARCHIVE",
    evidenceTitle: "VOGTCOM SOURCE AUTHORITY MAP v0.6 GITHUB ZIP SET PASS",
    evidenceDriveId: "1f6bD7vw_7E93TB0BbqADImQVAjSeMA41KPagdkVloqw",
    sourceConfidence: "dead_archive",
    unresolvedGate: "Internal ZIP contents were not inspected because the founder confirmed the project is dead.",
    noStandaloneRoomNotes: "Do not create active work for ShiftSync unless the founder explicitly reopens it.",
  },
];

export const PROJECT_ROOM_SOURCE_NOTE =
  "Read-only evidence-backed source contract. No actions, writes, runtime fetches, or database calls.";

export const PROJECT_ROOM_SOURCE_EXCLUSIONS = [
  "No standalone H.A.V.E.N. room.",
  "No Honey Sales room until the founder defines it.",
  "No case-trifold room until the founder reopens it.",
  "No generic Admin, Creative, Research, or Future Projects rooms.",
];

