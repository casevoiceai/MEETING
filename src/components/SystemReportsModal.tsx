import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type ReportStatus = "PENDING" | "IN_PROGRESS" | "FIXED";
type ReportOutcome = "SAVED" | "FIXED" | "FAILED" | "ABANDONED" | null;

type ReportRecord = {
  id: string;
  time: string;
  service: string;
  owner?: string;
  message: string;
  type?: string;
  status?: ReportStatus;
  notes?: string;
  outcome?: ReportOutcome;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

const STORAGE_KEY = "system_health_reports";

function readReports(): ReportRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.map((item: any, index: number) => ({
      id: String(item?.id ?? `report-${index}`),
      time: String(item?.time ?? new Date().toLocaleTimeString()),
      service: String(item?.service ?? "Unknown Service"),
      owner: String(item?.owner ?? "Unassigned"),
      message: String(item?.message ?? "No message"),
      type: item?.type ? String(item.type) : "",
      status:
        item?.status === "FIXED"
          ? "FIXED"
          : item?.status === "IN_PROGRESS"
            ? "IN_PROGRESS"
            : "PENDING",
      notes: String(item?.notes ?? ""),
      outcome:
        item?.outcome === "SAVED" ||
        item?.outcome === "FIXED" ||
        item?.outcome === "FAILED" ||
        item?.outcome === "ABANDONED"
          ? item.outcome
          : null,
    }));
  } catch {
    return [];
  }
}

function writeReports(reports: ReportRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
  window.dispatchEvent(new Event("storage_sync"));
  window.dispatchEvent(new Event("vault-reports-updated"));
}

function badgeStyle(label: string) {
  const upper = label.toUpperCase();

  if (upper === "FIXED" || upper === "ARCHIVE AS FIXED") {
    return {
      color: "#00E6A7",
      border: "1px solid rgba(0,230,167,0.55)",
      backgroundColor: "rgba(0,230,167,0.08)",
    };
  }

  if (upper === "FAILED" || upper === "ARCHIVE AS FAILED") {
    return {
      color: "#FF5252",
      border: "1px solid rgba(255,82,82,0.55)",
      backgroundColor: "rgba(255,82,82,0.08)",
    };
  }

  if (upper === "ABANDONED" || upper === "ARCHIVE AS ABANDONED") {
    return {
      color: "#FFB800",
      border: "1px solid rgba(255,184,0,0.55)",
      backgroundColor: "rgba(255,184,0,0.08)",
    };
  }

  if (upper === "SAVED" || upper === "SAVE REPORT TO VAULT") {
    return {
      color: "#2F80FF",
      border: "1px solid rgba(47,128,255,0.55)",
      backgroundColor: "rgba(47,128,255,0.08)",
    };
  }

  if (upper === "IN_PROGRESS") {
    return {
      color: "#FFB800",
      border: "1px solid rgba(255,184,0,0.55)",
      backgroundColor: "rgba(255,184,0,0.08)",
    };
  }

  return {
    color: "#D8E3F0",
    border: "1px solid rgba(216,227,240,0.28)",
    backgroundColor: "rgba(216,227,240,0.05)",
  };
}

function typeLabel(type?: string) {
  if (!type) return "REPORT";
  if (type === "AUTO_FIX") return "AUTO FIX";
  if (type === "FIX_PROMPT") return "FIX PROMPT";
  if (type === "SEND_TO_TEAM") return "TEAM";
  return type.replaceAll("_", " ");
}

function outcomeFolder(outcome: ReportOutcome) {
  if (outcome === "SAVED") return "Vault / System Health Reports / Saved";
  if (outcome === "FIXED") return "Vault / System Health Reports / Archive / Fixed";
  if (outcome === "FAILED") return "Vault / System Health Reports / Archive / Failed";
  if (outcome === "ABANDONED") return "Vault / System Health Reports / Archive / Abandoned";
  return "Vault / System Health Reports / Active";
}

