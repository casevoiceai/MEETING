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

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

function notionHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "Notion-Version": NOTION_VERSION,
  };
}

function richText(text: string) {
  return [{ type: "text", text: { content: text.slice(0, 2000) } }];
}

function urlProp(url: string) {
  return url ? { url } : { url: null };
}

function multiSelect(items: string[]) {
  return { multi_select: items.filter(Boolean).slice(0, 10).map((n) => ({ name: n.slice(0, 100) })) };
}

async function testConnection(apiKey: string): Promise<{ success: boolean; botName?: string; error?: string }> {
  const res = await fetch(`${NOTION_API}/users/me`, { headers: notionHeaders(apiKey) });
  if (!res.ok) {
    const err = await res.text();
    return { success: false, error: err };
  }
  const data = await res.json();
  return { success: true, botName: data.name ?? "Notion Integration" };
}

async function listDatabases(apiKey: string): Promise<{ id: string; title: string }[]> {
  const res = await fetch(`${NOTION_API}/search`, {
    method: "POST",
    headers: notionHeaders(apiKey),
    body: JSON.stringify({ filter: { value: "database", property: "object" } }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    title: ((r.title as { plain_text: string }[])?.[0]?.plain_text) ?? "Untitled",
  }));
}

async function createJulieReportPage(
  apiKey: string,
  dbId: string,
  payload: {
    sessionKey: string;
    sessionDate: string;
    summary: string;
    decisions: string[];
    openQuestions: string[];
    assignedTasks: { task: string; owner: string }[];
    activeTopics: string[];
    mentorsInvolved: string[];
    driveLinks: { transcript?: string; report?: string; files?: string[] };
  }
): Promise<string> {
  const props: Record<string, unknown> = {
    "Session": { title: richText(`Session — ${payload.sessionKey}`) },
    "Date": { date: { start: payload.sessionDate } },
    "Summary": { rich_text: richText(payload.summary || "No summary generated.") },
    "Decisions": { rich_text: richText(payload.decisions.slice(0, 5).join("\n• ") || "None") },
    "Open Questions": { rich_text: richText(payload.openQuestions.slice(0, 5).join("\n? ") || "None") },
    "Topics": multiSelect(payload.activeTopics.slice(0, 5)),
    "Team": multiSelect(payload.mentorsInvolved.slice(0, 10)),
  };

  if (payload.driveLinks.transcript) {
    props["Transcript (Drive)"] = urlProp(payload.driveLinks.transcript);
  }
  if (payload.driveLinks.report) {
    props["Report (Drive)"] = urlProp(payload.driveLinks.report);
  }

  const children: unknown[] = [];

  if (payload.assignedTasks.length > 0) {
    children.push({ object: "block", type: "heading_2", heading_2: { rich_text: richText("Tasks") } });
    for (const t of payload.assignedTasks.slice(0, 10)) {
      children.push({
        object: "block",
        type: "to_do",
        to_do: { rich_text: richText(`${t.task} → ${t.owner}`), checked: false },
      });
    }
  }

  if (payload.decisions.length > 0) {
    children.push({ object: "block", type: "heading_2", heading_2: { rich_text: richText("Decisions Made") } });
    for (const d of payload.decisions.slice(0, 10)) {
      children.push({ object: "block", type: "bulleted_list_item", bulleted_list_item: { rich_text: richText(d) } });
    }
  }

  if (payload.openQuestions.length > 0) {
    children.push({ object: "block", type: "heading_2", heading_2: { rich_text: richText("Unresolved Questions") } });
    for (const q of payload.openQuestions.slice(0, 10)) {
      children.push({ object: "block", type: "bulleted_list_item", bulleted_list_item: { rich_text: richText(q) } });
    }
  }

  const res = await fetch(`${NOTION_API}/pages`, {
    method: "POST",
    headers: notionHeaders(apiKey),
    body: JSON.stringify({ parent: { database_id: dbId }, properties: props, children }),
  });

  if (!res.ok) throw new Error(`Failed to create Julie report page: ${await res.text()}`);
  const page = await res.json();
  return page.id as string;
}

