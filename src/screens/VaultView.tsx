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

type LinkedTarget =
  | {
      type: string;
      id: string;
    }
  | undefined;

type VaultViewProps = {
  onNavigateLinked?: (target: { type: string; id: string }) => void;
  linkedTarget?: LinkedTarget;
};

type TimelineEntry = {
  id: string;
  time: string;
  label: string;
  detail?: string;
};

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
  timeline: TimelineEntry[];
  createdAt?: string;
  updatedAt?: string;
};

type FilterKey = "ACTIVE" | "ALL" | "SAVED" | "FIXED" | "FAILED" | "ABANDONED";

const STORAGE_KEYS = [
  "systemReports",
  "system_reports",
  "systemHealthReports",
  "system_health_reports",
  "vaultSystemHealthRecords",
  "vault_system_health_records",
  "meetingRoomSystemReports",
  "meeting_room_system_reports",
];

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "ACTIVE", label: "Active" },
  { key: "ALL", label: "All" },
  { key: "SAVED", label: "Saved" },
  { key: "FIXED", label: "Fixed" },
  { key: "FAILED", label: "Failed" },
  { key: "ABANDONED", label: "Abandoned" },
];

const STATUS_STYLES: Record<
  string,
  { label: string; text: string; border: string; bg: string }
> = {
  ACTIVE: {
    label: "Active",
    text: "#F59E0B",
    border: "rgba(245,158,11,0.35)",
    bg: "rgba(245,158,11,0.08)",
  },
  SAVED: {
    label: "Saved to Vault",
    text: "#60A5FA",
    border: "rgba(96,165,250,0.35)",
    bg: "rgba(96,165,250,0.08)",
  },
  FIXED: {
    label: "Archived as Fixed",
    text: "#10B981",
    border: "rgba(16,185,129,0.35)",
    bg: "rgba(16,185,129,0.08)",
  },
  FAILED: {
    label: "Archived as Failed",
    text: "#EF4444",
    border: "rgba(239,68,68,0.35)",
    bg: "rgba(239,68,68,0.08)",
  },
  ABANDONED: {
    label: "Archived as Abandoned",
    text: "#F59E0B",
    border: "rgba(245,158,11,0.35)",
    bg: "rgba(245,158,11,0.08)",
  },
};

