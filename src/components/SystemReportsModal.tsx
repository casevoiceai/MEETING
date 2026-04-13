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
        setReports(JSON.parse(stored));
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
    save(
      reports.map((r) =>
        r.id === id ? { ...r, fixStatus } : r
      )
    );
  };

  const updateNotes = (id: number, notes: string) => {
    save(
      reports.map((r) =>
        r.id === id ? { ...r, notes } : r
      )
    );
  };

  const deleteReport = (id: number) => {
    save(reports.filter((r) => r.id !== id));
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.75)", zIndex: 3000 }}
    >
      <div
        className="w-[760px] max-h-[82vh] overflow-y-auto p-5 rounded-xl"
        style={{
          backgroundColor: "#0D1B2E",
          border: "1px solid #1B2A4A",
        }}
      >
        <div className="flex justify-between items-center mb-4">
          <div>
            <div className="text-lg text-white font-bold">System Reports</div>
            <div className="text-xs text-gray-400">
              Active fires, team messages, status tracking, and fix notes.
            </div>
          </div>

          <button
            onClick={onClose}
            className="px-3 py-1 text-xs rounded"
            style={{
              backgroundColor: "#1B2A4A",
              color: "#C9A84C",
            }}
          >
            Close
          </button>
        </div>

        {reports.length === 0 && (
          <div className="text-gray-400">No active issues.</div>
        )}

        <div className="space-y-4">
          {reports.map((r) => (
            <div
              key={r.id}
              className="p-4 rounded border"
              style={{
                backgroundColor: "#111D30",
                borderColor: "#1B2A4A",
              }}
            >
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <div className="text-sm font-bold text-white">
                  {r.service}
                </div>

                <div
                  className="px-2 py-1 rounded text-[10px] font-bold uppercase"
                  style={{
                    border: "1px solid #C084FC",
                    color: "#C084FC",
                  }}
                >
                  {r.owner}
                </div>

                <div
                  className="px-2 py-1 rounded text-[10px] font-bold uppercase"
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

              <div className="text-sm mb-4 whitespace-pre-wrap text-white">
                {r.message}
              </div>

              <div className="flex gap-2 mb-3 flex-wrap">
                <button
                  onClick={() => updateStatus(r.id, "Pending")}
                  className="px-2 py-1 text-xs rounded"
                  style={{
                    border: "1px solid #94A3B8",
                    color: "#94A3B8",
                  }}
                >
                  Pending
                </button>

                <button
                  onClick={() => updateStatus(r.id, "In Progress")}
                  className="px-2 py-1 text-xs rounded"
                  style={{
                    border: "1px solid #F59E0B",
                    color: "#F59E0B",
                  }}
                >
                  In Progress
                </button>

                <button
                  onClick={() => updateStatus(r.id, "Fixed")}
                  className="px-2 py-1 text-xs rounded"
                  style={{
                    border: "1px solid #10B981",
                    color: "#10B981",
                  }}
                >
                  Fixed
                </button>

                <button
                  onClick={() => deleteReport(r.id)}
                  className="px-2 py-1 text-xs rounded"
                  style={{
                    border: "1px solid #EF4444",
                    color: "#EF4444",
                  }}
                >
                  Delete
                </button>
              </div>

              <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                What was done to fix
              </div>

              <textarea
                value={r.notes}
                onChange={(e) => updateNotes(r.id, e.target.value)}
                placeholder="Add update, fix notes, what was changed, and whether it worked."
                className="w-full min-h-[110px] p-3 rounded-lg text-sm"
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
