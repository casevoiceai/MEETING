import { useEffect, useState } from "react";

type VaultRecord = {
  id?: string;
  service?: string;
  time?: string;
  message?: string;
  type?: string;
  notes?: string;
  status?: string;
  outcome?: string | null;
};

export default function VaultView() {
  const [records, setRecords] = useState<VaultRecord[]>([]);
  const [openKeys, setOpenKeys] = useState<string[]>([]);

  const load = () => {
    try {
      const data = JSON.parse(localStorage.getItem("system_health_reports") || "[]");
      setRecords(Array.isArray(data) ? data : []);
    } catch {
      setRecords([]);
    }
  };

  useEffect(() => {
    load();
    const sync = () => load();
    window.addEventListener("storage_sync", sync);
    return () => window.removeEventListener("storage_sync", sync);
  }, []);

  const getRowKey = (r: VaultRecord, index: number) => {
    return `${r.id || "no-id"}__${r.time || "no-time"}__${r.service || "no-service"}__${index}`;
  };

  const toggle = (rowKey: string) => {
    setOpenKeys((prev) =>
      prev.includes(rowKey)
        ? prev.filter((x) => x !== rowKey)
        : [...prev, rowKey]
    );
  };

  return (
    <div className="p-6 text-white space-y-6 min-h-full">
      <h1 className="text-xl font-bold">System Health Reports</h1>

      <div className="border border-[#1B2A4A] rounded-lg overflow-hidden">
        {records.length === 0 ? (
          <div className="px-4 py-6 text-sm text-gray-400">No records found.</div>
        ) : (
          records.map((r, index) => {
            const rowKey = getRowKey(r, index);
            const isOpen = openKeys.includes(rowKey);

            return (
              <div key={rowKey} className="border-b border-[#1B2A4A] last:border-b-0">
                <div className="flex justify-between items-center px-4 py-3 bg-[#0D1B2E]">
                  <div className="text-sm min-w-0">
                    <div className="font-bold">{r.service || "Unknown Service"}</div>
                    <div className="text-xs text-gray-400">{r.time || "No time"}</div>
                  </div>

                  <button
                    onClick={() => toggle(rowKey)}
                    className="text-yellow-400 text-xs font-semibold"
                  >
                    {isOpen ? "Hide" : "Open"}
                  </button>
                </div>

                {isOpen && (
                  <div className="bg-[#111D30] p-4 text-sm text-gray-300 space-y-2">
                    <div>{r.message || "No message"}</div>

                    <div className="text-xs text-[#C9A84C]">
                      TYPE: {r.type || "REPORT"}
                    </div>

                    {(r.status || r.outcome) && (
                      <div className="text-xs text-[#8BA4C2]">
                        STATUS: {r.outcome || r.status}
                      </div>
                    )}

                    {r.notes && (
                      <div className="mt-2 p-2 bg-[#0B1C34] border border-[#1B2A4A] rounded">
                        {r.notes}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
