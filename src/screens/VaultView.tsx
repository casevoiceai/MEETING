import { useEffect, useState } from "react";

type SavedReport = {
  id: number;
  time: string;
  service: string;
  owner: string;
  message: string;
  fixStatus: string;
  notes: string;
  savedAt: string;
  folder: string;
};

type VaultViewProps = {
  onNavigateLinked?: (type: any, id: string) => void;
  linkedTarget?: any;
};

export default function VaultView(_props: VaultViewProps) {
  const [reports, setReports] = useState<SavedReport[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem("vault_system_health_reports");
    if (stored) {
      try {
        setReports(JSON.parse(stored));
      } catch {
        setReports([]);
      }
    }
  }, []);

  const deleteSavedReport = (id: number) => {
    const next = reports.filter((r) => r.id !== id);
    setReports(next);
    localStorage.setItem("vault_system_health_reports", JSON.stringify(next));
  };

  return (
    <div
      className="flex-1 min-h-0 overflow-auto"
      style={{ backgroundColor: "#0D1B2E", color: "#FFFFFF" }}
    >
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-6">
          <div
            className="text-xs font-bold uppercase tracking-widest mb-2"
            style={{ color: "#8A9BB5" }}
          >
            Vault
          </div>
          <h1 className="text-2xl font-bold">System Health Reports</h1>
          <p className="text-sm mt-2" style={{ color: "#8A9BB5" }}>
            Saved reports only. This is the folder view for reports you chose to keep.
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
            No saved reports yet.
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <div
                key={report.id}
                className="rounded-xl p-5 border relative"
                style={{
                  backgroundColor: "#111D30",
                  borderColor: "#1B2A4A",
                }}
              >
                <button
                  onClick={() => deleteSavedReport(report.id)}
                  style={{
                    position: "absolute",
                    top: "12px",
                    right: "14px",
                    color: "#EF4444",
                    fontSize: "18px",
                    fontWeight: "bold",
                    background: "transparent",
                    lineHeight: 1,
                  }}
                >
                  ✕
                </button>

                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <div className="text-base font-bold">{report.service}</div>

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
                      border: "1px solid #3B82F6",
                      color: "#3B82F6",
                    }}
                  >
                    Saved
                  </div>

                  <div className="text-xs" style={{ color: "#8A9BB5" }}>
                    {report.savedAt}
                  </div>
                </div>

                <div className="text-xs mb-2" style={{ color: "#8A9BB5" }}>
                  Folder: {report.folder}
                </div>

                <div className="text-sm mb-3 whitespace-pre-wrap">{report.message}</div>

                <div
                  className="mb-2 text-xs font-bold uppercase tracking-widest"
                  style={{ color: "#8A9BB5" }}
                >
                  Saved notes
                </div>

                <div
                  className="w-full min-h-[110px] p-3 rounded-lg text-sm whitespace-pre-wrap"
                  style={{
                    backgroundColor: "#0D1B2E",
                    border: "1px solid #1B2A4A",
                    color: "#FFFFFF",
                  }}
                >
                  {report.notes || "No notes saved."}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
