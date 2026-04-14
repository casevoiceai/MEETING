import { useEffect, useState } from "react";

export default function VaultView() {
  const [records, setRecords] = useState<any[]>([]);
  const [openIds, setOpenIds] = useState<string[]>([]);

  const load = () => {
    const data = JSON.parse(localStorage.getItem("system_health_reports") || "[]");
    setRecords(data);
  };

  useEffect(() => {
    load();
    const sync = () => load();
    window.addEventListener("storage_sync", sync);
    return () => window.removeEventListener("storage_sync", sync);
  }, []);

  const toggle = (id: string) => {
    setOpenIds(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : [...prev, id]
    );
  };

  return (
    <div className="p-6 text-white space-y-6">
      <h1 className="text-xl font-bold">System Health Reports</h1>

      <div className="border border-[#1B2A4A] rounded-lg overflow-hidden">
        {records.map((r) => {
          const isOpen = openIds.includes(r.id);

          return (
            <div key={r.id} className="border-b border-[#1B2A4A]">
              
              {/* ROW */}
              <div className="flex justify-between items-center px-4 py-3 bg-[#0D1B2E]">
                <div className="text-sm">
                  <div className="font-bold">{r.service}</div>
                  <div className="text-xs text-gray-400">{r.time}</div>
                </div>

                <button
                  onClick={() => toggle(r.id)}
                  className="text-yellow-400 text-xs"
                >
                  {isOpen ? "Hide" : "Open"}
                </button>
              </div>

              {/* EXPANDED PANEL */}
              {isOpen && (
                <div className="bg-[#111D30] p-4 text-sm text-gray-300">
                  <div className="mb-2">{r.message}</div>

                  <div className="text-xs text-[#C9A84C] mb-2">
                    TYPE: {r.type}
                  </div>

                  {r.notes && (
                    <div className="mt-2 p-2 bg-[#0B1C34] border border-[#1B2A4A] rounded">
                      {r.notes}
                    </div>
                  )}
                </div>
              )}

            </div>
          );
        })}
      </div>
    </div>
  );
}
