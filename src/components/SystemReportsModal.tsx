import { useEffect, useState } from "react";

type Report = {
  id: number;
  time: string;
  service: string;
  owner: string;
  message: string;
  fixStatus: string;
  notes: string;
};

type CustodyEntry = {
  time: string;
  action: string;
  location: string;
  details: string;
};

type HistoryReport = Report & {
  archivedAt: string;
  outcome: "Fixed" | "Abandoned" | "Failed";
  folder: string;
  recordType: "archived";
  custodyTags: string[];
  custodyTrail: CustodyEntry[];
};

type SavedReport = Report & {
  savedAt: string;
  folder: string;
  recordType: "saved";
  custodyTags: string[];
  custodyTrail: CustodyEntry[];
};

function nowLabel() {
  return new Date().toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function ownerTag(owner: string) {
  return `OWNER_${owner.toUpperCase().replace(/\s+/g, "_")}`;
}

function statusTag(status: string) {
  return `STATUS_${status.toUpperCase().replace(/\s+/g, "_")}`;
}

function notifyVaultChanged() {
  window.dispatchEvent(new CustomEvent("vault-reports-updated"));
}

function baseTrail(report: Report): CustodyEntry[] {
  return [
    {
      time: report.time || nowLabel(),
      action: "Report created",
      location: "System Reports / Active",
      details: `${report.service} issue opened and assigned to ${report.owner}`,
    },
  ];
}

export default function SystemReportsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [reports, setReports] = useState<Report[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem("system_health_reports");
    if (stored) {
      try {
        const parsed: Report[] = JSON.parse(stored);

        const unique = parsed.filter(
          (r: Report, i: number, arr: Report[]) =>
            i === arr.findIndex((x) => x.message === r.message && x.time === r.time)
        );

        setReports(unique);
        localStorage.setItem("system_health_reports", JSON.stringify(unique));
      } catch {
        setReports([]);
      }
    } else {
      setReports([]);
    }
  }, [open]);

  const save = (next: Report[]) => {
    setReports(next);
    localStorage.setItem("system_health_reports", JSON.stringify(next));
    notifyVaultChanged();
  };

  const updateStatus = (id: number, fixStatus: string) => {
    const next = reports.map((r) => (r.id === id ? { ...r, fixStatus } : r));
    save(next);
  };

  const updateNotes = (id: number, notes: string) => {
    const next = reports.map((r) => (r.id === id ? { ...r, notes } : r));
    save(next);
  };

  const deleteReport = (id: number) => {
    const next = reports.filter((r) => r.id !== id);
    save(next);
  };

  const archiveReport = (id: number, outcome: "Fixed" | "Abandoned" | "Failed") => {
    const target = reports.find((r) => r.id === id);
    if (!target) return;

    const existingHistory = localStorage.getItem("system_health_reports_history");
    const parsedHistory: HistoryReport[] = existingHistory ? JSON.parse(existingHistory) : [];

    const folder = `Vault / System Health Reports / Archive / ${outcome}`;
    const time = nowLabel();

    const archivedReport: HistoryReport = {
      ...target,
      fixStatus: outcome,
      archivedAt: time,
      outcome,
      folder,
      recordType: "archived",
      custodyTags: [
        "SYSTEM_REPORT",
        "ARCHIVED",
        ownerTag(target.owner),
        statusTag(target.fixStatus),
        `OUTCOME_${outcome.toUpperCase()}`,
      ],
      custodyTrail: [
        ...baseTrail(target),
        {
          time,
          action: `Archived as ${outcome}`,
          location: folder,
          details: target.notes?.trim() || "No final notes entered before archive.",
        },
      ],
    };

    localStorage.setItem(
      "system_health_reports_history",
      JSON.stringify([archivedReport, ...parsedHistory])
    );

    save(reports.filter((r) => r.id !== id));
    notifyVaultChanged();
  };

  const saveToVault = (report: Report) => {
    const existing = localStorage.getItem("vault_system_health_reports");
    const parsed: SavedReport[] = existing ? JSON.parse(existing) : [];

    const time = nowLabel();
    const folder = "Vault / System Health Reports / Saved";

    const savedReport: SavedReport = {
      ...report,
      savedAt: time,
      folder,
      recordType: "saved",
      custodyTags: [
        "SYSTEM_REPORT",
        "VAULT_SAVED",
        ownerTag(report.owner),
        statusTag(report.fixStatus),
      ],
      custodyTrail: [
        ...baseTrail(report),
        {
          time,
          action: "Saved to Vault",
          location: folder,
          details: report.notes?.trim() || "Saved without notes.",
        },
      ],
    };

    const withoutDuplicate = parsed.filter(
      (item) =>
        !(
          item.message === report.message &&
          item.service === report.service &&
          item.owner === report.owner
        )
    );

    localStorage.setItem(
      "vault_system_health_reports",
      JSON.stringify([savedReport, ...withoutDuplicate])
    );

    notifyVaultChanged();
    alert("Saved to Vault / System Health Reports / Saved");
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.75)", zIndex: 3000 }}
    >
      <div
        className="w-[860px] max-h-[84vh] overflow-y-auto p-6 rounded-xl"
        style={{
          backgroundColor: "#0D1B2E",
          border: "1px solid #1B2A4A",
        }}
      >
        <div className="flex justify-between items-center mb-6">
          <div>
            <div className="text-xl text-white font-bold">System Reports</div>
            <div className="text-sm text-gray-400 mt-1">
              Active fires, team messages, status tracking, and fix notes.
            </div>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded"
            style={{
              backgroundColor: "#1B2A4A",
              color: "#C9A84C",
            }}
          >
            Close
          </button>
        </div>

        {reports.length === 0 && <div className="text-gray-400">No active issues.</div>}

        <div className="space-y-6">
          {reports.map((r) => (
            <div
              key={r.id}
              className="p-5 rounded border relative"
              style={{
                backgroundColor: "#111D30",
                borderColor: "#1B2A4A",
              }}
            >
              <button
                onClick={() => deleteReport(r.id)}
                style={{
                  position: "absolute",
                  top: "10px",
                  right: "12px",
                  color: "#EF4444",
                  fontSize: "18px",
                  fontWeight: "bold",
                  background: "transparent",
                  lineHeight: 1,
                }}
              >
                ✕
              </button>

              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="text-lg font-bold text-white">{r.service}</div>

                <div
                  className="px-3 py-1 rounded text-[11px] font-bold uppercase"
                  style={{
                    border: "1px solid #C084FC",
                    color: "#C084FC",
                  }}
                >
                  {r.owner}
                </div>

                <div
                  className="px-3 py-1 rounded text-[11px] font-bold uppercase"
                  style={{
                    border:
                      r.fixStatus === "Fixed"
                        ? "1px solid #10B981"
                        : r.fixStatus === "In Progress"
                          ? "1px solid #F59E0B"
                          : "1px solid #94A3B8",
                    color:
                      r.fixStatus === "Fixed"
                        ? "#10B981"
                        : r.fixStatus === "In Progress"
                          ? "#F59E0B"
                          : "#94A3B8",
                  }}
                >
                  {r.fixStatus}
                </div>

                <div className="text-sm text-gray-400">{r.time}</div>
              </div>

              <div className="text-base mb-4 whitespace-pre-wrap text-white">
                {r.message}
              </div>

              <div className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">
                Status
              </div>
              <div className="flex flex-wrap gap-4 mb-6">
                <button
                  onClick={() => updateStatus(r.id, "Pending")}
                  className="px-4 py-2 text-sm rounded"
                  style={{
                    border: "1px solid #94A3B8",
                    color: "#94A3B8",
                    backgroundColor: "#0D1B2E",
                  }}
                >
                  Pending
                </button>

                <button
                  onClick={() => updateStatus(r.id, "In Progress")}
                  className="px-4 py-2 text-sm rounded"
                  style={{
                    border: "1px solid #F59E0B",
                    color: "#F59E0B",
                    backgroundColor: "#0D1B2E",
                  }}
                >
                  In Progress
                </button>

                <button
                  onClick={() => updateStatus(r.id, "Fixed")}
                  className="px-4 py-2 text-sm rounded"
                  style={{
                    border: "1px solid #10B981",
                    color: "#10B981",
                    backgroundColor: "#0D1B2E",
                  }}
                >
                  Fixed
                </button>
              </div>

              <div className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">
                Actions
              </div>
              <div className="flex flex-wrap gap-4 mb-6">
                <button
                  onClick={() => archiveReport(r.id, "Fixed")}
                  className="px-4 py-2 text-sm rounded"
                  style={{
                    border: "1px solid #10B981",
                    color: "#10B981",
                    backgroundColor: "#0D1B2E",
                  }}
                >
                  Archive as Fixed
                </button>

                <button
                  onClick={() => archiveReport(r.id, "Abandoned")}
                  className="px-4 py-2 text-sm rounded"
                  style={{
                    border: "1px solid #F59E0B",
                    color: "#F59E0B",
                    backgroundColor: "#0D1B2E",
                  }}
                >
                  Archive as Abandoned
                </button>

                <button
                  onClick={() => archiveReport(r.id, "Failed")}
                  className="px-4 py-2 text-sm rounded"
                  style={{
                    border: "1px solid #EF4444",
                    color: "#EF4444",
                    backgroundColor: "#0D1B2E",
                  }}
                >
                  Archive as Failed
                </button>

                <button
                  onClick={() => saveToVault(r)}
                  className="px-4 py-2 text-sm rounded"
                  style={{
                    border: "1px solid #3B82F6",
                    color: "#3B82F6",
                    backgroundColor: "#0D1B2E",
                  }}
                >
                  Save Report to Vault
                </button>
              </div>

              <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
                What was done to fix
              </div>

              <textarea
                value={r.notes}
                onChange={(e) => updateNotes(r.id, e.target.value)}
                placeholder="Add update, fix notes, what was changed, and whether it worked."
                className="w-full min-h-[140px] p-4 rounded-lg text-sm"
                style={{
                  backgroundColor: "#0D1B2E",
                  border: "1px solid #1B2A4A",
                  color: "#FFFFFF",
                  resize: "vertical",
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
