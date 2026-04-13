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

type VaultViewProps = {
  onNavigateLinked?: (type: any, id: string) => void;
  linkedTarget?: any;
};

export default function VaultView(_props: VaultViewProps) {
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
  }, []);

  const saveReports = (next: Report[]) => {
    setReports(next);
    localStorage.setItem("system_health_reports", JSON.stringify(next));
  };

  const updateStatus = (id: number, fixStatus: string) => {
    const next = reports.map((report) =>
      report.id === id ? { ...report, fixStatus } : report
    );
    saveReports(next);
  };

  const updateNotes = (id: number, notes: string) => {
    const next = reports.map((report) =>
      report.id === id ? { ...report, notes } : report
    );
    saveReports(next);
  };

  return (
    <div
      className="flex-1 min-h-0 overflow-auto"
      style={{ backgroundColor: "#0D1B2E", color: "#FFFFFF" }}
    >
      <div className="p-6">
        <div className="mb-6">
          <div
            className="text-xs font-bold uppercase tracking-widest mb-2"
            style={{ color: "#8A9BB5" }}
          >
            Vault
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "#FFFFFF" }}>
            System Health Reports
          </h1>
          <p className="text-sm mt-2" style={{ color: "#8A9BB5" }}>
            TM Message log, status tracking, and fix notes.
          </p>
        </div>

        {reports.length === 0 ? (
          <div
            className="rounded-xl p-6 border"
            style={{
              backgroundColor: "#111D30",
              borderColor: "#1B2A4A",
              color: "#8A9BB5",
            }}
          >
            No reports yet.
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <div
                key={report.id}
                className="rounded-xl p-4 border"
                style={{
                  backgroundColor: "#111D30",
                  borderColor: "#1B2A4A",
                }}
              >
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <div className="text-sm font-bold">{report.service}</div>
                  <div
                    className="px-2 py-1 rounded text-[10px] font-bold uppercase"
                    style={{
                      border: "1px solid #C084FC",
                      color: "#C084FC",
                    }}
                  >
                    {report.owner}
                  </div>
                  <div
                    className="px-2 py-1 rounded text-[10px] font-bold uppercase"
                    style={{
                      border:
                        report.fixStatus === "Fixed"
                          ? "1px solid #10B981"
                          : report.fixStatus === "In Progress"
                            ? "1px solid #F59E0B"
                            : "1px solid #94A3B8",
                      color:
                        report.fixStatus === "Fixed"
                          ? "#10B981"
                          : report.fixStatus === "In Progress"
                            ? "#F59E0B"
                            : "#94A3B8",
                    }}
                  >
                    {report.fixStatus}
                  </div>
                  <div className="text-xs" style={{ color: "#8A9BB5" }}>
                    {report.time}
                  </div>
                </div>

                <div className="text-sm mb-4 whitespace-pre-wrap">
                  {report.message}
                </div>

                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => updateStatus(report.id, "Pending")}
                    className="px-3 py-1 text-xs rounded"
                    style={{
                      backgroundColor: "#1B2A4A",
                      color: "#94A3B8",
                      border: "1px solid #94A3B8",
                    }}
                  >
                    Pending
                  </button>

                  <button
                    onClick={() => updateStatus(report.id, "In Progress")}
                    className="px-3 py-1 text-xs rounded"
                    style={{
                      backgroundColor: "#1B2A4A",
                      color: "#F59E0B",
                      border: "1px solid #F59E0B",
                    }}
                  >
                    In Progress
                  </button>

                  <button
                    onClick={() => updateStatus(report.id, "Fixed")}
                    className="px-3 py-1 text-xs rounded"
                    style={{
                      backgroundColor: "#1B2A4A",
                      color: "#10B981",
                      border: "1px solid #10B981",
                    }}
                  >
                    Fixed
                  </button>
                </div>

                <div className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: "#8A9BB5" }}>
                  What was done to fix
                </div>

                <textarea
                  value={report.notes}
                  onChange={(e) => updateNotes(report.id, e.target.value)}
                  placeholder="Add update, fix notes, what was changed, and whether it worked."
                  className="w-full min-h-[96px] p-3 rounded-lg text-sm"
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
        )}
      </div>
    </div>
  );
}
