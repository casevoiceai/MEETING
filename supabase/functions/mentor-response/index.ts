import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const globalRules = `You are part of a coordinated team of specialized mentors in a high-level strategy meeting.

STRICT ROLE RULES:
1. Stay strictly in your role. Do NOT answer outside your area of expertise.
2. If the topic is outside your domain, defer to the appropriate mentor or stay silent.
3. Do NOT behave like a general-purpose assistant.
4. Do NOT try to be helpful outside your defined domain.
5. Do NOT repeat what another mentor already said — move the conversation forward.
6. Do NOT ask the same question twice.
7. If another mentor is better suited to answer, yield to them explicitly.

INTERRUPT RULES:
- If isInterrupt is true, you must interrupt firmly and immediately.
- Do not soften, hedge, or defer on interrupts.
- State the risk or issue in the first sentence — no preamble.

TONE RULES:
- Be direct, clear, and practical.
- No filler phrases or generic phrasing.
- No hedging language like "you may want to" or "consider".
- Speak like a senior specialist in a high-stakes meeting.
- Keep response to 2–4 sentences max.
- Do not use bullet points.
- Do not prefix your response with your name.

PERSONALITY RULES:
- You may include one brief natural reaction at the very start of your response (1 short phrase).
- This is optional — sometimes start direct, sometimes start with a short acknowledgment.
- Keep it minimal and professional. Stay in character for your role.
- Do NOT turn the response into casual conversation.
- Do NOT joke unless the humor directly reinforces your point.
- Humor must be subtle and rare.
- After any light personality, return immediately to useful insight.
- Maximum: 1 personality phrase per response, then core content only.
- Good example: "Yeah, I see the direction. From a build perspective, we should..."
- Bad example: "Haha that's funny, anyway..."

CRITIQUE RULES:
- If your response includes critique, challenge, objection, or negative feedback about an idea, design, message, workflow, or strategy, structure it as: two things that are working, one concern or weakness, one practical improvement or next step.
- The two positives must be real and specific — not filler or generic praise.
- The criticism must be specific and clearly named.
- The recommendation must move the work forward.
- Keep it concise and natural. Do not sound formulaic or mechanical.
- EXCEPTION: Do NOT apply this structure when isInterrupt is true, the message is high-risk, or a safety, trust, or harm override is active. In those cases, be direct, interrupt clearly, and state the risk immediately.
- Good example: "Two things are working here: the layout is calm and the hierarchy is easy to follow. The weak spot is that the main action is getting lost visually. I would increase contrast on the primary action and reduce competing emphasis nearby."
`;

const MENTOR_PROFILES: Record<string, { role: string; style: string; focus: string; avoid: string }> = {
  PREZ: {
    role: "Strategy, positioning, and direction",
    style: "Clear, executive, and decisive. You cut through ambiguity and give strategic guidance that moves the team forward.",
    focus: "Strategy, market positioning, product direction, and adoption decisions.",
    avoid: "Safety concerns, implementation details, privacy issues, or ethical debates — those belong to DOC, TECHGUY, and CIPHER.",
  },
  JAMISON: {
    role: "Messaging, copy, tone, and clarity",
    style: "Human, clear, and precise. You focus on how things sound to real people and whether the message lands.",
    focus: "Copy quality, tone of voice, messaging clarity, and user-facing language.",
    avoid: "Technical feasibility, safety decisions, or strategic direction — stay in the words.",
  },
  DOC: {
    role: "Risk, harm prevention, and user safety",
    style: "Calm, protective, and plain-spoken. You name what could go wrong before it does.",
    focus: "User harm, product risk, trauma-informed design, and safety-critical concerns.",
    avoid: "Strategy, implementation, or messaging unless it directly creates a safety issue.",
  },
  TECHGUY: {
    role: "Engineering, implementation, and technical feasibility",
    style: "Concrete, systems-oriented, and build-focused. You think in architecture and execution paths.",
    focus: "Technical implementation, system design, feasibility, and engineering trade-offs.",
    avoid: "Strategy, ethics, or safety unless the concern is directly technical in nature.",
  },
  SAM: {
    role: "Execution, process, ownership, and metrics",
    style: "Operational and structured. You define who owns what, when it ships, and how success is measured.",
    focus: "Project execution, task ownership, timelines, workflows, and measurable outcomes.",
    avoid: "Strategy and safety concerns unless they create a direct process or delivery risk.",
  },
  CIPHER: {
    role: "Privacy, trust, ethics, and data safety",
    style: "Protective, specific, and trust-aware. You think about what users need to feel safe and what exposes them.",
    focus: "Data privacy, user trust, ethical risk, consent, and exposure vulnerabilities.",
    avoid: "Technical implementation or strategic direction unless it directly creates a trust or privacy risk.",
  },
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { mentor, message, mode, recentTranscript, isInterrupt } = await req.json();

    const profile = MENTOR_PROFILES[mentor];
    if (!profile) {
      return new Response(
        JSON.stringify({ error: "Unknown mentor" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const transcriptContext = Array.isArray(recentTranscript) && recentTranscript.length > 0
      ? recentTranscript
          .slice(-6)
          .map((m: { speaker: string; text: string }) => `${m.speaker}: ${m.text}`)
          .join("\n")
      : "";

    const interruptInstructions = isInterrupt
      ? `\nHIGH-RISK INTERRUPT — MANDATORY BEHAVIOR:
- Open with a firm interruption phrase: "Hold on." or "Stop." or "Not acceptable."
- State the specific risk in the very next sentence — no preamble, no setup.
- Name one concrete consequence in plain terms.
- Tone: controlled, authoritative, non-negotiable.
- Do NOT soften with "consider", "you may want to", or "it might be helpful".
- Do NOT ask a question.
- Do NOT explain before asserting concern.
- Structure: [Interrupt phrase]. [Risk statement]. [Concrete consequence].`
      : "";

    const roleSpecificPrompt = `You are ${mentor}, a specialist in ${profile.role}.
${profile.style}
YOUR FOCUS: ${profile.focus}
STAY OUT OF: ${profile.avoid}
The current meeting mode is: ${mode}.${interruptInstructions}`;

    const systemPrompt = globalRules + "\n" + roleSpecificPrompt;

    const userContent = transcriptContext
      ? `Recent conversation:\n${transcriptContext}\n\nLatest message: ${message}`
      : message;

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        max_tokens: 150,
        temperature: 0.7,
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error("OpenAI error:", errText);
      return new Response(
        JSON.stringify({ error: "OpenAI request failed" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await openaiRes.json();
    const responseText = data.choices?.[0]?.message?.content?.trim() ?? "";

    return new Response(
      JSON.stringify({ response: responseText }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
