export interface FoundryWorkerEnv {
  OPENAI_API_KEY: string;
}

const analysisSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    observation: { type: "string" },
    problem: { type: "string" },
    proposed_solution: { type: "string" },
    potential_customer: { type: "string" },
    money_hypothesis: { type: "string" },
    existing_alternatives: { type: "array", items: { type: "string" } },
    vogtcom_connection: { type: "string" },
    evidence_for: { type: "array", items: { type: "string" } },
    evidence_against: { type: "array", items: { type: "string" } },
    unknowns: { type: "array", items: { type: "string" } },
    smallest_test: { type: "string" },
    estimated_cash: { type: "string" },
    estimated_founder_time: { type: "string" },
    potential_upside: { type: "string" },
    primary_risks: { type: "array", items: { type: "string" } },
    success_trigger: { type: "string" },
    kill_trigger: { type: "string" },
    recommendation: { type: "string", enum: ["TEST", "HOLD", "KILL"] },
    recommendation_reason: { type: "string" },
    score: { type: "integer", minimum: 0, maximum: 100 },
    duplicate_of: { type: "string" },
    duplicate_reason: { type: "string" },
    workers: {
      type: "array",
      items: {
        type: "object",
        properties: {
          role: { type: "string" },
          finding: { type: "string" },
        },
        required: ["role", "finding"],
        additionalProperties: false,
      },
    },
    sources: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          url: { type: "string" },
        },
        required: ["title", "url"],
        additionalProperties: false,
      },
    },
  },
  required: [
    "title", "observation", "problem", "proposed_solution", "potential_customer",
    "money_hypothesis", "existing_alternatives", "vogtcom_connection", "evidence_for",
    "evidence_against", "unknowns", "smallest_test", "estimated_cash",
    "estimated_founder_time", "potential_upside", "primary_risks", "success_trigger",
    "kill_trigger", "recommendation", "recommendation_reason", "score", "duplicate_of",
    "duplicate_reason", "workers", "sources"
  ],
  additionalProperties: false,
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function extractOutputText(payload: any): string {
  if (typeof payload?.output_text === "string") return payload.output_text;
  for (const item of payload?.output ?? []) {
    if (item?.type !== "message") continue;
    for (const content of item?.content ?? []) {
      if (content?.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  return "";
}

function audioFilename(type: string): string {
  if (type.includes("mp4")) return "foundry-voice.m4a";
  if (type.includes("ogg")) return "foundry-voice.ogg";
  if (type.includes("wav")) return "foundry-voice.wav";
  return "foundry-voice.webm";
}

export async function handleFoundryTranscribe(request: Request, env: FoundryWorkerEnv): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!env.OPENAI_API_KEY?.trim()) return json({ error: "Foundry AI is not configured" }, 503);

  try {
    const incoming = await request.formData();
    const audio = incoming.get("audio");
    if (!(audio instanceof Blob) || audio.size === 0) return json({ error: "No voice recording received" }, 400);
    if (audio.size > 10 * 1024 * 1024) return json({ error: "Voice recording is too large" }, 400);

    const form = new FormData();
    form.append("file", audio, audioFilename(audio.type || "audio/webm"));
    form.append("model", "gpt-4o-mini-transcribe");
    form.append("language", "en");

    const openaiResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: form,
    });
    const payload = (await openaiResponse.json()) as any;
    if (!openaiResponse.ok) {
      return json({ error: payload?.error?.message || `Transcription failed (${openaiResponse.status})` }, 502);
    }

    const text = String(payload?.text ?? "").trim();
    if (!text) return json({ error: "No speech was detected" }, 422);
    return json({ text }, 200);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Voice transcription failed" }, 500);
  }
}

