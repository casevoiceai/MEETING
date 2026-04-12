import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const GOOGLE_DRIVE_API = "https://www.googleapis.com/drive/v3";
const GOOGLE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

interface DriveFile {
  id: string;
  name: string;
  webViewLink: string;
  parents?: string[];
}

async function getAccessToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" })).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const payload = btoa(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  })).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const toSign = `${header}.${payload}`;
  const privateKey = sa.private_key.replace(/\\n/g, "\n");
  const pemContents = privateKey.replace("-----BEGIN PRIVATE KEY-----", "").replace("-----END PRIVATE KEY-----", "").replace(/\s/g, "");
  const binaryKey = atob(pemContents);
  const keyBuffer = new Uint8Array(binaryKey.length);
  for (let i = 0; i < binaryKey.length; i++) keyBuffer[i] = binaryKey.charCodeAt(i);

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBuffer.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const encoder = new TextEncoder();
  const signatureBuffer = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, encoder.encode(toSign));
  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const jwt = `${toSign}.${signature}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Failed to get access token: ${err}`);
  }
  const tokenData = await tokenRes.json();
  return tokenData.access_token as string;
}

async function findOrCreateFolder(accessToken: string, name: string, parentId?: string): Promise<string> {
  const q = parentId
    ? `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
    : `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

  const searchRes = await fetch(`${GOOGLE_DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (searchRes.ok) {
    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      return searchData.files[0].id as string;
    }
  }

  const createBody: Record<string, unknown> = {
    name,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (parentId) createBody.parents = [parentId];

  const createRes = await fetch(`${GOOGLE_DRIVE_API}/files?fields=id`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(createBody),
  });

  if (!createRes.ok) throw new Error(`Failed to create folder: ${await createRes.text()}`);
  const created = await createRes.json();
  return created.id as string;
}

async function uploadFileToDrive(
  accessToken: string,
  fileName: string,
  content: string | Uint8Array,
  mimeType: string,
  parentFolderId: string
): Promise<DriveFile> {
  const metadata = { name: fileName, parents: [parentFolderId] };
  const body = typeof content === "string" ? new TextEncoder().encode(content) : content;

  const boundary = "boundary_mystatement_ai";
  const metaPart = `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(metadata)}\r\n`;
  const filePart = `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`;
  const endPart = `\r\n--${boundary}--`;

  const metaBytes = new TextEncoder().encode(metaPart);
  const filePartBytes = new TextEncoder().encode(filePart);
  const endBytes = new TextEncoder().encode(endPart);

  const combined = new Uint8Array(metaBytes.length + filePartBytes.length + body.length + endBytes.length);
  combined.set(metaBytes, 0);
  combined.set(filePartBytes, metaBytes.length);
  combined.set(body, metaBytes.length + filePartBytes.length);
  combined.set(endBytes, metaBytes.length + filePartBytes.length + body.length);

  const uploadRes = await fetch(`${GOOGLE_UPLOAD_API}/files?uploadType=multipart&fields=id,name,webViewLink`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body: combined,
  });

  if (!uploadRes.ok) throw new Error(`Upload failed: ${await uploadRes.text()}`);
  return await uploadRes.json() as DriveFile;
}

async function ensureFolderStructure(accessToken: string): Promise<Record<string, string>> {
  const root = await findOrCreateFolder(accessToken, "MyStatement");
  const sessions = await findOrCreateFolder(accessToken, "Sessions", root);
  const files = await findOrCreateFolder(accessToken, "Files", root);
  const sideNotes = await findOrCreateFolder(accessToken, "SideNotes", root);
  const reports = await findOrCreateFolder(accessToken, "Reports", root);

  await supabase.from("integration_settings").update({
    config: {
      root_folder_name: "MyStatement",
      folders: { root, sessions, files, side_notes: sideNotes, reports },
    },
    last_sync_at: new Date().toISOString(),
  }).eq("integration_type", "google_drive");

  return { root, sessions, files, side_notes: sideNotes, reports };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    const { data: settings } = await supabase
      .from("integration_settings")
      .select("*")
      .eq("integration_type", "google_drive")
      .maybeSingle();

    const serviceAccountJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON") ?? "";

    if (action === "test_connection") {
      if (!serviceAccountJson) {
        return new Response(JSON.stringify({ success: false, error: "GOOGLE_SERVICE_ACCOUNT_JSON secret not configured" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      try {
        const token = await getAccessToken(serviceAccountJson);
        const folders = await ensureFolderStructure(token);
        await supabase.from("integration_settings").update({ connected: true, connected_at: new Date().toISOString() }).eq("integration_type", "google_drive");
        return new Response(JSON.stringify({ success: true, folders }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: String(err) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (action === "sync_file") {
      const { syncLogId, fileContent, fileName, mimeType, driveFolder } = body;
      if (!serviceAccountJson) {
        await supabase.from("drive_sync_log").update({ status: "failed", error_message: "Service account not configured" }).eq("id", syncLogId);
        return new Response(JSON.stringify({ success: false, error: "Not configured" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      await supabase.from("drive_sync_log").update({ status: "syncing" }).eq("id", syncLogId);

      try {
        const token = await getAccessToken(serviceAccountJson);
        const folderConfig = settings?.config?.folders ?? {};
        const folderId = folderConfig[driveFolder] ?? folderConfig.files ?? await findOrCreateFolder(token, "Files", folderConfig.root);
        const uploaded = await uploadFileToDrive(token, fileName, fileContent, mimeType, folderId);

        await supabase.from("drive_sync_log").update({
          status: "synced",
          drive_file_id: uploaded.id,
          drive_url: uploaded.webViewLink ?? "",
          synced_at: new Date().toISOString(),
        }).eq("id", syncLogId);

        if (body.localFileId) {
          await supabase.from("vault_files").update({ summary: `Drive: ${uploaded.webViewLink}` }).eq("id", body.localFileId);
        }

        return new Response(JSON.stringify({ success: true, driveFileId: uploaded.id, driveUrl: uploaded.webViewLink }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (err) {
        const retry = (settings?.retry_count ?? 0) + 1;
        await supabase.from("drive_sync_log").update({ status: "failed", error_message: String(err), retry_count: retry }).eq("id", syncLogId);
        return new Response(JSON.stringify({ success: false, error: String(err) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (action === "sync_transcript") {
      const { sessionId, sessionKey, transcriptJson, julieReportJson } = body;
      if (!serviceAccountJson) {
        return new Response(JSON.stringify({ success: false, error: "Not configured" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      try {
        const token = await getAccessToken(serviceAccountJson);
        const folderConfig = settings?.config?.folders ?? {};
        const sessionsFolder = folderConfig.sessions ?? await findOrCreateFolder(token, "Sessions", folderConfig.root);
        const reportsFolder = folderConfig.reports ?? await findOrCreateFolder(token, "Reports", folderConfig.root);

        const transcriptFile = await uploadFileToDrive(
          token,
          `transcript_${sessionKey}.json`,
          JSON.stringify(transcriptJson, null, 2),
          "application/json",
          sessionsFolder
        );

        const transcriptLogId = crypto.randomUUID();
        await supabase.from("drive_sync_log").insert({
          id: transcriptLogId,
          session_id: sessionId,
          drive_file_id: transcriptFile.id,
          drive_url: transcriptFile.webViewLink ?? "",
          drive_folder: "sessions",
          file_name: `transcript_${sessionKey}.json`,
          file_type: "transcript",
          status: "synced",
          synced_at: new Date().toISOString(),
        });

        let reportUrl = "";
        if (julieReportJson) {
          const reportFile = await uploadFileToDrive(
            token,
            `julie_report_${sessionKey}.json`,
            JSON.stringify(julieReportJson, null, 2),
            "application/json",
            reportsFolder
          );
          reportUrl = reportFile.webViewLink ?? "";

          await supabase.from("drive_sync_log").insert({
            session_id: sessionId,
            drive_file_id: reportFile.id,
            drive_url: reportUrl,
            drive_folder: "reports",
            file_name: `julie_report_${sessionKey}.json`,
            file_type: "julie_report",
            status: "synced",
            synced_at: new Date().toISOString(),
          });
        }

        await supabase.from("integration_settings").update({ last_sync_at: new Date().toISOString() }).eq("integration_type", "google_drive");

        return new Response(JSON.stringify({
          success: true,
          transcriptUrl: transcriptFile.webViewLink,
          reportUrl,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: String(err) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (action === "sync_side_note") {
      const { sessionId, sessionKey, noteText, noteTags, noteMentors } = body;
      if (!serviceAccountJson) {
        return new Response(JSON.stringify({ success: false, error: "Not configured" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      try {
        const token = await getAccessToken(serviceAccountJson);
        const folderConfig = settings?.config?.folders ?? {};
        const sideNotesFolder = folderConfig.side_notes ?? await findOrCreateFolder(token, "SideNotes", folderConfig.root);

        const noteContent = `Side Note — ${sessionKey}\n\nText:\n${noteText}\n\nTags: ${noteTags?.join(", ") ?? ""}\nMentors: ${noteMentors?.join(", ") ?? ""}`;
        const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const noteFile = await uploadFileToDrive(token, `sidenote_${sessionKey}_${ts}.txt`, noteContent, "text/plain", sideNotesFolder);

        await supabase.from("drive_sync_log").insert({
          session_id: sessionId,
          drive_file_id: noteFile.id,
          drive_url: noteFile.webViewLink ?? "",
          drive_folder: "side_notes",
          file_name: `sidenote_${sessionKey}_${ts}.txt`,
          file_type: "side_note",
          status: "synced",
          synced_at: new Date().toISOString(),
        });

        return new Response(JSON.stringify({ success: true, driveUrl: noteFile.webViewLink }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: String(err) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (action === "retry_failed") {
      const { data: failed } = await supabase.from("drive_sync_log").select("*").eq("status", "failed").lt("retry_count", 3);
      return new Response(JSON.stringify({ success: true, failedCount: failed?.length ?? 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
