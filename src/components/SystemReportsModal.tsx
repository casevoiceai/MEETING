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

type HistoryReport = Report & {
  archivedAt: string;
  outcome: "Fixed" | "Abandoned" | "Failed";
};

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
    }
  }, [open]);

  const save = (next: Report[]) => {
    setReports(next);
    localStorage.setItem("system_health_reports", JSON.stringify(next));
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

    const archivedReport: HistoryReport = {
      ...target,
      fixStatus: outcome,
      archivedAt: new Date().toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      }),
      outcome,
    };

    localStorage.setItem(
      "system_health_reports_history",
      JSON.stringify([archivedReport, ...parsedHistory])
    );

    save(reports.filter((r) => r.id !== id));
  };

  const clearAll = () => {
    save([]);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.75)", zIndex: 3000 }}
    >
      <div
        className="w-[820px] max-h-[82vh] overflow-y-auto p-5 rounded-xl"
        style={{
          backgroundColor: "#0D1B2E",
          border: "1px solid #1B2A4A",
        }}
      >
        <div className="flex justify-between items-center mb-5">
          <div>
            <div className="text-lg text-white font-bold">System Reports</div>
            <div className="text-xs text-gray-400">
              Active fires, team messages, status tracking, and fix notes.
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={clearAll}
              className="px-3 py-1.5 text-xs rounded"
              style={{
                backgroundColor: "#EF4444",
                color: "#FFFFFF",
              }}
            >
              Clear All
            </button>

            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs rounded"
              style={{
                backgroundColor: "#1B2A4A",
                color: "#C9A84C",
              }}
            >
              Close
            </button>
          </div>
        </div>

        {reports.length === 0 && <div className="text-gray-400">No active issues.</div>}

        <div className="space-y-5">
          {reports.map((r) => (
            <div
              key={r.id}
              className="p-5 rounded border"
              style={{
                backgroundColor: "#111D30",
                borderColor: "#1B2A4A",
              }}
            >
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="text-base font-bold text-white">{r.service}</div>

                <div
                  className="px-2.5 py-1 rounded text-[10px] font-bold uppercase"
                  style={{
                    border: "1px solid #C084FC",
                    color: "#C084FC",
                  }}
                >
                  {r.owner}
                </div>

                <div
                  className="px-2.5 py-1 rounded text-[10px] font-bold uppercase"
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

                <div className="text-xs text-gray-400">{r.time}</div>
              </div>

              <div className="text-sm mb-5 whitespace-pre-wrap text-white">{r.message}</div>

              <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                Status
              </div>
              <div className="flex flex-wrap gap-3 mb-5">
                <button
                  onClick={() => updateStatus(r.id, "Pending")}
                  className="px-3 py-2 text-xs rounded"
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
                  className="px-3 py-2 text-xs rounded"
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
                  className="px-3 py-2 text-xs rounded"
                  style={{
                    border: "1px solid #10B981",
                    color: "#10B981",
                    backgroundColor: "#0D1B2E",
                  }}
                >
                  Fixed
                </button>

                <button
                  onClick={() => deleteReport(r.id)}
                  className="px-3 py-2 text-xs rounded"
                  style={{
                    border: "1px solid #EF4444",
                    color: "#EF4444",
                    backgroundColor: "#0D1B2E",
                  }}
                >
                  Delete This Report
                </button>
              </div>

              <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                Archive Outcome
              </div>
              <div className="flex flex-wrap gap-3 mb-5">
                <button
                  onClick={() => archiveReport(r.id, "Fixed")}
                  className="px-3 py-2 text-xs rounded"
                  style={{
                    border: "1px solid #10B981",
                    color: "#10B981",
                    backgroundColor: "#0D1B2E",
                  }}
                >
                  Archive Fixed
                </button>

                <button
                  onClick={() => archiveReport(r.id, "Abandoned")}
                  className="px-3 py-2 text-xs rounded"
                  style={{
                    border: "1px solid #F59E0B",
                    color: "#F59E0B",
                    backgroundColor: "#0D1B2E",
                  }}
                >
                  Archive Abandoned
                </button>

                <button
                  onClick={() => archiveReport(r.id, "Failed")}
                  className="px-3 py-2 text-xs rounded"
                  style={{
                    border: "1px solid #EF4444",
                    color: "#EF4444",
                    backgroundColor: "#0D1B2E",
                  }}
                >
                  Archive Failed
                </button>
              </div>

              <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                What was done to fix
              </div>

              <textarea
                value={r.notes}
                onChange={(e) => updateNotes(r.id, e.target.value)}
                placeholder="Add update, fix notes, what was changed, and whether it worked."
                className="w-full min-h-[120px] p-3 rounded-lg text-sm"
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
