import { useEffect, useState } from "react";

export default function SystemReportsPanel() {
  const [reports, setReports] = useState([]);

  useEffect(() => {
    const stored =
      JSON.parse(localStorage.getItem("systemReports")) || [];
    setReports(stored);
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
    <div className="p-4 space-y-6">
      {reports.map((report) => (
        <div key={report.id} className="bg-[#111D30] p-4 rounded">

          <div className="text-white font-semibold mb-1">
            {report.title || report.service}
          </div>

          <div className="text-gray-400 mb-4">
            {report.description}
          </div>

          <div className="flex gap-2 flex-wrap">

            <button
              onClick={() => createVaultRecord(report, "FIXED")}
              className="bg-green-600 px-3 py-2 rounded text-white"
            >
              Archive as Fixed
            </button>

            <button
              onClick={() => createVaultRecord(report, "ABANDONED")}
              className="bg-yellow-600 px-3 py-2 rounded text-white"
            >
              Archive as Abandoned
            </button>

            <button
              onClick={() => createVaultRecord(report, "FAILED")}
              className="bg-red-600 px-3 py-2 rounded text-white"
            >
              Archive as Failed
            </button>

            <button
              onClick={() => createVaultRecord(report, "SAVED")}
              className="bg-blue-600 px-3 py-2 rounded text-white"
            >
              Save Report to Vault
            </button>

          </div>
        </div>
      ))}
    </div>
  );
}
