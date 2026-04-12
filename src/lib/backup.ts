import { supabase } from "./supabase";

export type ExportFormat = "json" | "markdown" | "html";

export type BackupScope = {
  sessions: boolean;
  notes: boolean;
  projects: boolean;
  filesMetadata: boolean;
};

export interface BackupManifest {
  exportedAt: string;
  format: ExportFormat;
  scope: BackupScope;
  counts: {
    sessions: number;
    notes: number;
    projects: number;
    files: number;
  };
}

interface RawData {
  sessions: Record<string, unknown>[];
  transcripts: Record<string, unknown>[];
  julieReports: Record<string, unknown>[];
  sideNotes: Record<string, unknown>[];
  projects: Record<string, unknown>[];
  projectNotes: Record<string, unknown>[];
  projectTasks: Record<string, unknown>[];
  vaultFolders: Record<string, unknown>[];
  vaultFiles: Record<string, unknown>[];
  tags: Record<string, unknown>[];
}

async function fetchAll(scope: BackupScope): Promise<RawData> {
  const results = await Promise.all([
    scope.sessions
      ? supabase.from("sessions").select("*").order("session_date", { ascending: false })
      : Promise.resolve({ data: [] }),
    scope.sessions
      ? supabase.from("session_transcripts").select("*")
      : Promise.resolve({ data: [] }),
    scope.sessions
      ? supabase.from("julie_reports").select("*")
      : Promise.resolve({ data: [] }),
    scope.notes
      ? supabase.from("side_notes").select("*").order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    scope.projects
      ? supabase.from("projects").select("*").order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    scope.projects
      ? supabase.from("project_notes").select("*").order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    scope.projects
      ? supabase.from("project_tasks").select("*").order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    scope.filesMetadata
      ? supabase.from("vault_folders").select("*").order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    scope.filesMetadata
      ? supabase.from("vault_files").select("id,name,summary,tags,file_type,linked_project_id,linked_session_id,archived,created_at,updated_at,file_size,mime_type,original_name,quarantine_status,quarantine_reason").order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase.from("tags").select("*"),
  ]);

  return {
    sessions: (results[0].data ?? []) as Record<string, unknown>[],
    transcripts: (results[1].data ?? []) as Record<string, unknown>[],
    julieReports: (results[2].data ?? []) as Record<string, unknown>[],
    sideNotes: (results[3].data ?? []) as Record<string, unknown>[],
    projects: (results[4].data ?? []) as Record<string, unknown>[],
    projectNotes: (results[5].data ?? []) as Record<string, unknown>[],
    projectTasks: (results[6].data ?? []) as Record<string, unknown>[],
    vaultFolders: (results[7].data ?? []) as Record<string, unknown>[],
    vaultFiles: (results[8].data ?? []) as Record<string, unknown>[],
    tags: (results[9].data ?? []) as Record<string, unknown>[],
  };
}

function buildManifest(data: RawData, format: ExportFormat, scope: BackupScope): BackupManifest {
  return {
    exportedAt: new Date().toISOString(),
    format,
    scope,
    counts: {
      sessions: data.sessions.length,
      notes: data.sideNotes.length,
      projects: data.projects.length,
      files: data.vaultFiles.length,
    },
  };
}

function toJSON(data: RawData, scope: BackupScope): string {
  const manifest = buildManifest(data, "json", scope);
  const payload: Record<string, unknown> = { __manifest: manifest };
  if (scope.sessions) {
    payload.sessions = data.sessions;
    payload.session_transcripts = data.transcripts;
    payload.julie_reports = data.julieReports;
  }
  if (scope.notes) payload.side_notes = data.sideNotes;
  if (scope.projects) {
    payload.projects = data.projects;
    payload.project_notes = data.projectNotes;
    payload.project_tasks = data.projectTasks;
  }
  if (scope.filesMetadata) {
    payload.vault_folders = data.vaultFolders;
    payload.vault_files = data.vaultFiles;
  }
  payload.tags = data.tags;
  return JSON.stringify(payload, null, 2);
}

