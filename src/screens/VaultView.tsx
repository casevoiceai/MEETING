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
  const [openIds, setOpenIds] = useState<string[]>([]);

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

  const toggle = (id: string) => {
    setOpenIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="p-6 text-white space-y-6">
      <h1 className="text-2xl font-semibold">System Health Reports</h1>

      <div className="space-y-3">
        {records.map((r) => {
          const isOpen = openIds.includes(r.id);

          return (
            <div
              key={r.id}
              className="bg-[#0f1b2d] border border-[#1e2e4a] rounded-xl overflow-hidden"
            >
              {/* HEADER */}
              <div
                onClick={() => toggle(r.id)}
                className="flex justify-between items-center p-4 cursor-pointer hover:bg-[#16243a] transition"
              >
                <div>
                  <div className="font-medium">{r.service}</div>
                  <div className="text-sm text-gray-400">{r.time}</div>
                </div>

                <div className="text-sm text-yellow-400">
                  {isOpen ? "Hide" : "Open"}
                </div>
              </div>

              {/* EXPANDED CONTENT */}
              {isOpen && (
                <div className="px-4 pb-4 border-t border-[#1e2e4a] bg-[#16243a]">
                  <div className="mt-3 text-sm">{r.message}</div>

                  {r.type && (
                    <div className="text-xs text-yellow-400 mt-2">
                      TYPE: {r.type}
                    </div>
                  )}

                  <div className="text-xs text-gray-400 mt-1">
                    STATUS: {r.status}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
