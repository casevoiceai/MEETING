import { useState, useEffect } from "react";

type Report = {
  id: string;
  time: string;
  service: string;
  owner: string;
  message: string;
  fixStatus: string;
  notes: string;
  type: "TEAM" | "PROMPT" | "AUTO_FIX";
};

export default function SystemReportsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [reports, setReports] = useState<Report[]>([]);

  const loadReports = () => {
    const data = localStorage.getItem("system_health_reports");
    if (data) {
      setReports(JSON.parse(data));
    } else {
      setReports([]);
    }
  };

  // Sync state whenever modal opens or storage event fires
  useEffect(() => {
    if (isOpen) loadReports();
  }, [isOpen]);

  useEffect(() => {
    const handleSync = () => loadReports();
    window.addEventListener("storage_update", handleSync);
    window.addEventListener("storage", handleSync);
    return () => {
      window.removeEventListener("storage_update", handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, []);

  const clearReports = () => {
    localStorage.removeItem("system_health_reports");
    setReports([]);
    window.dispatchEvent(new Event("storage_update"));
  };

  const deleteOne = (id: string) => {
    const updated = reports.filter((r) => r.id !== id);
    localStorage.setItem("system_health_reports", JSON.stringify(updated));
    setReports(updated);
    window.dispatchEvent(new Event("storage_update"));
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.8)", zIndex: 9000 }}
      onClick={onClose}
    >
      <div
        className="w-[800px] h-[600px] flex flex-col rounded-xl overflow-hidden shadow-2xl"
        style={{ backgroundColor: "#0D1B2E", border: "1px solid #1B2A4A" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-[#1B2A4A] flex justify-between items-center bg-[#111D30]">
          <h2 className="text-white font-bold tracking-widest uppercase text-sm">System Health Vault</h2>
          <div className="flex gap-3">
            <button onClick={clearReports} className="text-[10px] text-red-400 hover:underline">CLEAR ALL</button>
            <button onClick={onClose} className="text-white hover:text-gray-300">✕</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {reports.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-500 text-xs italic">
              No reports generated in this session.
            </div>
          ) : (
            reports.map((report) => (
              <div
                key={report.id}
                className="p-3 rounded bg-[#16253A] border border-[#1B2A4A] flex justify-between group"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#C9A84C] font-mono">{report.time}</span>
                    <span className="text-xs text-white font-bold">{report.service}</span>
                    <span className={`text-[9px] px-1 rounded ${
                      report.type === "AUTO_FIX" ? "bg-blue-900 text-blue-200" : 
                      report.type === "TEAM" ? "bg-green-900 text-green-200" : "bg-purple-900 text-purple-200"
                    }`}>
                      {report.type}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-400 max-w-[600px]">{report.message}</div>
                  <div className="text-[10px] text-gray-500 italic">Owner: {report.owner}</div>
                </div>
                <button 
                  onClick={() => deleteOne(report.id)}
                  className="opacity-0 group-hover:opacity-100 text-red-500 text-xs px-2"
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
