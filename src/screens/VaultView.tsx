import { useEffect, useMemo, useState } from "react";

type CustodyEntry = {
  time: string;
  action: string;
  location: string;
  details: string;
};

type SavedReport = {
  id: number;
  time: string;
  service: string;
  owner: string;
  message: string;
  fixStatus: string;
  notes: string;
  savedAt: string;
  folder: string;
  recordType: "saved";
  custodyTags: string[];
  custodyTrail: CustodyEntry[];
};

type HistoryReport = {
  id: number;
  time: string;
  service: string;
  owner: string;
  message: string;
  fixStatus: string;
  notes: string;
  archivedAt: string;
  outcome: "Fixed" | "Abandoned" | "Failed";
  folder: string;
  recordType: "archived";
  custodyTags: string[];
  custodyTrail: CustodyEntry[];
};

type VaultViewProps = {
  onNavigateLinked?: (type: any, id: string) => void;
  linkedTarget?: any;
};

type UnifiedRow = {
  key: string;
  kind: "saved" | "archived";
  id: number;
  service: string;
  owner: string;
  status: string;
  folder: string;
  timeLabel: string;
  message: string;
  notes: string;
  tags: string[];
  custodyTrail: CustodyEntry[];
};

function readAll() {
  let savedReports: SavedReport[] = [];
  let archivedReports: HistoryReport[] = [];

  const storedSaved = localStorage.getItem("vault_system_health_reports");
  if (storedSaved) {
    try {
      savedReports = JSON.parse(storedSaved);
    } catch {
      savedReports = [];
    }
  }

  const storedArchived = localStorage.getItem("system_health_reports_history");
  if (storedArchived) {
    try {
      archivedReports = JSON.parse(storedArchived);
    } catch {
      archivedReports = [];
    }
  }

  return { savedReports, archivedReports };
}

function getStatusStyle(status: string) {
  const value = status.toLowerCase();

  if (value.includes("fixed")) {
    return { border: "#10B981", text: "#10B981" };
  }
  if (value.includes("abandoned")) {
    return { border: "#F59E0B", text: "#F59E0B" };
  }
  if (value.includes("failed")) {
    return { border: "#EF4444", text: "#EF4444" };
  }
  if (value.includes("saved")) {
    return { border: "#3B82F6", text: "#3B82F6" };
  }

  return { border: "#94A3B8", text: "#94A3B8" };
}