export default function SystemReportsModal({ isOpen, onClose }: Props) {
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [savedIds, setSavedIds] = useState<string[]>([]);

  const load = () => {
    const data = readReports();
    setReports(data);
  };

  useEffect(() => {
    if (isOpen) load();

    const sync = () => load();
    window.addEventListener("storage_sync", sync);

    return () => {
      window.removeEventListener("storage_sync", sync);
    };
  }, [isOpen]);

  const orderedReports = useMemo(() => reports, [reports]);

  const updateReport = (id: string, updates: Partial<ReportRecord>) => {
    const next = reports.map((report) =>
      report.id === id ? { ...report, ...updates } : report
    );
    setReports(next);
    writeReports(next);
  };

  const saveNotes = (id: string) => {
    const nextValue = notesDraft[id] ?? "";
    updateReport(id, { notes: nextValue });

    setSavedIds((prev) => [...prev.filter((item) => item !== id), id]);

    window.setTimeout(() => {
      setSavedIds((prev) => prev.filter((item) => item !== id));
    }, 1600);
  };

  const archiveReport = (id: string, outcome: ReportOutcome) => {
    updateReport(id, { outcome });
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const deleteReport = (id: string) => {
    const target = reports.find((report) => report.id === id);
    const confirmed = window.confirm(
      `Delete this report?\n\n${target?.service ?? "Report"}\n${target?.message ?? ""}`
    );
    if (!confirmed) return;

    const next = reports.filter((report) => report.id !== id);
    setReports(next);
    setExpandedIds((prev) => prev.filter((item) => item !== id));

    setNotesDraft((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });

    setSavedIds((prev) => prev.filter((item) => item !== id));

    writeReports(next);
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9500] flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div
        className="w-[780px] max-w-[94vw] h-[80vh] max-h-[820px] rounded-2xl border shadow-2xl flex flex-col overflow-hidden"
        style={{
          backgroundColor: "#0D1B2E",
          borderColor: "#1B2A4A",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-5 py-4 border-b flex items-start justify-between"
          style={{ backgroundColor: "#111D30", borderColor: "#1B2A4A" }}
        >
          <div>
            <div className="text-white font-bold text-[34px] leading-none">System Reports</div>
            <div className="text-[13px] mt-2 text-[#8A9BB5]">
              Active fires, team messages, status tracking, and fix notes.
            </div>
          </div>

          <button onClick={onClose} className="text-white hover:text-red-500 text-[30px] leading-none">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {orderedReports.length === 0 ? (
            <div className="h-full flex items-center justify-center text-[#5A7A9A] text-[11px] uppercase font-bold tracking-[0.18em]">
              No Reports Found
            </div>
          ) : (
            orderedReports.map((report) => {
              const isExpanded = expandedIds.includes(report.id);
              const isSaved = savedIds.includes(report.id);
              const typeTone = badgeStyle(typeLabel(report.type));
              const statusTone = badgeStyle(report.status ?? "PENDING");
              const outcomeTone = report.outcome ? badgeStyle(report.outcome) : null;

              return (
                <div
                  key={report.id}
                  className="rounded-2xl border overflow-hidden"
                  style={{
                    backgroundColor: "#10203A",
                    borderColor: isExpanded ? "rgba(201,168,76,0.26)" : "#1B2A4A",
                  }}
                >
                  <div
                    className="w-full px-5 py-4"
                    style={{
                      backgroundColor: isExpanded ? "rgba(201,168,76,0.03)" : "transparent",
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <button
                        onClick={() => toggleExpanded(report.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-white text-[18px] font-bold leading-none">
                            {report.service}
                          </span>

                          <span
                            className="px-3 py-1 rounded-lg text-[11px] font-bold uppercase tracking-[0.12em]"
                            style={typeTone}
                          >
                            {typeLabel(report.type)}
                          </span>

                          <span
                            className="px-3 py-1 rounded-lg text-[11px] font-bold uppercase tracking-[0.12em]"
                            style={statusTone}
                          >
                            {(report.status ?? "PENDING").replaceAll("_", " ")}
                          </span>

                          {outcomeTone && (
                            <span
                              className="px-3 py-1 rounded-lg text-[11px] font-bold uppercase tracking-[0.12em]"
                              style={outcomeTone}
                            >
                              {report.outcome}
                            </span>
                          )}

                          <span className="text-[13px] text-[#A0B2C8]">{report.time}</span>
                        </div>

                        <div className="text-white text-[15px] leading-relaxed mt-3">
                          {report.message}
                        </div>
                      </button>

                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          onClick={() => toggleExpanded(report.id)}
                          className="text-[#FF5252] text-[28px] leading-none font-light"
                          style={{ minWidth: "24px", textAlign: "center" }}
                          title={isExpanded ? "Collapse report" : "Expand report"}
                        >
                          {isExpanded ? "−" : "+"}
                        </button>

                        <button
                          onClick={() => deleteReport(report.id)}
                          className="text-[#FF5252] text-[28px] leading-none font-light"
                          style={{ minWidth: "24px", textAlign: "center" }}
                          title="Delete report"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div
                      className="px-5 pb-5 pt-1 border-t space-y-5"
                      style={{ borderColor: "#1B2A4A" }}
                    >
                      <div>
                        <div className="text-[11px] font-bold tracking-[0.18em] uppercase mb-3 text-[#8A9BB5]">
                          Status
                        </div>

                        <div className="flex gap-3 flex-wrap">
                          {(["PENDING", "IN_PROGRESS", "FIXED"] as ReportStatus[]).map((status) => {
                            const tone = badgeStyle(status);
                            return (
                              <button
                                key={status}
                                onClick={() => updateReport(report.id, { status })}
                                className="px-4 py-3 rounded-xl text-[15px] font-semibold"
                                style={tone}
                              >
                                {status === "IN_PROGRESS"
                                  ? "In Progress"
                                  : status.charAt(0) + status.slice(1).toLowerCase()}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] font-bold tracking-[0.18em] uppercase mb-3 text-[#8A9BB5]">
                          Actions
                        </div>

                        <div className="flex gap-3 flex-wrap">
                          {[
                            { label: "Archive as Fixed", outcome: "FIXED" as ReportOutcome },
                            { label: "Archive as Abandoned", outcome: "ABANDONED" as ReportOutcome },
                            { label: "Archive as Failed", outcome: "FAILED" as ReportOutcome },
                            { label: "Save Report to Vault", outcome: "SAVED" as ReportOutcome },
                          ].map((action) => {
                            const tone = badgeStyle(action.label);
                            return (
                              <button
                                key={action.label}
                                onClick={() => archiveReport(report.id, action.outcome)}
                                className="px-4 py-3 rounded-xl text-[15px] font-semibold"
                                style={tone}
                              >
                                {action.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] font-bold tracking-[0.18em] uppercase mb-3 text-[#8A9BB5]">
                          What was done to fix
                        </div>

                        <textarea
                          value={notesDraft[report.id] ?? report.notes ?? ""}
                          onChange={(e) =>
                            setNotesDraft((prev) => ({
                              ...prev,
                              [report.id]: e.target.value,
                            }))
                          }
                          placeholder="Add update, fix notes, what was changed, and whether it worked."
                          className="w-full min-h-[132px] rounded-xl p-4 outline-none resize-y text-sm"
                          style={{
                            backgroundColor: "#0B1C34",
                            border: "1px solid #1B2A4A",
                            color: "#D8E8F5",
                          }}
                        />

                        <div className="flex items-center justify-between gap-3 mt-3">
                          <div className="text-[11px] text-[#8A9BB5]">
                            {isSaved
                              ? "Notes saved"
                              : report.outcome
                                ? `Current folder: ${outcomeFolder(report.outcome)}`
                                : "Current folder: Vault / System Health Reports / Active"}
                          </div>

                          <button
                            onClick={() => saveNotes(report.id)}
                            className="px-4 py-2 rounded-lg text-sm font-semibold"
                            style={{
                              color: "#0D1B2E",
                              backgroundColor: "#C9A84C",
                            }}
                          >
                            Save Notes
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
