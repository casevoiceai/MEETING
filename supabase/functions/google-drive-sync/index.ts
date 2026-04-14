import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GOOGLE_SERVICE_ACCOUNT = JSON.parse(
  Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON") || "{}"
);

const SCOPES = ["https://www.googleapis.com/auth/drive"];

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const payload = {
    iss: GOOGLE_SERVICE_ACCOUNT.client_email,
    scope: SCOPES.join(" "),
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encoder = new TextEncoder();

  function base64url(input: Uint8Array) {
    return btoa(String.fromCharCode(...input))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  const encodedHeader = base64url(
    encoder.encode(JSON.stringify(header))
  );
  const encodedPayload = base64url(
    encoder.encode(JSON.stringify(payload))
  );

  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    str2ab(GOOGLE_SERVICE_ACCOUNT.private_key),
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

  const signedJwt = `${signatureInput}.${base64url(
    new Uint8Array(signature)
  )}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${signedJwt}`,
  });

  const data = await res.json();
  return data.access_token;
}

function str2ab(pem: string) {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\n/g, "");
  const binary = atob(b64);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    buffer[i] = binary.charCodeAt(i);
  }
  return buffer;
}

serve(async (req) => {
  try {
    const body = await req.json();

    if (body.action === "test_connection") {
      const token = await getAccessToken();

      const createRes = await fetch(
        "https://www.googleapis.com/drive/v3/files",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: "CASEVOICE_TEST_FOLDER",
            mimeType: "application/vnd.google-apps.folder",
          }),
        }
      );

      const result = await createRes.json();

      return new Response(
        JSON.stringify({
          success: true,
          result,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Invalid action" }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }
});
