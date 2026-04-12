import { useState, useEffect } from "react";
import {
  ShieldAlert, Download, CheckCircle2, Clock, AlertTriangle,
  RefreshCw, ChevronDown, ChevronUp, BookOpen, Database,
  Settings, FileText, X,
} from "lucide-react";
import {
  TIER0_ITEMS,
  CHECKLIST_STEPS,
  CATEGORY_COLORS,
  getLastBackupLog,
  getAllBackupLogs,
  logBackupCompletion,
  isBackupOverdue,
  daysSinceBackup,
  type BackupLog,
} from "../lib/criticalPath";
import { exportTier0, downloadBlob } from "../lib/backup";

const BG = "#0D1B2E";
const CARD = "#0A1628";
const BORDER = "#1B2A4A";
const MUTED = "#8A9BB5";
const DIM = "#3A4F6A";
const TEXT = "#D0DFEE";
const GOLD = "#C9A84C";

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  knowledge: <BookOpen size={12} />,
  config:    <Settings size={12} />,
  data:      <Database size={12} />,
  rules:     <FileText size={12} />,
};

type PanelStep = "overview" | "checklist" | "history";

export default function CriticalPathPanel() {
  const [activeStep, setActiveStep] = useState<PanelStep>("overview");
  const [lastLog, setLastLog] = useState<BackupLog | null>(null);
  const [logs, setLogs] = useState<BackupLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [checklistState, setChecklistState] = useState<Record<string, boolean>>({});
  const [exportingTier0, setExportingTier0] = useState(false);
  const [exportError, setExportError] = useState("");
  const [savingLog, setSavingLog] = useState(false);
  const [logSaved, setLogSaved] = useState(false);
  const [notes, setNotes] = useState("");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [last, all] = await Promise.all([getLastBackupLog(), getAllBackupLogs(10)]);
      setLastLog(last);
      setLogs(all);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  function toggleStep(id: string) {
    setChecklistState((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function handleExportTier0() {
    setExportingTier0(true);
    setExportError("");
    try {
      const result = await exportTier0();
      downloadBlob(result.blob, result.filename);
      setChecklistState((prev) => ({ ...prev, exported: true }));
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExportingTier0(false);
    }
  }

  async function handleLogBackup() {
    setSavingLog(true);
    try {
      const itemsExported = TIER0_ITEMS.map((i) => i.id);
      const log = await logBackupCompletion(checklistState, itemsExported, notes);
      setLastLog(log);
      setLogs((prev) => [log, ...prev]);
      setLogSaved(true);
      setChecklistState({});
      setNotes("");
      setTimeout(() => setLogSaved(false), 3000);
    } catch {
    } finally {
      setSavingLog(false);
    }
  }

  const overdue = isBackupOverdue(lastLog);
  const days = daysSinceBackup(lastLog);
  const completedSteps = CHECKLIST_STEPS.filter((s) => checklistState[s.id]).length;
  const allStepsDone = completedSteps === CHECKLIST_STEPS.length;

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: BG }}>
      <div
        className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0"
        style={{ borderColor: BORDER }}
      >
        <div className="flex items-center gap-3">
          <ShieldAlert size={16} style={{ color: "#E07B5A" }} />
          <span className="text-sm font-bold tracking-widest uppercase" style={{ color: TEXT }}>
            Critical Path Recovery
          </span>
          {overdue && (
            <span
              className="text-[9px] font-bold px-2 py-0.5 rounded-full tracking-wider uppercase"
              style={{ backgroundColor: "rgba(248,113,113,0.12)", color: "#F87171", border: "1px solid rgba(248,113,113,0.25)" }}
            >
              Backup Overdue
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {(["overview", "checklist", "history"] as PanelStep[]).map((s) => (
            <button
              key={s}
              onClick={() => setActiveStep(s)}
              className="px-3 py-1.5 rounded text-[10px] font-bold tracking-wider uppercase transition-all"
              style={
                activeStep === s
                  ? { backgroundColor: "rgba(201,168,76,0.12)", color: GOLD, border: "1px solid rgba(201,168,76,0.25)" }
                  : { color: DIM, border: "1px solid transparent" }
              }
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeStep === "overview" && (
          <div className="p-5 flex flex-col gap-5">
            <div
              className="rounded-xl p-4"
              style={{
                backgroundColor: overdue ? "rgba(248,113,113,0.06)" : "rgba(74,222,128,0.06)",
                border: `1px solid ${overdue ? "rgba(248,113,113,0.2)" : "rgba(74,222,128,0.2)"}`,
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold tracking-widest uppercase mb-1" style={{ color: overdue ? "#F87171" : "#4ADE80" }}>
                    {overdue ? "Backup Required" : "Backup Status"}
                  </p>
                  {loading ? (
                    <p className="text-xs" style={{ color: MUTED }}>Checking backup history...</p>
                  ) : lastLog ? (
                    <div>
                      <p className="text-sm font-semibold" style={{ color: TEXT }}>
                        Last backup: {new Date(lastLog.backup_date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: MUTED }}>
                        {days === 0 ? "Today" : days === 1 ? "1 day ago" : `${days} days ago`}
                        {overdue && <span style={{ color: "#F87171" }}> — weekly backup is overdue</span>}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm" style={{ color: "#F87171" }}>No backup on record — run your first Tier 0 backup</p>
                  )}
                </div>
                <button
                  onClick={() => setActiveStep("checklist")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase flex-shrink-0 transition-all"
                  style={{ backgroundColor: "rgba(201,168,76,0.1)", color: GOLD, border: "1px solid rgba(201,168,76,0.25)" }}
                >
                  <Download size={11} />
                  Run Backup
                </button>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold tracking-widest uppercase mb-3" style={{ color: DIM }}>
                Tier 0 — Critical Path Items ({TIER0_ITEMS.length})
              </p>
              <div className="grid grid-cols-1 gap-2">
                {TIER0_ITEMS.map((item) => {
                  const style = CATEGORY_COLORS[item.category];
                  return (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 px-3.5 py-3 rounded-xl"
                      style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}
                    >
                      <span
                        className="flex items-center gap-1 text-[9px] font-bold tracking-wider uppercase px-2 py-1 rounded flex-shrink-0 mt-0.5"
                        style={{ backgroundColor: style.bg, color: style.text, border: `1px solid ${style.border}` }}
                      >
                        {CATEGORY_ICONS[item.category]}
                        {item.category}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold" style={{ color: TEXT }}>{item.label}</p>
                        <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color: MUTED }}>{item.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div
              className="rounded-xl p-4"
              style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}
            >
              <p className="text-[10px] font-bold tracking-widest uppercase mb-3" style={{ color: DIM }}>
                Weekly Backup Protocol
              </p>
              <div className="space-y-2">
                {CHECKLIST_STEPS.map((step, i) => (
                  <div key={step.id} className="flex items-start gap-2.5">
                    <span
                      className="text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: "rgba(201,168,76,0.1)", color: GOLD, border: "1px solid rgba(201,168,76,0.2)" }}
                    >
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-xs font-semibold" style={{ color: TEXT }}>{step.label}</p>
                      <p className="text-[10px]" style={{ color: MUTED }}>{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeStep === "checklist" && (
          <div className="p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: DIM }}>
                Critical Path Backup Checklist
              </p>
              <span className="text-[10px]" style={{ color: completedSteps === CHECKLIST_STEPS.length ? "#4ADE80" : MUTED }}>
                {completedSteps} / {CHECKLIST_STEPS.length} complete
              </span>
            </div>

            <div
              className="flex items-center justify-between px-4 py-3 rounded-xl"
              style={{ backgroundColor: CARD, border: "1px solid rgba(201,168,76,0.2)" }}
            >
              <div>
                <p className="text-xs font-bold" style={{ color: TEXT }}>Step 1: Export Tier 0 Data</p>
                <p className="text-[10px] mt-0.5" style={{ color: MUTED }}>
                  Downloads a full JSON bundle of all 10 Tier 0 items
                </p>
                {exportError && (
                  <p className="text-[10px] mt-1" style={{ color: "#F87171" }}>{exportError}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                {checklistState["exported"] && <CheckCircle2 size={14} style={{ color: "#4ADE80" }} />}
                <button
                  onClick={handleExportTier0}
                  disabled={exportingTier0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all disabled:opacity-50"
                  style={{ backgroundColor: "rgba(201,168,76,0.12)", color: GOLD, border: "1px solid rgba(201,168,76,0.25)" }}
                >
                  {exportingTier0 ? (
                    <><RefreshCw size={11} className="animate-spin" /> Exporting...</>
                  ) : (
                    <><Download size={11} /> Export Now</>
                  )}
                </button>
              </div>
            </div>

            {CHECKLIST_STEPS.slice(1).map((step) => (
              <button
                key={step.id}
                onClick={() => toggleStep(step.id)}
                className="flex items-start gap-3 w-full px-4 py-3 rounded-xl text-left transition-all"
                style={{
                  backgroundColor: checklistState[step.id] ? "rgba(74,222,128,0.05)" : CARD,
                  border: `1px solid ${checklistState[step.id] ? "rgba(74,222,128,0.2)" : BORDER}`,
                }}
              >
                <div
                  className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{
                    backgroundColor: checklistState[step.id] ? "#4ADE80" : "transparent",
                    border: `1px solid ${checklistState[step.id] ? "#4ADE80" : DIM}`,
                  }}
                >
                  {checklistState[step.id] && <CheckCircle2 size={11} style={{ color: "#0D1B2E" }} />}
                </div>
                <div>
                  <p className="text-xs font-bold" style={{ color: checklistState[step.id] ? "#4ADE80" : TEXT }}>
                    {step.label}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: MUTED }}>{step.description}</p>
                </div>
              </button>
            ))}

            <div className="pt-1">
              <textarea
                className="w-full px-3 py-2 rounded-lg text-xs outline-none resize-none"
                style={{ backgroundColor: CARD, color: TEXT, border: `1px solid ${BORDER}`, caretColor: GOLD }}
                placeholder="Optional notes for this backup run..."
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <button
              onClick={handleLogBackup}
              disabled={savingLog || logSaved}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-bold tracking-wider uppercase transition-all disabled:opacity-50"
              style={{
                backgroundColor: logSaved ? "rgba(74,222,128,0.12)" : allStepsDone ? GOLD : "rgba(201,168,76,0.08)",
                color: logSaved ? "#4ADE80" : allStepsDone ? "#0D1B2E" : GOLD,
                border: logSaved ? "1px solid rgba(74,222,128,0.3)" : `1px solid ${allStepsDone ? "transparent" : "rgba(201,168,76,0.2)"}`,
              }}
            >
              {logSaved ? (
                <><CheckCircle2 size={13} /> Backup Logged</>
              ) : savingLog ? (
                <><RefreshCw size={13} className="animate-spin" /> Logging...</>
              ) : (
                <><Clock size={13} /> Log Backup Completion</>
              )}
            </button>

            {!allStepsDone && (
              <p className="text-[10px] text-center" style={{ color: DIM }}>
                Complete all steps above to record a full Tier 0 backup
              </p>
            )}
          </div>
        )}

        {activeStep === "history" && (
          <div className="p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: DIM }}>
                Backup History
              </p>
              <button
                onClick={loadData}
                className="text-[10px] flex items-center gap-1"
                style={{ color: DIM }}
              >
                <RefreshCw size={10} /> Refresh
              </button>
            </div>

            {loading ? (
              <p className="text-xs text-center py-8" style={{ color: DIM }}>Loading history...</p>
            ) : logs.length === 0 ? (
              <div className="text-center py-12">
                <Clock size={28} className="mx-auto mb-3 opacity-20" style={{ color: GOLD }} />
                <p className="text-xs" style={{ color: DIM }}>No backup history yet.</p>
              </div>
            ) : (
              logs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                const date = new Date(log.backup_date).toLocaleDateString("en-US", {
                  year: "numeric", month: "short", day: "numeric",
                });
                const time = new Date(log.backup_date).toLocaleTimeString("en-US", {
                  hour: "2-digit", minute: "2-digit",
                });
                const completedCount = Object.values(log.checklist_steps).filter(Boolean).length;
                const isFull = log.tier === "tier0";

                return (
                  <div
                    key={log.id}
                    className="rounded-xl overflow-hidden"
                    style={{ backgroundColor: CARD, border: `1px solid ${isExpanded ? "rgba(201,168,76,0.2)" : BORDER}` }}
                  >
                    <button
                      className="w-full flex items-center justify-between px-4 py-3 text-left gap-3"
                      onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 rounded flex-shrink-0"
                          style={
                            isFull
                              ? { backgroundColor: "rgba(74,222,128,0.1)", color: "#4ADE80", border: "1px solid rgba(74,222,128,0.25)" }
                              : { backgroundColor: "rgba(245,158,11,0.1)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.25)" }
                          }
                        >
                          {isFull ? "Tier 0" : "Partial"}
                        </span>
                        <div>
                          <p className="text-xs font-semibold" style={{ color: TEXT }}>{date}</p>
                          <p className="text-[10px]" style={{ color: DIM }}>{time} · {completedCount}/{CHECKLIST_STEPS.length} steps</p>
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp size={12} style={{ color: DIM }} />
                      ) : (
                        <ChevronDown size={12} style={{ color: DIM }} />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-3 border-t" style={{ borderColor: BORDER }}>
                        <div className="mt-3 space-y-1.5">
                          {CHECKLIST_STEPS.map((step) => (
                            <div key={step.id} className="flex items-center gap-2">
                              {log.checklist_steps[step.id] ? (
                                <CheckCircle2 size={11} style={{ color: "#4ADE80" }} />
                              ) : (
                                <X size={11} style={{ color: "#F87171" }} />
                              )}
                              <span
                                className="text-[10px]"
                                style={{ color: log.checklist_steps[step.id] ? "#4ADE80" : "#F87171" }}
                              >
                                {step.label}
                              </span>
                            </div>
                          ))}
                        </div>
                        {log.notes && (
                          <p className="mt-3 text-[10px] italic" style={{ color: MUTED }}>{log.notes}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
