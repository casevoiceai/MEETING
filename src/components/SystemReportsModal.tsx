import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

export default function SystemReportsModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [reports, setReports] = useState<any[]>([]);
  const [openIds, setOpenIds] = useState<string[]>([]);

  const load = () => {
    const data = JSON.parse(
      localStorage.getItem("system_health_reports") || "[]"
    );
    setReports(data);
  };

  useEffect(() => {
    if (isOpen) load();

    const sync = () => load();
    window.addEventListener("storage_sync", sync);

    return () => window.removeEventListener("storage_sync", sync);
  }, [isOpen]);

  const toggleOpen = (id: string) => {
    setOpenIds((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id]
    );
  };

  const deleteReport = (id: string) => {
    const updated = reports.filter((r) => r.id !== id);
    localStorage.setItem("system_health_reports", JSON.stringify(updated));
    setReports(updated);
    window.dispatchEvent(new Event("storage_sync"));
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)" }}
    >
      <div
        className="bg-[#0D1B2E] border border-[#1B2A4A] w-[700px] max-h-[80vh] flex flex-col rounded-xl shadow-2xl"
      >
        {/* HEADER */}
        <div className="p-4 border-b border-[#1B2A4A] flex justify-between items-center bg-[#111D30]">
          <span className="text-white font-bold text-xs tracking-tighter">
            SYSTEM REPORTS
          </span>
          <button
            onClick={onClose}
            className="text-white hover:text-red-500 text-sm"
          >
            ✕
          </button>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {reports.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-600 text-[10px] uppercase font-mono">
              No Reports Found
            </div>
          ) : (
            reports.map((r: any) => {
              const isOpen = openIds.includes(r.id);

              return (
                <div
                  key={r.id}
                  className="border border-[#1B2A4A] rounded bg-[#16253A]"
                >
                  {/* ROW HEADER */}
                  <div
                    onClick={() => toggleOpen(r.id)}
                    className="flex justify-between items-center px-3 py-2 cursor-pointer hover:bg-[#1B2A4A]"
                  >
                    <span className="text-white text-xs font-bold">
                      {r.service}
                    </span>
                    <span className="text-[9px] text-gray-500">
                      {r.time}
                    </span>
                  </div>

                  {/* EXPANDED */}
                  {isOpen && (
                    <div className="px-3 pb-3 flex flex-col gap-2">
                      <div className="text-[11px] text-gray-300 italic">
                        {r.message}
                      </div>

                      <div className="text-[10px] text-[#C9A84C] font-mono">
                        TYPE: {r.type}
                      </div>

                      <button
                        onClick={() => deleteReport(r.id)}
                        className="text-[10px] text-red-400 hover:text-red-300 text-left"
                      >
                        Delete Report
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
