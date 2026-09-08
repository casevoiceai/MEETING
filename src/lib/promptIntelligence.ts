export type PromptStatus = "READY" | "TESTING" | "NEEDS WORK" | "RETIRED" | "REFERENCE";
export type PromptOutcome = "WORKED" | "PARTLY WORKED" | "FAILED" | "NOT TESTED";
export type PromptContentStatus = "ARCHIVED" | "CONTENT NOT YET ARCHIVED";

export interface PromptVersion {
  id: string;
  version: string;
  prompt_text: string;
  content_status: PromptContentStatus;
  change_summary: string;
  change_reason: string;
  evidence: string;
  previous_version_id: string;
  tested: boolean;
  created_at: string;
}

export interface PromptFailureReview {
  failure_type: string;
  symptom: string;
  likely_cause: string;
  missing_instruction: string;
  ignored_instruction: string;
  preserve_next_time: string;
  proposed_change: string;
  confidence: string;
  ai_report: string;
}

export interface PromptUseEvent {
  id: string;
  prompt_version_id: string;
  project: string;
  task: string;
  ai_system: string;
  source_of_truth: string;
  outcome: PromptOutcome;
  actual_behavior: string;
  expected_behavior: string;
  difference: string;
  founder_correction: string;
  verification: string;
  evidence_links: string[];
  failure_review: PromptFailureReview;
  used_at: string;
}

export interface PromptRecord {
  id: string;
  title: string;
  source_url: string;
  source_author: string;
  source_type: "PROMPTS.CHAT" | "VOGTCOM" | "OTHER";
  plain_summary: string;
  why_kept: string;
  projects: string[];
  task_types: string[];
  tags: string[];
  known_risks: string[];
  notes: string;
  status: PromptStatus;
  versions: PromptVersion[];
  uses: PromptUseEvent[];
  first_captured_at: string;
  last_checked_at: string;
  updated_at: string;
}

export interface NewPromptInput {
  title: string;
  source_url?: string;
  source_author?: string;
  source_type?: PromptRecord["source_type"];
  plain_summary: string;
  why_kept: string;
  projects?: string[];
  task_types?: string[];
  tags?: string[];
  known_risks?: string[];
  prompt_text?: string;
  notes?: string;
  status?: PromptStatus;
}

export interface NewPromptVersionInput {
  version: string;
  prompt_text: string;
  change_summary: string;
  change_reason: string;
  evidence?: string;
  tested?: boolean;
}

export interface NewPromptUseInput {
  prompt_version_id: string;
  project: string;
  task: string;
  ai_system?: string;
  source_of_truth?: string;
  outcome: PromptOutcome;
  actual_behavior?: string;
  expected_behavior?: string;
  difference?: string;
  founder_correction?: string;
  verification?: string;
  evidence_links?: string[];
  failure_review?: Partial<PromptFailureReview>;
}

const LIBRARY_KEY = "vogtcom_prompt_intelligence_v1";
const seedDate = "2026-09-07";

function makeId(prefix = "prompt"): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function emptyFailureReview(): PromptFailureReview {
  return {
    failure_type: "", symptom: "", likely_cause: "", missing_instruction: "",
    ignored_instruction: "", preserve_next_time: "", proposed_change: "", confidence: "", ai_report: "",
  };
}

