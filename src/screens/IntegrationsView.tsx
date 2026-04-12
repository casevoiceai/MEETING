import { useState, useEffect, useCallback } from "react";
import {
  Cloud, Database, CheckCircle, XCircle, RefreshCw,
  ChevronRight, Send, Link as LinkIcon, FolderOpen,
  FileText, Layers, Check, X, Shield,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import {
  getAllIntegrationSettings, listDriveSyncLogs, listNotionSyncLogs,
  listPendingNotionApprovals, approveNotionSync, renameProject,
  deleteEmail, deleteProjectTask,
  type IntegrationSettings, type DriveSyncLog, type NotionSyncLog,
} from "../lib/db";
import {
  testDriveConnection, testNotionConnection, listNotionDatabases,
  saveNotionDbConfig, pushJulieReportToNotion,
} from "../lib/integrations";
import ApprovalQueue from "../components/ApprovalQueue";
import type { ApprovalEntry } from "../lib/approval";

const GOLD = "#C9A84C";
const NAVY = "#0D1B2E";
const CARD = "#0A1628";
const BORDER = "#1B2A4A";
const MUTED = "#8A9BB5";
const DIM = "#3A4F6A";
const TEXT = "#D0DFEE";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string; label: string }> = {
    synced:           { color: "#4ADE80", bg: "rgba(74,222,128,0.1)",   label: "Synced" },
    syncing:          { color: GOLD,      bg: "rgba(201,168,76,0.1)",  label: "Syncing" },
    pending:          { color: MUTED,     bg: "rgba(138,155,181,0.1)", label: "Pending" },
    pending_approval: { color: "#F97316", bg: "rgba(249,115,22,0.1)",  label: "Needs Approval" },
    approved:         { color: "#60A5FA", bg: "rgba(96,165,250,0.1)",  label: "Approved" },
    failed:           { color: "#F87171", bg: "rgba(248,113,113,0.1)", label: "Failed" },
  };
  const s = map[status] ?? { color: MUTED, bg: "rgba(138,155,181,0.1)", label: status };
  return (
    <span className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded" style={{ color: s.color, backgroundColor: s.bg }}>
      {s.label}
    </span>
  );
}

function ConnectionCard({
  icon, title, subtitle, connected, lastSync, onTest, testing, children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  connected: boolean;
  lastSync?: string | null;
  onTest: () => void;
  testing: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl p-5 flex flex-col gap-4" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(201,168,76,0.1)", border: `1px solid rgba(201,168,76,0.2)` }}>
            {icon}
          </div>
          <div>
            <p className="font-bold text-sm" style={{ color: TEXT }}>{title}</p>
            <p className="text-[11px] mt-0.5" style={{ color: MUTED }}>{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {connected ? (
            <span className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: "#4ADE80" }}>
              <CheckCircle size={13} /> Connected
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: "#F87171" }}>
              <XCircle size={13} /> Not connected
            </span>
          )}
        </div>
      </div>

      {lastSync && (
        <p className="text-[10px]" style={{ color: DIM }}>
          Last sync: {new Date(lastSync).toLocaleString()}
        </p>
      )}

      {children}

      <button
        onClick={onTest}
        disabled={testing}
        className="flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all hover:opacity-80 disabled:opacity-40"
        style={{ backgroundColor: "rgba(201,168,76,0.12)", color: GOLD, border: `1px solid rgba(201,168,76,0.3)` }}
      >
        <RefreshCw size={13} className={testing ? "animate-spin" : ""} />
        {testing ? "Testing…" : "Test Connection"}
      </button>
    </div>
  );
}

