import { useEffect, useState } from "react";

type RecordItem = {
  id: string;
  service: string;
  time: string;
  message: string;
  status: string;
  type?: string;
};

export default function VaultView() {
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [active, setActive] = useState<RecordItem | null>(null);

  const load = () => {
    const data = JSON.parse(localStorage.getItem("system_health_reports") || "[]");
    setRecords(data.reverse());
  };

  useEffect(() => {
    load();
    const sync = () => load();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  return (
    <div className="p-6 text-white space-y-6">
      <h1 className="text-2xl font-semibold">System Health Reports</h1>

      <div className="space-y-3">
        {records.map((r) => (
          <div
            key={r.id}
            onClick={() => setActive(r)}
            className="bg-[#0f1b2d] hover:bg-[#16243a] transition cursor-pointer border border-[#1e2e4a] rounded-xl p-4 flex justify-between items-center"
          >
            <div>
              <div className="font-medium">{r.service}</div>
              <div className="text-sm text-gray-400">{r.time}</div>
            </div>

            <div className="text-sm text-yellow-400">
              {active?.id === r.id ? "Hide" : "Open"}
            </div>
          </div>
        ))}
      </div>

      {/* MODAL */}
      {active && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#0f1b2d] w-[600px] max-w-full rounded-2xl border border-[#1e2e4a] p-6 relative">
            <button
              onClick={() => setActive(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              ✕
            </button>

            <h2 className="text-xl font-semibold mb-4">System Report</h2>

            <div className="space-y-4">
              <div className="bg-[#16243a] p-4 rounded-xl border border-[#1e2e4a]">
                <div className="font-medium mb-1">{active.service}</div>
                <div className="text-sm text-gray-400 mb-2">{active.time}</div>
                <div className="text-sm">{active.message}</div>

                {active.type && (
                  <div className="text-xs text-yellow-400 mt-2">
                    TYPE: {active.type}
                  </div>
                )}

                <div className="text-xs text-gray-400 mt-1">
                  STATUS: {active.status}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
