import React, { useEffect, useMemo, useState } from "react";

type ReportStatus = "Pending" | "In Progress" | "Fixed" | "Failed" | "Abandoned";

type ReportItem = {
  id: string;
  title: string;
  service: string;
  owner: string;
  status: ReportStatus;
  time: string;
  summary: string;
  notes: string;
  tags: string[];
  custody: {
    title: string;
    time: string;
    detail: string;
  }[];
};

type SystemReportsModalProps = {
  onClose: () => void;
};

const STORAGE_KEY = "meeting-system-reports";

const defaultReports: ReportItem[] = [
  {
    id: "google-drive-1",
    title: "Google Drive",
    service: "Google Drive",
    owner: "INTEGRATIONS",
    status: "Pending",
    time: "7:51 PM",
    summary: "Diagnose auth, route, env variables.",
    notes: "",
    tags: ["SYSTEM_REPORT", "OWNER_INTEGRATIONS"],
    custody: [
      {
        title: "Report created",
        time: "7:51 PM",
        detail: "Google Drive issue opened and assigned to Integrations.",
      },
    ],
  },
];

function loadReports(): ReportItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultReports;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : defaultReports;
  } catch {
    return defaultReports;
  }
}

function saveReports(reports: ReportItem[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
  } catch {
    // ignore storage failures
  }
}

function statusTag(status: ReportStatus) {
  return `STATUS_${status.toUpperCase().replace(/\s+/g, "_")}`;
}