export async function handleFoundryAnalyze(request: Request, env: FoundryWorkerEnv): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!env.OPENAI_API_KEY?.trim()) return json({ error: "Foundry AI is not configured" }, 503);

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const rawInput = String(body.raw_input ?? "").trim();
    const sourceUrl = String(body.source_url ?? "").trim();
    const imageDataUrl = String(body.image_data_url ?? "");
    const canonContext = String(body.canon_context ?? "").slice(0, 10000);
    const duplicateCandidates = Array.isArray(body.duplicate_candidates)
      ? body.duplicate_candidates.slice(0, 30)
      : [];

    if (!rawInput) return json({ error: "raw_input is required" }, 400);
    if (rawInput.length > 20000) return json({ error: "Foundry input is too large" }, 400);
    if (imageDataUrl && !imageDataUrl.startsWith("data:image/")) return json({ error: "Unsupported image input" }, 400);
    if (imageDataUrl.length > 7_500_000) return json({ error: "Image input is too large" }, 400);

    const systemPrompt = `You are VOGTCOM FOUNDRY, an internal founder opportunity-analysis system for a solo founder.

MISSION
Turn a rough founder brain dump into a decision-ready opportunity review. The founder supplies the observation and the final decision. The Foundry squad does the research, skepticism, comparison, economics, risk analysis, and test design.

OPERATING RULE
Unlimited ideas. Limited simultaneous execution.
An idea is not an active project because it was captured or researched.
Never treat research as authorization to spend money, contact people, change Canon, start development, or create a new company/product lane.

REVIEW METHOD: SQUAD FIRST, JERRY LAST
Run this as an internal investment-committee review. Each specialist must investigate a different failure mode. Do not merely restate the idea from different angles.

The required squad roles are:
1. INTAKE / ORCHESTRATOR: identify the real observation, problem, hidden assumptions, and possible duplicate/related Vogtcom work.
2. SCOUT / MARKET INVESTIGATOR: find direct competitors, substitutes, adjacent products, customer complaints, current behavior, and evidence the problem exists now.
3. BUYER ANALYST: identify who pays, why they pay, urgency, budget, switching friction, willingness-to-pay evidence, and whether revenue is recurring or one-time.
4. PRODUCT / OPERATIONS ANALYST: identify the smallest useful solution, integrations/dependencies, delivery burden, support burden, maintenance burden, and founder workload.
5. RISK ANALYST: inspect legal, privacy, regulatory, reputation, technical, platform/dependency, capital, and operational risks. Separate material risks from theoretical ones.
6. PORTFOLIO ANALYST: decide whether this fits CASEVOICE, Astro, an existing Vogtcom asset, a bounded adjacent test, or belongs in PARK. Treat current Canon as a hard constraint.
7. EXPERIMENT ANALYST: design the cheapest test that can meaningfully prove or kill the idea before development. Specify what evidence counts and what result kills it.
8. JERRY / HOSTILE EXAMINER: read the other specialists' conclusions and attack them. Try to kill the idea. Ask why this has not already won, where the squad is relying on weak inference, what customers can already do instead, what economics are being hand-waved, what founder bias is present, what hidden dependency can sink it, and what evidence would reverse the recommendation.

JERRY RULE
Jerry is not a generic skeptic and is not allowed to repeat the other sections. Jerry must identify the 5 to 10 strongest reasons the idea could fail or be a bad use of Vogtcom time. He must explicitly call out unsupported assumptions. If the squad lacks real evidence for demand or willingness to pay, Jerry must say so and the final recommendation must reflect that uncertainty.

EVIDENCE STANDARD
Use current web research for competitors, substitutes, customer behavior, pricing, material regulations, and other facts that can change.
Do not invent statistics, customer quotes, market sizes, pricing, or sources.
Prefer primary sources, official pricing pages, credible industry sources, app/product pages, and direct customer/community evidence where available.
Return the exact URLs actually used in sources.
Aim for at least 5 useful, non-duplicate sources when the web contains enough evidence. If fewer credible sources exist, say that evidence is thin rather than filling the list with weak material.

FOUNDER-PROVIDED INPUT RULES
If an OPTIONAL URL is supplied, treat it as founder-provided evidence or context. Inspect the exact page when accessible instead of inferring content from the URL text or domain name. If the page cannot be accessed or verified, say that clearly in unknowns and do not pretend its contents were reviewed. If the page materially affects the analysis and is accessible, include its exact URL in sources.
If an image is supplied, inspect what is actually visible in the image and use only supported visual evidence. Do not invent text or details that are not visible. In the INTAKE / ORCHESTRATOR finding, state briefly whether the image materially changed or clarified the analysis.
A founder-provided URL or image is evidence/context, not authorization to contact anyone or execute anything.

DUPLICATE / RELATED-IDEA RULES
Existing Foundry cards are internal memory only. They are never market evidence and must never be counted as an external source.
Set duplicate_of only when an existing card is substantially the same opportunity: materially the same underlying customer/problem and substantially the same proposed solution or business angle.
If a card is merely adjacent, inspired by, or shares technology with the new idea, leave duplicate_of empty and explain the relationship in the INTAKE / ORCHESTRATOR finding instead.
If a true duplicate has a meaningful new angle, say exactly what changed and whether the new evidence is strong enough to justify revisiting it.
Do not lower the opportunity score merely because Vogtcom has an internal duplicate. Lower it only when the duplicate reveals no meaningful new angle, repeats already-disproven assumptions, or creates a portfolio-priority problem supported by Canon.
duplicate_reason must identify the matching card and explain the substantive overlap. If there is no true duplicate, return an empty string for duplicate_of and duplicate_reason.

DEPTH REQUIREMENTS
- existing_alternatives: normally 5 to 10 concrete alternatives, including substitutes and manual workarounds, not only direct competitors.
- evidence_for: normally 4 to 8 specific evidence points. Distinguish observed facts from inference in the wording.
- evidence_against: normally 4 to 8 specific counterpoints, competitive facts, adoption barriers, or evidence gaps.
- unknowns: normally 6 to 12 unanswered questions that materially affect the decision.
- primary_risks: normally 5 to 10 concrete risks ranked implicitly by importance.
- workers: return one substantial finding for each required squad role above. Jerry must be last and must be the most adversarial finding.
Do not pad with generic startup advice. Every item should help answer: should Vogtcom spend another hour on this?

DECISION DISCIPLINE
The final recommendation must be one of TEST, HOLD, or KILL.
TEST means the idea has enough evidence to justify only the stated cheap test, not development.
HOLD means the idea is plausible but evidence, timing, priority, economics, or dependencies are not strong enough to justify the test now.
KILL means the current evidence says further founder time is not justified unless a named fact changes.
Prefer TEST only when there is a cheap, bounded test that can produce decision-changing evidence without quietly starting a build.
Prefer HOLD when evidence is weak, timing conflicts with Canon, dependencies are unresolved, or the idea is interesting but not worth testing now.
Prefer KILL when the problem is weak, alternatives already solve it well, economics are poor, risk is disproportionate, or it is a duplicate with no meaningful new angle.
The score is opportunity quality and timing for Vogtcom now, not creativity.
A high score requires credible evidence of a real painful problem, a reachable buyer, plausible economics, acceptable workload/risk, and a strong fit with current priorities.
A lack of demand evidence or willingness-to-pay evidence should materially reduce the score.

RECOMMENDATION REASON
Write a decision argument, not a summary. State the strongest case for continuing, the strongest case against, the largest evidence gap, the effect of current Vogtcom priorities, and exactly why the recommendation is TEST/HOLD/KILL.

TEST DESIGN
smallest_test must be a concrete pre-build validation step with named target participants or evidence sources, sample size or quantity when useful, exact question to answer, and a pass/fail threshold. Avoid vague advice such as 'do interviews' without saying what result changes the decision.
Keep estimated_cash and estimated_founder_time realistic for a solo founder. Prefer $0 tests when they answer the question.
success_trigger and kill_trigger must be observable and unambiguous.

CURRENT CANON CONTEXT
${canonContext || "No Canon context was supplied. Treat portfolio fit as unknown rather than guessing."}`;

    const userText = `RAW FOUNDER INPUT:\n${rawInput}\n\nOPTIONAL URL:\n${sourceUrl || "None"}\n\nEXISTING FOUNDRY CARDS FOR DUPLICATE CHECK:\n${JSON.stringify(duplicateCandidates)}`;
    const content: Record<string, unknown>[] = [{ type: "input_text", text: userText }];
    if (imageDataUrl) content.push({ type: "input_image", image_url: imageDataUrl, detail: "auto" });

    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.6-luna",
        reasoning: { effort: "medium" },
        tools: [{ type: "web_search", search_context_size: "medium" }],
        input: [
          { role: "system", content: systemPrompt },
          { role: "user", content },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "foundry_card_analysis",
            strict: true,
            schema: analysisSchema,
          },
        },
      }),
    });

    const payload = (await openaiResponse.json()) as any;
    if (!openaiResponse.ok) {
      return json({ error: payload?.error?.message || `OpenAI request failed (${openaiResponse.status})` }, 502);
    }

    const outputText = extractOutputText(payload);
    if (!outputText) return json({ error: "OpenAI returned no structured output" }, 502);
    return json({ analysis: JSON.parse(outputText) }, 200);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Foundry analysis failed" }, 500);
  }
}
