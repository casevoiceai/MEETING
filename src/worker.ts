export interface Env {
  ASSETS: Fetcher;
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}

async function handleApi(request: Request) {
  if (request.method === "OPTIONS") {
    return json({ ok: true }, 200);
  }

  if (request.method !== "POST") {
    return json(
      {
        success: false,
        error: "Method not allowed",
      },
      405
    );
  }

  let body: Record<string, unknown> = {};

  try {
    body = await request.json();
  } catch {
    return json(
      {
        success: false,
        error: "Invalid JSON body",
      },
      400
    );
  }

  const action = typeof body.action === "string" ? body.action : "";

  if (action === "test_connection") {
    return json({
      success: true,
      connected: true,
      message: "Google Drive connection OK (worker route live)",
      received: body,
    });
  }

  if (action === "save_meeting") {
    return json({
      success: true,
      saved: true,
      message: "Meeting saved (mock)",
      received: body,
    });
  }

  return json(
    {
      success: false,
      error: "Invalid action",
      received: body,
    },
    400
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/save-meeting") {
      return handleApi(request);
    }

    if (url.pathname === "/api/google-drive/save-meeting") {
      return handleApi(request);
    }

    return env.ASSETS.fetch(request);
  },
};
