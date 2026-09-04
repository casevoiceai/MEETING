export type FoundryLifecycle =
  | "CAPTURED"
  | "AI REVIEW"
  | "RESEARCHED"
  | "TESTABLE"
  | "TESTING"
  | "EVIDENCE"
  | "PROMOTE"
  | "HOLD"
  | "KILL";

export type FoundryRecommendation = "TEST" | "HOLD" | "KILL";
export type FoundryDecision = FoundryRecommendation | "PROMOTE";

export interface FoundrySource {
  title: string;
  url: string;
}

export interface FoundryWorkerFinding {
  role: string;
  finding: string;
}

export interface FoundryAnalysis {
  title: string;
  observation: string;
  problem: string;
  proposed_solution: string;
  potential_customer: string;
  money_hypothesis: string;
  existing_alternatives: string[];
  vogtcom_connection: string;
  evidence_for: string[];
  evidence_against: string[];
  unknowns: string[];
  smallest_test: string;
  estimated_cash: string;
  estimated_founder_time: string;
  potential_upside: string;
  primary_risks: string[];
  success_trigger: string;
  kill_trigger: string;
  recommendation: FoundryRecommendation;
  recommendation_reason: string;
  score: number;
  duplicate_of: string;
  duplicate_reason: string;
  workers: FoundryWorkerFinding[];
  sources: FoundrySource[];
}

export interface FoundryCard extends FoundryAnalysis {
  id: string;
  raw_input: string;
  source_url: string;
  attachment_name: string;
  lifecycle: FoundryLifecycle;
  decision: FoundryDecision | "";
  decision_reason: string;
  created_at: string;
  updated_at: string;
}

export interface FoundryIntake {
  rawInput: string;
  sourceUrl?: string;
  image?: File | null;
  canonContext: string;
}

interface FoundryCapture {
  id: string;
  raw_input: string;
  source_url: string;
  attachment_name: string;
  lifecycle: "CAPTURED";
  analysis_status: "pending" | "complete" | "failed";
  error: string;
  captured_at: string;
  card_id: string;
}

export interface FoundryDecisionLogEntry {
  id: string;
  truth_layer: "DECISION_LOG";
  category: "FOUNDRY";
  foundry_card_id: string;
  idea_title: string;
  decision: FoundryDecision;
  reason: string;
  canon_changed: false;
  active_project_created: false;
  recorded_at: string;
}

const CARDS_KEY = "vogtcom_foundry_cards_v1";
const CAPTURES_KEY = "vogtcom_foundry_captures_v1";
const DECISIONS_KEY = "vogtcom_foundry_decision_log_v1";

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

