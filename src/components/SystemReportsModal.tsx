import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

export default function SystemReportsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [reports, setReports] = useState<any[]>([]);

  const load = () => {
    const data = JSON.parse(localStorage.getItem("system_health_reports") || "[]");
    setReports(data);
  };

  useEffect(() => {
    if (isOpen) load();
    const sync = () => load();
    window.addEventListener("storage_sync", sync);
    return () => window.removeEventListener("storage_sync", sync);
  }, [isOpen]);

  const clear = () => {
    localStorage.setItem("system_health_reports", "[]");
    setReports([]);
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[9500]" onClick={onClose}>
      <div 
        className="bg-[#0D1B2E] border border-[#1B2A4A] w-[600px] h-[500px] flex flex-col rounded-xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-[#1B2A4A] flex justify-between items-center bg-[#111D30]">
          <span className="text-white font-bold text-xs tracking-tighter">INCIDENT_VAULT</span>
          <div className="flex gap-4">
            <button onClick={clear} className="text-[10px] text-red-500 font-bold hover:underline">WIPE_ALL</button>
            <button onClick={onClose} className="text-white hover:text-red-500">✕</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {reports.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-600 text-[10px] uppercase font-mono">No Records Found</div>
          ) : (
            reports.map((r: any) => (
              <div key={r.id} className="p-3 bg-[#16253A] border border-[#1B2A4A] rounded flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <span className="text-white text-xs font-bold">{r.service}</span>
                  <span className="text-[9px] text-gray-500">{r.time}</span>
                </div>
                <div className="text-[10px] text-gray-400 italic">{r.message}</div>
                <div className="text-[9px] text-[#C9A84C] mt-1 font-mono">TYPE: {r.type}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
