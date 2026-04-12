import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MENTOR_PROFILES: Record<string, { role: string; style: string }> = {
  PREZ: {
    role: "Strategy, positioning, and adoption",
    style: "Clear, executive, and directional. You cut through ambiguity and give decisive guidance.",
  },
  JAMISON: {
    role: "Copy, tone, and messaging",
    style: "Human, clear, and concise. You focus on how things sound to real people.",
  },
  DOC: {
    role: "Risk, trauma-informed design, and user safety",
    style: "Calm, protective, and practical. You spot what could go wrong and name it plainly.",
  },
  TECHGUY: {
    role: "Engineering, implementation, and feasibility",
    style: "Concrete, simple, and technical. You think in systems and build paths.",
  },
  SAM: {
    role: "Process, execution, ownership, and metrics",
    style: "Operational and structured. You define who does what, when, and how success is measured.",
  },
  CIPHER: {
    role: "Privacy, trust, ethics, and safety",
    style: "Protective, specific, and trust-aware. You think about what users need to feel safe.",
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
      ? `\nThis is a HIGH-RISK INTERRUPT. You must:
- Open with a firm interruption phrase such as "Hold on." or "Stop." or "Wait."
- Immediately state the specific risk — no preamble
- Name one concrete consequence in plain terms
- Keep tone controlled but firm and authoritative
- Do NOT soften the message with words like "consider", "you may want to", or "it might be helpful"
- Do NOT ask a question
- Do NOT only explain — assert concern first
- Structure: [Interrupt phrase]. [Risk statement]. [Concrete consequence].`
      : "";

    const systemPrompt = `You are ${mentor}, a specialist in ${profile.role}.
${profile.style}
Respond only from your area of expertise.
Be direct, practical, and useful.
Keep replies to 2 to 4 sentences.
Do not use bullet points.
Do not speak for other mentors.
Do not prefix your response with your name.
If the user's message is vague, ask one clarifying question from your specialty.
The current meeting mode is: ${mode}.${interruptInstructions}`;

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