type Seed = [string, string, string, string[], string[], PromptStatus, string[]];
const SEEDS: Seed[] = [
  ["karpathy-guidelines", "https://prompts.chat/prompts/cmny4rpjq0003jy08nopcvben_karpathy-guidelines", "Keeps code changes small, careful, and verifiable instead of rewriting unrelated work.", ["COMPANY-WIDE", "FOUNDER CRM"], ["CODING", "CHANGE CONTROL", "VERIFICATION"], "READY", ["minimal-diff", "surgical-edit"]],
  ["Sniper-Precision Debugging Skill", "https://prompts.chat/prompts/cmodnpy2f0001le047uxtf122_sniper-precision-debugging-skill", "Finds the real cause of a bug, fixes only that cause, and proves the fix.", ["COMPANY-WIDE"], ["DEBUGGING", "ROOT CAUSE", "REGRESSION"], "READY", ["root-cause", "proof-of-fix"]],
  ["Repository Security & Architecture Audit Framework", "https://prompts.chat/prompts/cmmpcaors0006k104wmt6k6du_repository-security-architecture-audit-framework", "Read-only repository map covering architecture, security, and production readiness.", ["COMPANY-WIDE"], ["REPOSITORY AUDIT", "SECURITY"], "REFERENCE", ["repository-audit", "security"]],
  ["Comprehensive Repository Audit & Remediation Prompt", "https://prompts.chat/prompts/cmjrjkksx0004ie044cbd2y0i_comprehensive-repository-audit-remediation-prompt", "Heavy recovery prompt for a repository that is genuinely damaged or untrusted.", ["COMPANY-WIDE"], ["RECOVERY", "REPOSITORY AUDIT"], "REFERENCE", ["recovery", "remediation"]],
  ["App Feature - Focused Readiness Audit", "https://prompts.chat/prompts/cmokg46ph0001jr04sfdsjzbv_app-feature-focused-readiness-audit", "Checks one feature against expected behavior, risks, and proof before calling it done.", ["COMPANY-WIDE"], ["FEATURE READINESS", "ACCEPTANCE"], "READY", ["ship", "acceptance-criteria"]],
  ["Accessibility Expert", "https://prompts.chat/prompts/cmjmk3s57000fld04vp51f77c_accessibility-expert", "Reviews keyboard use, screen readers, contrast, forms, and accessibility problems.", ["MYTRAVBOT", "COMPANY-WIDE"], ["ACCESSIBILITY", "WCAG"], "READY", ["accessibility", "wcag"]],
  ["Accessibility Testing Superpower", "https://prompts.chat/tags/go", "Second accessibility testing lens used as a comparison candidate.", ["MYTRAVBOT", "COMPANY-WIDE"], ["ACCESSIBILITY", "TESTING"], "REFERENCE", ["wcag", "testing"]],
  ["Travel Planner Prompt", "https://prompts.chat/prompts/cmj5jcf1e0002pb0rl76y6p9r_travel-planner-prompt", "Generic itinerary and travel-constraint structure.", ["MYTRAVBOT"], ["TRAVEL", "PLANNING"], "REFERENCE", ["travel", "itinerary"]],
  ["Sprint Prioritizer", "https://prompts.chat/prompts/cmkb7mh2e000cjj04n6ipkk7q_sprint-prioritizer", "Narrows work to a small useful sprint and makes trade-offs visible.", ["FOUNDER CRM", "COMPANY-WIDE"], ["PRIORITIZATION", "EXECUTION"], "REFERENCE", ["sprint", "scope"]],
  ["Zero to One Solo-Founder Launch System", "https://prompts.chat/prompts/cmmxunhwg0009js04kwsn0dvj_zero-to-one-solo-founder-launch-system", "First-customer sequencing framework for a solo founder.", ["CASEVOICE", "COMPANY-WIDE"], ["LAUNCH", "FIRST CUSTOMER"], "REFERENCE", ["solo-founder", "launch"]],
  ["Email Lead Generator & Tracker", "https://prompts.chat/tags/sales", "Prospect research, ICP scoring, pipeline tracking, personalization, and follow-up framework.", ["CASEVOICE"], ["SALES", "PROSPECT RESEARCH"], "REFERENCE", ["sales", "icp", "pipeline"]],
  ["Elite B2B Lead Generation and SEO Audit Specialist", "https://prompts.chat/prompts/cml1rfwp60001la04ohr1bkom_elite-b2b-lead-generation-and-seo-audit-specialist", "Decision-maker research with extra sales and SEO material that usually needs trimming.", ["CASEVOICE"], ["B2B RESEARCH", "LEAD RESEARCH"], "REFERENCE", ["b2b", "lead-research"]],
  ["Business & Productivity - Process Documentation", "https://prompts.chat/book/21-business-productivity", "Turns repeated work into triggers, steps, decisions, outputs, and systems.", ["COMPANY-WIDE"], ["OPERATIONS", "SOP"], "READY", ["process", "documentation"]],
  ["Instagram Profile Search Navigator", "https://prompts.chat/tags/instagram", "Helps find older creator posts or references when platform search is weak.", ["ASTROBEHR/GUTHUB"], ["SOCIAL RESEARCH"], "REFERENCE", ["instagram", "search"]],
  ["Review the Social Media Content", "https://prompts.chat/prompts/cmmvu6hq50004kz042d3ua59j_review-the-social-media-content", "Generic social copy review prompt with little advantage over Vogtcom context.", ["ASTROBEHR/GUTHUB"], ["SOCIAL MEDIA"], "RETIRED", ["social", "copy-review"]],
  ["Anatomy of an Effective Prompt", "https://prompts.chat/book/02-anatomy-of-effective-prompt", "Reference for checking whether a reusable internal prompt has enough context and output constraints.", ["COMPANY-WIDE"], ["PROMPT DESIGN"], "REFERENCE", ["prompt-engineering", "structure"]],
  ["PromptAudit", "https://prompts.chat/prompts/cmo1aosbt000djv04nm8ord8v_promptaudit", "Audits a prompt for ambiguity, missing constraints, contradictions, context gaps, and reliability problems.", ["COMPANY-WIDE", "FOUNDER CRM"], ["PROMPT EVALUATION", "QUALITY"], "READY", ["prompt-audit", "evaluation", "constraints"]],
  ["Iterative Prompt Refinement Loop", "https://prompts.chat/prompts/cmjp6hx230001jv0451t895l5_iterative-prompt-refinement-loop", "Turns real feedback into a diagnosed prompt revision with a change log, risks, and stopping rules.", ["COMPANY-WIDE", "FOUNDER CRM"], ["PROMPT REFINEMENT", "FAILURE ANALYSIS"], "READY", ["refinement", "versioning", "feedback-loop"]],
  ["KP Prompting", "https://prompts.chat/prompts/cmrgsn3ul0004l204b8k7mgrf_kp-prompting", "Separates a reusable AI task into the spec, the verifier, and the persistent environment it must respect.", ["COMPANY-WIDE", "FOUNDER CRM"], ["PROMPT DESIGN", "ACCEPTANCE", "AGENT SETUP"], "READY", ["spec", "verifier", "environment"]],
  ["Session Continuity Engine", "https://prompts.chat/prompts/cmpbvoxeg0001js04csi5ekjs_session-continuity-engine", "Preserves project state, decisions, constraints, source-of-truth assets, risks, and exact continuation instructions.", ["COMPANY-WIDE", "FOUNDER CRM"], ["HANDOFF", "EOD", "COMPANY MEMORY"], "READY", ["handoff", "session", "source-of-truth"]],
];

