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

const CURRENT_NORTH_STAR_TITLE = "VOGTCOM CANON NORTH STAR - NEXT 90 DAYS - CURRENT";
const CURRENT_NORTH_STAR_ID = "1yv2FKe_9dRcrfFN6DRt9PY8kikKrdu8Y5aK-pJcjEso";

export const PROJECT_ROOM_SOURCE_RECORDS: ProjectRoomSourceRecord[] = [
  {
    key: "casevoice-mystatement",
    name: "CASEVOICE / My Written Statement",
    detail: "Primary commercial business and first claim on Vogtcom time, money, legal work, testing, outreach, sales, PR, support, and evidence-driven improvements. The current My Written Statement app uses the local deterministic Statement Guide.",
    status: "KING / COUNSEL-GATED",
    evidenceTitle: CURRENT_NORTH_STAR_TITLE,
    evidenceDriveId: CURRENT_NORTH_STAR_ID,
    sourceConfidence: "active_evidence_partial",
    unresolvedGate: "Current CASE gate: 94 PASS / 0 OPEN / 3 BLOCKED. The remaining three items require qualified-counsel classification. No target-organization outreach until the counsel gate is explicitly green.",
    noStandaloneRoomNotes: "No standalone H.A.V.E.N. runtime room. H.A.V.E.N. is not the current My Written Statement runtime architecture.",
  },
  {
    key: "meeting-founder-crm",
    name: "MEETING / Founder CRM Source Room",
    detail: "Founder operating system and source-truth support room. It supports the North Star; it does not choose company priority or become another project.",
    status: "CANONICAL LOCKED / SUPPORT",
    evidenceTitle: "MEETING SOURCE AUTHORITY CHECK v0.1 READ ONLY",
    evidenceDriveId: "1ClQbj0ty6e7vqrwYZ3cKx_IIqeKgkdbH8gPKIYPO_cE",
    sourceConfidence: "canonical_locked",
    unresolvedGate: "Keep the CRM aligned to current Drive controls. Surface visible progress, a few side quests, and structured idea hypotheses without creating a new dashboard or workstream.",
    noStandaloneRoomNotes: "CRM source authority is separate from business priority. The Sep 1 North Star controls company direction.",
  },
  {
    key: "casevoice-site",
    name: "CASEVOICE Site Room",
    detail: "Supporting public/B2B site source for the primary CASE commercial lane.",
    status: "SUPPORTING / OUTREACH-GATED",
    evidenceTitle: "CASEVOICE SITE SOURCE AUTHORITY CHECK v0.1 READ ONLY",
    evidenceDriveId: "1wN-7Elcrhyuwl8mweFCjanjAaA8rRgjNjuOObgUOFZI",
    sourceConfidence: "canonical_locked",
    unresolvedGate: "Do not use the site to begin target-organization outreach until the CASE counsel gate is green. Outreach clearance does not automatically clear a live pilot.",
    noStandaloneRoomNotes: "Static site support only. CASE product and legal gate truth come from the current CASE controls.",
  },
  {
    key: "astrobehr",
    name: "AstroBehr",
    detail: "Protected creator/content/community/commerce/IP lane and the only active bucket beside CASE. One protected Studio Day; one Astro lane worked deeply at a time.",
    status: "ACTIVE / BOUNDED",
    evidenceTitle: CURRENT_NORTH_STAR_TITLE,
    evidenceDriveId: CURRENT_NORTH_STAR_ID,
    sourceConfidence: "active_evidence_partial",
    unresolvedGate: "Do not let Astro become a second software company or steal CASE priority. Each Studio Day should make, record, publish, and preserve reusable output.",
    noStandaloneRoomNotes: "GutHub, Let Him Cook!, WAH Farm, creator content, and related reusable IP stay inside this bounded creator ecosystem.",
  },
  {
    key: "guthub",
    name: "GutHub / AstroBehr",
    detail: "Existing AstroBehr community/content sub-brand and member system. It is not Vogtcom Priority #1 and is not a standalone software company.",
    status: "ACTIVE ASTRO SUB-BRAND",
    evidenceTitle: CURRENT_NORTH_STAR_TITLE,
    evidenceDriveId: CURRENT_NORTH_STAR_ID,
    sourceConfidence: "active_evidence_partial",
    unresolvedGate: "Use the existing system. Address verified safety/legal/acceptance blockers only when GutHub is the selected Astro Studio-Day lane and before any affected real-user/public use.",
    noStandaloneRoomNotes: "Public GutHub content belongs under AstroBehr.com. guthub.club remains a private/member-newsletter asset, not the public destination.",
  },
  {
    key: "wah-farm",
    name: "WAH Farm / AstroBehr",
    detail: "Tiny bounded Astro commerce/content lane. Six-product line is locked: lip balm, hand balm, beard balm, lotion bars, lotion-bar bits, and honey balls with tea bags.",
    status: "WAITING CTTC / BOUNDED",
    evidenceTitle: CURRENT_NORTH_STAR_TITLE,
    evidenceDriveId: CURRENT_NORTH_STAR_ID,
    sourceConfidence: "active_evidence_partial",
    unresolvedGate: "Wait for CTTC response/classification before actual regulated-product sales execution. Do not expand the catalog or build extra retail infrastructure while waiting.",
    noStandaloneRoomNotes: "The honey-ball gift vessel is a vintage clear glass coffee cup only. WAH is not a standalone startup or revival of the old farmers-market cash-engine plan.",
  },
  {
    key: "mytravbot",
    name: "MyTravBot",
    detail: "Preserved future software candidate and existing Astro field/content tool. The product is parked as active development.",
    status: "PARKED",
    evidenceTitle: CURRENT_NORTH_STAR_TITLE,
    evidenceDriveId: CURRENT_NORTH_STAR_ID,
    sourceConfidence: "parked_evidence_partial",
    unresolvedGate: "Do not code, redesign, merge preserved feature PRs, or restart the roadmap. Review only after meaningful CASE revenue or the six-month review trigger; review is not automatic restart.",
    noStandaloneRoomNotes: "Astro may use the existing app naturally for IRL/travel content without fixing or expanding it.",
  },
  {
    key: "my420journal",
    name: "my420journal",
    detail: "Preserved product and optional existing Astro content/travel tool. The product is parked as active development.",
    status: "PARKED / SHARED JOURNEY OFF",
    evidenceTitle: CURRENT_NORTH_STAR_TITLE,
    evidenceDriveId: CURRENT_NORTH_STAR_ID,
    sourceConfidence: "parked_evidence_partial",
    unresolvedGate: "No active development, outreach, commercialization, or paid legal work. Shared Journey remains OFF. A deliberate review is required before any restart.",
    noStandaloneRoomNotes: "Existing app use does not reopen the product roadmap. Preserve known privacy/safety evidence for any future review.",
  },
  {
    key: "dnd-ttrpg",
    name: "DND / TTRPG Room",
    detail: "Personal/creative prototype history. Preserve unless explicitly selected inside the bounded Astro IP lane.",
    status: "PARKED",
    evidenceTitle: "DND SOURCE AUTHORITY CHECK v0.1 READ ONLY",
    evidenceDriveId: "1Jol11YzhurqlZL7pR2aHJGKpXnmcVWNztHkEPC0jges",
    sourceConfidence: "parked_evidence_partial",
    unresolvedGate: "Do not create a new active software/product stream from this room.",
    noStandaloneRoomNotes: "Creative IP can grow through Astro only when deliberately selected; it does not compete with CASE priority.",
  },
  {
    key: "shiftsync",
    name: "ShiftSync",
    detail: "Cancelled project. Archive only unless explicitly reopened.",
    status: "DEAD / ARCHIVE",
    evidenceTitle: "VOGTCOM SOURCE AUTHORITY MAP v0.6 GITHUB ZIP SET PASS",
    evidenceDriveId: "1f6bD7vw_7E93TB0BbqADImQVAjSeMA41KPagdkVloqw",
    sourceConfidence: "dead_archive",
    unresolvedGate: "No active work. Preserve only as historical evidence.",
    noStandaloneRoomNotes: "Do not create active work for ShiftSync unless the founder explicitly reopens it.",
  },
];

export const PROJECT_ROOM_SOURCE_NOTE =
  "Read-only evidence-backed source contract. Current company priority comes from the Sep 1 North Star and current product gates; asset existence does not create an active workstream.";

export const PROJECT_ROOM_SOURCE_EXCLUSIONS = [
  "No standalone H.A.V.E.N. runtime room.",
  "No standalone GutHub software-company priority room; GutHub stays inside AstroBehr.",
  "No standalone WAH software/company room; WAH stays inside AstroBehr.",
  "No case-trifold room until the founder reopens it.",
  "No generic Admin, Creative, Research, or Future Projects rooms.",
];