export default function SystemReportsModal({ onClose }: SystemReportsModalProps) {
  const [reports, setReports] = useState<ReportItem[]>(() => loadReports());
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const initial = loadReports();
    return initial[0]?.id ?? null;
  });
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    saveReports(reports);
  }, [reports]);

  useEffect(() => {
    if (!selectedId) return;
    const stillExists = reports.some((report) => report.id === selectedId);
    if (!stillExists) {
      setSelectedId(reports[0]?.id ?? null);
      setAdvancedOpen(false);
    }
  }, [reports, selectedId]);

  const selectedReport = useMemo(
    () => reports.find((report) => report.id === selectedId) ?? null,
    [reports, selectedId]
  );

  const selectedTags = useMemo(() => {
    if (!selectedReport) return [];
    return [...selectedReport.tags, statusTag(selectedReport.status)];
  }, [selectedReport]);

  function patchSelectedReport(patch: Partial<ReportItem>) {
    if (!selectedReport) return;
    setReports((prev) =>
      prev.map((report) =>
        report.id === selectedReport.id ? { ...report, ...patch } : report
      )
    );
  }

  function appendCustody(title: string, detail: string) {
    if (!selectedReport) return;
    const now = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    setReports((prev) =>
      prev.map((report) =>
        report.id === selectedReport.id
          ? {
              ...report,
              time: now,
              custody: [...report.custody, { title, time: now, detail }],
            }
          : report
      )
    );
  }

  function handleStatusChange(status: ReportStatus) {
    if (!selectedReport) return;
    patchSelectedReport({ status });
    appendCustody("Status changed", `${selectedReport.title} marked ${status}.`);
  }

  function handleNotesChange(value: string) {
    patchSelectedReport({ notes: value });
  }

  function handleSaveNotes() {
    if (!selectedReport) return;
    appendCustody("Notes updated", selectedReport.notes?.trim() ? "Notes saved." : "Notes cleared.");
  }

  function handleSaveToVault() {
    if (!selectedReport) return;

    window.dispatchEvent(
      new CustomEvent("vault-reports-updated", {
        detail: {
          action: "save",
          payload: {
            id: selectedReport.id,
            title: selectedReport.title,
            service: selectedReport.service,
            owner: selectedReport.owner,
            status: selectedReport.status,
            time: selectedReport.time,
            summary: selectedReport.summary,
            notes: selectedReport.notes,
            tags: selectedTags,
            source: "System Reports",
            folderPath: "Vault / System Health Reports / Saved",
            custody: selectedReport.custody,
          },
        },
      })
    );

    appendCustody("Saved to Vault", `${selectedReport.title} saved to Vault.`);
  }

  function handleArchive(status: "Fixed" | "Failed" | "Abandoned") {
    if (!selectedReport) return;
    patchSelectedReport({ status });
    appendCustody(`Archived ${status}`, `${selectedReport.title} archived as ${status}.`);
  }

  function handleDelete() {
    if (!selectedReport) return;

    const okay = window.confirm(
      `Delete "${selectedReport.title}" from this local reports list?`
    );
    if (!okay) return;

    setReports((prev) => prev.filter((report) => report.id !== selectedReport.id));
    setSelectedId(null);
    setAdvancedOpen(false);
  }

  function handleOverlayClick() {
    onClose();
  }

  function handleShellClick(event: React.MouseEvent<HTMLDivElement>) {
    event.stopPropagation();
  }

  return (
    <div style={overlay} onClick={handleOverlayClick}>
      <div style={modalShell} onClick={handleShellClick}>
        <div style={header}>
          <div>
            <div style={titleStyle}>System Reports</div>
            <div style={subtitleStyle}>Big picture left. Clean working detail on the right.</div>
          </div>
          <button type="button" style={closeButton} onClick={onClose}>
            Close
          </button>
        </div>

        <div style={body}>
          <div style={leftColumn}>
            <div style={leftHeadingRow}>
              <div>
                <div style={leftLabel}>Active reports</div>
                <div style={leftHelper}>Pick one report to work. Keep the rest simple.</div>
              </div>
              <div style={countBadge}>{reports.length}</div>
            </div>

            <div style={reportList}>
              {reports.length === 0 ? (
                <div style={emptyCard}>No active reports.</div>
              ) : (
                reports.map((report) => {
                  const active = report.id === selectedId;
                  return (
                    <div
                      key={report.id}
                      style={{
                        ...reportCard,
                        ...(active ? reportCardActive : {}),
                      }}
                      onClick={() => setSelectedId(report.id)}
                    >
                      <div style={reportTop}>
                        <div style={reportService}>{report.service}</div>
                        <div style={pillRow}>
                          <span style={{ ...pillBase, ...statusStyle(report.status) }}>
                            {report.status}
                          </span>
                          <span style={ownerPill}>{report.owner}</span>
                        </div>
                      </div>

                      <div style={reportSummary}>{report.summary}</div>

                      <div style={reportBottom}>
                        <div style={reportTime}>{report.time}</div>
                        <div style={openPill}>Open</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div style={rightColumn}>
            {selectedReport ? (
              <div style={detailCard}>
                <div style={detailHeader}>
                  <div style={detailTitle}>{selectedReport.service}</div>
                  <button type="button" style={deleteButton} onClick={handleDelete}>
                    Delete
                  </button>
                </div>

                <div style={sectionLabel}>Summary</div>
                <div style={summaryBox}>{selectedReport.summary}</div>

                <div style={buttonRow}>
                  <button type="button" style={{ ...buttonBase, ...statusPending }} onClick={() => handleStatusChange("Pending")}>
                    Pending
                  </button>
                  <button type="button" style={{ ...buttonBase, ...statusProgress }} onClick={() => handleStatusChange("In Progress")}>
                    In Progress
                  </button>
                  <button type="button" style={{ ...buttonBase, ...statusFixed }} onClick={() => handleStatusChange("Fixed")}>
                    Fixed
                  </button>
                </div>

                <div style={buttonRow}>
                  <button type="button" style={saveVaultButton} onClick={handleSaveToVault}>
                    Save to Vault
                  </button>
                  <button type="button" style={{ ...buttonBase, ...statusFixed }} onClick={() => handleArchive("Fixed")}>
                    Archive Fixed
                  </button>
                  <button type="button" style={{ ...buttonBase, ...statusAbandoned }} onClick={() => handleArchive("Abandoned")}>
                    Archive Abandoned
                  </button>
                  <button type="button" style={{ ...buttonBase, ...statusFailed }} onClick={() => handleArchive("Failed")}>
                    Archive Failed
                  </button>
                </div>

                <div style={sectionLabel}>Notes</div>
                <textarea
                  value={selectedReport.notes}
                  onChange={(event) => handleNotesChange(event.target.value)}
                  placeholder="Add notes..."
                  style={notesBox}
                  spellCheck={false}
                />

                <button type="button" style={saveNotesButton} onClick={handleSaveNotes}>
                  Save Notes
                </button>

                <button
                  type="button"
                  style={advancedHeader}
                  onClick={() => setAdvancedOpen((open) => !open)}
                >
                  <span>Advanced</span>
                  <span>{advancedOpen ? "−" : "+"}</span>
                </button>

                {advancedOpen ? (
                  <div style={advancedPanel}>
                    <div style={sectionLabel}>Tags</div>
                    <div style={tagsWrap}>
                      {selectedTags.map((tag) => (
                        <span key={tag} style={tagPill}>
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div style={sectionLabel}>Chain of custody</div>
                    <div style={custodyWrap}>
                      {selectedReport.custody.map((entry, index) => (
                        <div key={`${entry.title}-${index}`} style={custodyCard}>
                          <div style={custodyTop}>
                            <div style={custodyTitle}>{entry.title}</div>
                            <div style={custodyTime}>{entry.time}</div>
                          </div>
                          <div style={custodyDetail}>{entry.detail}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div style={detailCardEmpty}>Pick a report on the left.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function statusStyle(status: ReportStatus): React.CSSProperties {
  switch (status) {
    case "Pending":
      return statusPending;
    case "In Progress":
      return statusProgress;
    case "Fixed":
      return statusFixed;
    case "Failed":
      return statusFailed;
    case "Abandoned":
      return statusAbandoned;
    default:
      return statusPending;
  }
}

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  background: "rgba(1, 8, 20, 0.72)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
};

const modalShell: React.CSSProperties = {
  width: "min(1400px, 96vw)",
  maxHeight: "92vh",
  overflow: "auto",
  background: "#081a35",
  border: "1px solid rgba(59, 130, 246, 0.18)",
  borderRadius: "18px",
  boxShadow: "0 24px 80px rgba(0,0,0,0.45)",
};

const header: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  padding: "22px 22px 16px",
  borderBottom: "1px solid rgba(148, 163, 184, 0.12)",
};

const titleStyle: React.CSSProperties = {
  fontSize: "38px",
  lineHeight: 1.05,
  fontWeight: 800,
  color: "#f8fafc",
};

const subtitleStyle: React.CSSProperties = {
  marginTop: "6px",
  fontSize: "14px",
  color: "#93c5fd",
};

const closeButton: React.CSSProperties = {
  border: "1px solid rgba(96, 165, 250, 0.16)",
  background: "#13294a",
  color: "#f8fafc",
  borderRadius: "10px",
  padding: "12px 18px",
  fontSize: "15px",
  fontWeight: 700,
  cursor: "pointer",
};

const body: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "18px",
  padding: "18px 22px 22px",
};

const leftColumn: React.CSSProperties = {
  border: "1px solid rgba(148, 163, 184, 0.12)",
  borderRadius: "16px",
  padding: "18px",
  background: "#0c1f3b",
  minHeight: "560px",
};

const rightColumn: React.CSSProperties = {
  minHeight: "560px",
};

const leftHeadingRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  marginBottom: "18px",
};

const leftLabel: React.CSSProperties = {
  fontSize: "30px",
  fontWeight: 800,
  color: "#f8fafc",
};

const leftHelper: React.CSSProperties = {
  marginTop: "6px",
  fontSize: "14px",
  color: "#93c5fd",
};

const countBadge: React.CSSProperties = {
  minWidth: "34px",
  height: "34px",
  borderRadius: "999px",
  background: "#17345a",
  color: "#fcd34d",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 800,
  fontSize: "15px",
};

const reportList: React.CSSProperties = {
  display: "grid",
  gap: "14px",
};

const emptyCard: React.CSSProperties = {
  minHeight: "360px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#93c5fd",
  fontSize: "20px",
  textAlign: "center",
  border: "1px solid rgba(148, 163, 184, 0.12)",
  borderRadius: "16px",
};

const reportCard: React.CSSProperties = {
  border: "1px solid rgba(96, 165, 250, 0.12)",
  background: "#162a49",
  borderRadius: "16px",
  padding: "18px",
  cursor: "pointer",
};

const reportCardActive: React.CSSProperties = {
  border: "2px solid #3b82f6",
  boxShadow: "0 0 0 2px rgba(59,130,246,0.12) inset",
};

const reportTop: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
};

const reportService: React.CSSProperties = {
  fontSize: "34px",
  fontWeight: 800,
  color: "#f8fafc",
  lineHeight: 1.05,
};

const pillRow: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const pillBase: React.CSSProperties = {
  borderRadius: "999px",
  padding: "6px 10px",
  fontSize: "12px",
  fontWeight: 800,
  letterSpacing: "0.03em",
  border: "1px solid currentColor",
};

const ownerPill: React.CSSProperties = {
  ...pillBase,
  color: "#c084fc",
  background: "rgba(168, 85, 247, 0.12)",
};

const reportSummary: React.CSSProperties = {
  marginTop: "14px",
  fontSize: "22px",
  lineHeight: 1.35,
  color: "#f8fafc",
};

const reportBottom: React.CSSProperties = {
  marginTop: "16px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const reportTime: React.CSSProperties = {
  fontSize: "28px",
  fontWeight: 800,
  color: "#f8fafc",
};

const openPill: React.CSSProperties = {
  borderRadius: "10px",
  background: "#0d1f3a",
  color: "#f8fafc",
  padding: "10px 16px",
  fontWeight: 800,
  fontSize: "14px",
};

const detailCard: React.CSSProperties = {
  border: "1px solid rgba(148, 163, 184, 0.12)",
  borderRadius: "16px",
  padding: "18px",
  background: "#162a49",
  minHeight: "560px",
};

const detailCardEmpty: React.CSSProperties = {
  ...detailCard,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#93c5fd",
  fontSize: "20px",
  textAlign: "center",
};

const detailHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
};

const detailTitle: React.CSSProperties = {
  fontSize: "40px",
  lineHeight: 1.05,
  fontWeight: 800,
  color: "#f8fafc",
};

const deleteButton: React.CSSProperties = {
  border: "1px solid rgba(248, 113, 113, 0.75)",
  background: "rgba(127, 29, 29, 0.2)",
  color: "#fecaca",
  borderRadius: "10px",
  padding: "12px 18px",
  fontWeight: 800,
  fontSize: "15px",
  cursor: "pointer",
};

const sectionLabel: React.CSSProperties = {
  marginTop: "14px",
  marginBottom: "8px",
  fontSize: "13px",
  fontWeight: 800,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "#bfdbfe",
};

const summaryBox: React.CSSProperties = {
  background: "#081529",
  border: "1px solid rgba(96, 165, 250, 0.12)",
  borderRadius: "12px",
  padding: "16px",
  color: "#f8fafc",
  fontSize: "26px",
  lineHeight: 1.35,
};

const buttonRow: React.CSSProperties = {
  marginTop: "14px",
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
};

const buttonBase: React.CSSProperties = {
  borderRadius: "10px",
  padding: "12px 16px",
  fontWeight: 800,
  fontSize: "15px",
  cursor: "pointer",
  border: "1px solid currentColor",
};

const saveVaultButton: React.CSSProperties = {
  ...buttonBase,
  color: "#bfdbfe",
  background: "rgba(59, 130, 246, 0.2)",
};

const saveNotesButton: React.CSSProperties = {
  marginTop: "10px",
  borderRadius: "10px",
  padding: "12px 16px",
  fontWeight: 800,
  fontSize: "15px",
  cursor: "pointer",
  border: "1px solid rgba(201,168,76,0.28)",
  color: "#0D1B2E",
  background: "#C9A84C",
};

const statusPending: React.CSSProperties = {
  color: "#e5e7eb",
  background: "rgba(71, 85, 105, 0.28)",
};

const statusProgress: React.CSSProperties = {
  color: "#fbbf24",
  background: "rgba(245, 158, 11, 0.16)",
};

const statusFixed: React.CSSProperties = {
  color: "#34d399",
  background: "rgba(16, 185, 129, 0.16)",
};

const statusFailed: React.CSSProperties = {
  color: "#f87171",
  background: "rgba(239, 68, 68, 0.14)",
};

const statusAbandoned: React.CSSProperties = {
  color: "#fbbf24",
  background: "rgba(217, 119, 6, 0.16)",
};

const notesBox: React.CSSProperties = {
  width: "100%",
  minHeight: "120px",
  resize: "vertical",
  background: "#081529",
  border: "1px solid rgba(96, 165, 250, 0.12)",
  borderRadius: "12px",
  padding: "14px",
  color: "#f8fafc",
  fontSize: "18px",
  lineHeight: 1.4,
};

const advancedHeader: React.CSSProperties = {
  width: "100%",
  marginTop: "16px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  border: "1px solid rgba(96, 165, 250, 0.12)",
  borderRadius: "12px",
  background: "#0d1f3a",
  color: "#f8fafc",
  padding: "14px 16px",
  fontSize: "18px",
  fontWeight: 800,
  cursor: "pointer",
};

const advancedPanel: React.CSSProperties = {
  marginTop: "10px",
  border: "1px solid rgba(96, 165, 250, 0.12)",
  borderRadius: "14px",
  background: "#0d1f3a",
  padding: "16px",
};

const tagsWrap: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
  marginBottom: "18px",
};

const tagPill: React.CSSProperties = {
  borderRadius: "999px",
  padding: "6px 10px",
  fontSize: "12px",
  fontWeight: 800,
  color: "#bfdbfe",
  background: "rgba(59, 130, 246, 0.12)",
  border: "1px solid rgba(96, 165, 250, 0.22)",
  userSelect: "none",
  WebkitUserSelect: "none",
};

const custodyWrap: React.CSSProperties = {
  display: "grid",
  gap: "10px",
};

const custodyCard: React.CSSProperties = {
  border: "1px solid rgba(96, 165, 250, 0.12)",
  borderRadius: "12px",
  background: "#081529",
  padding: "14px",
};

const custodyTop: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  alignItems: "center",
};

const custodyTitle: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 800,
  color: "#f8fafc",
};

const custodyTime: React.CSSProperties = {
  fontSize: "14px",
  color: "#bfdbfe",
  fontWeight: 700,
};

const custodyDetail: React.CSSProperties = {
  marginTop: "8px",
  fontSize: "16px",
  lineHeight: 1.45,
  color: "#f8fafc",
};
