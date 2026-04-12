import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";

const PRIME_DIRECTIVE = `PRIME DIRECTIVE — SEND LOCK:
The team can READ, ANALYZE, and DRAFT email responses.
The team CANNOT SEND emails under any circumstances.
The user is the ONLY person who can send emails.
Never suggest auto-sending. Never imply the team will send. Always refer to "your reply" or "when you send this".`;

const MENTOR_EMAIL_ROLES: Record<string, string> = {
  JAMES: "Internal messaging clarity, tone alignment, team communication",
  MAILMAN: "Outbound email tone, audience awareness, delivery effectiveness",
  TECHGUY: "Technical files, code, architecture documents, system specs",
  DOC: "Sensitive content, safety, wellbeing, emotional impact",
  ALEX: "Visual/UI attachments, design files, UX feedback",
  CIPHER: "Data privacy, consent, trust, security concerns",
  RICK: "Risk detection, failure scenarios, red flags",
  MARK: "Strategic direction, executive decisions, positioning",
  ATK: "Legal offense, contract language, IP claims",
  DEF: "Legal defense, compliance, liability exposure",
  PAUL: "Prioritization, scope, next steps",
  SCOUT: "Competitive intelligence, market signals",
};

async function callOpenAI(systemPrompt: string, userPrompt: string, maxTokens = 300): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, email, attachment, tone, mentor } = body as {
      action: "analyze" | "analyze_attachment" | "draft_reply" | "mentor_insight";
      email?: { subject: string; sender_name: string; sender_email: string; body: string };
      attachment?: { filename: string; content_type: string; content: string };
      tone?: string;
      mentor?: string;
    };

    if (action === "analyze" && email) {
      const systemPrompt = `${PRIME_DIRECTIVE}

You are JULIE, the AI meeting facilitator. Your job is to analyze an inbound email and return structured intelligence for the team.

Return ONLY valid JSON in this exact format:
{
  "summary": "2-3 sentence summary of the email",
  "intent": "one sentence: what does the sender want?",
  "risks": ["risk1", "risk2"],
  "opportunities": ["opportunity1"],
  "suggested_tone": "formal|direct|friendly|assertive",
  "key_points": ["point1", "point2", "point3"],
  "tags": ["tag1", "tag2"],
  "routed_mentors": ["MENTOR1", "MENTOR2"]
}

routed_mentors: pick 2-3 mentors from [JAMES, MAILMAN, TECHGUY, DOC, ALEX, CIPHER, RICK, MARK, ATK, DEF, PAUL, SCOUT] who should weigh in on this email based on its content.`;

      const userPrompt = `EMAIL:
From: ${email.sender_name} <${email.sender_email}>
Subject: ${email.subject}
Body: ${email.body}`;

      const raw = await callOpenAI(systemPrompt, userPrompt, 400);
      const cleaned = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned);

      return new Response(JSON.stringify({ success: true, analysis: parsed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "analyze_attachment" && attachment) {
      const routingMap: Record<string, string[]> = {
        "technical": ["TECHGUY"],
        "code": ["TECHGUY"],
        "spec": ["TECHGUY"],
        "legal": ["ATK", "DEF"],
        "contract": ["ATK", "DEF"],
        "safety": ["DOC"],
        "sensitive": ["DOC", "CIPHER"],
        "design": ["ALEX"],
        "ui": ["ALEX"],
        "copy": ["JAMES", "JAMISON"],
        "email": ["MAILMAN"],
      };

      const fnLower = attachment.filename.toLowerCase();
      let routed = "JAMES";
      for (const [keyword, mentors] of Object.entries(routingMap)) {
        if (fnLower.includes(keyword) || attachment.content_type.includes(keyword)) {
          routed = mentors[0];
          break;
        }
      }

      const role = MENTOR_EMAIL_ROLES[routed] ?? "General analysis";
      const systemPrompt = `${PRIME_DIRECTIVE}

You are ${routed}, analyzing an email attachment. Your expertise: ${role}.
Extract key points, risks, opportunities, and tags from this file content.

Return ONLY valid JSON:
{
  "routed_to": "${routed}",
  "key_points": ["point1", "point2"],
  "risks": ["risk1"],
  "opportunities": ["opp1"],
  "tags": ["tag1", "tag2"],
  "summary": "brief summary of the attachment content"
}`;

      const userPrompt = `Attachment: ${attachment.filename} (${attachment.content_type})
Content:
${attachment.content.slice(0, 2000)}`;

      const raw = await callOpenAI(systemPrompt, userPrompt, 300);
      const cleaned = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned);

      return new Response(JSON.stringify({ success: true, analysis: { ...parsed, routed_to: routed } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "draft_reply" && email) {
      const toneInstructions: Record<string, string> = {
        formal: "Professional, structured, third-person friendly. Use complete sentences. Avoid contractions.",
        direct: "Clear, concise, no fluff. Gets to the point immediately. Short sentences.",
        friendly: "Warm, approachable, human. Use contractions. Conversational but professional.",
        assertive: "Confident, direct, sets clear boundaries or expectations. No hedging language.",
      };

      const chosenTone = tone ?? "direct";
      const draftMentor = mentor ?? "JAMES";
      const toneDesc = toneInstructions[chosenTone] ?? toneInstructions.direct;

      const systemPrompt = `${PRIME_DIRECTIVE}

You are ${draftMentor}, drafting an email reply for the user. The user will review, edit, and send this themselves.
Never say "I will send" — always write as if drafting for the user to send.

Tone: ${chosenTone.toUpperCase()} — ${toneDesc}

Write only the email body text. No subject line. No "Draft:" prefix. No explanation. Just the reply body.
Keep it focused and actionable. 3-6 sentences unless the email requires more.`;

      const userPrompt = `Original email:
From: ${email.sender_name} <${email.sender_email}>
Subject: ${email.subject}
Body: ${email.body}

Draft a ${chosenTone} reply for the user to review and send.`;

      const draftText = await callOpenAI(systemPrompt, userPrompt, 350);

      return new Response(JSON.stringify({ success: true, draft: draftText.trim(), tone: chosenTone, drafted_by: draftMentor }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "mentor_insight" && email && mentor) {
      const role = MENTOR_EMAIL_ROLES[mentor] ?? "General analysis";
      const systemPrompt = `${PRIME_DIRECTIVE}

You are ${mentor}. Your domain: ${role}.
Read this email and give ONE sharp, specific insight from your perspective.
2-3 sentences max. Stay in your lane. Be direct, not generic.`;

      const userPrompt = `Email from ${email.sender_name}: Subject: ${email.subject}\n\n${email.body}`;

      const insight = await callOpenAI(systemPrompt, userPrompt, 150);

      return new Response(JSON.stringify({ success: true, mentor, insight: insight.trim() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