async function createTaskPage(
  apiKey: string,
  dbId: string,
  payload: {
    taskText: string;
    owner: string;
    sessionKey: string;
    sessionId?: string;
    projectName?: string;
    status?: string;
  }
): Promise<string> {
  const props: Record<string, unknown> = {
    "Task": { title: richText(payload.taskText) },
    "Owner": { rich_text: richText(payload.owner) },
    "Session": { rich_text: richText(payload.sessionKey) },
    "Status": { select: { name: payload.status ?? "Open" } },
  };

  if (payload.projectName) {
    props["Project"] = { rich_text: richText(payload.projectName) };
  }

  const res = await fetch(`${NOTION_API}/pages`, {
    method: "POST",
    headers: notionHeaders(apiKey),
    body: JSON.stringify({ parent: { database_id: dbId }, properties: props }),
  });

  if (!res.ok) throw new Error(`Failed to create task page: ${await res.text()}`);
  const page = await res.json();
  return page.id as string;
}

async function createOrUpdateProjectPage(
  apiKey: string,
  dbId: string,
  payload: {
    projectName: string;
    summary: string;
    tags: string[];
    driveFileUrls: string[];
    sessionKeys: string[];
    existingPageId?: string;
  }
): Promise<string> {
  const props: Record<string, unknown> = {
    "Project": { title: richText(payload.projectName) },
    "Summary": { rich_text: richText(payload.summary || "") },
    "Tags": multiSelect(payload.tags),
    "Sessions": { rich_text: richText(payload.sessionKeys.join(", ")) },
    "Files (Drive)": { rich_text: richText(payload.driveFileUrls.join("\n")) },
  };

  if (payload.existingPageId) {
    const res = await fetch(`${NOTION_API}/pages/${payload.existingPageId}`, {
      method: "PATCH",
      headers: notionHeaders(apiKey),
      body: JSON.stringify({ properties: props }),
    });
    if (!res.ok) throw new Error(`Failed to update project page: ${await res.text()}`);
    return payload.existingPageId;
  }

  const res = await fetch(`${NOTION_API}/pages`, {
    method: "POST",
    headers: notionHeaders(apiKey),
    body: JSON.stringify({ parent: { database_id: dbId }, properties: props }),
  });
  if (!res.ok) throw new Error(`Failed to create project page: ${await res.text()}`);
  const page = await res.json();
  return page.id as string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    const notionApiKey = Deno.env.get("NOTION_API_KEY") ?? "";

    const { data: settings } = await supabase
      .from("integration_settings")
      .select("*")
      .eq("integration_type", "notion")
      .maybeSingle();

    const dbConfig = settings?.config?.databases ?? {};

    if (action === "test_connection") {
      if (!notionApiKey) {
        return new Response(JSON.stringify({ success: false, error: "NOTION_API_KEY secret not configured" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const result = await testConnection(notionApiKey);
      if (result.success) {
        await supabase.from("integration_settings").update({ connected: true, connected_at: new Date().toISOString() }).eq("integration_type", "notion");
      }
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "list_databases") {
      if (!notionApiKey) {
        return new Response(JSON.stringify({ success: false, error: "Not configured" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const dbs = await listDatabases(notionApiKey);
      return new Response(JSON.stringify({ success: true, databases: dbs }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "save_db_config") {
      const { databases } = body;
      await supabase.from("integration_settings").update({
        config: { databases },
        updated_at: new Date().toISOString(),
      }).eq("integration_type", "notion");
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "sync_julie_report") {
      const { syncLogId, sessionId, sessionKey, sessionDate, summary, decisions, openQuestions, assignedTasks, activeTopics, mentorsInvolved, driveLinks } = body;

      if (!notionApiKey) {
        await supabase.from("notion_sync_log").update({ status: "failed", error_message: "NOTION_API_KEY not configured" }).eq("id", syncLogId);
        return new Response(JSON.stringify({ success: false, error: "Not configured" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const julieDbId = dbConfig.julie_reports;
      if (!julieDbId) {
        await supabase.from("notion_sync_log").update({ status: "failed", error_message: "Julie Reports database not configured" }).eq("id", syncLogId);
        return new Response(JSON.stringify({ success: false, error: "Julie Reports DB not configured" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      await supabase.from("notion_sync_log").update({ status: "syncing" }).eq("id", syncLogId);

      try {
        const pageId = await createJulieReportPage(notionApiKey, julieDbId, {
          sessionKey, sessionDate, summary, decisions, openQuestions, assignedTasks, activeTopics, mentorsInvolved, driveLinks,
        });

        await supabase.from("notion_sync_log").update({
          status: "synced",
          notion_page_id: pageId,
          synced_at: new Date().toISOString(),
        }).eq("id", syncLogId);

        await supabase.from("integration_settings").update({ last_sync_at: new Date().toISOString() }).eq("integration_type", "notion");

        return new Response(JSON.stringify({ success: true, notionPageId: pageId }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (err) {
        const retry = (body.retryCount ?? 0) + 1;
        await supabase.from("notion_sync_log").update({ status: "failed", error_message: String(err), retry_count: retry }).eq("id", syncLogId);
        return new Response(JSON.stringify({ success: false, error: String(err) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (action === "sync_task") {
      const { syncLogId, taskText, owner, sessionKey, sessionId, projectName } = body;

      if (!notionApiKey) {
        return new Response(JSON.stringify({ success: false, error: "Not configured" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const tasksDbId = dbConfig.tasks;
      if (!tasksDbId) {
        return new Response(JSON.stringify({ success: false, error: "Tasks database not configured" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (syncLogId) await supabase.from("notion_sync_log").update({ status: "syncing" }).eq("id", syncLogId);

      try {
        const pageId = await createTaskPage(notionApiKey, tasksDbId, { taskText, owner, sessionKey, sessionId, projectName });

        if (syncLogId) {
          await supabase.from("notion_sync_log").update({ status: "synced", notion_page_id: pageId, synced_at: new Date().toISOString() }).eq("id", syncLogId);
        }

        return new Response(JSON.stringify({ success: true, notionPageId: pageId }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (err) {
        if (syncLogId) await supabase.from("notion_sync_log").update({ status: "failed", error_message: String(err) }).eq("id", syncLogId);
        return new Response(JSON.stringify({ success: false, error: String(err) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (action === "sync_project") {
      const { syncLogId, projectId, projectName, summary, tags, driveFileUrls, sessionKeys } = body;

      if (!notionApiKey) {
        return new Response(JSON.stringify({ success: false, error: "Not configured" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const projectsDbId = dbConfig.projects;
      if (!projectsDbId) {
        return new Response(JSON.stringify({ success: false, error: "Projects database not configured" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: existingLog } = await supabase
        .from("notion_sync_log")
        .select("notion_page_id")
        .eq("local_id", projectId)
        .eq("local_type", "project")
        .eq("status", "synced")
        .maybeSingle();

      if (syncLogId) await supabase.from("notion_sync_log").update({ status: "syncing" }).eq("id", syncLogId);

      try {
        const pageId = await createOrUpdateProjectPage(notionApiKey, projectsDbId, {
          projectName, summary, tags, driveFileUrls, sessionKeys,
          existingPageId: existingLog?.notion_page_id,
        });

        if (syncLogId) {
          await supabase.from("notion_sync_log").update({ status: "synced", notion_page_id: pageId, synced_at: new Date().toISOString() }).eq("id", syncLogId);
        } else {
          await supabase.from("notion_sync_log").insert({
            notion_db: "projects",
            notion_page_id: pageId,
            local_id: projectId,
            local_type: "project",
            status: "synced",
            approved_by_user: true,
            payload: { projectName, summary, tags },
            synced_at: new Date().toISOString(),
          });
        }

        return new Response(JSON.stringify({ success: true, notionPageId: pageId }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (err) {
        if (syncLogId) await supabase.from("notion_sync_log").update({ status: "failed", error_message: String(err) }).eq("id", syncLogId);
        return new Response(JSON.stringify({ success: false, error: String(err) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (action === "get_sync_status") {
      const { sessionId } = body;
      const [driveRes, notionRes] = await Promise.all([
        supabase.from("drive_sync_log").select("*").eq("session_id", sessionId).order("created_at", { ascending: false }),
        supabase.from("notion_sync_log").select("*").eq("session_id", sessionId).order("created_at", { ascending: false }),
      ]);
      return new Response(JSON.stringify({
        success: true,
        drive: driveRes.data ?? [],
        notion: notionRes.data ?? [],
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
