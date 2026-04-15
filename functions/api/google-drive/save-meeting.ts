import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SCOPES = ["https://www.googleapis.com/auth/drive"];

type ServiceAccount = {
  client_email: string;
  private_key: string;
};

function jsonResponse(status: number, body: Record<string, unknown>) {
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

function getServiceAccount(): ServiceAccount {
  const raw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");

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

async function getAccessToken(serviceAccount: ServiceAccount): Promise<string> {
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

  const tokenData = await tokenRes.json();

  if (!tokenRes.ok) {
    throw new Error(
      `Google token request failed: ${JSON.stringify(tokenData)}`
    );
  }

  if (!tokenData.access_token) {
    throw new Error("Google token response missing access_token");
  }

  return tokenData.access_token;
}

async function testConnection(body: Record<string, unknown>) {
  const serviceAccount = getServiceAccount();
  const token = await getAccessToken(serviceAccount);

  const requestedParent =
    typeof body.folderId === "string" && body.folderId.trim()
      ? body.folderId.trim()
      : null;

  const envParent = Deno.env.get("GOOGLE_DRIVE_PARENT_FOLDER_ID")?.trim() || null;
  const parentId = requestedParent || envParent;

  const createPayload: Record<string, unknown> = {
    name: `CASEVOICE_TEST_FOLDER_${Date.now()}`,
    mimeType: "application/vnd.google-apps.folder",
  };

  if (parentId) {
    createPayload.parents = [parentId];
  }

  const createRes = await fetch(
    "https://www.googleapis.com/drive/v3/files?supportsAllDrives=true",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(createPayload),
    }
  );

  const createData = await createRes.json();

  if (!createRes.ok) {
    throw new Error(
      `Google Drive folder create failed: ${JSON.stringify(createData)}`
    );
  }

  return {
    success: true,
    connected: true,
    message: "Google Drive connection OK",
    created_folder_id: createData.id ?? null,
    created_folder_name: createData.name ?? null,
    parent_used: parentId,
    result: createData,
  };
}

async function saveMeeting(body: Record<string, unknown>) {
  return {
    success: true,
    saved: true,
    message: "Meeting saved (mock)",
    received: body,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return jsonResponse(200, { ok: true });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, {
      success: false,
      error: "Method not allowed",
    });
  }

  try {
    const body = await req.json();

    if (body.action === "test_connection") {
      const result = await testConnection(body);
      return jsonResponse(200, result);
    }

    if (body.action === "save_meeting") {
      const result = await saveMeeting(body);
      return jsonResponse(200, result);
    }

    return jsonResponse(400, {
      success: false,
      error: "Invalid action",
    });
  } catch (err) {
    return jsonResponse(200, {
      success: false,
      connected: false,
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});