function safeJsonParse(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeStatus(input: unknown): string {
  const raw = String(input ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  if (
    raw.includes("ACTIVE") ||
    raw.includes("PENDING") ||
    raw.includes("IN_PROGRESS")
  ) {
    return "ACTIVE";
  }
  if (raw.includes("SAVED")) return "SAVED";
  if (raw.includes("FIXED")) return "FIXED";
  if (raw.includes("FAILED")) return "FAILED";
  if (raw.includes("ABANDONED")) return "ABANDONED";
  return "ACTIVE";
}

function toTimeLabel(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  return text;
}

function normalizeTimeline(input: unknown): TimelineEntry[] {
  if (!Array.isArray(input)) return [];

  return input.map((entry: any, index) => ({
    id: String(entry?.id ?? `timeline-${index}`),
    time: toTimeLabel(entry?.time ?? entry?.timestamp ?? entry?.createdAt),
    label: String(entry?.label ?? entry?.title ?? entry?.action ?? "Update"),
    detail: entry?.detail ? String(entry.detail) : entry?.description ? String(entry.description) : undefined,
  }));
}

function dedupeStrings(values: unknown[]): string[] {
  return Array.from(
    new Set(
      values
        .flatMap((value) => {
          if (Array.isArray(value)) return value;
          if (typeof value === "string") return value.split(",");
          return [];
        })
        .map((value) => String(value).trim())
        .filter(Boolean),
    ),
  );
}

function normalizeReport(item: any, index: number): ReportRecord {
  const service = String(
    item?.service ??
      item?.name ??
      item?.title ??
      item?.source ??
      "Unknown Service",
  ).trim();

  const status = normalizeStatus(
    item?.status ??
      item?.outcome ??
      item?.lifecycleState ??
      item?.current_state,
  );

  const owner = String(
    item?.owner ??
      item?.team ??
      item?.assignee ??
      item?.assignedTo ??
      "Unassigned",
  ).trim();

  const description = String(
    item?.description ??
      item?.summary ??
      item?.issue ??
      item?.message ??
      "No summary provided.",
  ).trim();

  const title = String(item?.title ?? service).trim();

  const notes = String(
    item?.notes ??
      item?.fixNotes ??
      item?.whatWasDone ??
      item?.resolution ??
      "",
  ).trim();

  const createdAt =
    item?.createdAt ??
    item?.created_at ??
    item?.timestamp ??
    item?.time ??
    null;

  const updatedAt =
    item?.updatedAt ??
    item?.updated_at ??
    item?.lastUpdated ??
    item?.archivedAt ??
    createdAt;

  const timeline = normalizeTimeline(
    item?.timeline ?? item?.history ?? item?.chainOfCustody ?? item?.log,
  );

  return {
    id: String(item?.id ?? item?.reportId ?? `${service}-${index}-${status}`),
    service,
    owner,
    status,
    folder: String(
      item?.folder ??
        item?.path ??
        item?.vaultPath ??
        buildFolderPath(status),
    ).trim(),
    time: toTimeLabel(updatedAt ?? createdAt),
    title,
    description,
    notes,
    tags: dedupeStrings([
      item?.tags,
      item?.labels,
      statusTag(status),
      owner !== "Unassigned" ? `owner_${owner.toLowerCase().replace(/\s+/g, "_")}` : null,
      "system_report",
    ]),
    timeline,
    createdAt: createdAt ? String(createdAt) : undefined,
    updatedAt: updatedAt ? String(updatedAt) : undefined,
  };
}

function buildFolderPath(status: string) {
  if (status === "SAVED") return "Vault / System Health Reports / Saved";
  if (status === "FIXED") return "Vault / System Health Reports / Archive / Fixed";
  if (status === "FAILED") return "Vault / System Health Reports / Archive / Failed";
  if (status === "ABANDONED") return "Vault / System Health Reports / Archive / Abandoned";
  return "Vault / System Health Reports / Active";
}

function statusTag(status: string) {
  if (status === "SAVED") return "status_saved";
  if (status === "FIXED") return "outcome_fixed";
  if (status === "FAILED") return "outcome_failed";
  if (status === "ABANDONED") return "outcome_abandoned";
  return "status_active";
}

function readStoredReports(): ReportRecord[] {
  const collected: ReportRecord[] = [];

  for (const key of STORAGE_KEYS) {
    const parsed = safeJsonParse(localStorage.getItem(key));
    if (!Array.isArray(parsed)) continue;

    parsed.forEach((item, index) => {
      try {
        collected.push(normalizeReport(item, index));
      } catch {
        //
      }
    });
  }

  if (collected.length === 0) {
    return [
      {
        id: "seed-google-drive-active",
        service: "Google Drive",
        owner: "Integrations",
        status: "ACTIVE",
        folder: "Vault / System Health Reports / Active",
        time: "4:35 PM",
        title: "Google Drive",
        description: "Fix Google Drive integration. Diagnose auth, route, env variables.",
        notes: "",
        tags: ["system_report", "integrations", "status_active", "owner_integrations"],
        timeline: [
          {
            id: "seed-created",
            time: "4:35 PM",
            label: "Report created",
            detail: "Google Drive issue opened and assigned to Integrations.",
          },
        ],
      },
      {
        id: "seed-google-drive-saved",
        service: "Google Drive",
        owner: "Integrations",
        status: "SAVED",
        folder: "Vault / System Health Reports / Saved",
        time: "4:31 PM",
        title: "Google Drive",
        description: "Fix Google Drive integration. Diagnose auth, route, env variables.",
        notes: "Saved for traceability after validation work started.",
        tags: ["system_report", "integrations", "status_saved", "owner_integrations"],
        timeline: [
          {
            id: "seed-saved-created",
            time: "4:23 PM",
            label: "Report created",
            detail: "Google Drive issue opened and assigned to Integrations.",
          },
          {
            id: "seed-saved",
            time: "4:31 PM",
            label: "Saved to Vault",
            detail: "Preserved as a formal system record before archive decision.",
          },
        ],
      },
      {
        id: "seed-google-drive-fixed",
        service: "Google Drive",
        owner: "Integrations",
        status: "FIXED",
        folder: "Vault / System Health Reports / Archive / Fixed",
        time: "4:23 PM",
        title: "Google Drive",
        description: "Fix Google Drive integration. Diagnose auth, route, env variables.",
        notes: "No final notes entered before archive.",
        tags: ["system_report", "archived", "owner_integrations", "outcome_fixed"],
        timeline: [
          {
            id: "seed-fixed-created",
            time: "4:23 PM",
            label: "Report created",
            detail: "Google Drive issue opened and assigned to Integrations.",
          },
          {
            id: "seed-fixed-archived",
            time: "4:23 PM",
            label: "Archived as Fixed",
            detail: "Vault / System Health Reports / Archive / Fixed",
          },
        ],
      },
    ];
  }

  const deduped = new Map<string, ReportRecord>();
  collected.forEach((report) => {
    deduped.set(report.id, report);
  });

  return Array.from(deduped.values()).sort((a, b) => {
    const timeA = new Date(a.updatedAt ?? a.createdAt ?? "").getTime();
    const timeB = new Date(b.updatedAt ?? b.createdAt ?? "").getTime();
    if (Number.isNaN(timeA) || Number.isNaN(timeB)) return 0;
    return timeB - timeA;
  });
}

function writeStoredReports(reports: ReportRecord[]) {
  const payload = reports.map((report) => ({
    id: report.id,
    service: report.service,
    owner: report.owner,
    status: report.status,
    folder: report.folder,
    time: report.time,
    title: report.title,
    description: report.description,
    notes: report.notes,
    tags: report.tags,
    timeline: report.timeline,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
  }));

  localStorage.setItem("systemHealthReports", JSON.stringify(payload));
  window.dispatchEvent(new Event("system-health-reports-updated"));
}

function getStatusStyle(status: string) {
  return STATUS_STYLES[status] ?? STATUS_STYLES.ACTIVE;
}

function getFilterMatch(report: ReportRecord, filter: FilterKey) {
  if (filter === "ALL") return true;
  return report.status === filter;
}

function getUrgencyMeta(report: ReportRecord) {
  if (report.status === "ACTIVE") {
    return {
      title: "Action required now",
      textColor: "#FCA5A5",
      border: "rgba(239,68,68,0.32)",
      bg: "rgba(127,29,29,0.20)",
      icon: <ShieldAlert size={16} />,
    };
  }

  if (report.status === "SAVED") {
    return {
      title: "Work ready for review",
      textColor: "#93C5FD",
      border: "rgba(59,130,246,0.32)",
      bg: "rgba(30,64,175,0.16)",
      icon: <Clock3 size={16} />,
    };
  }

  if (report.status === "FIXED") {
    return {
      title: "No action required",
      textColor: "#6EE7B7",
      border: "rgba(16,185,129,0.32)",
      bg: "rgba(6,95,70,0.18)",
      icon: <CheckCircle2 size={16} />,
    };
  }

  if (report.status === "FAILED") {
    return {
      title: "Escalation required",
      textColor: "#FCA5A5",
      border: "rgba(239,68,68,0.32)",
      bg: "rgba(127,29,29,0.20)",
      icon: <XCircle size={16} />,
    };
  }

  return {
    title: "Closed with no active work",
    textColor: "#FCD34D",
    border: "rgba(245,158,11,0.32)",
    bg: "rgba(120,53,15,0.18)",
    icon: <Archive size={16} />,
  };
}

function deriveNextAction(report: ReportRecord) {
  const lower = `${report.service} ${report.title} ${report.description} ${report.notes} ${report.tags.join(" ")}`.toLowerCase();

  if (report.status === "ACTIVE") {
    if (lower.includes("google drive")) {
      return {
        primary: "Reconnect Google Drive",
        reason: "The issue is still active. Move from diagnosis to repair now.",
        secondary: [
          "Verify Google auth callback route",
          "Confirm Vercel environment variables",
          "Run connection test after auth reset",
        ],
      };
    }

    if (lower.includes("database")) {
      return {
        primary: "Restore database connectivity",
        reason: "This report is blocking core system function and needs direct remediation.",
        secondary: [
          "Check database URL and credentials",
          "Validate current deployment environment",
          "Retry health check after reconnect",
        ],
      };
    }

    return {
      primary: "Assign and resolve active issue",
      reason: "The report is still open. Someone needs to own the next operational move.",
      secondary: [
        "Confirm owner",
        "Document troubleshooting step",
        "Retest before archiving",
      ],
    };
  }

  if (report.status === "SAVED") {
    return {
      primary: "Review saved record and decide final outcome",
      reason: "The issue has been preserved, but the workflow still needs a final decision.",
      secondary: [
        "Archive as Fixed if resolved",
        "Archive as Failed if blocked",
        "Add final notes before closeout",
      ],
    };
  }

  if (report.status === "FAILED") {
    return {
      primary: "Escalate and reopen investigation",
      reason: "The prior attempt failed. The next move is not more drift. It is escalation.",
      secondary: [
        "Review failed steps",
        "Assign senior owner",
        "Create follow-up active report if work resumes",
      ],
    };
  }

  if (report.status === "ABANDONED") {
    return {
      primary: "Confirm abandonment is intentional",
      reason: "Abandoned work should be a conscious decision, not a silent dead end.",
      secondary: [
        "Record why work stopped",
        "Link replacement path if one exists",
      ],
    };
  }

  return {
    primary: "No action required",
    reason: "This report is already archived as fixed and remains available for traceability.",
    secondary: [
      "Keep for audit history",
      "Reopen only if the issue returns",
    ],
  };
}

export default function VaultView({ linkedTarget }: VaultViewProps) {
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [filter, setFilter] = useState<FilterKey>("ACTIVE");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      const next = readStoredReports();
      setReports(next);

      setSelectedId((current) => {
        if (current && next.some((report) => report.id === current)) return current;
        return next[0]?.id ?? null;
      });
    };

    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("system-health-reports-updated", sync);

    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("system-health-reports-updated", sync);
    };
  }, []);

  useEffect(() => {
    if (!linkedTarget?.id) return;
    setSelectedId(linkedTarget.id);
  }, [linkedTarget]);

  const filteredReports = useMemo(
    () => reports.filter((report) => getFilterMatch(report, filter)),
    [reports, filter],
  );

  const selectedReport =
    filteredReports.find((report) => report.id === selectedId) ??
    reports.find((report) => report.id === selectedId) ??
    filteredReports[0] ??
    reports[0] ??
    null;

  const handleOpenClose = (id: string) => {
    setSelectedId((current) => (current === id ? null : id));
  };

  const handleDelete = (id: string) => {
    const next = reports.filter((report) => report.id !== id);
    setReports(next);
    writeStoredReports(next);
    if (selectedId === id) {
      setSelectedId(next[0]?.id ?? null);
    }
  };

  return (
    <div
      className="flex-1 overflow-auto"
      style={{ backgroundColor: "#0D1B2E" }}
    >
      <div className="max-w-6xl mx-auto px-8 py-8">
        <div className="mb-6">
          <div
            className="text-[11px] font-bold tracking-[0.22em] uppercase mb-2"
            style={{ color: "#8BA4C2" }}
          >
            Vault
          </div>
          <h1
            className="text-4xl font-semibold leading-tight mb-2"
            style={{ color: "#FFFFFF" }}
          >
            System Health Records
          </h1>
          <p className="text-sm" style={{ color: "#8BA4C2" }}>
            Compact table view for saved reports, archived outcomes, and next-step decision support.
          </p>
        </div>

        <div
          className="rounded-2xl p-3 mb-6"
          style={{
            backgroundColor: "#111D30",
            border: "1px solid #1B2A4A",
          }}
        >
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((item) => {
              const active = filter === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setFilter(item.key)}
                  className="px-4 py-2 rounded-xl text-xs font-bold tracking-[0.18em] uppercase transition-all"
                  style={
                    active
                      ? {
                          backgroundColor: "#C9A84C",
                          color: "#0D1B2E",
                          border: "1px solid rgba(201,168,76,0.45)",
                        }
                      : {
                          backgroundColor: "#0D1B2E",
                          color: "#8BA4C2",
                          border: "1px solid #1B2A4A",
                        }
                  }
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div
          className="rounded-2xl overflow-hidden mb-6"
          style={{
            backgroundColor: "#111D30",
            border: "1px solid #1B2A4A",
          }}
        >
          <div
            className="grid items-center text-[11px] font-bold tracking-[0.18em] uppercase px-4 py-4"
            style={{
              gridTemplateColumns: "1.2fr 0.8fr 1fr 2.2fr 0.8fr 0.8fr",
              color: "#8BA4C2",
              borderBottom: "1px solid #1B2A4A",
            }}
          >
            <div>Service</div>
            <div>Owner</div>
            <div>Status</div>
            <div>Folder</div>
            <div>Time</div>
            <div>View</div>
          </div>

          {filteredReports.length === 0 ? (
            <div className="px-4 py-8" style={{ color: "#8BA4C2" }}>
              No records match this filter.
            </div>
          ) : (
            filteredReports.map((report) => {
              const isOpen = selectedId === report.id;
              const statusStyle = getStatusStyle(report.status);

              return (
                <div
                  key={report.id}
                  className="px-4"
                  style={{ borderBottom: "1px solid #1B2A4A" }}
                >
                  <div
                    className="grid items-center py-4 text-sm gap-4"
                    style={{
                      gridTemplateColumns: "1.2fr 0.8fr 1fr 2.2fr 0.8fr 0.8fr",
                    }}
                  >
                    <div className="font-semibold" style={{ color: "#FFFFFF" }}>
                      {report.service}
                    </div>

                    <div>
                      <span
                        className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-[0.12em] uppercase"
                        style={{
                          color: "#E9D5FF",
                          border: "1px solid rgba(168,85,247,0.35)",
                          backgroundColor: "rgba(168,85,247,0.10)",
                        }}
                      >
                        {report.owner}
                      </span>
                    </div>

                    <div>
                      <span
                        className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-[0.12em] uppercase"
                        style={{
                          color: statusStyle.text,
                          border: `1px solid ${statusStyle.border}`,
                          backgroundColor: statusStyle.bg,
                        }}
                      >
                        {statusStyle.label}
                      </span>
                    </div>

                    <div className="text-sm" style={{ color: "#C7D2E3" }}>
                      {report.folder}
                    </div>

                    <div className="text-sm" style={{ color: "#C7D2E3" }}>
                      {report.time}
                    </div>

                    <div>
                      <button
                        onClick={() => handleOpenClose(report.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                        style={{
                          color: "#C9A84C",
                          border: "1px solid rgba(201,168,76,0.45)",
                          backgroundColor: isOpen ? "rgba(201,168,76,0.14)" : "transparent",
                        }}
                      >
                        {isOpen ? "Close" : "Open"}
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="pb-5">
                      <div
                        className="rounded-2xl p-5"
                        style={{
                          backgroundColor: "#0D1B2E",
                          border: "1px solid #1B2A4A",
                        }}
                      >
                        <div className="flex items-start justify-between gap-4 mb-5">
                          <div>
                            <div
                              className="text-2xl font-semibold mb-2"
                              style={{ color: "#FFFFFF" }}
                            >
                              {report.title}
                            </div>
                            <div
                              className="text-sm leading-7 max-w-4xl"
                              style={{ color: "#FFFFFF" }}
                            >
                              {report.description}
                            </div>
                          </div>

                          <button
                            onClick={() => handleDelete(report.id)}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold tracking-[0.12em] uppercase transition-all"
                            style={{
                              color: "#FCA5A5",
                              border: "1px solid rgba(239,68,68,0.45)",
                              backgroundColor: "rgba(127,29,29,0.18)",
                            }}
                          >
                            <Trash2 size={12} />
                            Delete
                          </button>
                        </div>

                        <NextActionPanel report={report} />

                        <div className="grid lg:grid-cols-[1.3fr_1fr] gap-5 mt-5">
                          <div
                            className="rounded-xl p-4"
                            style={{
                              backgroundColor: "#111D30",
                              border: "1px solid #1B2A4A",
                            }}
                          >
                            <div
                              className="text-[11px] font-bold tracking-[0.18em] uppercase mb-3"
                              style={{ color: "#8BA4C2" }}
                            >
                              Readable Tags
                            </div>
                            <div className="flex flex-wrap gap-2 mb-4">
                              {report.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-[0.12em] uppercase"
                                  style={{
                                    color: "#C9A84C",
                                    border: "1px solid rgba(201,168,76,0.24)",
                                    backgroundColor: "rgba(201,168,76,0.08)",
                                  }}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>

                            <div
                              className="text-[11px] font-bold tracking-[0.18em] uppercase mb-3"
                              style={{ color: "#8BA4C2" }}
                            >
                              Chain of Custody
                            </div>
                            <div
                              className="rounded-xl p-4 space-y-3"
                              style={{
                                backgroundColor: "#0D1B2E",
                                border: "1px solid #1B2A4A",
                              }}
                            >
                              {report.timeline.length === 0 ? (
                                <div className="text-sm" style={{ color: "#8BA4C2" }}>
                                  No chain-of-custody events recorded.
                                </div>
                              ) : (
                                report.timeline.map((entry) => (
                                  <div key={entry.id}>
                                    <div
                                      className="text-sm font-semibold"
                                      style={{ color: "#FFFFFF" }}
                                    >
                                      [{entry.time}] {entry.label}
                                    </div>
                                    {entry.detail && (
                                      <div className="text-sm" style={{ color: "#8BA4C2" }}>
                                        {entry.detail}
                                      </div>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          </div>

                          <div
                            className="rounded-xl p-4"
                            style={{
                              backgroundColor: "#111D30",
                              border: "1px solid #1B2A4A",
                            }}
                          >
                            <div
                              className="text-[11px] font-bold tracking-[0.18em] uppercase mb-3"
                              style={{ color: "#8BA4C2" }}
                            >
                              Notes
                            </div>
                            <div
                              className="rounded-xl p-4 min-h-[180px]"
                              style={{
                                backgroundColor: "#0D1B2E",
                                border: "1px solid #1B2A4A",
                                color: report.notes ? "#FFFFFF" : "#8BA4C2",
                              }}
                            >
                              {report.notes || "No notes saved."}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function NextActionPanel({ report }: { report: ReportRecord }) {
  const urgency = getUrgencyMeta(report);
  const nextAction = deriveNextAction(report);

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        backgroundColor: urgency.bg,
        border: `1px solid ${urgency.border}`,
      }}
    >
      <div className="flex items-start gap-3 mb-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{
            backgroundColor: "rgba(255,255,255,0.05)",
            color: urgency.textColor,
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {urgency.icon}
        </div>

        <div className="min-w-0">
          <div
            className="text-[11px] font-bold tracking-[0.18em] uppercase mb-1"
            style={{ color: "#8BA4C2" }}
          >
            Next Action
          </div>
          <div className="text-lg font-semibold mb-1" style={{ color: "#FFFFFF" }}>
            {urgency.title}
          </div>
          <div className="text-sm" style={{ color: "#C7D2E3" }}>
            {nextAction.reason}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1.3fr_1fr] gap-4 mt-4">
        <div
          className="rounded-xl p-4"
          style={{
            backgroundColor: "#0D1B2E",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div
            className="text-[11px] font-bold tracking-[0.18em] uppercase mb-2"
            style={{ color: "#8BA4C2" }}
          >
            Primary Action
          </div>

          <div
            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold"
            style={{
              backgroundColor:
                report.status === "ACTIVE"
                  ? "rgba(239,68,68,0.16)"
                  : report.status === "SAVED"
                    ? "rgba(59,130,246,0.16)"
                    : report.status === "FAILED"
                      ? "rgba(239,68,68,0.16)"
                      : "rgba(16,185,129,0.16)",
              color: "#FFFFFF",
              border:
                report.status === "ACTIVE" || report.status === "FAILED"
                  ? "1px solid rgba(239,68,68,0.35)"
                  : report.status === "SAVED"
                    ? "1px solid rgba(59,130,246,0.35)"
                    : "1px solid rgba(16,185,129,0.35)",
            }}
          >
            {report.status === "ACTIVE" ? <AlertTriangle size={15} /> : null}
            {report.status === "SAVED" ? <RefreshCw size={15} /> : null}
            {report.status === "FIXED" ? <CheckCircle2 size={15} /> : null}
            {report.status === "FAILED" ? <ShieldAlert size={15} /> : null}
            {report.status === "ABANDONED" ? <FolderOpen size={15} /> : null}
            {nextAction.primary}
          </div>
        </div>

        <div
          className="rounded-xl p-4"
          style={{
            backgroundColor: "#0D1B2E",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div
            className="text-[11px] font-bold tracking-[0.18em] uppercase mb-2"
            style={{ color: "#8BA4C2" }}
          >
            Secondary Actions
          </div>

          <div className="space-y-2">
            {nextAction.secondary.map((item) => (
              <div
                key={item}
                className="text-sm rounded-lg px-3 py-2"
                style={{
                  color: "#C7D2E3",
                  border: "1px solid #1B2A4A",
                  backgroundColor: "#111D30",
                }}
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
