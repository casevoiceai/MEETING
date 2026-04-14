import React, { useMemo, useState } from "react";

type ReportStatus = "Pending" | "In Progress" | "Fixed" | "Failed" | "Abandoned";

type ReportItem = {
  id: string;
  service: string;
  owner: string;
  status: ReportStatus;
  time: string;
  summary: string;
  notes?: string;
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

const initialReports: ReportItem[] = [
  {
    id: "google-drive-1",
    service: "Google Drive",
    owner: "INTEGRATIONS",
    status: "Pending",
    time: "7:51 PM",
    summary: "Diagnose auth, route, env variables.",
    notes: "",
    tags: ["SYSTEM_REPORT", "OWNER_INTEGRATIONS", "STATUS_PENDING"],
    custody: [
      {
        title: "Report created",
        time: "7:51 PM",
        detail: "Google Drive issue opened and assigned to Integrations.",
      },
    ],
  },
];

export default function SystemReportsModal({
  onClose,
}: SystemReportsModalProps) {
  const [reports, setReports] = useState<ReportItem[]>(initialReports);
  const [selectedId, setSelectedId] = useState<string>(
    initialReports[0]?.id ?? ""
  );
  const [advancedOpen, setAdvancedOpen] = useState<boolean>(false);

  const selected = useMemo(
    () => reports.find((report) => report.id === selectedId) ?? null,
    [reports, selectedId]
  );

  const updateSelectedStatus = (status: ReportStatus) => {
    setReports((current) =>
      current.map((report) =>
        report.id === selectedId
          ? {
              ...report,
              status,
            }
          : report
      )
    );
  };

  const updateSelectedNotes = (notes: string) => {
    setReports((current) =>
      current.map((report) =>
        report.id === selectedId
          ? {
              ...report,
              notes,
            }
          : report
      )
    );
  };

  const deleteSelected = () => {
    if (!selected) return;

    const confirmed = window.confirm(
      `Delete "${selected.service}" from this local reports list?`
    );
    if (!confirmed) return;

    setReports((current) => current.filter((report) => report.id !== selected.id));

    if (selectedId === selected.id) {
      const remaining = reports.filter((report) => report.id !== selected.id);
      setSelectedId(remaining[0]?.id ?? "");
    }
  };

  const archiveSelected = (status: Extract<ReportStatus, "Fixed" | "Failed" | "Abandoned">) => {
    updateSelectedStatus(status);
  };

  const saveToVault = () => {
    if (!selected) return;

    window.dispatchEvent(
      new CustomEvent("vault-reports-updated", {
        detail: {
          action: "save",
          payload: {
            id: selected.id,
            service: selected.service,
            owner: selected.owner,
            status: selected.status,
            time: selected.time,
            summary: selected.summary,
            notes: selected.notes ?? "",
            tags: selected.tags,
            source: "System Reports",
            folderPath: "Vault / System Health Reports / Saved",
            custody: selected.custody,
          },
        },
      })
    );
  };

  const statusStyle = (status: ReportStatus): React.CSSProperties => {
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
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modalShell} onClick={(event) => event.stopPropagation()}>
        <div style={header}>
          <div>
            <div style={title}>System Reports</div>
            <div style={subtitle}>
              Big picture left. Clean working detail on the right.
            </div>
          </div>

          <button type="button" style={closeButton} onClick={onClose}>
            Close
          </button>
        </div>

        <div style={body}>
          <div style={leftColumn}>
            <div style={leftLabel}>Active reports</div>
            <div style={leftHelper}>
              Pick one report to work. Keep the rest simple.
            </div>

            <div style={countBadge}>{reports.length}</div>

            <div style={reportList}>
              {reports.length === 0 ? (
                <div style={emptyState}>No active reports.</div>
              ) : (
                reports.map((report) => {
                  const isSelected = report.id === selectedId;
                  return (
                    <button
                      key={report.id}
                      type="button"
                      onClick={() => setSelectedId(report.id)}
                      style={{
                        ...reportCard,
                        ...(isSelected ? reportCardSelected : {}),
                      }}
                    >
                      <div style={reportCardTop}>
                        <div style={reportCardTitle}>{report.service}</div>
                        <div style={reportCardPills}>
                          <span style={{ ...pillBase, ...statusStyle(report.status) }}>
                            {report.status}
                          </span>
                          <span style={ownerPill}>{report.owner}</span>
                        </div>
                      </div>

                      <div style={reportSummary}>{report.summary}</div>

                      <div style={reportCardBottom}>
                        <span style={reportTime}>{report.time}</span>
                        <span style={openMiniButton}>Open</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div style={rightColumn}>
            {selected ? (
              <div style={detailCard}>
                <div style={detailHeader}>
                  <div style={detailTitle}>{selected.service}</div>
                  <button type="button" style={deleteButton} onClick={deleteSelected}>
                    Delete
                  </button>
                </div>

                <div style={summaryLabel}>Summary</div>
                <div style={summaryBox}>{selected.summary}</div>

                <div style={buttonRow}>
                  <button
                    type="button"
                    style={{ ...actionButton, ...statusPending }}
                    onClick={() => updateSelectedStatus("Pending")}
                  >
                    Pending
                  </button>
                  <button
                    type="button"
                    style={{ ...actionButton, ...statusProgress }}
                    onClick={() => updateSelectedStatus("In Progress")}
                  >
                    In Progress
                  </button>
                  <button
                    type="button"
                    style={{ ...actionButton, ...statusFixed }}
                    onClick={() => updateSelectedStatus("Fixed")}
                  >
                    Fixed
                  </button>
                </div>

                <div style={buttonRow}>
                  <button type="button" style={saveButton} onClick={saveToVault}>
                    Save to Vault
                  </button>
                  <button
                    type="button"
                    style={{ ...actionButton, ...statusFixed }}
                    onClick={() => archiveSelected("Fixed")}
                  >
                    Archive Fixed
                  </button>
                  <button
                    type="button"
                    style={{ ...actionButton, ...statusAbandoned }}
                    onClick={() => archiveSelected("Abandoned")}
                  >
                    Archive Abandoned
                  </button>
                  <button
                    type="button"
                    style={{ ...actionButton, ...statusFailed }}
                    onClick={() => archiveSelected("Failed")}
                  >
                    Archive Failed
                  </button>
                </div>

                <div style={notesLabel}>Notes</div>
                <textarea
                  value={selected.notes ?? ""}
                  onChange={(event) => updateSelectedNotes(event.target.value)}
                  placeholder="Add notes..."
                  style={notesBox}
                />

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
                    <div style={advancedLabel}>Tags</div>
                    <div style={tagsWrap}>
                      {selected.tags.map((tag) => (
                        <span key={tag} style={tagPill}>
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div style={advancedLabel}>Chain of custody</div>
                    <div style={custodyBox}>
                      {selected.custody.map((entry, index) => (
                        <div key={`${entry.title}-${index}`} style={custodyEntry}>
                          <div style={custodyTop}>
                            <span style={custodyTitle}>{entry.title}</span>
                            <span style={custodyTime}>{entry.time}</span>
                          </div>
                          <div style={custodyDetail}>{entry.detail}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div style={detailCard}>
                <div style={emptyState}>Pick a report on the left.</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(1, 8, 20, 0.72)",
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
};

const modalShell: React.CSSProperties = {
  width: "min(1400px, 96vw)",
  maxHeight: "92vh",
  overflow: "auto",
  borderRadius: "18px",
  border: "1px solid rgba(59, 130, 246, 0.18)",
  background: "#081a35",
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

const title: React.CSSProperties = {
  fontSize: "38px",
  lineHeight: 1.05,
  fontWeight: 800,
  color: "#f8fafc",
};

const subtitle: React.CSSProperties = {
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
  position: "relative",
  border: "1px solid rgba(148, 163, 184, 0.12)",
  borderRadius: "16px",
  padding: "18px",
  background: "#0c1f3b",
  minHeight: "560px",
};

const rightColumn: React.CSSProperties = {
  minHeight: "560px",
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
  marginBottom: "18px",
};

const countBadge: React.CSSProperties = {
  position: "absolute",
  top: "18px",
  right: "18px",
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

const reportCard: React.CSSProperties = {
  width: "100%",
  textAlign: "left",
  border: "1px solid rgba(96, 165, 250, 0.12)",
  background: "#162a49",
  borderRadius: "16px",
  padding: "18px",
  cursor: "pointer",
};

const reportCardSelected: React.CSSProperties = {
  border: "2px solid #3b82f6",
  boxShadow: "0 0 0 2px rgba(59,130,246,0.12) inset",
};

const reportCardTop: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  alignItems: "flex-start",
};

const reportCardTitle: React.CSSProperties = {
  fontSize: "34px",
  fontWeight: 800,
  color: "#f8fafc",
  lineHeight: 1.05,
};

const reportCardPills: React.CSSProperties = {
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

const reportCardBottom: React.CSSProperties = {
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

const openMiniButton: React.CSSProperties = {
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

const detailHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  alignItems: "flex-start",
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

const summaryLabel: React.CSSProperties = {
  marginTop: "12px",
  fontSize: "13px",
  fontWeight: 800,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "#bfdbfe",
};

const summaryBox: React.CSSProperties = {
  marginTop: "8px",
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

const actionButton: React.CSSProperties = {
  borderRadius: "10px",
  padding: "12px 16px",
  fontWeight: 800,
  fontSize: "15px",
  cursor: "pointer",
  border: "1px solid currentColor",
};

const saveButton: React.CSSProperties = {
  ...actionButton,
  color: "#bfdbfe",
  background: "rgba(59, 130, 246, 0.2)",
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

const notesLabel: React.CSSProperties = {
  marginTop: "16px",
  fontSize: "13px",
  fontWeight: 800,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "#bfdbfe",
};

const notesBox: React.CSSProperties = {
  width: "100%",
  minHeight: "120px",
  marginTop: "8px",
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

const advancedLabel: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 800,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "#bfdbfe",
  marginBottom: "10px",
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
};

const custodyBox: React.CSSProperties = {
  display: "grid",
  gap: "10px",
};

const custodyEntry: React.CSSProperties = {
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

const emptyState: React.CSSProperties = {
  minHeight: "240px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#93c5fd",
  fontSize: "20px",
  textAlign: "center",
  padding: "20px",
};
