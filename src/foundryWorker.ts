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
Turn a rough founder brain dump into a decision-ready opportunity card. Do the administrative and research work so the founder does not have to.

OPERATING RULE
Unlimited ideas. Limited simultaneous execution.
An idea is not an active project because it was captured or researched.
Never treat research as authorization to spend money, contact people, change Canon, start development, or create a new company/product lane.

ANALYST LENSES
Run one coordinated pass using these jobs and return one concise finding from each that materially applies:
1. Intake/orchestrator: actual idea, triggering observation/problem, duplicate/related work.
2. Market analyst: affected users, competitors, alternatives, current market evidence.
3. Business analyst: payer, pricing/business-model hypothesis, recurring vs one-time value.
4. Product analyst: smallest viable solution and reusable Vogtcom assets.
5. Experiment analyst: cheapest useful test, evidence threshold, kill condition.
6. Operations analyst: delivery, support, maintenance, founder workload.
7. Risk analyst: legal, privacy, regulatory, reputation, capital, dependencies.
8. Portfolio analyst: CASEVOICE, Astro, existing-asset connection, or truly new opportunity.

DECISION DISCIPLINE
Prefer TEST only when there is a cheap, bounded test that can produce useful evidence without quietly starting a new build.
Prefer HOLD when evidence is weak, timing conflicts with Canon, dependencies are unresolved, or the idea is interesting but not worth testing now.
Prefer KILL when the problem is weak, alternatives already solve it well, economics are poor, risk is disproportionate, or it is a duplicate with no meaningful new angle.
The score is opportunity quality/timing for Vogtcom now, not how creative the idea is.
Use current web research for competitors, market evidence, material regulations, and other facts that can change.
Do not invent statistics or sources. Put exact source URLs used in sources.
Keep estimated_cash and estimated_founder_time realistic for a solo founder. Prefer $0 tests when they answer the question.

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
        reasoning: { effort: "low" },
        tools: [{ type: "web_search", search_context_size: "low" }],
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
