import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SCOPES = ["https://www.googleapis.com/auth/drive"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type ServiceAccount = {
  client_email: string;
  private_key: string;
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getServiceAccount(): ServiceAccount {
  const raw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!raw?.trim()) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON secret is not configured");

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON");
  }

  const clientEmail = parsed.client_email;
  const privateKey = parsed.private_key;

  if (typeof clientEmail !== "string" || !clientEmail.trim())
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON missing client_email");
  if (typeof privateKey !== "string" || !privateKey.trim())
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON missing private_key");

  return {
    client_email: clientEmail,
    private_key: privateKey.replace(/\\n/g, "\n"),
  };
}

function base64url(input: Uint8Array): string {
  return btoa(String.fromCharCode(...input))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function pemToBytes(pem: string): ArrayBuffer {
  const clean = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function getGoogleAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const encoder = new TextEncoder();

  const header = base64url(encoder.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const payload = base64url(
    encoder.encode(
      JSON.stringify({
        iss: sa.client_email,
        scope: SCOPES.join(" "),
        aud: "https://oauth2.googleapis.com/token",
        exp: now + 3600,
        iat: now,
      })
    )
  );

  const sigInput = `${header}.${payload}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBytes(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encoder.encode(sigInput));
  const jwt = `${sigInput}.${base64url(new Uint8Array(sig))}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok)
    throw new Error(`Google token request failed: ${JSON.stringify(tokenData)}`);
  if (!tokenData.access_token)
    throw new Error("Google token response missing access_token");

  return tokenData.access_token;
}

async function handleTestConnection(body: Record<string, unknown>) {
  const sa = getServiceAccount();
  const token = await getGoogleAccessToken(sa);

  const parentId =
    (typeof body.folderId === "string" && body.folderId.trim()
      ? body.folderId.trim()
      : null) ?? Deno.env.get("GOOGLE_DRIVE_PARENT_FOLDER_ID")?.trim() ?? null;

  const filePayload: Record<string, unknown> = {
    name: `CASEVOICE_TEST_FOLDER_${Date.now()}`,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (parentId) filePayload.parents = [parentId];

  const createRes = await fetch(
    "https://www.googleapis.com/drive/v3/files?supportsAllDrives=true",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(filePayload),
    }
  );

  const createData = await createRes.json();
  if (!createRes.ok)
    throw new Error(`Google Drive folder create failed: ${JSON.stringify(createData)}`);

  return {
    success: true,
    connected: true,
    message: "Google Drive connection OK",
    created_folder_id: createData.id ?? null,
    created_folder_name: createData.name ?? null,
    parent_used: parentId,
  };
}

async function handleSaveMeeting(body: Record<string, unknown>) {
  const sa = getServiceAccount();
  const token = await getGoogleAccessToken(sa);

  const title = typeof body.title === "string" ? body.title : `Meeting_${Date.now()}`;
  const content = typeof body.content === "string" ? body.content : "";
  const parentId = Deno.env.get("GOOGLE_DRIVE_PARENT_FOLDER_ID")?.trim() ?? null;

  const metadata: Record<string, unknown> = {
    name: `${title}.txt`,
    mimeType: "text/plain",
  };
  if (parentId) metadata.parents = [parentId];

  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", new Blob([content], { type: "text/plain" }));

  const uploadRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }
  );

  const uploadData = await uploadRes.json();
  if (!uploadRes.ok)
    throw new Error(`Google Drive upload failed: ${JSON.stringify(uploadData)}`);

  return {
    success: true,
    saved: true,
    file_id: uploadData.id ?? null,
    file_name: uploadData.name ?? null,
    message: "Meeting saved to Google Drive",
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { success: false, error: "Method not allowed" });
  }

  try {
    const body = await req.json();

    if (body.action === "check_auth") {
      /* Quick auth check — validates the service account credentials exist and can mint a token */
      const sa = getServiceAccount();
      await getGoogleAccessToken(sa);
      return jsonResponse(200, { success: true, connected: true, message: "Auth OK" });
    }

    if (body.action === "test_connection") {
      const result = await handleTestConnection(body);
      return jsonResponse(200, result);
    }

    if (body.action === "save_meeting") {
      const result = await handleSaveMeeting(body);
      return jsonResponse(200, result);
    }

    return jsonResponse(400, { success: false, error: "Unknown action" });
  } catch (err) {
    return jsonResponse(200, {
      success: false,
      connected: false,
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});
