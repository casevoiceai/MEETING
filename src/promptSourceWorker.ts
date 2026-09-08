type JsonBody = Record<string, unknown>;

function json(body: JsonBody, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export async function handlePromptSource(request: Request): Promise<Response> {
  if (request.method !== "GET") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id")?.trim() ?? "";
  if (!/^[A-Za-z0-9_-]{6,180}$/.test(id)) {
    return json({ success: false, error: "Invalid prompts.chat prompt id" }, 400);
  }

  try {
    const upstream = await fetch(`https://prompts.chat/api/prompts/${encodeURIComponent(id)}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const text = await upstream.text();

    if (!upstream.ok) {
      return json({
        success: false,
        error: `prompts.chat request failed (${upstream.status})`,
      }, upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502);
    }

    try {
      const payload = JSON.parse(text) as unknown;
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    } catch {
      return json({ success: false, error: "prompts.chat returned invalid JSON" }, 502);
    }
  } catch (error) {
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Could not reach prompts.chat",
    }, 502);
  }
}
