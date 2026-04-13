import { useEffect, useMemo, useState } from "react";

type Report = {
  id: number;
  time: string;
  service: string;
  owner: string;
  message: string;
  fixStatus: string;
  notes: string;
};

type CustodyEntry = {
  time: string;
  action: string;
  location: string;
  details: string;
};

type HistoryReport = Report & {
  archivedAt: string;
  outcome: "Fixed" | "Abandoned" | "Failed";
  folder: string;
  recordType: "archived";
  custodyTags: string[];
  custodyTrail: CustodyEntry[];
};

type SavedReport = Report & {
  savedAt: string;
  folder: string;
  recordType: "saved";
  custodyTags: string[];
  custodyTrail: CustodyEntry[];
};

function nowLabel() {
  return new Date().toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function ownerTag(owner: string) {
  return `OWNER_${owner.toUpperCase().replace(/\s+/g, "_")}`;
}

function statusTag(status: string) {
  return `STATUS_${status.toUpperCase().replace(/\s+/g, "_")}`;
}

function notifyVaultChanged() {
  window.dispatchEvent(new CustomEvent("vault-reports-updated"));
}

function baseTrail(report: Report): CustodyEntry[] {
  return [
    {
      time: report.time || nowLabel(),
      action: "Report created",
      location: "System Reports / Active",
      details: `${report.service} issue opened and assigned to ${report.owner}`,
    },
  ];
}

function getStatusColors(status: string) {
  if (status === "Fixed") {
    return { border: "#10B981", text: "#10B981", soft: "rgba(16,185,129,0.12)" };
  }

  if (status === "In Progress") {
    return { border: "#F59E0B", text: "#F59E0B", soft: "rgba(245,158,11,0.12)" };
  }

  if (status === "Failed") {
    return { border: "#EF4444", text: "#EF4444", soft: "rgba(239,68,68,0.12)" };
  }

  return { border: "#94A3B8", text: "#CBD5E1", soft: "rgba(148,163,184,0.12)" };
}

function summarizeMessage(message: string) {
  const clean = message.replace(/\s+/g, " ").trim();
  if (clean.length <= 120) return clean;
  return `${clean.slice(0, 117)}...`;
}

export default function SystemReportsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("system_health_reports");
    if (stored) {
      try {
        const parsed: Report[] = JSON.parse(stored);

        const unique = parsed.filter(
          (r: Report, i: number, arr: Report[]) =>
            i === arr.findIndex((x) => x.message === r.message && x.time === r.time)
        );

        setReports(unique);
        localStorage.setItem("system_health_reports", JSON.stringify(unique));
      } catch {
        setReports([]);
      }
    } else {
      setReports([]);
    }
  }, [open]);

  useEffect(() => {
    if (!reports.length) {
      setSelectedId(null);
      setAdvancedOpen(false);
      return;
    }

    if (!reports.some((report) => report.id === selectedId)) {
      setSelectedId(reports[0].id);
      setAdvancedOpen(false);
    }
  }, [reports, selectedId]);

  const selectedReport = useMemo(
    () => reports.find((report) => report.id === selectedId) ?? null,
    [reports, selectedId]
  );

  const save = (next: Report[]) => {
    setReports(next);
    localStorage.setItem("system_health_reports", JSON.stringify(next));
    notifyVaultChanged();
  };

  const updateStatus = (id: number, fixStatus: string) => {
    const next = reports.map((r) => (r.id === id ? { ...r, fixStatus } : r));
    save(next);
  };

  const updateNotes = (id: number, notes: string) => {
    const next = reports.map((r) => (r.id === id ? { ...r, notes } : r));
    save(next);
  };

  const deleteReport = (id: number) => {
    const next = reports.filter((r) => r.id !== id);
    save(next);
  };

  const archiveReport = (id: number, outcome: "Fixed" | "Abandoned" | "Failed") => {
    const target = reports.find((r) => r.id === id);
    if (!target) return;

    const existingHistory = localStorage.getItem("system_health_reports_history");
    const parsedHistory: HistoryReport[] = existingHistory ? JSON.parse(existingHistory) : [];

    const folder = `Vault / System Health Reports / Archive / ${outcome}`;
    const time = nowLabel();

    const archivedReport: HistoryReport = {
      ...target,
      fixStatus: outcome,
      archivedAt: time,
      outcome,
      folder,
      recordType: "archived",
      custodyTags: [
        "SYSTEM_REPORT",
        "ARCHIVED",
        ownerTag(target.owner),
        statusTag(target.fixStatus),
        `OUTCOME_${outcome.toUpperCase()}`,
      ],
      custodyTrail: [
        ...baseTrail(target),
        {
          time,
          action: `Archived as ${outcome}`,
          location: folder,
          details: target.notes?.trim() || "No final notes entered before archive.",
        },
      ],
    };

    localStorage.setItem(
      "system_health_reports_history",
      JSON.stringify([archivedReport, ...parsedHistory])
    );

    save(reports.filter((r) => r.id !== id));
    notifyVaultChanged();
  };

  const saveToVault = (report: Report) => {
    const existing = localStorage.getItem("vault_system_health_reports");
    const parsed: SavedReport[] = existing ? JSON.parse(existing) : [];

    const time = nowLabel();
    const folder = "Vault / System Health Reports / Saved";

    const savedReport: SavedReport = {
      ...report,
      savedAt: time,
      folder,
      recordType: "saved",
      custodyTags: [
        "SYSTEM_REPORT",
        "VAULT_SAVED",
        ownerTag(report.owner),
        statusTag(report.fixStatus),
      ],
      custodyTrail: [
        ...baseTrail(report),
        {
          time,
          action: "Saved to Vault",
          location: folder,
          details: report.notes?.trim() || "Saved without notes.",
        },
      ],
    };

    const withoutDuplicate = parsed.filter(
      (item) =>
        !(
          item.message === report.message &&
          item.service === report.service &&
          item.owner === report.owner
        )
    );

    localStorage.setItem(
      "vault_system_health_reports",
      JSON.stringify([savedReport, ...withoutDuplicate])
    );

    notifyVaultChanged();
    alert("Saved to Vault / System Health Reports / Saved");
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.78)", zIndex: 3000 }}
    >
      <div
        className="w-full max-w-[1180px] max-h-[88vh] overflow-hidden rounded-2xl border"
        style={{
          backgroundColor: "#0D1B2E",
          borderColor: "#1B2A4A",
          boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
        }}
      >
        <div className="flex items-center justify-between gap-4 border-b px-6 py-5"
          style={{ borderColor: "#1B2A4A" }}>
          <div>
            <div className="text-2xl font-bold text-white">System Reports</div>
            <div className="mt-1 text-sm" style={{ color: "#8BA4C2" }}>
              Big picture on the left. Clean working detail on the right.
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-semibold"
            style={{
              backgroundColor: "#13243B",
              color: "#E2E8F0",
              border: "1px solid #1B2A4A",
            }}
          >
            Close
          </button>
        </div>

        <div className="grid h-[calc(88vh-89px)] grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
          <div className="border-r p-5 overflow-y-auto" style={{ borderColor: "#1B2A4A" }}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-white">Active reports</div>
                <div className="text-sm" style={{ color: "#8BA4C2" }}>
                  Pick one report to work. Keep the rest simple.
                </div>
              </div>
              <div
                className="rounded-full px-3 py-1 text-sm font-bold"
                style={{ background: "#13243B", color: "#C9A84C", border: "1px solid #1B2A4A" }}
              >
                {reports.length}
              </div>
            </div>

            {reports.length === 0 ? (
              <div
                className="rounded-2xl border p-6 text-base"
                style={{ background: "#111D30", borderColor: "#1B2A4A", color: "#94A3B8" }}
              >
                No active issues.
              </div>
            ) : (
              <div className="space-y-4">
                {reports.map((report) => {
                  const statusColors = getStatusColors(report.fixStatus);
                  const isSelected = report.id === selectedId;

                  return (
                    <button
                      key={report.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(report.id);
                        setAdvancedOpen(false);
                      }}
                      className="w-full rounded-2xl border p-5 text-left transition"
                      style={{
                        background: isSelected ? "#13243B" : "#111D30",
                        borderColor: isSelected ? "#3B82F6" : "#1B2A4A",
                        boxShadow: isSelected ? "0 0 0 1px rgba(59,130,246,0.15)" : "none",
                      }}
                    >
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <div className="text-lg font-bold text-white">{report.service}</div>
                        <div
                          className="rounded-full px-3 py-1 text-xs font-bold uppercase"
                          style={{
                            border: `1px solid ${statusColors.border}`,
                            color: statusColors.text,
                            background: statusColors.soft,
                          }}
                        >
                          {report.fixStatus}
                        </div>
                        <div
                          className="rounded-full px-3 py-1 text-xs font-bold uppercase"
                          style={{
                            border: "1px solid #7C3AED",
                            color: "#D8B4FE",
                            background: "rgba(124,58,237,0.12)",
                          }}
                        >
                          {report.owner}
                        </div>
                      </div>

                      <div className="mb-3 text-base leading-7 text-white">
                        {summarizeMessage(report.message)}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-sm font-medium" style={{ color: "#8BA4C2" }}>
                          {report.time}
                        </div>
                        <div className="flex gap-2">
                          <span
                            className="rounded-lg px-3 py-2 text-sm font-semibold"
                            style={{ background: "#0D1B2E", color: "#E2E8F0", border: "1px solid #1B2A4A" }}
                          >
                            Open
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="overflow-y-auto p-5">
            {!selectedReport ? (
              <div
                className="rounded-2xl border p-6 text-base"
                style={{ background: "#111D30", borderColor: "#1B2A4A", color: "#94A3B8" }}
              >
                Pick a report from the left.
              </div>
            ) : (
              <div
                className="rounded-2xl border p-5"
                style={{ background: "#111D30", borderColor: "#1B2A4A" }}
              >
                <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="mb-2 text-2xl font-bold text-white">{selectedReport.service}</div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div
                        className="rounded-full px-3 py-1 text-xs font-bold uppercase"
                        style={{
                          border: `1px solid ${getStatusColors(selectedReport.fixStatus).border}`,
                          color: getStatusColors(selectedReport.fixStatus).text,
                          background: getStatusColors(selectedReport.fixStatus).soft,
                        }}
                      >
                        {selectedReport.fixStatus}
                      </div>
                      <div
                        className="rounded-full px-3 py-1 text-xs font-bold uppercase"
                        style={{
                          border: "1px solid #7C3AED",
                          color: "#D8B4FE",
                          background: "rgba(124,58,237,0.12)",
                        }}
                      >
                        {selectedReport.owner}
                      </div>
                      <div className="text-sm font-medium" style={{ color: "#8BA4C2" }}>
                        {selectedReport.time}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => deleteReport(selectedReport.id)}
                    className="rounded-xl px-4 py-2 text-sm font-semibold"
                    style={{
                      background: "rgba(239,68,68,0.12)",
                      border: "1px solid #EF4444",
                      color: "#FCA5A5",
                    }}
                  >
                    Delete
                  </button>
                </div>

                <div className="mb-5 rounded-2xl border p-4" style={{ background: "#0D1B2E", borderColor: "#1B2A4A" }}>
                  <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: "#8BA4C2" }}>
                    Summary
                  </div>
                  <div className="text-lg leading-8 text-white whitespace-pre-wrap">
                    {selectedReport.message}
                  </div>
                </div>

                <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {(["Pending", "In Progress", "Fixed"] as const).map((status) => {
                    const isActive = selectedReport.fixStatus === status;
                    const colors = getStatusColors(status);
                    return (
                      <button
                        key={status}
                        onClick={() => updateStatus(selectedReport.id, status)}
                        className="rounded-xl px-4 py-3 text-sm font-bold"
                        style={{
                          border: `1px solid ${colors.border}`,
                          color: colors.text,
                          background: isActive ? colors.soft : "#0D1B2E",
                        }}
                      >
                        {status}
                      </button>
                    );
                  })}
                </div>

                <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <button
                    onClick={() => saveToVault(selectedReport)}
                    className="rounded-xl px-4 py-3 text-sm font-bold"
                    style={{ border: "1px solid #3B82F6", color: "#60A5FA", background: "#0D1B2E" }}
                  >
                    Save to Vault
                  </button>
                  <button
                    onClick={() => archiveReport(selectedReport.id, "Fixed")}
                    className="rounded-xl px-4 py-3 text-sm font-bold"
                    style={{ border: "1px solid #10B981", color: "#10B981", background: "#0D1B2E" }}
                  >
                    Archive Fixed
                  </button>
                  <button
                    onClick={() => archiveReport(selectedReport.id, "Abandoned")}
                    className="rounded-xl px-4 py-3 text-sm font-bold"
                    style={{ border: "1px solid #F59E0B", color: "#F59E0B", background: "#0D1B2E" }}
                  >
                    Archive Abandoned
                  </button>
                  <button
                    onClick={() => archiveReport(selectedReport.id, "Failed")}
                    className="rounded-xl px-4 py-3 text-sm font-bold"
                    style={{ border: "1px solid #EF4444", color: "#F87171", background: "#0D1B2E" }}
                  >
                    Archive Failed
                  </button>
                </div>

                <div className="mb-5 rounded-2xl border p-4" style={{ background: "#0D1B2E", borderColor: "#1B2A4A" }}>
                  <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: "#8BA4C2" }}>
                    Notes
                  </div>
                  <textarea
                    value={selectedReport.notes}
                    onChange={(e) => updateNotes(selectedReport.id, e.target.value)}
                    placeholder="Add what was changed, what happened, and whether it worked."
                    className="w-full min-h-[180px] rounded-xl p-4 text-base leading-7"
                    style={{
                      backgroundColor: "#08121F",
                      border: "1px solid #1B2A4A",
                      color: "#FFFFFF",
                      resize: "vertical",
                    }}
                  />
                </div>

                <div className="rounded-2xl border" style={{ background: "#0D1B2E", borderColor: "#1B2A4A" }}>
                  <button
                    onClick={() => setAdvancedOpen((value) => !value)}
                    className="flex w-full items-center justify-between px-4 py-4 text-left"
                    style={{ color: "#E2E8F0" }}
                  >
                    <div>
                      <div className="text-base font-bold">Advanced</div>
                      <div className="text-sm" style={{ color: "#8BA4C2" }}>
                        Tags, chain of custody, and archive detail.
                      </div>
                    </div>
                    <div className="text-xl font-bold" style={{ color: "#C9A84C" }}>
                      {advancedOpen ? "−" : "+"}
                    </div>
                  </button>

                  {advancedOpen && (
                    <div className="border-t px-4 pb-4 pt-4" style={{ borderColor: "#1B2A4A" }}>
                      <div className="mb-4">
                        <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: "#8BA4C2" }}>
                          Tags
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {["SYSTEM_REPORT", ownerTag(selectedReport.owner), statusTag(selectedReport.fixStatus)].map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full px-3 py-1 text-xs font-bold"
                              style={{ background: "#13243B", color: "#C9A84C", border: "1px solid #1B2A4A" }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: "#8BA4C2" }}>
                          Chain of custody
                        </div>
                        <div className="space-y-3">
                          {baseTrail(selectedReport).map((entry, index) => (
                            <div
                              key={`${entry.time}-${entry.action}-${index}`}
                              className="rounded-xl border p-3"
                              style={{ background: "#08121F", borderColor: "#1B2A4A" }}
                            >
                              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                                <div className="text-sm font-bold text-white">{entry.action}</div>
                                <div className="text-xs font-semibold" style={{ color: "#8BA4C2" }}>
                                  {entry.time}
                                </div>
                              </div>
                              <div className="text-sm font-semibold" style={{ color: "#C9A84C" }}>
                                {entry.location}
                              </div>
                              <div className="mt-1 text-sm leading-6" style={{ color: "#CBD5E1" }}>
                                {entry.details}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