function SyncLogRow({ log }: { log: DriveSyncLog | NotionSyncLog }) {
  const isDrive = "drive_file_id" in log;
  return (
    <div className="flex items-center justify-between px-3 py-2.5 rounded-lg" style={{ backgroundColor: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}` }}>
      <div className="flex items-center gap-2.5 min-w-0">
        {isDrive ? <Cloud size={13} style={{ color: MUTED, flexShrink: 0 }} /> : <Database size={13} style={{ color: MUTED, flexShrink: 0 }} />}
        <div className="min-w-0">
          <p className="text-[11px] font-semibold truncate" style={{ color: TEXT }}>
            {isDrive ? (log as DriveSyncLog).file_name : `${(log as NotionSyncLog).notion_db} — ${(log as NotionSyncLog).local_type}`}
          </p>
          <p className="text-[9px]" style={{ color: DIM }}>
            {new Date(log.created_at).toLocaleString()}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {isDrive && (log as DriveSyncLog).drive_url && (
          <a href={(log as DriveSyncLog).drive_url} target="_blank" rel="noreferrer"
            className="text-[10px] hover:opacity-80 transition-opacity"
            style={{ color: "#60A5FA" }}>
            <LinkIcon size={11} />
          </a>
        )}
        <StatusBadge status={log.status} />
      </div>
    </div>
  );
}

interface NotionDbSelectorProps {
  databases: { id: string; title: string }[];
  config: { julie_reports?: string; tasks?: string; projects?: string };
  onChange: (key: "julie_reports" | "tasks" | "projects", val: string) => void;
}

function NotionDbSelector({ databases, config, onChange }: NotionDbSelectorProps) {
  const fields: { key: "julie_reports" | "tasks" | "projects"; label: string; icon: React.ReactNode }[] = [
    { key: "julie_reports", label: "Julie Reports", icon: <FileText size={12} /> },
    { key: "tasks",         label: "Tasks",         icon: <CheckCircle size={12} /> },
    { key: "projects",      label: "Projects",      icon: <Layers size={12} /> },
  ];

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[9px] tracking-widest uppercase font-bold" style={{ color: MUTED }}>Map Notion Databases</p>
      {fields.map(({ key, label, icon }) => (
        <div key={key} className="flex items-center gap-2">
          <span style={{ color: DIM, flexShrink: 0 }}>{icon}</span>
          <span className="text-[11px] font-semibold w-28 flex-shrink-0" style={{ color: MUTED }}>{label}</span>
          <select
            value={config[key] ?? ""}
            onChange={(e) => onChange(key, e.target.value)}
            className="flex-1 text-[11px] px-2 py-1.5 rounded-lg outline-none"
            style={{ backgroundColor: "#111D30", color: TEXT, border: `1px solid ${BORDER}` }}
          >
            <option value="">— select database —</option>
            {databases.map((db) => (
              <option key={db.id} value={db.id}>{db.title}</option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

export default function IntegrationsView({ onPendingChange }: { onPendingChange?: (count: number) => void }) {
  const [integrations, setIntegrations] = useState<IntegrationSettings[]>([]);
  const [driveLogs, setDriveLogs] = useState<DriveSyncLog[]>([]);
  const [notionLogs, setNotionLogs] = useState<NotionSyncLog[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<NotionSyncLog[]>([]);
  const [testingDrive, setTestingDrive] = useState(false);
  const [testingNotion, setTestingNotion] = useState(false);
  const [driveResult, setDriveResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [notionResult, setNotionResult] = useState<{ success: boolean; error?: string; botName?: string } | null>(null);
  const [notionDatabases, setNotionDatabases] = useState<{ id: string; title: string }[]>([]);
  const [notionDbConfig, setNotionDbConfig] = useState<{ julie_reports?: string; tasks?: string; projects?: string }>({});
  const [savingDbConfig, setSavingDbConfig] = useState(false);
  const [loadingDbs, setLoadingDbs] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [pushingId, setPushingId] = useState<string | null>(null);
  const [tab, setTab] = useState<"approvals" | "setup" | "drive" | "notion" | "notion_approvals">("approvals");
  const [approvalPendingCount, setApprovalPendingCount] = useState(0);

  const load = useCallback(async () => {
    const [settings, drive, notion, pending] = await Promise.all([
      getAllIntegrationSettings(),
      listDriveSyncLogs(),
      listNotionSyncLogs(),
      listPendingNotionApprovals(),
    ]);
    setIntegrations(settings);
    setDriveLogs(drive);
    setNotionLogs(notion);
    setPendingApprovals(pending);

    const notionSettings = settings.find((s) => s.integration_type === "notion");
    if (notionSettings?.config?.databases) {
      setNotionDbConfig(notionSettings.config.databases as { julie_reports?: string; tasks?: string; projects?: string });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const driveSettings = integrations.find((s) => s.integration_type === "google_drive");
  const notionSettings = integrations.find((s) => s.integration_type === "notion");

  async function handleTestDrive() {
    setTestingDrive(true);
    setDriveResult(null);
    const result = await testDriveConnection();
    setDriveResult(result);
    setTestingDrive(false);
    if (result.success) load();
  }

  async function handleTestNotion() {
    setTestingNotion(true);
    setNotionResult(null);
    const result = await testNotionConnection();
    setNotionResult(result);
    setTestingNotion(false);
    if (result.success) {
      setLoadingDbs(true);
      const dbs = await listNotionDatabases();
      setNotionDatabases(dbs);
      setLoadingDbs(false);
      load();
    }
  }

  async function handleLoadDatabases() {
    setLoadingDbs(true);
    const dbs = await listNotionDatabases();
    setNotionDatabases(dbs);
    setLoadingDbs(false);
  }

  async function handleSaveDbConfig() {
    setSavingDbConfig(true);
    await saveNotionDbConfig(notionDbConfig);
    setSavingDbConfig(false);
    load();
  }

  async function handleApprove(log: NotionSyncLog) {
    setApprovingId(log.id);
    await approveNotionSync(log.id);
    setPushingId(log.id);
    const payload = log.payload as Record<string, unknown>;
    const result = await pushJulieReportToNotion(log.id, {
      sessionId: (payload.sessionId as string) ?? log.session_id ?? "",
      sessionKey: (payload.sessionKey as string) ?? "",
      sessionDate: (payload.sessionDate as string) ?? "",
      summary: (payload.summary as string) ?? "",
      decisions: (payload.decisions as string[]) ?? [],
      openQuestions: (payload.openQuestions as string[]) ?? [],
      assignedTasks: (payload.assignedTasks as { task: string; owner: string }[]) ?? [],
      activeTopics: (payload.activeTopics as string[]) ?? [],
      mentorsInvolved: (payload.mentorsInvolved as string[]) ?? [],
      driveLinks: (payload.driveLinks as { transcript?: string; report?: string }) ?? {},
    });
    setPushingId(null);
    setApprovingId(null);
    if (result.success) load();
  }

  async function handleReject(logId: string) {
    await supabase.from("notion_sync_log").update({ status: "failed", error_message: "Rejected by user" }).eq("id", logId);
    load();
  }

  const TABS = [
    { id: "approvals" as const,         label: "Approvals", count: approvalPendingCount },
    { id: "notion_approvals" as const,  label: "Notion Queue", count: pendingApprovals.length },
    { id: "setup" as const,             label: "Setup" },
    { id: "drive" as const,             label: "Drive Log" },
    { id: "notion" as const,            label: "Notion Log" },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ backgroundColor: NAVY, color: "#FFFFFF" }}>
      <div className="flex items-center justify-between px-6 py-3.5 border-b flex-shrink-0" style={{ borderColor: BORDER }}>
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-sm font-bold tracking-widest uppercase" style={{ color: GOLD }}>Integrations & Approvals</h1>
            <p className="text-[11px] mt-0.5" style={{ color: MUTED }}>All team proposals require your approval before execution</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ backgroundColor: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }}>
            <Shield size={11} style={{ color: "#F59E0B" }} />
            <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "#F59E0B" }}>User approval required for all final actions</span>
          </div>
          <button onClick={load} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all hover:opacity-80" style={{ backgroundColor: "#1B2A4A", color: MUTED }}>
            <RefreshCw size={11} /> Refresh
          </button>
        </div>
      </div>

      <div className="flex gap-1 px-6 pt-4 pb-0 border-b flex-shrink-0" style={{ borderColor: BORDER }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="relative px-4 py-2 text-xs font-semibold tracking-wider uppercase rounded-t transition-all"
            style={{
              color: tab === t.id ? GOLD : DIM,
              borderBottom: tab === t.id ? `2px solid ${GOLD}` : "2px solid transparent",
              backgroundColor: tab === t.id ? "rgba(201,168,76,0.04)" : "transparent",
            }}
          >
            {t.label}
            {t.count != null && t.count > 0 && (
              <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ backgroundColor: "rgba(245,158,11,0.2)", color: "#F59E0B" }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">

        {tab === "approvals" && (
          <div className="flex flex-col min-h-0 -mx-6 -my-5">
            <ApprovalQueue
              onPendingCountChange={(count) => {
                setApprovalPendingCount(count);
                onPendingChange?.(count);
              }}
              onExecute={(entry: ApprovalEntry) => {
                if (entry.action_type === "project_rename" && entry.payload?.project_id) {
                  const { project_id, new_name } = entry.payload as { project_id: string; new_name: string };
                  renameProject(project_id, new_name).catch(() => {});
                }
                if (entry.action_type === "email_delete" && entry.payload?.email_id) {
                  deleteEmail(entry.payload.email_id as string).catch(() => {});
                }
                if (entry.action_type === "task_delete" && entry.payload?.task_id) {
                  deleteProjectTask(entry.payload.task_id as string).catch(() => {});
                }
              }}
            />
          </div>
        )}

        {tab === "setup" && (
          <div className="grid grid-cols-1 gap-5 max-w-2xl">

            <div className="rounded-xl px-5 py-4" style={{ backgroundColor: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.2)" }}>
              <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: "#60A5FA" }}>How it works</p>
              <div className="flex flex-col gap-1.5 text-[11px]" style={{ color: MUTED }}>
                <p>1. Add <code className="px-1 rounded text-[10px]" style={{ backgroundColor: "#1B2A4A", color: GOLD }}>GOOGLE_SERVICE_ACCOUNT_JSON</code> secret in Supabase → Edge Functions → Secrets</p>
                <p>2. Add <code className="px-1 rounded text-[10px]" style={{ backgroundColor: "#1B2A4A", color: GOLD }}>NOTION_API_KEY</code> secret in Supabase → Edge Functions → Secrets</p>
                <p>3. Test each connection below, then map Notion databases</p>
                <p>4. Files sync to Drive automatically. Session reports go to Notion after your approval</p>
              </div>
            </div>

            <ConnectionCard
              icon={<Cloud size={18} style={{ color: GOLD }} />}
              title="Google Drive"
              subtitle="Raw file storage — transcripts, vault files, side notes, reports"
              connected={driveSettings?.connected ?? false}
              lastSync={driveSettings?.last_sync_at}
              onTest={handleTestDrive}
              testing={testingDrive}
            >
              {driveResult && (
                <div className="px-3 py-2.5 rounded-lg text-[11px]" style={{
                  backgroundColor: driveResult.success ? "rgba(74,222,128,0.06)" : "rgba(248,113,113,0.06)",
                  border: `1px solid ${driveResult.success ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}`,
                  color: driveResult.success ? "#4ADE80" : "#F87171",
                }}>
                  {driveResult.success
                    ? "Connected. Folder structure created in Google Drive: /MyStatement/Sessions, /Files, /SideNotes, /Reports"
                    : `Error: ${driveResult.error}`}
                </div>
              )}
              {driveSettings?.connected && (
                <div className="flex flex-col gap-1">
                  <p className="text-[9px] tracking-widest uppercase font-bold" style={{ color: DIM }}>Drive Folders</p>
                  {["Sessions", "Files", "SideNotes", "Reports"].map((f) => (
                    <div key={f} className="flex items-center gap-2">
                      <FolderOpen size={11} style={{ color: DIM }} />
                      <span className="text-[11px]" style={{ color: MUTED }}>/MyStatement/{f}</span>
                    </div>
                  ))}
                </div>
              )}
            </ConnectionCard>

            <ConnectionCard
              icon={<Database size={18} style={{ color: GOLD }} />}
              title="Notion"
              subtitle="Structured workspace — Julie reports, tasks, projects with Drive links"
              connected={notionSettings?.connected ?? false}
              lastSync={notionSettings?.last_sync_at}
              onTest={handleTestNotion}
              testing={testingNotion}
            >
              {notionResult && (
                <div className="px-3 py-2.5 rounded-lg text-[11px]" style={{
                  backgroundColor: notionResult.success ? "rgba(74,222,128,0.06)" : "rgba(248,113,113,0.06)",
                  border: `1px solid ${notionResult.success ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}`,
                  color: notionResult.success ? "#4ADE80" : "#F87171",
                }}>
                  {notionResult.success
                    ? `Connected as: ${notionResult.botName}`
                    : `Error: ${notionResult.error}`}
                </div>
              )}

              {notionSettings?.connected && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] tracking-widest uppercase font-bold" style={{ color: DIM }}>Database Mapping</p>
                    <button
                      onClick={handleLoadDatabases}
                      disabled={loadingDbs}
                      className="flex items-center gap-1 text-[10px] px-2 py-1 rounded transition-all hover:opacity-80"
                      style={{ backgroundColor: "#1B2A4A", color: MUTED }}
                    >
                      <RefreshCw size={9} className={loadingDbs ? "animate-spin" : ""} />
                      Load databases
                    </button>
                  </div>

                  {notionDatabases.length > 0 && (
                    <>
                      <NotionDbSelector
                        databases={notionDatabases}
                        config={notionDbConfig}
                        onChange={(key, val) => setNotionDbConfig((prev) => ({ ...prev, [key]: val }))}
                      />
                      <button
                        onClick={handleSaveDbConfig}
                        disabled={savingDbConfig}
                        className="flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                        style={{ backgroundColor: "rgba(74,222,128,0.1)", color: "#4ADE80", border: "1px solid rgba(74,222,128,0.3)" }}
                      >
                        <Check size={12} />
                        {savingDbConfig ? "Saving…" : "Save Database Config"}
                      </button>
                    </>
                  )}

                  {notionDatabases.length === 0 && (
                    <p className="text-[11px]" style={{ color: DIM }}>
                      Click "Load databases" to see your Notion databases. Make sure your integration is shared with the databases you want to use.
                    </p>
                  )}
                </div>
              )}
            </ConnectionCard>

            <div className="rounded-xl p-5" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
              <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: MUTED }}>Data Flow</p>
              <div className="flex flex-col gap-2">
                {[
                  { from: "File Upload", to: "Google Drive /Files", icon: <Cloud size={11} /> },
                  { from: "Session End", to: "Drive /Sessions + /Reports", icon: <Cloud size={11} /> },
                  { from: "Side Note Saved", to: "Drive /SideNotes", icon: <Cloud size={11} /> },
                  { from: "Julie Report (approved)", to: "Notion Julie Reports DB", icon: <Database size={11} /> },
                  { from: "Task Created", to: "Notion Tasks DB", icon: <Database size={11} /> },
                  { from: "Project Updated", to: "Notion Projects DB", icon: <Database size={11} /> },
                ].map((row, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px]">
                    <span className="font-semibold" style={{ color: TEXT, minWidth: "160px" }}>{row.from}</span>
                    <ChevronRight size={10} style={{ color: DIM, flexShrink: 0 }} />
                    <span style={{ color: MUTED }}>{row.icon}</span>
                    <span style={{ color: MUTED }}>{row.to}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "notion_approvals" && (
          <div className="flex flex-col gap-3 max-w-2xl">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold" style={{ color: TEXT }}>Pending Notion Approvals</p>
              <p className="text-[11px]" style={{ color: DIM }}>{pendingApprovals.length} item{pendingApprovals.length !== 1 ? "s" : ""} waiting</p>
            </div>

            {pendingApprovals.length === 0 ? (
              <div className="rounded-xl p-8 text-center" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
                <CheckCircle size={28} className="mx-auto mb-3" style={{ color: "#4ADE80", opacity: 0.4 }} />
                <p className="text-sm font-semibold" style={{ color: MUTED }}>No pending approvals</p>
                <p className="text-[11px] mt-1" style={{ color: DIM }}>Session reports will appear here for review before being pushed to Notion</p>
              </div>
            ) : (
              pendingApprovals.map((log) => {
                const payload = log.payload as Record<string, unknown>;
                const decisions = (payload.decisions as string[]) ?? [];
                const tasks = (payload.assignedTasks as { task: string; owner: string }[]) ?? [];
                const topics = (payload.activeTopics as string[]) ?? [];
                const isApproving = approvingId === log.id;
                const isPushing = pushingId === log.id;

                return (
                  <div key={log.id} className="rounded-xl p-5 flex flex-col gap-4" style={{ backgroundColor: CARD, border: `1px solid rgba(249,115,22,0.3)` }}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-sm" style={{ color: TEXT }}>
                          Julie Report — {(payload.sessionKey as string) ?? "Session"}
                        </p>
                        <p className="text-[11px] mt-0.5" style={{ color: DIM }}>
                          {(payload.sessionDate as string) ?? ""} · {log.notion_db}
                        </p>
                      </div>
                      <StatusBadge status={log.status} />
                    </div>

                    {(payload.summary as string) && (
                      <p className="text-[12px] leading-relaxed" style={{ color: MUTED }}>{(payload.summary as string).slice(0, 200)}</p>
                    )}

                    <div className="grid grid-cols-3 gap-3">
                      {decisions.length > 0 && (
                        <div>
                          <p className="text-[9px] tracking-widest uppercase font-bold mb-1.5" style={{ color: "#4ADE80" }}>Decisions ({decisions.length})</p>
                          {decisions.slice(0, 3).map((d, i) => (
                            <p key={i} className="text-[10px] leading-snug mb-0.5" style={{ color: MUTED }}>· {d.slice(0, 50)}</p>
                          ))}
                        </div>
                      )}
                      {tasks.length > 0 && (
                        <div>
                          <p className="text-[9px] tracking-widest uppercase font-bold mb-1.5" style={{ color: "#5A9BD3" }}>Tasks ({tasks.length})</p>
                          {tasks.slice(0, 3).map((t, i) => (
                            <p key={i} className="text-[10px] leading-snug mb-0.5" style={{ color: MUTED }}>· {t.task.slice(0, 40)}</p>
                          ))}
                        </div>
                      )}
                      {topics.length > 0 && (
                        <div>
                          <p className="text-[9px] tracking-widest uppercase font-bold mb-1.5" style={{ color: GOLD }}>Topics ({topics.length})</p>
                          {topics.slice(0, 3).map((t, i) => (
                            <p key={i} className="text-[10px] leading-snug mb-0.5" style={{ color: MUTED }}>· {t.slice(0, 40)}</p>
                          ))}
                        </div>
                      )}
                    </div>

                    {log.drive_links && (log.drive_links as string[]).length > 0 && (
                      <div className="flex flex-col gap-1">
                        <p className="text-[9px] tracking-widest uppercase font-bold" style={{ color: DIM }}>Drive Links</p>
                        {(log.drive_links as string[]).map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[11px] hover:opacity-80 transition-opacity" style={{ color: "#60A5FA" }}>
                            <LinkIcon size={10} /> {url.slice(0, 60)}…
                          </a>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => handleApprove(log)}
                        disabled={isApproving}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all hover:opacity-80 disabled:opacity-40"
                        style={{ backgroundColor: "rgba(74,222,128,0.12)", color: "#4ADE80", border: "1px solid rgba(74,222,128,0.3)" }}
                      >
                        {isPushing ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
                        {isPushing ? "Pushing to Notion…" : isApproving ? "Approving…" : "Approve & Push to Notion"}
                      </button>
                      <button
                        onClick={() => handleReject(log.id)}
                        disabled={isApproving}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all hover:opacity-80 disabled:opacity-40"
                        style={{ backgroundColor: "rgba(248,113,113,0.08)", color: "#F87171", border: "1px solid rgba(248,113,113,0.2)" }}
                      >
                        <X size={13} /> Reject
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === "drive" && (
          <div className="flex flex-col gap-3 max-w-2xl">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold" style={{ color: TEXT }}>Google Drive Sync Log</p>
              <div className="flex gap-2">
                {(["synced", "failed", "pending", "syncing"] as const).map((s) => {
                  const count = driveLogs.filter((l) => l.status === s).length;
                  return count > 0 ? <StatusBadge key={s} status={s} /> : null;
                })}
              </div>
            </div>
            {driveLogs.length === 0 ? (
              <div className="rounded-xl p-8 text-center" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
                <Cloud size={28} className="mx-auto mb-3" style={{ color: MUTED, opacity: 0.3 }} />
                <p className="text-sm font-semibold" style={{ color: MUTED }}>No Drive syncs yet</p>
                <p className="text-[11px] mt-1" style={{ color: DIM }}>Files will appear here after Drive is connected and syncs begin</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {driveLogs.map((log) => <SyncLogRow key={log.id} log={log} />)}
              </div>
            )}
          </div>
        )}

        {tab === "notion" && (
          <div className="flex flex-col gap-3 max-w-2xl">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold" style={{ color: TEXT }}>Notion Sync Log</p>
              <div className="flex gap-2">
                {(["synced", "failed", "pending_approval", "syncing"] as const).map((s) => {
                  const count = notionLogs.filter((l) => l.status === s).length;
                  return count > 0 ? <StatusBadge key={s} status={s} /> : null;
                })}
              </div>
            </div>
            {notionLogs.length === 0 ? (
              <div className="rounded-xl p-8 text-center" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
                <Database size={28} className="mx-auto mb-3" style={{ color: MUTED, opacity: 0.3 }} />
                <p className="text-sm font-semibold" style={{ color: MUTED }}>No Notion syncs yet</p>
                <p className="text-[11px] mt-1" style={{ color: DIM }}>Session reports, tasks, and projects will appear here after approval</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {notionLogs.map((log) => <SyncLogRow key={log.id} log={log} />)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
