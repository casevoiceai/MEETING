import { useEffect, useState } from "react";

const STORAGE_KEYS = [
  "systemReports",
  "system_reports",
  "systemHealthReports",
  "system_health_reports",
  "meetingRoomSystemReports",
];

export default function SystemHealthPanel() {
  const [reports, setReports] = useState([]);

  useEffect(() => {
    let all = [];

    STORAGE_KEYS.forEach((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return;

      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          all.push(...parsed);
        }
      } catch {}
    });

    // dedupe
    const map = new Map();
    all.forEach((r) => map.set(r.id, r));

    setReports(Array.from(map.values()));
  }, []);

  const createVaultRecord = (report, status) => {
    const newRecord = {
      ...report,
      id: `${report.id}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 6)}`,
      status,
      time: new Date().toLocaleTimeString(),
      folder: `Vault / System Health Reports / ${status}`,
    };

    const existing =
      JSON.parse(localStorage.getItem("systemHealthReports")) || [];

    const updated = [...existing, newRecord];

    localStorage.setItem("systemHealthReports", JSON.stringify(updated));

    window.dispatchEvent(new Event("system-health-reports-updated"));
  };

  return (
    <div className="fixed right-0 top-[80px] w-[420px] h-[calc(100vh-80px)] bg-[#0D1B2E] border-l border-[#1B2A4A] overflow-y-auto z-50">

      <div className="p-4">

        <div className="text-sm text-[#8BA4C2] mb-2 uppercase">
          System Health
        </div>

        {reports.length === 0 && (
          <div className="text-red-400 text-sm">
            No reports found (data missing)
          </div>
        )}

        {reports.map((report) => (
          <div key={report.id} className="bg-[#111D30] p-4 rounded mb-4">

            <div className="text-white font-semibold mb-1">
              {report.title || report.service}
            </div>

            <div className="text-gray-400 mb-4 text-sm">
              {report.description}
            </div>

            <div className="flex gap-2 flex-wrap">

              <button
                onClick={() => createVaultRecord(report, "FIXED")}
                className="bg-green-600 px-3 py-2 rounded text-white text-xs"
              >
                Fixed
              </button>

              <button
                onClick={() => createVaultRecord(report, "ABANDONED")}
                className="bg-yellow-600 px-3 py-2 rounded text-white text-xs"
              >
                Abandoned
              </button>

              <button
                onClick={() => createVaultRecord(report, "FAILED")}
                className="bg-red-600 px-3 py-2 rounded text-white text-xs"
              >
                Failed
              </button>

              <button
                onClick={() => createVaultRecord(report, "SAVED")}
                className="bg-blue-600 px-3 py-2 rounded text-white text-xs"
              >
                Save
              </button>

            </div>

          </div>
        ))}

      </div>
    </div>
  );
}