function makeId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `foundry_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the image."));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });
}

function saveCards(cards: FoundryCard[]): void {
  writeJson(CARDS_KEY, cards.slice(0, 250));
}

function updateCapture(id: string, patch: Partial<FoundryCapture>): void {
  const captures = readJson<FoundryCapture[]>(CAPTURES_KEY, []);
  writeJson(
    CAPTURES_KEY,
    captures.map((capture) => (capture.id === id ? { ...capture, ...patch } : capture)).slice(0, 500)
  );
}

function accessError(status: number): string {
  return status === 401 || status === 403
    ? "Your Founder CRM sign-in session is missing or expired. Refresh the page and sign in again."
    : "";
}

export async function listFoundryCards(): Promise<FoundryCard[]> {
  return readJson<FoundryCard[]>(CARDS_KEY, []).sort(
    (a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at)
  );
}

export function listFoundryDecisionLog(): FoundryDecisionLogEntry[] {
  return readJson<FoundryDecisionLogEntry[]>(DECISIONS_KEY, []);
}

export async function transcribeFoundryAudio(audio: Blob): Promise<string> {
  if (!audio.size) throw new Error("No voice recording was captured.");
  if (audio.size > 10 * 1024 * 1024) throw new Error("Keep voice notes under 10 MB.");

  const formData = new FormData();
  const type = audio.type || "audio/webm";
  const extension = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : type.includes("wav") ? "wav" : "webm";
  formData.append("audio", audio, `foundry-voice.${extension}`);

  const response = await fetch("/api/foundry-transcribe", {
    method: "POST",
    body: formData,
    credentials: "same-origin",
  });
  const payload = (await response.json().catch(() => ({}))) as { text?: string; error?: string };
  if (!response.ok || !payload.text?.trim()) {
    throw new Error(accessError(response.status) || payload.error || "Voice transcription failed.");
  }
  return payload.text.trim();
}

export async function analyzeFoundryIdea(intake: FoundryIntake): Promise<FoundryCard> {
  const rawInput = intake.rawInput.trim();
  const sourceUrl = intake.sourceUrl?.trim() ?? "";
  if (!rawInput) throw new Error("Add a thought first.");

  if (intake.image) {
    if (!intake.image.type.startsWith("image/")) throw new Error("Foundry image input must be an image file.");
    if (intake.image.size > 5 * 1024 * 1024) throw new Error("Keep Foundry images under 5 MB.");
  }

  const existing = await listFoundryCards();
  const duplicateCandidates = existing.slice(0, 30).map((card) => ({
    id: card.id,
    title: card.title,
    observation: card.observation,
    problem: card.problem,
    lifecycle: card.lifecycle,
  }));

  const captureId = makeId();
  const capturedAt = new Date().toISOString();
  const capture: FoundryCapture = {
    id: captureId,
    raw_input: rawInput,
    source_url: sourceUrl,
    attachment_name: intake.image?.name ?? "",
    lifecycle: "CAPTURED",
    analysis_status: "pending",
    error: "",
    captured_at: capturedAt,
    card_id: "",
  };

  const captures = readJson<FoundryCapture[]>(CAPTURES_KEY, []);
  writeJson(CAPTURES_KEY, [capture, ...captures].slice(0, 500));

  let imageDataUrl = "";
  try {
    if (intake.image) imageDataUrl = await fileToDataUrl(intake.image);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Foundry input preparation failed.";
    updateCapture(captureId, { analysis_status: "failed", error: message });
    throw new Error(`${message} Your raw thought was preserved locally.`);
  }

  let response: Response;
  try {
    response = await fetch("/api/foundry-analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        raw_input: rawInput,
        source_url: sourceUrl,
        image_data_url: imageDataUrl,
        duplicate_candidates: duplicateCandidates,
        canon_context: intake.canonContext,
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Foundry analysis request failed.";
    updateCapture(captureId, { analysis_status: "failed", error: message });
    throw new Error(`${message} Your raw thought was preserved locally.`);
  }

  const payload = (await response.json().catch(() => ({}))) as { analysis?: FoundryAnalysis; error?: string };
  if (!response.ok || !payload.analysis) {
    const message = accessError(response.status) || payload.error || `Foundry analysis failed (${response.status}).`;
    updateCapture(captureId, { analysis_status: "failed", error: message });
    throw new Error(`${message} Your raw thought was preserved locally.`);
  }

  const now = new Date().toISOString();
  const card: FoundryCard = {
    ...payload.analysis,
    id: captureId,
    raw_input: rawInput,
    source_url: sourceUrl,
    attachment_name: intake.image?.name ?? "",
    lifecycle: "TESTABLE",
    decision: "",
    decision_reason: "",
    created_at: capturedAt,
    updated_at: now,
  };

  saveCards([card, ...existing.filter((item) => item.id !== card.id)]);
  updateCapture(captureId, { analysis_status: "complete", card_id: card.id, error: "" });
  return card;
}

export async function recordFoundryDecision(
  card: FoundryCard,
  decision: FoundryDecision,
  reason = "Founder decision from Foundry queue"
): Promise<FoundryCard> {
  const lifecycle: FoundryLifecycle =
    decision === "TEST" ? "TESTING" : decision === "HOLD" ? "HOLD" : decision === "KILL" ? "KILL" : "PROMOTE";

  const updated: FoundryCard = {
    ...card,
    lifecycle,
    decision,
    decision_reason: reason,
    updated_at: new Date().toISOString(),
  };

  const cards = await listFoundryCards();
  saveCards(cards.map((item) => (item.id === card.id ? updated : item)));

  const entry: FoundryDecisionLogEntry = {
    id: makeId(),
    truth_layer: "DECISION_LOG",
    category: "FOUNDRY",
    foundry_card_id: card.id,
    idea_title: card.title,
    decision,
    reason,
    canon_changed: false,
    active_project_created: false,
    recorded_at: new Date().toISOString(),
  };
  const log = listFoundryDecisionLog();
  writeJson(DECISIONS_KEY, [entry, ...log].slice(0, 500));

  return updated;
}
