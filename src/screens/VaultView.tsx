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

export default function Vault() {
  const [reports, setReports] = useState<Report[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem("system_health_reports");
    if (stored) {
      setReports(JSON.parse(stored));
    }
  }, []);

  const updateStatus = (id: number, status: string) => {
    const updated = reports.map((r) =>
      r.id === id ? { ...r, fixStatus: status } : r
    );
    setReports(updated);
    localStorage.setItem("system_health_reports", JSON.stringify(updated));
  };

  const updateNotes = (id: number, notes: string) => {
    const updated = reports.map((r) =>
      r.id === id ? { ...r, notes } : r
    );
    setReports(updated);
    localStorage.setItem("system_health_reports", JSON.stringify(updated));
  };

  return (
    <div className="p-6 text-white">
      <h2 className="text-lg mb-4">System Health Reports</h2>

      {reports.length === 0 && (
        <div className="text-gray-400">No reports yet.</div>
      )}

      {reports.map((r) => (
        <div
          key={r.id}
          className="mb-4 p-4 rounded border"
          style={{ borderColor: "#1B2A4A", backgroundColor: "#0D1B2E" }}
        >
          <div className="text-sm mb-1">{r.time}</div>
          <div className="text-xs text-gray-400 mb-2">
            {r.service} → {r.owner}
          </div>

          <div className="text-sm mb-2">{r.message}</div>

          <div className="flex gap-2 mb-2">
            <button
              onClick={() => updateStatus(r.id, "Fixed")}
              className="px-2 py-1 text-xs rounded"
              style={{
                border: "1px solid #10B981",
                color: "#10B981",
              }}
            >
              Mark Fixed
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
          </div>

          <textarea
            value={r.notes}
            onChange={(e) => updateNotes(r.id, e.target.value)}
            placeholder="What was done to fix?"
            className="w-full p-2 text-xs rounded"
            style={{
              backgroundColor: "#111D30",
              border: "1px solid #1B2A4A",
              color: "#fff",
            }}
          />
        </div>
      ))}
    </div>
  );
}