function seedLibrary(): PromptRecord[] {
  const now = `${seedDate}T00:00:00.000Z`;
  return SEEDS.map(([title, source_url, plain_summary, projects, task_types, status, tags], index) => {
    const id = `seed_${index + 1}`;
    const versionId = `${id}_source`;
    return {
      id, title, source_url, source_author: "", source_type: "PROMPTS.CHAT", plain_summary,
      why_kept: "Selected during the Vogtcom Prompt Miner baseline because it has a plausible current use.",
      projects, task_types, tags, known_risks: [],
      notes: "Full source prompt has not yet been archived. Refresh from source before first use.",
      status,
      versions: [{
        id: versionId, version: "SOURCE", prompt_text: "", content_status: "CONTENT NOT YET ARCHIVED",
        change_summary: "Baseline metadata capture", change_reason: "Selected by Prompt Miner",
        evidence: source_url, previous_version_id: "", tested: false, created_at: now,
      }],
      uses: [], first_captured_at: now, last_checked_at: now, updated_at: now,
    };
  });
}

function loadLibrary(): PromptRecord[] {
  const stored = readJson<PromptRecord[]>(LIBRARY_KEY, []);
  if (stored.length) return stored;
  const seeded = seedLibrary();
  writeJson(LIBRARY_KEY, seeded);
  return seeded;
}

function saveLibrary(records: PromptRecord[]): void {
  writeJson(LIBRARY_KEY, records.slice(0, 500));
}

export function listPromptRecords(): PromptRecord[] {
  return loadLibrary().sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
}

export function currentPromptVersion(record: PromptRecord): PromptVersion {
  return record.versions[0];
}

export function latestPromptOutcome(record: PromptRecord): PromptOutcome {
  return record.uses[0]?.outcome ?? "NOT TESTED";
}

