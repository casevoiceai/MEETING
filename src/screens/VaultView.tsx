import { useEffect, useState } from "react";

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

export default function VaultView(_props: VaultViewProps) {
  const [{ savedReports, archivedReports }, setData] = useState(readAll());

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

  const deleteSavedReport = (id: number) => {
    const next = savedReports.filter((r) => r.id !== id);
    localStorage.setItem("vault_system_health_reports", JSON.stringify(next));
    setData((prev) => ({ ...prev, savedReports: next }));
  };

  const deleteArchivedReport = (id: number) => {
    const next = archivedReports.filter((r) => r.id !== id);
    localStorage.setItem("system_health_reports_history", JSON.stringify(next));
    setData((prev) => ({ ...prev, archivedReports: next }));
  };

  return (
    <div
      className="flex-1 min-h-0 overflow-auto"
      style={{ backgroundColor: "#0D1B2E", color: "#FFFFFF" }}
    >
      <div className="p-6 max-w-6xl mx-auto">
        <div className="mb-8">
          <div
            className="text-xs font-bold uppercase tracking-widest mb-2"
            style={{ color: "#8A9BB5" }}
          >
            Vault
          </div>
          <h1 className="text-2xl font-bold">System Health Records</h1>
          <p className="text-sm mt-2" style={{ color: "#8A9BB5" }}>
            Chain-of-custody view for saved reports and archived outcomes.
          </p>
        </div>

        <div className="mb-10">
          <div className="text-lg font-bold mb-4">Saved Reports</div>

          {savedReports.length === 0 ? (
            <div
              className="rounded-xl p-6 border"
              style={{
                backgroundColor: "#111D30",
                borderColor: "#1B2A4A",
                color: "#8A9BB5",
              }}
            >
              No saved reports yet.
            </div>
          ) : (
            <div className="space-y-5">
              {savedReports.map((report) => (
                <div
                  key={`saved-${report.id}`}
                  className="rounded-xl p-5 border relative"
                  style={{
                    backgroundColor: "#111D30",
                    borderColor: "#1B2A4A",
                  }}
                >
                  <button
                    onClick={() => deleteSavedReport(report.id)}
                    style={{
                      position: "absolute",
                      top: "12px",
                      right: "14px",
                      color: "#EF4444",
                      fontSize: "18px",
                      fontWeight: "bold",
                      background: "transparent",
                      lineHeight: 1,
                    }}
                  >
                    ✕
                  </button>

                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <div className="text-base font-bold">{report.service}</div>

                    <div
                      className="px-2 py-1 rounded text-[10px] font-bold uppercase"
                      style={{
                        border: "1px solid #C084FC",
                        color: "#C084FC",
                      }}
                    >
                      {report.owner}
                    </div>

                    <div
                      className="px-2 py-1 rounded text-[10px] font-bold uppercase"
                      style={{
                        border: "1px solid #3B82F6",
                        color: "#3B82F6",
                      }}
                    >
                      Saved to Vault
                    </div>

                    <div className="text-xs" style={{ color: "#8A9BB5" }}>
                      {report.savedAt}
                    </div>
                  </div>

                  <div className="text-xs mb-2" style={{ color: "#8A9BB5" }}>
                    Folder: {report.folder}
                  </div>

                  <div className="text-sm mb-3 whitespace-pre-wrap">{report.message}</div>

                  <div className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: "#8A9BB5" }}>
                    Readable Tags
                  </div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {report.custodyTags?.map((tag, index) => (
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
                    {report.custodyTrail?.map((entry, index) => (
                      <div key={index} className="mb-2 last:mb-0">
                        <span style={{ color: "#C9A84C" }}>[{entry.time}]</span>{" "}
                        <span style={{ color: "#FFFFFF" }}>{entry.action}</span>{" "}
                        <span style={{ color: "#8A9BB5" }}>→ {entry.location}</span>
                        <div style={{ color: "#8A9BB5" }}>{entry.details}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: "#8A9BB5" }}>
                    Saved Notes
                  </div>

                  <div
                    className="w-full min-h-[110px] p-3 rounded-lg text-sm whitespace-pre-wrap"
                    style={{
                      backgroundColor: "#0D1B2E",
                      border: "1px solid #1B2A4A",
                      color: "#FFFFFF",
                    }}
                  >
                    {report.notes || "No notes saved."}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="text-lg font-bold mb-4">Archived Reports</div>

          {archivedReports.length === 0 ? (
            <div
              className="rounded-xl p-6 border"
              style={{
                backgroundColor: "#111D30",
                borderColor: "#1B2A4A",
                color: "#8A9BB5",
              }}
            >
              No archived reports yet.
            </div>
          ) : (
            <div className="space-y-5">
              {archivedReports.map((report) => (
                <div
                  key={`archived-${report.id}-${report.archivedAt}`}
                  className="rounded-xl p-5 border relative"
                  style={{
                    backgroundColor: "#111D30",
                    borderColor: "#1B2A4A",
                  }}
                >
                  <button
                    onClick={() => deleteArchivedReport(report.id)}
                    style={{
                      position: "absolute",
                      top: "12px",
                      right: "14px",
                      color: "#EF4444",
                      fontSize: "18px",
                      fontWeight: "bold",
                      background: "transparent",
                      lineHeight: 1,
                    }}
                  >
                    ✕
                  </button>

                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <div className="text-base font-bold">{report.service}</div>

                    <div
                      className="px-2 py-1 rounded text-[10px] font-bold uppercase"
                      style={{
                        border: "1px solid #C084FC",
                        color: "#C084FC",
                      }}
                    >
                      {report.owner}
                    </div>

                    <div
                      className="px-2 py-1 rounded text-[10px] font-bold uppercase"
                      style={{
                        border:
                          report.outcome === "Fixed"
                            ? "1px solid #10B981"
                            : report.outcome === "Abandoned"
                              ? "1px solid #F59E0B"
                              : "1px solid #EF4444",
                        color:
                          report.outcome === "Fixed"
                            ? "#10B981"
                            : report.outcome === "Abandoned"
                              ? "#F59E0B"
                              : "#EF4444",
                      }}
                    >
                      Archived as {report.outcome}
                    </div>

                    <div className="text-xs" style={{ color: "#8A9BB5" }}>
                      {report.archivedAt}
                    </div>
                  </div>

                  <div className="text-xs mb-2" style={{ color: "#8A9BB5" }}>
                    Folder: {report.folder}
                  </div>

                  <div className="text-sm mb-3 whitespace-pre-wrap">{report.message}</div>

                  <div className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: "#8A9BB5" }}>
                    Readable Tags
                  </div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {report.custodyTags?.map((tag, index) => (
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
                    {report.custodyTrail?.map((entry, index) => (
                      <div key={index} className="mb-2 last:mb-0">
                        <span style={{ color: "#C9A84C" }}>[{entry.time}]</span>{" "}
                        <span style={{ color: "#FFFFFF" }}>{entry.action}</span>{" "}
                        <span style={{ color: "#8A9BB5" }}>→ {entry.location}</span>
                        <div style={{ color: "#8A9BB5" }}>{entry.details}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: "#8A9BB5" }}>
                    Final Notes
                  </div>

                  <div
                    className="w-full min-h-[110px] p-3 rounded-lg text-sm whitespace-pre-wrap"
                    style={{
                      backgroundColor: "#0D1B2E",
                      border: "1px solid #1B2A4A",
                      color: "#FFFFFF",
                    }}
                  >
                    {report.notes || "No final notes saved."}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
