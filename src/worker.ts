export interface Env {
  ASSETS: Fetcher;
  OAUTH_TOKENS: KVNamespace;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_DRIVE_PARENT_FOLDER_ID?: string;
}

const REDIRECT_URI = "https://foundercrm.casevoice-ai.workers.dev/oauth/callback";
const SCOPES = "https://www.googleapis.com/auth/drive.file";
const TOKEN_KEY = "google_oauth_token";

type JsonRecord = Record<string, unknown>;

function json(body: JsonRecord, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    },
  });
}

async function getStoredToken(env: Env): Promise<string | null> {
  try {
    const stored = await env.OAUTH_TOKENS.get(TOKEN_KEY);
    if (!stored) return null;

    const tokenData = JSON.parse(stored) as {
      access_token: string;
      expires_at: number;
      refresh_token?: string;
    };

    if (Date.now() > tokenData.expires_at - 300000) {
      if (tokenData.refresh_token) {
        return await refreshAccessToken(env, tokenData.refresh_token);
      }
      return null;
    }

    return tokenData.access_token;
  } catch {
    return null;
  }
}

async function refreshAccessToken(env: Env, refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) return null;

    const accessToken = data.access_token as string;
    const expiresIn = (data.expires_in as number) || 3600;

    const existing = await env.OAUTH_TOKENS.get(TOKEN_KEY);
    const existingData = existing ? JSON.parse(existing) : {};

    await env.OAUTH_TOKENS.put(
      TOKEN_KEY,
      JSON.stringify({
        ...existingData,
        access_token: accessToken,
        expires_at: Date.now() + expiresIn * 1000,
      })
    );

    return accessToken;
  } catch {
    return null;
  }
}

async function saveMeetingToDrive(env: Env, body: JsonRecord) {
  const token = await getStoredToken(env);

  if (!token) {
    return {
      success: false,
      needs_auth: true,
      auth_url: "/oauth/start",
      error: "Not connected to Google Drive. Visit /oauth/start to connect.",
    };
  }

  const title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim()
      : `Meeting_${new Date().toISOString()}`;

  const content =
    typeof body.content === "string" && body.content.trim()
      ? body.content
      : "No meeting content provided.";

  const parentId = env.GOOGLE_DRIVE_PARENT_FOLDER_ID?.trim() || null;

  const metadata: JsonRecord = {
    name: `${title.replace(/[\\/:*?"<>|]/g, "_")}.txt`,
    mimeType: "text/plain",
  };

  if (parentId) {
    metadata.parents = [parentId];
  }

  const boundary = `casevoice-boundary-${crypto.randomUUID()}`;

  const multipartBody =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: text/plain\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--`;

  const uploadRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    }
  );

  const uploadData = (await uploadRes.json()) as Record<string, unknown>;

  if (!uploadRes.ok) {
    if (uploadRes.status === 401) {
      await env.OAUTH_TOKENS.delete(TOKEN_KEY);
      return {
        success: false,
        needs_auth: true,
        auth_url: "/oauth/start",
        error: "Google Drive token expired. Visit /oauth/start to reconnect.",
      };
    }
    throw new Error(`Google Drive save failed: ${JSON.stringify(uploadData)}`);
  }

  return {
    success: true,
    saved: true,
    message: "Meeting saved to Google Drive",
    file_id: uploadData.id ?? null,
    file_name: uploadData.name ?? null,
    web_view_link: uploadData.webViewLink ?? null,
    parent_used: parentId,
  };
}

async function handleApi(request: Request, env: Env) {
  if (request.method === "OPTIONS") {
    return json({ ok: true }, 200);
  }

  if (request.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  let body: JsonRecord = {};
  try {
    body = (await request.json()) as JsonRecord;
  } catch {
    return json({ success: false, error: "Invalid JSON body" }, 400);
  }

  const action = typeof body.action === "string" ? body.action : "";

  try {
    if (action === "save_meeting") {
      const result = await saveMeetingToDrive(env, body);
      return json(result, 200);
    }

    if (action === "check_auth") {
      const token = await getStoredToken(env);
      return json({ success: true, connected: !!token }, 200);
    }

    return json({ success: false, error: "Invalid action", received: body }, 400);
  } catch (error) {
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/oauth/start") {
      const params = new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: "code",
        scope: SCOPES,
        access_type: "offline",
        prompt: "consent",
      });
      return Response.redirect(
        `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
        302
      );
    }

    if (url.pathname === "/oauth/callback") {
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      if (error || !code) {
        return new Response(`OAuth
