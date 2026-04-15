export interface Env {
  ASSETS: Fetcher;
  GOOGLE_SERVICE_ACCOUNT_JSON?: string;
  GOOGLE_DRIVE_PARENT_FOLDER_ID?: string;
}

const SCOPES = ["https://www.googleapis.com/auth/drive.file"];

type ServiceAccount = {
  client_email: string;
  private_key: string;
};

type JsonRecord = Record<string, unknown>;

function json(body: JsonRecord, status = 200) {
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

function getServiceAccount(env: Env): ServiceAccount {
  const raw = env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (!raw || !raw.trim()) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is missing");
  }

  let parsed: Record<string, unknown>;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON");
  }

  const clientEmail = parsed.client_email;
  const privateKey = parsed.private_key;

  if (typeof clientEmail !== "string" || !clientEmail.trim()) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is missing client_email");
  }

  if (typeof privateKey !== "string" || !privateKey.trim()) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is missing private_key");
  }

  return {
    client_email: clientEmail,
    private_key: privateKey.replace(/\\n/g, "\n"),
  };
}

function base64url(input: Uint8Array) {
  return btoa(String.fromCharCode(...input))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function pemToArrayBuffer(pem: string) {
  const clean = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");

  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes.buffer;
}

async function getGoogleAccessToken(env: Env): Promise<string> {
  const serviceAccount = getServiceAccount(env);
  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const payload = {
    iss: serviceAccount.client_email,
    scope: SCOPES.join(" "),
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encoder = new TextEncoder();

  const encodedHeader = base64url(encoder.encode(JSON.stringify(header)));
  const encodedPayload = base64url(encoder.encode(JSON.stringify(payload)));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(serviceAccount.private_key),
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    encoder.encode(signatureInput)
  );

  const signedJwt = `${signatureInput}.${base64url(new Uint8Array(signature))}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body:
      "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer" +
      `&assertion=${signedJwt}`,
  });

  const tokenData = (await tokenRes.json()) as Record<string, unknown>;

  if (!tokenRes.ok) {
    throw new Error(`Google token request failed: ${JSON.stringify(tokenData)}`);
  }

  const accessToken = tokenData.access_token;

  if (typeof accessToken !== "string" || !accessToken) {
    throw new Error("Google token response missing access_token");
  }

  return accessToken;
}

async function testDriveConnection(env: Env, body: JsonRecord) {
  const token = await getGoogleAccessToken(env);

  const requestedParent =
    typeof body.folderId === "string" && body.folderId.trim()
      ? body.folderId.trim()
      : null;

  const envParent = env.GOOGLE_DRIVE_PARENT_FOLDER_ID?.trim() || null;
  const parentId = requestedParent || envParent;

  const metadata: JsonRecord = {
    name: `CASEVOICE_TEST_${Date.now()}.txt`,
    mimeType: "text/plain",
  };

  if (parentId) {
    metadata.parents = [parentId];
  }

  const boundary = `casevoice-boundary-${crypto.randomUUID()}`;
  const content = `CASEVOICE Google Drive connection test\n${new Date().toISOString()}\n`;

  const multipartBody =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: text/plain\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--`;

  const uploadRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink,parents",
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
    throw new Error(`Google Drive test upload failed: ${JSON.stringify(uploadData)}`);
  }

  return {
    success: true,
    connected: true,
    message: "Google Drive connection OK",
    file_id: uploadData.id ?? null,
    file_name: uploadData.name ?? null,
    web_view_link: uploadData.webViewLink ?? null,
    parent_used: parentId,
  };
}

async function saveMeetingToDrive(env: Env, body: JsonRecord) {
  const token = await getGoogleAccessToken(env);

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
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink,parents",
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
    return json(
      {
        success: false,
        error: "Method not allowed",
      },
      405
    );
  }

  let body: JsonRecord = {};

  try {
    body = (await request.json()) as JsonRecord;
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

  try {
    if (action === "test_connection") {
      const result = await testDriveConnection(env, body);
      return json(result, 200);
    }

    if (action === "save_meeting") {
      const result = await saveMeetingToDrive(env, body);
      return json(result, 200);
    }

    return json(
      {
        success: false,
        error: "Invalid action",
        received: body,
      },
      400
    );
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

    if (url.pathname === "/api/save-meeting") {
      return handleApi(request, env);
    }

    if (url.pathname === "/api/google-drive/save-meeting") {
      return handleApi(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
