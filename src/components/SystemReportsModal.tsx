import { useEffect, useState } from "react";

type Report = {
  id: number;
  time: string;
  service: string;
  owner: string;
  message: string;
  fixStatus: string;
  notes: string;
  state?: "active" | "saved" | "archived";
};

function nowLabel() {
  return new Date().toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
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

  const updateNotes = (id: number, notes: string) => {
    save(reports.map(r => r.id === id ? { ...r, notes } : r));
  };

  const deleteReport = (id: number) => {
    save(reports.filter(r => r.id !== id));
  };

  const markSaved = (id: number) => {
    save(
      reports.map(r =>
        r.id === id ? { ...r, state: "saved" } : r
      )
    );
  };

  const markArchived = (id: number) => {
    save(
      reports.map(r =>
        r.id === id ? { ...r, state: "archived" } : r
      )
    );
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.75)" }}>
      <div className="w-[860px] max-h-[84vh] overflow-y-auto p-6 rounded-xl" style={{ backgroundColor: "#0D1B2E", border: "1px solid #1B2A4A" }}>
        
        <div className="flex justify-between mb-6">
          <div className="text-white text-xl font-bold">System Reports</div>
          <button onClick={onClose} style={{ color: "#C9A84C" }}>Close</button>
        </div>

        <div className="space-y-6">
          {reports.map(r => (
            <div
              key={r.id}
              className="p-5 rounded border relative"
              style={{
                backgroundColor:
                  r.state === "saved"
                    ? "#0E2A3A"
                    : r.state === "archived"
                    ? "#2A1A1A"
                    : "#111D30",
                borderColor: "#1B2A4A"
              }}
            >

              <button
                onClick={() => deleteReport(r.id)}
                style={{
                  position: "absolute",
                  top: 10,
                  right: 12,
                  color: "#EF4444",
                  fontSize: 18
                }}
              >
                ✕
              </button>

              <div className="text-white font-bold text-lg mb-2">
                {r.service}
              </div>

              <div className="text-sm text-gray-400 mb-4">
                {r.message}
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex gap-4 mb-4">

                <button
                  onClick={() => markSaved(r.id)}
                  style={{
                    border: "1px solid #3B82F6",
                    color: "#3B82F6",
                    padding: "8px 12px"
                  }}
                >
                  Save → Vault
                </button>

                <button
                  onClick={() => markArchived(r.id)}
                  style={{
                    border: "1px solid #10B981",
                    color: "#10B981",
                    padding: "8px 12px"
                  }}
                >
                  Archive Report
                </button>

              </div>

              {/* VISUAL STATUS */}
              {r.state && (
                <div
                  style={{
                    fontSize: 12,
                    color:
                      r.state === "saved"
                        ? "#3B82F6"
                        : "#EF4444"
                  }}
                >
                  {r.state === "saved"
                    ? "Saved to Vault"
                    : "Archived"}
                </div>
              )}

              <textarea
                value={r.notes}
                onChange={(e) => updateNotes(r.id, e.target.value)}
                className="w-full mt-4 p-3"
                style={{
                  backgroundColor: "#0D1B2E",
                  border: "1px solid #1B2A4A",
                  color: "white"
                }}
              />

            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
