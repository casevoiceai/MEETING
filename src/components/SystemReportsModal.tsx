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
      border: "1px solid rgba(0,230,167,0.65)",
      backgroundColor: "rgba(0,230,167,0.08)",
    };
  }

  if (upper === "FAILED" || upper === "ARCHIVE AS FAILED") {
    return {
      color: "#FF5252",
      border: "1px solid rgba(255,82,82,0.65)",
      backgroundColor: "rgba(255,82,82,0.08)",
    };
  }

  if (upper === "ABANDONED" || upper === "ARCHIVE AS ABANDONED") {
    return {
      color: "#FFB800",
      border: "1px solid rgba(255,184,0,0.65)",
      backgroundColor: "rgba(255,184,0,0.08)",
    };
  }

  if (upper === "SAVED" || upper === "SAVE REPORT TO VAULT") {
    return {
      color: "#2F80FF",
      border: "1px solid rgba(47,128,255,0.65)",
      backgroundColor: "rgba(47,128,255,0.08)",
    };
  }

  if (upper === "IN_PROGRESS") {
    return {
      color: "#FFB800",
      border: "1px solid rgba(255,184,0,0.65)",
      backgroundColor: "rgba(255,184,0,0.08)",
    };
  }

  return {
    color: "#D8E3F0",
    border: "1px solid rgba(216,227,240,0.35)",
    backgroundColor: "rgba(216,227,240,0.06)",
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  const load = () => {
    const data = readReports();
    setReports(data);
    setExpandedId((current) => current ?? data[0]?.id ?? null);
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
    updateReport(id, { notes: notesDraft[id] ?? "" });
  };

  const archiveReport = (id: string, outcome: ReportOutcome) => {
    updateReport(id, { outcome });
  };

  const expandedReport = orderedReports.find((report) => report.id === expandedId) ?? null;

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9500] flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div
        className="w-[700px] max-w-[92vw] h-[78vh] max-h-[760px] rounded-xl border shadow-2xl flex flex-col overflow-hidden"
        style={{
          backgroundColor: "#0D1B2E",
          borderColor: "#1B2A4A",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-4 py-3 border-b flex items-center justify-between"
          style={{ backgroundColor: "#111D30", borderColor: "#1B2A4A" }}
        >
          <div>
            <div className="text-white font-bold text-sm">System Reports</div>
            <div className="text-[11px] text-[#8A9BB5]">
              Active fires, team messages, status tracking, and fix notes.
            </div>
          </div>

          <button onClick={onClose} className="text-white hover:text-red-500 text-lg leading-none">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {orderedReports.length === 0 ? (
            <div className="h-full flex items-center justify-center text-[#5A7A9A] text-[11px] uppercase font-bold tracking-[0.18em]">
              No Reports Found
            </div>
          ) : (
            orderedReports.map((report) => {
              const isExpanded = expandedId === report.id;
              const typeTone = badgeStyle(typeLabel(report.type));
              const statusTone = badgeStyle(report.status ?? "PENDING");

              return (
                <div
                  key={report.id}
                  className="rounded-lg border p-4"
                  style={{
                    backgroundColor: "#10203A",
                    borderColor: "#1B2A4A",
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : report.id)}
                    >
                      <div className="flex items-center gap-3 flex-wrap mb-3">
                        <span className="text-white text-xl font-bold leading-none">
                          {report.service}
                        </span>

                        <span
                          className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-[0.12em]"
                          style={typeTone}
                        >
                          {typeLabel(report.type)}
                        </span>

                        <span
                          className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-[0.12em]"
                          style={statusTone}
                        >
                          {(report.status ?? "PENDING").replaceAll("_", " ")}
                        </span>

                        <span className="text-[12px] text-[#A0B2C8]">{report.time}</span>
                      </div>

                      <div className="text-white text-[15px] leading-relaxed">
                        {report.message}
                      </div>
                    </div>

                    <button
                      onClick={() => setExpandedId(isExpanded ? null : report.id)}
                      className="text-red-500 text-2xl leading-none px-1"
                      title={isExpanded ? "Collapse" : "Expand"}
                    >
                      {isExpanded ? "–" : "×"}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="mt-5 pt-4 border-t space-y-5" style={{ borderColor: "#1B2A4A" }}>
                      <div>
                        <div className="text-[11px] font-bold tracking-[0.18em] uppercase mb-2 text-[#8A9BB5]">
                          Status
                        </div>

                        <div className="flex gap-3 flex-wrap">
                          {(["PENDING", "IN_PROGRESS", "FIXED"] as ReportStatus[]).map((status) => {
                            const tone = badgeStyle(status);
                            return (
                              <button
                                key={status}
                                onClick={() => updateReport(report.id, { status })}
                                className="px-4 py-2 rounded text-sm font-semibold"
                                style={tone}
                              >
                                {status === "IN_PROGRESS" ? "In Progress" : status.charAt(0) + status.slice(1).toLowerCase()}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] font-bold tracking-[0.18em] uppercase mb-2 text-[#8A9BB5]">
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
                                className="px-4 py-2 rounded text-sm font-semibold"
                                style={tone}
                              >
                                {action.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] font-bold tracking-[0.18em] uppercase mb-2 text-[#8A9BB5]">
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
                          className="w-full min-h-[124px] rounded-lg p-4 outline-none resize-y text-sm"
                          style={{
                            backgroundColor: "#0B1C34",
                            border: "1px solid #1B2A4A",
                            color: "#D8E8F5",
                          }}
                        />

                        <div className="flex items-center justify-between mt-3">
                          <div className="text-[11px] text-[#8A9BB5]">
                            {report.outcome
                              ? `Current folder: ${outcomeFolder(report.outcome)}`
                              : "Current folder: Vault / System Health Reports / Active"}
                          </div>

                          <button
                            onClick={() => saveNotes(report.id)}
                            className="px-4 py-2 rounded text-sm font-semibold"
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