function mdSection(title: string, lines: string[]): string {
  if (!lines.length) return "";
  return `## ${title}\n\n${lines.join("\n\n")}\n\n`;
}

function safeStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return (v as unknown[]).map((x) => String(x)).join(", ");
  return JSON.stringify(v);
}

function toMarkdown(data: RawData, scope: BackupScope): string {
  const manifest = buildManifest(data, "markdown", scope);
  const lines: string[] = [];
  lines.push(`# MyStatement_AI — Data Backup`);
  lines.push(`> Exported: ${new Date(manifest.exportedAt).toLocaleString()}\n`);

  if (scope.sessions && data.sessions.length) {
    lines.push(`## Sessions (${data.sessions.length})\n`);
    for (const s of data.sessions) {
      lines.push(`### ${safeStr(s.session_key)} — ${safeStr(s.session_date)}`);
      if (s.session_summary) lines.push(`**Summary:** ${safeStr(s.session_summary)}\n`);
      if (Array.isArray(s.key_topics) && s.key_topics.length) lines.push(`**Topics:** ${(s.key_topics as string[]).join(", ")}\n`);
      const transcript = data.transcripts.find((t) => t.session_id === s.id);
      if (transcript && Array.isArray(transcript.messages) && (transcript.messages as unknown[]).length) {
        lines.push(`\n#### Transcript\n`);
        for (const msg of transcript.messages as { speaker: string; text: string; sender?: string }[]) {
          const who = msg.sender || msg.speaker;
          lines.push(`**${who}:** ${msg.text}\n`);
        }
      }
      lines.push("---");
    }
  }

  if (scope.notes && data.sideNotes.length) {
    lines.push(`\n## Notes (${data.sideNotes.length})\n`);
    for (const n of data.sideNotes) {
      lines.push(`### Note — ${safeStr(n.created_at).slice(0, 10)}`);
      lines.push(safeStr(n.text));
      if (Array.isArray(n.tags) && n.tags.length) lines.push(`*Tags: ${(n.tags as string[]).join(", ")}*`);
      lines.push("---");
    }
  }

  if (scope.projects && data.projects.length) {
    lines.push(`\n## Projects (${data.projects.length})\n`);
    for (const p of data.projects) {
      lines.push(`### ${safeStr(p.name)}`);
      const pNotes = data.projectNotes.filter((n) => n.project_id === p.id);
      const pTasks = data.projectTasks.filter((t) => t.project_id === p.id);
      if (pNotes.length) {
        lines.push(`\n#### Notes\n`);
        for (const n of pNotes) lines.push(`- ${safeStr(n.text)}`);
      }
      if (pTasks.length) {
        lines.push(`\n#### Tasks\n`);
        for (const t of pTasks) lines.push(`- [${safeStr(t.status)}] ${safeStr(t.text)} — ${safeStr(t.owner)}`);
      }
      lines.push("---");
    }
  }

  if (scope.filesMetadata && data.vaultFiles.length) {
    lines.push(`\n## Vault Files Metadata (${data.vaultFiles.length})\n`);
    lines.push(`| Name | Type | Size | Tags | Created |`);
    lines.push(`|------|------|------|------|---------|`);
    for (const f of data.vaultFiles) {
      const size = f.file_size ? `${Math.round((f.file_size as number) / 1024)}KB` : "—";
      const tags = Array.isArray(f.tags) ? (f.tags as string[]).join(", ") : "";
      lines.push(`| ${safeStr(f.name)} | ${safeStr(f.file_type)} | ${size} | ${tags} | ${safeStr(f.created_at).slice(0, 10)} |`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function toHTML(data: RawData, scope: BackupScope): string {
  const manifest = buildManifest(data, "html", scope);
  const md = toMarkdown(data, scope);

  const body = md
    .split("\n")
    .map((line) => {
      if (line.startsWith("### ")) return `<h3>${escHtml(line.slice(4))}</h3>`;
      if (line.startsWith("## ")) return `<h2>${escHtml(line.slice(3))}</h2>`;
      if (line.startsWith("# ")) return `<h1>${escHtml(line.slice(2))}</h1>`;
      if (line.startsWith("> ")) return `<blockquote>${escHtml(line.slice(2))}</blockquote>`;
      if (line.startsWith("---")) return `<hr>`;
      if (line.startsWith("- ")) return `<li>${escHtml(line.slice(2))}</li>`;
      if (line.startsWith("|")) return `<tr><td>${line.split("|").filter(Boolean).map((c) => escHtml(c.trim())).join("</td><td>")}</td></tr>`;
      if (line.startsWith("**") && line.endsWith("**")) return `<strong>${escHtml(line.slice(2, -2))}</strong>`;
      if (!line.trim()) return "<br>";
      return `<p>${escHtml(line)}</p>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MyStatement_AI Backup — ${new Date(manifest.exportedAt).toLocaleDateString()}</title>
<style>
  body { font-family: system-ui, sans-serif; line-height: 1.6; color: #1a1a2e; max-width: 900px; margin: 40px auto; padding: 0 24px; }
  h1 { color: #0a0f1e; border-bottom: 3px solid #C9A84C; padding-bottom: 12px; }
  h2 { color: #1B3A5E; border-bottom: 1px solid #dee2e6; padding-bottom: 8px; margin-top: 2.5em; }
  h3 { color: #2d4a6b; margin-top: 1.5em; }
  hr { border: none; border-top: 1px solid #dee2e6; margin: 1.5em 0; }
  blockquote { color: #6c757d; border-left: 3px solid #C9A84C; padding-left: 1em; margin-left: 0; }
  table { border-collapse: collapse; width: 100%; }
  td { border: 1px solid #dee2e6; padding: 8px 12px; font-size: 0.9em; }
  li { margin: 4px 0; }
  .meta { background: #f8f9fa; padding: 16px; border-radius: 8px; margin-bottom: 2em; font-size: 0.875em; color: #6c757d; }
</style>
</head>
<body>
<div class="meta">
  <strong>Exported:</strong> ${escHtml(new Date(manifest.exportedAt).toLocaleString())} &nbsp;|&nbsp;
  <strong>Sessions:</strong> ${manifest.counts.sessions} &nbsp;|&nbsp;
  <strong>Notes:</strong> ${manifest.counts.notes} &nbsp;|&nbsp;
  <strong>Projects:</strong> ${manifest.counts.projects} &nbsp;|&nbsp;
  <strong>Files:</strong> ${manifest.counts.files}
</div>
${body}
</body>
</html>`;
}

function buildBlob(content: string, format: ExportFormat): { blob: Blob; ext: string; mime: string } {
  const mimeMap: Record<ExportFormat, string> = {
    json: "application/json",
    markdown: "text/markdown",
    html: "text/html",
  };
  const extMap: Record<ExportFormat, string> = { json: "json", markdown: "md", html: "html" };
  return {
    blob: new Blob([content], { type: mimeMap[format] }),
    ext: extMap[format],
    mime: mimeMap[format],
  };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

export async function runExport(
  format: ExportFormat,
  scope: BackupScope
): Promise<{ blob: Blob; filename: string; manifest: BackupManifest }> {
  const data = await fetchAll(scope);
  const manifest = buildManifest(data, format, scope);

  let content = "";
  if (format === "json") content = toJSON(data, scope);
  else if (format === "markdown") content = toMarkdown(data, scope);
  else content = toHTML(data, scope);

  const { blob, ext } = buildBlob(content, format);
  const ts = new Date().toISOString().slice(0, 16).replace("T", "_").replace(":", "-");
  const filename = `mystatement_backup_${ts}.${ext}`;

  return { blob, filename, manifest };
}

export async function quickBackup(format: ExportFormat = "json"): Promise<void> {
  const scope: BackupScope = { sessions: true, notes: true, projects: true, filesMetadata: true };
  const { blob, filename } = await runExport(format, scope);
  downloadBlob(blob, filename);
}