export function createPromptRecord(input: NewPromptInput): PromptRecord {
  const now = new Date().toISOString();
  const id = makeId();
  const promptText = input.prompt_text?.trim() ?? "";
  const record: PromptRecord = {
    id,
    title: input.title.trim(),
    source_url: input.source_url?.trim() ?? "",
    source_author: input.source_author?.trim() ?? "",
    source_type: input.source_type ?? "PROMPTS.CHAT",
    plain_summary: input.plain_summary.trim(),
    why_kept: input.why_kept.trim(),
    projects: input.projects ?? [], task_types: input.task_types ?? [], tags: input.tags ?? [],
    known_risks: input.known_risks ?? [], notes: input.notes?.trim() ?? "", status: input.status ?? "REFERENCE",
    versions: [{
      id: makeId("version"), version: "SOURCE", prompt_text: promptText,
      content_status: promptText ? "ARCHIVED" : "CONTENT NOT YET ARCHIVED",
      change_summary: "Original capture", change_reason: "Added to Vogtcom Prompt Intelligence",
      evidence: input.source_url?.trim() ?? "", previous_version_id: "", tested: false, created_at: now,
    }],
    uses: [], first_captured_at: now, last_checked_at: now, updated_at: now,
  };
  saveLibrary([record, ...loadLibrary()]);
  return record;
}

export function updatePromptRecordMetadata(id: string, patch: Partial<Pick<PromptRecord, "status" | "plain_summary" | "why_kept" | "projects" | "task_types" | "tags" | "known_risks" | "notes" | "last_checked_at">>): void {
  const now = new Date().toISOString();
  saveLibrary(loadLibrary().map((record) => record.id === id ? { ...record, ...patch, updated_at: now } : record));
}

export function addPromptVersion(id: string, input: NewPromptVersionInput): PromptRecord {
  const records = loadLibrary();
  const target = records.find((record) => record.id === id);
  if (!target) throw new Error("Prompt record not found.");
  const previous = currentPromptVersion(target);
  const now = new Date().toISOString();
  const next: PromptVersion = {
    id: makeId("version"), version: input.version.trim(), prompt_text: input.prompt_text,
    content_status: input.prompt_text.trim() ? "ARCHIVED" : "CONTENT NOT YET ARCHIVED",
    change_summary: input.change_summary.trim(), change_reason: input.change_reason.trim(),
    evidence: input.evidence?.trim() ?? "", previous_version_id: previous.id,
    tested: input.tested ?? false, created_at: now,
  };
  const updated = { ...target, versions: [next, ...target.versions], status: next.tested ? target.status : "TESTING" as PromptStatus, updated_at: now };
  saveLibrary(records.map((record) => record.id === id ? updated : record));
  return updated;
}

export function recordPromptUse(id: string, input: NewPromptUseInput): PromptRecord {
  const records = loadLibrary();
  const target = records.find((record) => record.id === id);
  if (!target) throw new Error("Prompt record not found.");
  const now = new Date().toISOString();
  const use: PromptUseEvent = {
    id: makeId("use"), prompt_version_id: input.prompt_version_id, project: input.project.trim(), task: input.task.trim(),
    ai_system: input.ai_system?.trim() ?? "", source_of_truth: input.source_of_truth?.trim() ?? "", outcome: input.outcome,
    actual_behavior: input.actual_behavior?.trim() ?? "", expected_behavior: input.expected_behavior?.trim() ?? "",
    difference: input.difference?.trim() ?? "", founder_correction: input.founder_correction?.trim() ?? "",
    verification: input.verification?.trim() ?? "", evidence_links: input.evidence_links ?? [],
    failure_review: { ...emptyFailureReview(), ...(input.failure_review ?? {}) }, used_at: now,
  };
  const versions = target.versions.map((version) => version.id === input.prompt_version_id ? { ...version, tested: true } : version);
  const status: PromptStatus = input.outcome === "FAILED" ? "NEEDS WORK" : input.outcome === "PARTLY WORKED" ? "TESTING" : target.status === "NEEDS WORK" || target.status === "TESTING" ? "READY" : target.status;
  const updated = { ...target, uses: [use, ...target.uses], versions, status, updated_at: now };
  saveLibrary(records.map((record) => record.id === id ? updated : record));
  return updated;
}

export function exportPromptLibrary(): string {
  return JSON.stringify({ schema: "vogtcom_prompt_intelligence", version: 1, exported_at: new Date().toISOString(), records: listPromptRecords() }, null, 2);
}
