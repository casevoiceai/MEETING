// FULL FILE (REPLACE EVERYTHING)

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Clock3,
  FolderOpen,
  RefreshCw,
  ShieldAlert,
  Trash2,
  XCircle,
} from "lucide-react";

type ReportRecord = {
  id: string;
  service: string;
  owner: string;
  status: string;
  folder: string;
  time: string;
  title: string;
  description: string;
  notes: string;
  tags: string[];
  timeline: { id: string; time: string; label: string; detail?: string }[];
};

type FilterKey =
  | "ACTIVE"
  | "ALL"
  | "SAVED"
  | "FIXED"
  | "FAILED"
  | "ABANDONED"
  | "WAITING"
  | "QUARANTINE";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "ACTIVE", label: "Active" },
  { key: "ALL", label: "All" },
  { key: "SAVED", label: "Saved" },
  { key: "FIXED", label: "Fixed" },
  { key: "FAILED", label: "Failed" },
  { key: "ABANDONED", label: "Abandoned" },
  { key: "WAITING", label: "Waiting Room" },
  { key: "QUARANTINE", label: "Quarantine" },
];

export default function VaultView() {
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [filter, setFilter] = useState<FilterKey>("ACTIVE");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<ReportRecord | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("systemHealthReports");
    if (stored) setReports(JSON.parse(stored));
  }, []);

  const filtered = useMemo(() => {
    if (filter === "ALL") return reports;
    return reports.filter((r) => r.status === filter);
  }, [reports, filter]);

  const selected = filtered.find((r) => r.id === selectedId);

  const moveStatus = (id: string, status: string) => {
    const next = reports.map((r) =>
      r.id === id ? { ...r, status, folder: `Vault / ${status}` } : r
    );
    setReports(next);
    localStorage.setItem("systemHealthReports", JSON.stringify(next));
    setConfirmTarget(null);
  };

  const hardDelete = (id: string) => {
    const next = reports.filter((r) => r.id !== id);
    setReports(next);
    localStorage.setItem("systemHealthReports", JSON.stringify(next));
    setConfirmTarget(null);
    setSelectedId(null);
  };

  return (
    <div className="p-8 text-white bg-[#0D1B2E] min-h-screen">
      <h1 className="text-3xl mb-4">System Health Records</h1>

      {/* FILTER */}
      <div className="flex gap-2 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1 rounded ${
              filter === f.key ? "bg-yellow-500 text-black" : "bg-[#111D30]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* TABLE */}
      {filtered.map((r) => (
        <div key={r.id} className="border-b border-[#1B2A4A] py-3">
          <div className="flex justify-between items-center">
            <div>{r.service}</div>
            <button
              onClick={() =>
                setSelectedId(selectedId === r.id ? null : r.id)
              }
              className="text-yellow-400"
            >
              {selectedId === r.id ? "Close" : "Open"}
            </button>
          </div>

          {/* OPEN PANEL */}
          {selectedId === r.id && (
            <div className="mt-4 p-4 bg-[#111D30] rounded">

              <h2 className="text-xl mb-2">{r.title}</h2>
              <p className="mb-4">{r.description}</p>

              {/* NEXT ACTION */}
              <div className="p-4 mb-4 border border-red-500 rounded">
                <div className="text-sm text-gray-400">NEXT ACTION</div>
                <div className="text-lg font-bold mb-2">
                  Action required now
                </div>
                <button className="bg-red-600 px-4 py-2 rounded">
                  Reconnect Google Drive
                </button>
              </div>

              {/* SAFE ACTIONS */}
              <div className="mt-6 border-t border-[#1B2A4A] pt-4">
                <div className="text-xs text-gray-400 mb-2">
                  FILE ACTIONS (SAFE)
                </div>

                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => setConfirmTarget(r)}
                    className="px-3 py-2 border border-red-500 text-red-400 rounded"
                  >
                    Move / Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* CONFIRM MODAL */}
      {confirmTarget && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center">
          <div className="bg-[#111D30] p-6 rounded w-[500px]">

            <h2 className="text-xl mb-2">Move Record</h2>

            <div className="mb-4 text-sm text-gray-300">
              <div><b>{confirmTarget.title}</b></div>
              <div>{confirmTarget.service}</div>
              <div>{confirmTarget.folder}</div>
            </div>

            <div className="space-y-2 mb-4">

              <button
                onClick={() => moveStatus(confirmTarget.id, "WAITING")}
                className="w-full bg-blue-600 p-2 rounded"
              >
                Move to Waiting Room
              </button>

              <button
                onClick={() => moveStatus(confirmTarget.id, "QUARANTINE")}
                className="w-full bg-yellow-600 p-2 rounded"
              >
                Quarantine
              </button>

              <button
                onClick={() => hardDelete(confirmTarget.id)}
                className="w-full bg-red-700 p-2 rounded"
              >
                Permanently Delete
              </button>
            </div>

            <button
              onClick={() => setConfirmTarget(null)}
              className="text-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