export default function VaultView(_props: VaultViewProps) {
  const [{ savedReports, archivedReports }, setData] = useState(readAll());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => setData(readAll());

    refresh();
    window.addEventListener("vault-reports-updated", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);

    return () => {
      window.removeEventListener("vault-reports-updated", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const rows = useMemo<UnifiedRow[]>(() => {
    const saved: UnifiedRow[] = savedReports.map((report) => ({
      key: `saved-${report.id}-${report.savedAt}`,
      kind: "saved",
      id: report.id,
      service: report.service,
      owner: report.owner,
      status: "Saved to Vault",
      folder: report.folder,
      timeLabel: report.savedAt,
      message: report.message,
      notes: report.notes || "",
      tags: report.custodyTags || [],
      custodyTrail: report.custodyTrail || [],
    }));

    const archived: UnifiedRow[] = archivedReports.map((report) => ({
      key: `archived-${report.id}-${report.archivedAt}`,
      kind: "archived",
      id: report.id,
      service: report.service,
      owner: report.owner,
      status: `Archived as ${report.outcome}`,
      folder: report.folder,
      timeLabel: report.archivedAt,
      message: report.message,
      notes: report.notes || "",
      tags: report.custodyTags || [],
      custodyTrail: report.custodyTrail || [],
    }));

    return [...saved, ...archived].sort((a, b) =>
      b.timeLabel.localeCompare(a.timeLabel)
    );
  }, [savedReports, archivedReports]);

  const selectedRow = rows.find((row) => row.key === selectedKey) || null;

  const deleteSelected = () => {
    if (!selectedRow) return;

    if (selectedRow.kind === "saved") {
      const next = savedReports.filter((r) => r.id !== selectedRow.id);
      localStorage.setItem("vault_system_health_reports", JSON.stringify(next));
      setData((prev) => ({ ...prev, savedReports: next }));
    } else {
      const next = archivedReports.filter((r) => r.id !== selectedRow.id);
      localStorage.setItem("system_health_reports_history", JSON.stringify(next));
      setData((prev) => ({ ...prev, archivedReports: next }));
    }

    setSelectedKey(null);
    window.dispatchEvent(new CustomEvent("vault-reports-updated"));
  };

  return (
    <div
      className="flex-1 min-h-0 overflow-auto"
      style={{ backgroundColor: "#0D1B2E", color: "#FFFFFF" }}
    >
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <div
            className="text-xs font-bold uppercase tracking-widest mb-2"
            style={{ color: "#8A9BB5" }}
          >
            Vault
          </div>
          <h1 className="text-2xl font-bold">System Health Records</h1>
          <p className="text-sm mt-2" style={{ color: "#8A9BB5" }}>
            Compact table view for saved reports and archived outcomes.
          </p>
        </div>

        {rows.length === 0 ? (
          <div
            className="rounded-xl p-6 border"
            style={{
              backgroundColor: "#111D30",
              borderColor: "#1B2A4A",
              color: "#8A9BB5",
            }}
          >
            No saved or archived reports yet.
          </div>
        ) : (
          <>
            <div
              className="rounded-xl border overflow-hidden"
              style={{
                backgroundColor: "#111D30",
                borderColor: "#1B2A4A",
              }}
            >
              <div
                className="grid text-xs font-bold uppercase tracking-widest"
                style={{
                  gridTemplateColumns: "160px 120px 170px 1fr 100px 80px",
                  backgroundColor: "#0F2238",
                  color: "#8A9BB5",
                  borderBottom: "1px solid #1B2A4A",
                }}
              >
                <div className="p-3">Service</div>
                <div className="p-3">Owner</div>
                <div className="p-3">Status</div>
                <div className="p-3">Folder</div>
                <div className="p-3">Time</div>
                <div className="p-3">View</div>
              </div>

              {rows.map((row, index) => {
                const style = getStatusStyle(row.status);
                const isSelected = selectedKey === row.key;

                return (
                  <div
                    key={row.key}
                    className="grid items-center text-sm"
                    style={{
                      gridTemplateColumns: "160px 120px 170px 1fr 100px 80px",
                      borderBottom:
                        index === rows.length - 1 ? "none" : "1px solid #1B2A4A",
                      backgroundColor: isSelected ? "#102742" : "#111D30",
                    }}
                  >
                    <div className="p-3 font-bold text-white truncate">
                      {row.service}
                    </div>

                    <div className="p-3">
                      <span
                        className="px-2 py-1 rounded text-[10px] font-bold uppercase"
                        style={{
                          border: "1px solid #C084FC",
                          color: "#C084FC",
                        }}
                      >
                        {row.owner}
                      </span>
                    </div>

                    <div className="p-3">
                      <span
                        className="px-2 py-1 rounded text-[10px] font-bold uppercase"
                        style={{
                          border: `1px solid ${style.border}`,
                          color: style.text,
                        }}
                      >
                        {row.status}
                      </span>
                    </div>

                    <div className="p-3 truncate" style={{ color: "#8A9BB5" }}>
                      {row.folder}
                    </div>

                    <div className="p-3" style={{ color: "#8A9BB5" }}>
                      {row.timeLabel}
                    </div>

                    <div className="p-3">
                      <button
                        onClick={() => setSelectedKey(isSelected ? null : row.key)}
                        className="px-2 py-1 text-xs rounded"
                        style={{
                          border: "1px solid #C9A84C",
                          color: "#C9A84C",
                          backgroundColor: "#0D1B2E",
                        }}
                      >
                        {isSelected ? "Hide" : "Open"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedRow && (
              <div
                className="mt-6 rounded-xl p-5 border"
                style={{
                  backgroundColor: "#111D30",
                  borderColor: "#1B2A4A",
                }}
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="text-lg font-bold text-white">
                      {selectedRow.service}
                    </div>
                    <div className="text-sm mt-1" style={{ color: "#8A9BB5" }}>
                      {selectedRow.folder}
                    </div>
                  </div>

                  <button
                    onClick={deleteSelected}
                    className="px-3 py-1.5 text-xs rounded"
                    style={{
                      border: "1px solid #EF4444",
                      color: "#EF4444",
                      backgroundColor: "#0D1B2E",
                    }}
                  >
                    Delete
                  </button>
                </div>

                <div className="mb-4 text-sm whitespace-pre-wrap text-white">
                  {selectedRow.message}
                </div>

                <div className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: "#8A9BB5" }}>
                  Readable Tags
                </div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {selectedRow.tags.map((tag, index) => (
                    <div
                      key={`${tag}-${index}`}
                      className="px-2 py-1 rounded text-[10px] font-bold uppercase"
                      style={{
                        border: "1px solid #1B2A4A",
                        color: "#C9A84C",
                      }}
                    >
                      {tag}
                    </div>
                  ))}
                </div>

                <div className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: "#8A9BB5" }}>
                  Chain of Custody
                </div>
                <div
                  className="w-full p-3 rounded-lg text-sm mb-4"
                  style={{
                    backgroundColor: "#0D1B2E",
                    border: "1px solid #1B2A4A",
                  }}
                >
                  {selectedRow.custodyTrail.map((entry, index) => (
                    <div key={index} className="mb-2 last:mb-0">
                      <span style={{ color: "#C9A84C" }}>[{entry.time}]</span>{" "}
                      <span style={{ color: "#FFFFFF" }}>{entry.action}</span>{" "}
                      <span style={{ color: "#8A9BB5" }}>→ {entry.location}</span>
                      <div style={{ color: "#8A9BB5" }}>{entry.details}</div>
                    </div>
                  ))}
                </div>

                <div className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: "#8A9BB5" }}>
                  Notes
                </div>
                <div
                  className="w-full min-h-[110px] p-3 rounded-lg text-sm whitespace-pre-wrap"
                  style={{
                    backgroundColor: "#0D1B2E",
                    border: "1px solid #1B2A4A",
                    color: "#FFFFFF",
                  }}
                >
                  {selectedRow.notes || "No notes saved."}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
