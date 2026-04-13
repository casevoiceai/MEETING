import { useState } from "react";

const reportsMock = [
  {
    id: 1,
    service: "Google Drive",
    owner: "INTEGRATIONS",
    status: "SAVED",
    outcome: "PENDING",
    folder: "Vault / System Health Reports / Saved",
    time: "4:31 PM",
  },
  {
    id: 2,
    service: "Google Drive",
    owner: "INTEGRATIONS",
    status: "ARCHIVED",
    outcome: "FAILED",
    folder: "Vault / System Health Reports / Archive / Failed",
    time: "4:31 PM",
  },
  {
    id: 3,
    service: "Google Drive",
    owner: "INTEGRATIONS",
    status: "ARCHIVED",
    outcome: "FIXED",
    folder: "Vault / System Health Reports / Archive / Fixed",
    time: "4:31 PM",
  },
];

const filters = [
  "ALL",
  "ACTIVE",
  "SAVED",
  "FIXED",
  "FAILED",
  "ABANDONED",
];

export default function VaultView() {
  const [activeFilter, setActiveFilter] = useState("ACTIVE");

  const filteredReports = reportsMock.filter((r) => {
    if (activeFilter === "ALL") return true;
    if (activeFilter === "ACTIVE") return r.status !== "ARCHIVED";
    if (activeFilter === "SAVED") return r.status === "SAVED";
    if (activeFilter === "FIXED") return r.outcome === "FIXED";
    if (activeFilter === "FAILED") return r.outcome === "FAILED";
    if (activeFilter === "ABANDONED") return r.outcome === "ABANDONED";
    return true;
  });

  return (
    <div className="p-6 text-white">
      <h1 className="text-xl font-semibold mb-4">
        System Health Records
      </h1>

      {/* FILTER BAR */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`px-3 py-1 text-sm rounded border ${
              activeFilter === f
                ? "bg-blue-600 border-blue-400"
                : "border-gray-600 hover:border-gray-400"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* TABLE */}
      <div className="border border-gray-700 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-800 text-gray-300">
            <tr>
              <th className="text-left p-2">Service</th>
              <th className="text-left p-2">Owner</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Folder</th>
              <th className="text-left p-2">Time</th>
              <th className="text-left p-2">View</th>
            </tr>
          </thead>
          <tbody>
            {filteredReports.map((r) => (
              <tr
                key={r.id}
                className="border-t border-gray-700 hover:bg-gray-800"
              >
                <td className="p-2">{r.service}</td>
                <td className="p-2">
                  <span className="px-2 py-1 border border-purple-400 text-purple-300 rounded text-xs">
                    {r.owner}
                  </span>
                </td>
                <td className="p-2">
                  {r.status === "ARCHIVED" ? (
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        r.outcome === "FIXED"
                          ? "bg-green-700"
                          : r.outcome === "FAILED"
                          ? "bg-red-700"
                          : "bg-yellow-700"
                      }`}
                    >
                      {r.outcome}
                    </span>
                  ) : (
                    <span className="bg-blue-700 px-2 py-1 rounded text-xs">
                      {r.status}
                    </span>
                  )}
                </td>
                <td className="p-2 text-gray-400">{r.folder}</td>
                <td className="p-2">{r.time}</td>
                <td className="p-2">
                  <button className="border px-2 py-1 rounded text-xs hover:border-white">
                    Open
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
