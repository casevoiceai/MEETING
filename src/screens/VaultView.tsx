// FULL FILE — FIXED DATA PIPELINE + WAITING/QUARANTINE

import { useEffect, useMemo, useState } from "react";

type Report = {
  id: string;
  service: string;
  owner: string;
  status: string;
  folder: string;
  time: string;
  title: string;
  description: string;
};

const STORAGE_KEYS = [
  "systemReports",
  "system_reports",
  "systemHealthReports",
  "system_health_reports",
  "vaultSystemHealthRecords",
  "meetingRoomSystemReports",
];

const FILTERS = [
  "ACTIVE",
  "ALL",
  "SAVED",
  "FIXED",
  "FAILED",
  "ABANDONED",
  "WAITING",
  "QUARANTINE",
];

export default function VaultView() {
  const [reports, setReports] = useState<Report[]>([]);
  const [filter, setFilter] = useState("ACTIVE");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modal, setModal] = useState<Report | null>(null);

  // 🔥 FIX: READ FROM ALL STORAGE KEYS
  useEffect(() => {
    let all: Report[] = [];

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

    // dedupe by id
    const map = new Map();
    all.forEach((r) => map.set(r.id, r));

    setReports(Array.from(map.values()));
  }, []);

  const filtered = useMemo(() => {
    if (filter === "ALL") return reports;
    return reports.filter((r) => r.status === filter);
  }, [reports, filter]);

  const selected = reports.find((r) => r.id === selectedId);

  const updateStatus = (id: string, status: string) => {
    const next = reports.map((r) =>
      r.id === id ? { ...r, status } : r
    );

    setReports(next);
    localStorage.setItem("systemHealthReports", JSON.stringify(next));
    setModal(null);
  };

  const deleteReport = (id: string) => {
    const next = reports.filter((r) => r.id !== id);
    setReports(next);
    localStorage.setItem("systemHealthReports", JSON.stringify(next));
    setModal(null);
    setSelectedId(null);
  };

  return (
    <div className="p-8 bg-[#0D1B2E] text-white min-h-screen">

      <h1 className="text-3xl mb-4">System Health Records</h1>

      {/* FILTERS */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded ${
              filter === f ? "bg-yellow-500 text-black" : "bg-[#111D30]"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* TABLE */}
      {filtered.map((r) => (
        <div key={r.id} className="border-b border-[#1B2A4A] py-3">

          <div className="flex justify-between">
            <div>{r.service}</div>
            <button onClick={() => setSelectedId(selectedId === r.id ? null : r.id)}>
              {selectedId === r.id ? "Close" : "Open"}
            </button>
          </div>

          {selectedId === r.id && (
            <div className="mt-4 p-4 bg-[#111D30] rounded">

              <h2 className="text-xl">{r.title}</h2>
              <p className="mb-4">{r.description}</p>

              {/* NEXT ACTION */}
              <div className="border border-red-500 p-4 mb-4 rounded">
                <div className="text-sm text-gray-400">NEXT ACTION</div>
                <div className="font-bold">Action required now</div>
              </div>

              {/* SAFE ACTION */}
              <button
                onClick={() => setModal(r)}
                className="border border-red-500 px-3 py-2 text-red-400 rounded"
              >
                Move / Delete
              </button>

            </div>
          )}
        </div>
      ))}

      {/* MODAL */}
      {modal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center">

          <div className="bg-[#111D30] p-6 rounded w-[500px]">

            <h2 className="text-xl mb-2">Move Record</h2>

            <div className="mb-4">
              <div className="font-bold">{modal.title}</div>
              <div>{modal.service}</div>
            </div>

            <div className="space-y-2">

              <button
                onClick={() => updateStatus(modal.id, "WAITING")}
                className="w-full bg-blue-600 p-2 rounded"
              >
                Waiting Room
              </button>

              <button
                onClick={() => updateStatus(modal.id, "QUARANTINE")}
                className="w-full bg-yellow-600 p-2 rounded"
              >
                Quarantine
              </button>

              <button
                onClick={() => deleteReport(modal.id)}
                className="w-full bg-red-700 p-2 rounded"
              >
                Permanently Delete
              </button>

            </div>

            <button onClick={() => setModal(null)} className="mt-4 text-gray-400">
              Cancel
            </button>

          </div>
        </div>
      )}
    </div>
  );
}
