import { useEffect, useMemo, useState } from "react";
import type { LinkableType } from "../lib/db";

type LinkedTarget = {
  type: LinkableType;
  id: string;
};

type CustodyEntry = {
  time: string;
  action: string;
  location: string;
  details: string;
};

type BaseVaultRecord = {
  id: string | number;
  title?: string;
  service?: string;
  owner?: string;
  status?: string;
  folder?: string;
  folderPath?: string;
  time?: string;
  timestamp?: string;
  savedAt?: string;
  archivedAt?: string;
  updatedAt?: string;
  description?: string;
  message?: string;
  summary?: string;
  notes?: string;
  fixStatus?: string;
  severity?: string;
  source?: string;
  category?: string;
  custodyTags?: string[];
  custodyTrail?: CustodyEntry[];
  recordType?: string;
  outcome?: string;
  relatedItems?: string[];
  attachments?: string[];
  requiresFollowUp?: boolean;
  lastUpdatedBy?: string;
};

type VaultBucket = {
  id: string;
  label: string;
  description: string;
  keys: string[];
  fallbackCategory: string;
};

type DisplayRecord = {
  id: string;
  rawId: string | number;
  title: string;
  service: string;
  owner: string;
  status: string;
  folder: string;
  time: string;
  summary: string;
  notes: string;
  severity: string;
  source: string;
  category: string;
  tags: string[];
  custodyTrail: CustodyEntry[];
  relatedItems: string[];
  attachments: string[];
  requiresFollowUp: boolean;
  lastUpdatedBy: string;
  recordType: string;
};

const BUCKETS: VaultBucket[] = [
  {
    id: "system-health",
    label: "System Health Reports",
    description: "Tracked reports, saved fixes, and archived outcomes from the System Reports flow.",
    keys: [
      "vault_system_health_reports",
      "system_health_reports_history",
      "system_health_reports",
      "systemReports",
      "system_reports",
      "systemHealthReports",
      "system_health_reports",
      "vaultSystemHealthRecords",
      "meetingRoomSystemReports",
    ],
    fallbackCategory: "System Health Reports",
  },
  {
    id: "integrations",
    label: "Integrations",
    description: "Integration records and sync issues that need follow-up or review.",
    keys: [
      "integration_reports",
      "integration_sync_reports",
      "integration_health_records",
      "vault_integrations",
      "integration_failure_log",
      "drive_sync_log",
      "notion_sync_log",
    ],
    fallbackCategory: "Integrations",
  },
  {
    id: "projects",
    label: "Projects",
    description: "Project-level records, milestones, and stored change notes.",
    keys: ["vault_projects", "project_records", "project_notes", "project_activity_log"],
    fallbackCategory: "Projects",
  },
  {
    id: "email",
    label: "Email",
    description: "Email exports, tracked messages, and action notes.",
    keys: ["vault_email", "email_records", "email_activity_log"],
    fallbackCategory: "Email",
  },
  {
    id: "tags",
    label: "Tags",
    description: "Saved tag decisions, label groupings, and classification notes.",
    keys: ["vault_tags", "tag_records", "tag_activity_log"],
    fallbackCategory: "Tags",
  },
  {
    id: "source-of-truth",
    label: "Source of Truth",
    description: "Canonical references, trust decisions, and linked evidence.",
    keys: ["source_of_truth_records", "vault_source_of_truth", "canonical_records"],
    fallbackCategory: "Source of Truth",
  },
  {
    id: "recovery",
    label: "Recovery",
    description: "Rollback notes, backup references, and critical recovery actions.",
    keys: ["backup_logs", "recovery_records", "critical_path_records", "dead_man_switch_records"],
    fallbackCategory: "Recovery",
  },
];

const STATUS_FILTERS = [
  "ALL",
  "ACTIVE",
  "PENDING",
  "IN PROGRESS",
  "FIXED",
  "FAILED",
  "ABANDONED",
  "WAITING",
  "QUARANTINE",
  "ARCHIVED",
];

function nowLabel() {
  return new Date().toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function readJsonArray(key: string): BaseVaultRecord[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeStatus(value?: string) {
  if (!value) return "ACTIVE";

  const upper = value.trim().toUpperCase();
  if (upper === "SAVED") return "SAVED";
  if (upper === "FIXED") return "FIXED";
  if (upper === "FAILED") return "FAILED";
  if (upper === "ABANDONED") return "ABANDONED";
  if (upper === "WAITING") return "WAITING";
  if (upper === "QUARANTINE") return "QUARANTINE";
  if (upper === "IN PROGRESS") return "IN PROGRESS";
  if (upper === "PENDING") return "PENDING";
  if (upper === "ARCHIVED") return "ARCHIVED";
  return upper;
}

function statusTone(status: string) {
  const upper = normalizeStatus(status);

  if (upper === "FIXED") {
    return {
      color: "#86EFAC",
      border: "1px solid rgba(16,185,129,0.35)",
      background: "rgba(6,95,70,0.18)",
    };
  }

  if (upper === "FAILED" || upper === "QUARANTINE") {
    return {
      color: "#FCA5A5",
      border: "1px solid rgba(239,68,68,0.35)",
      background: "rgba(127,29,29,0.18)",
    };
  }

  if (upper === "IN PROGRESS" || upper === "WAITING" || upper === "ABANDONED") {
    return {
      color: "#FCD34D",
      border: "1px solid rgba(245,158,11,0.35)",
      background: "rgba(120,53,15,0.18)",
    };
  }

  if (upper === "ARCHIVED") {
    return {
      color: "#93C5FD",
      border: "1px solid rgba(59,130,246,0.35)",
      background: "rgba(30,64,175,0.18)",
    };
  }

  return {
    color: "#CBD5E1",
    border: "1px solid rgba(148,163,184,0.35)",
    background: "rgba(51,65,85,0.18)",
  };
}

function dedupeStrings(values: Array<string | undefined | null>) {
  return Array.from(new Set(values.map((value) => (value || "").trim()).filter(Boolean)));
}

function buildTitle(record: BaseVaultRecord, bucket: VaultBucket) {
  return (
    record.title ||
    record.service ||
    record.summary ||
    record.message ||
    `${bucket.label} Record`
  );
}

function buildSummary(record: BaseVaultRecord) {
  return record.summary || record.description || record.message || "No summary captured yet.";
}

function buildFolder(record: BaseVaultRecord, bucket: VaultBucket) {
  return record.folderPath || record.folder || `Vault / ${bucket.label}`;
}

function buildTime(record: BaseVaultRecord) {
  return (
    record.archivedAt ||
    record.savedAt ||
    record.updatedAt ||
    record.timestamp ||
    record.time ||
    nowLabel()
  );
}

function buildTags(record: BaseVaultRecord, bucket: VaultBucket, status: string) {
  return dedupeStrings([
    ...(record.custodyTags || []),
    record.category,
    record.source,
    record.severity,
    record.owner ? `OWNER_${record.owner.toUpperCase().replace(/\s+/g, "_")}` : undefined,
    `STATUS_${status.replace(/\s+/g, "_")}`,
    bucket.label.toUpperCase().replace(/\s+/g, "_"),
    record.recordType ? `TYPE_${record.recordType.toUpperCase()}` : undefined,
  ]);
}

function buildCustodyTrail(record: BaseVaultRecord, folder: string, summary: string): CustodyEntry[] {
  if (Array.isArray(record.custodyTrail) && record.custodyTrail.length > 0) {
    return record.custodyTrail;
  }

  return [
    {
      time: buildTime(record),
      action: "Record captured",
      location: folder,
      details: summary,
    },
  ];
}

function normalizeRecord(record: BaseVaultRecord, bucket: VaultBucket, index: number): DisplayRecord {
  const status = normalizeStatus(record.status || record.fixStatus || record.outcome || record.recordType);
  const folder = buildFolder(record, bucket);
  const summary = buildSummary(record);
  const time = buildTime(record);
  const service = record.service || bucket.label;
  const owner = record.owner || record.lastUpdatedBy || "Unassigned";
  const category = record.category || bucket.fallbackCategory;
  const source = record.source || bucket.label;

  return {
    id: `${bucket.id}-${String(record.id ?? `${service}-${index}`)}`,
    rawId: record.id ?? `${service}-${index}`,
    title: buildTitle(record, bucket),
    service,
    owner,
    status,
    folder,
    time,
    summary,
    notes: record.notes || "",
    severity: record.severity || "Standard",
    source,
    category,
    tags: buildTags(record, bucket, status),
    custodyTrail: buildCustodyTrail(record, folder, summary),
    relatedItems: record.relatedItems || [],
    attachments: record.attachments || [],
    requiresFollowUp: Boolean(record.requiresFollowUp),
    lastUpdatedBy: record.lastUpdatedBy || owner,
    recordType: record.recordType || "tracked",
  };
}

function bucketRecords(bucket: VaultBucket): DisplayRecord[] {
  const merged = bucket.keys.flatMap((key) => readJsonArray(key));
  const unique = new Map<string, BaseVaultRecord>();

  merged.forEach((item, index) => {
    const stableKey = JSON.stringify([
      item.id,
      item.title,
      item.service,
      item.time,
      item.savedAt,
      item.archivedAt,
      item.message,
      item.folder,
      index,
    ]);

    if (!unique.has(stableKey)) {
      unique.set(stableKey, item);
    }
  });

  return Array.from(unique.values())
    .map((item, index) => normalizeRecord(item, bucket, index))
    .sort((a, b) => String(b.time).localeCompare(String(a.time)));
}

type DetailSectionProps = {
  label: string;
  children: React.ReactNode;
};

function DetailSection({ label, children }: DetailSectionProps) {
  return (
    <div className="rounded-2xl p-4 md:p-5" style={{ backgroundColor: "#111D30", border: "1px solid #1B2A4A" }}>
      <div className="text-[11px] font-bold uppercase tracking-[0.18em] mb-3" style={{ color: "#8A9BB5" }}>
        {label}
      </div>
      {children}
    </div>
  );
}

export default function VaultView({
  onNavigateLinked: _onNavigateLinked,
  linkedTarget: _linkedTarget,
}: {
  onNavigateLinked?: (type: LinkableType, id: string) => void;
  linkedTarget?: LinkedTarget;
}) {
  const [activeBucketId, setActiveBucketId] = useState(BUCKETS[0].id);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [recordsByBucket, setRecordsByBucket] = useState<Record<string, DisplayRecord[]>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notesDrafts, setNotesDrafts] = useState<Record<string, string>>({});
  const [simpleMode, setSimpleMode] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const refreshRecords = () => {
    const next: Record<string, DisplayRecord[]> = {};
    BUCKETS.forEach((bucket) => {
      next[bucket.id] = bucketRecords(bucket);
    });
    setRecordsByBucket(next);
  };

  useEffect(() => {
    refreshRecords();

    const handleRefresh = () => refreshRecords();
    window.addEventListener("storage", handleRefresh);
    window.addEventListener("vault-reports-updated", handleRefresh as EventListener);

    return () => {
      window.removeEventListener("storage", handleRefresh);
      window.removeEventListener("vault-reports-updated", handleRefresh as EventListener);
    };
  }, []);

  const activeBucket = BUCKETS.find((bucket) => bucket.id === activeBucketId) || BUCKETS[0];
  const records = recordsByBucket[activeBucket.id] || [];

  const filteredRecords = useMemo(() => {
    if (statusFilter === "ALL") return records;
    return records.filter((record) => normalizeStatus(record.status) === statusFilter);
  }, [records, statusFilter]);

  const selectedRecord = filteredRecords.find((record) => record.id === expandedId) || null;

  useEffect(() => {
    if (!selectedRecord && filteredRecords.length > 0) {
      setExpandedId(filteredRecords[0].id);
    }

    if (filteredRecords.length === 0) {
      setExpandedId(null);
    }
  }, [filteredRecords, selectedRecord]);

  useEffect(() => {
    setAdvancedOpen(false);
  }, [expandedId, simpleMode, activeBucketId]);

  const counts = useMemo(() => {
    const total = records.length;
    const open = records.filter((record) => ["ACTIVE", "PENDING", "IN PROGRESS", "WAITING"].includes(normalizeStatus(record.status))).length;
    const fixed = records.filter((record) => normalizeStatus(record.status) === "FIXED").length;
    const failed = records.filter((record) => ["FAILED", "QUARANTINE", "ABANDONED"].includes(normalizeStatus(record.status))).length;
    return { total, open, fixed, failed };
  }, [records]);

  const handleDelete = (record: DisplayRecord) => {
    const confirmed = window.confirm(`Delete "${record.title}" from this local vault list?`);
    if (!confirmed) return;

    const nextBucketRecords = (recordsByBucket[activeBucket.id] || []).filter((item) => item.id !== record.id);
    setRecordsByBucket((prev) => ({ ...prev, [activeBucket.id]: nextBucketRecords }));
    setExpandedId(nextBucketRecords[0]?.id || null);
  };

  const handleSaveNotes = (record: DisplayRecord) => {
    setRecordsByBucket((prev) => {
      const nextBucketRecords = (prev[activeBucket.id] || []).map((item) =>
        item.id === record.id
          ? {
              ...item,
              notes: notesDrafts[record.id] ?? item.notes,
              custodyTrail: [
                {
                  time: nowLabel(),
                  action: "Notes updated",
                  location: item.folder,
                  details: (notesDrafts[record.id] || "Notes cleared.").trim() || "Notes cleared.",
                },
                ...item.custodyTrail,
              ],
            }
          : item
      );
      return { ...prev, [activeBucket.id]: nextBucketRecords };
    });
  };

  return (
    <div className="min-h-screen px-4 py-5 md:px-6 lg:px-8 lg:py-7" style={{ backgroundColor: "#0D1B2E", color: "#FFFFFF" }}>
      <div className="max-w-[1560px] mx-auto space-y-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-4xl">
            <div className="text-[11px] font-bold uppercase tracking-[0.22em]" style={{ color: "#8A9BB5" }}>
              Vault
            </div>
            <h1 className="text-[30px] leading-tight font-bold mt-2" style={{ color: "#F8FAFC" }}>
              Records, folders, and chain of custody
            </h1>
            <p className="text-[15px] leading-7 mt-3" style={{ color: "#A8B6CC" }}>
              Same strong tracking underneath, but with a cleaner layout on top. Use Simple Mode for quick review.
              Open Advanced only when you want tags, custody logs, and the extra technical details.
            </p>
          </div>

          <div className="flex flex-col items-stretch gap-3 xl:items-end">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setSimpleMode(true)}
                className="px-4 py-3 rounded-xl text-sm font-bold"
                style={
                  simpleMode
                    ? { backgroundColor: "#C9A84C", color: "#0D1B2E" }
                    : { backgroundColor: "#111D30", color: "#D7E0EC", border: "1px solid #1B2A4A" }
                }
              >
                Simple Mode
              </button>
              <button
                onClick={() => setSimpleMode(false)}
                className="px-4 py-3 rounded-xl text-sm font-bold"
                style={
                  !simpleMode
                    ? { backgroundColor: "#7C3AED", color: "#F8FAFC" }
                    : { backgroundColor: "#111D30", color: "#D7E0EC", border: "1px solid #1B2A4A" }
                }
              >
                Advanced View
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 min-w-[320px]">
              {[
                { label: "Records", value: counts.total, tone: "neutral" },
                { label: "Open", value: counts.open, tone: "warning" },
                { label: "Fixed", value: counts.fixed, tone: "good" },
                { label: "Failed", value: counts.failed, tone: "bad" },
              ].map((card) => {
                const tone =
                  card.tone === "good"
                    ? { color: "#86EFAC", border: "1px solid rgba(16,185,129,0.28)", background: "rgba(6,95,70,0.18)" }
                    : card.tone === "bad"
                      ? { color: "#FCA5A5", border: "1px solid rgba(239,68,68,0.28)", background: "rgba(127,29,29,0.18)" }
                      : card.tone === "warning"
                        ? { color: "#FCD34D", border: "1px solid rgba(245,158,11,0.28)", background: "rgba(120,53,15,0.18)" }
                        : { color: "#C9A84C", border: "1px solid #1B2A4A", background: "#111D30" };

                return (
                  <div key={card.label} className="rounded-2xl px-4 py-3" style={tone}>
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em]">{card.label}</div>
                    <div className="text-2xl font-bold mt-2">{card.value}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="rounded-[24px] p-4" style={{ backgroundColor: "#0F1E33", border: "1px solid #1B2A4A" }}>
          <div className="flex flex-wrap gap-3">
            {BUCKETS.map((bucket) => {
              const active = bucket.id === activeBucket.id;
              const count = (recordsByBucket[bucket.id] || []).length;

              return (
                <button
                  key={bucket.id}
                  onClick={() => {
                    setActiveBucketId(bucket.id);
                    setExpandedId(null);
                  }}
                  className="px-4 py-3 rounded-xl text-left min-w-[190px] transition-all"
                  style={
                    active
                      ? {
                          backgroundColor: "#111D30",
                          border: "1px solid rgba(201,168,76,0.32)",
                          color: "#F8FAFC",
                        }
                      : {
                          backgroundColor: "rgba(17,29,48,0.55)",
                          border: "1px solid #1B2A4A",
                          color: "#A8B6CC",
                        }
                  }
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-bold">{bucket.label}</div>
                    <div className="text-[11px] font-bold px-2 py-1 rounded-lg" style={{ backgroundColor: "#0D1B2E", color: "#C9A84C" }}>
                      {count}
                    </div>
                  </div>
                  <div className="text-xs mt-2 leading-5">{bucket.description}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.38fr_1fr] items-start">
          <div className="rounded-[24px] overflow-hidden" style={{ backgroundColor: "#0F1E33", border: "1px solid #1B2A4A" }}>
            <div className="px-5 py-4 border-b flex flex-col gap-4" style={{ borderColor: "#1B2A4A" }}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-[28px] font-bold text-white leading-tight">{activeBucket.label}</div>
                  <div className="text-[15px] mt-2 leading-7" style={{ color: "#8A9BB5" }}>
                    {activeBucket.description}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {STATUS_FILTERS.map((item) => {
                    const active = item === statusFilter;
                    return (
                      <button
                        key={item}
                        onClick={() => setStatusFilter(item)}
                        className="px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-[0.14em]"
                        style={
                          active
                            ? { backgroundColor: "#C9A84C", color: "#0D1B2E" }
                            : { backgroundColor: "#111D30", color: "#8A9BB5", border: "1px solid #1B2A4A" }
                        }
                      >
                        {titleCase(item)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div
                className={`grid gap-4 px-1 text-[11px] font-bold uppercase tracking-[0.18em] ${
                  simpleMode ? "grid-cols-[1.25fr_0.9fr_0.85fr_0.55fr]" : "grid-cols-[1.05fr_0.85fr_0.9fr_1.4fr_0.75fr_0.6fr]"
                }`}
                style={{ color: "#8A9BB5" }}
              >
                <div>Service</div>
                {!simpleMode && <div>Owner</div>}
                <div>Status</div>
                <div>{simpleMode ? "Time" : "Folder"}</div>
                {!simpleMode && <div>Time</div>}
                <div className="text-right">View</div>
              </div>
            </div>

            <div className="max-h-[760px] overflow-y-auto">
              {filteredRecords.length === 0 ? (
                <div className="px-5 py-10 text-base" style={{ color: "#8A9BB5" }}>
                  No records in this section yet.
                </div>
              ) : (
                filteredRecords.map((record) => {
                  const expanded = record.id === expandedId;
                  const tone = statusTone(record.status);

                  return (
                    <div key={record.id} className="border-b" style={{ borderColor: "#1B2A4A" }}>
                      <button
                        onClick={() => setExpandedId(expanded ? null : record.id)}
                        className={`w-full grid gap-4 px-5 py-5 text-left items-start ${
                          simpleMode ? "grid-cols-[1.25fr_0.9fr_0.85fr_0.55fr]" : "grid-cols-[1.05fr_0.85fr_0.9fr_1.4fr_0.75fr_0.6fr]"
                        }`}
                        style={{ backgroundColor: expanded ? "rgba(201,168,76,0.05)" : "transparent" }}
                      >
                        <div>
                          <div className="font-semibold text-white text-[18px] leading-7">{record.service}</div>
                          <div className="text-[14px] mt-1 leading-6" style={{ color: "#D7E0EC" }}>
                            {record.title}
                          </div>
                          {simpleMode && (
                            <div className="text-[13px] mt-2 leading-6" style={{ color: "#8A9BB5" }}>
                              {record.summary}
                            </div>
                          )}
                        </div>
                        {!simpleMode && <div className="text-[15px] leading-7" style={{ color: "#D7E0EC" }}>{record.owner}</div>}
                        <div>
                          <span className="inline-flex px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-[0.16em]" style={tone}>
                            {titleCase(record.status)}
                          </span>
                        </div>
                        <div className="text-[15px] leading-7" style={{ color: "#D7E0EC" }}>
                          {simpleMode ? record.time : record.folder}
                        </div>
                        {!simpleMode && <div className="text-[15px] leading-7" style={{ color: "#A8B6CC" }}>{record.time}</div>}
                        <div className="text-right text-[15px] font-bold" style={{ color: "#C9A84C" }}>
                          {expanded ? "Hide" : "Open"}
                        </div>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-[24px] p-5 md:p-6" style={{ backgroundColor: "#0F1E33", border: "1px solid #1B2A4A" }}>
            {!selectedRecord ? (
              <div className="min-h-[560px] flex items-center justify-center text-center text-base px-6 leading-7" style={{ color: "#8A9BB5" }}>
                Open a record on the left to review its summary, notes, and advanced tracking details.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="max-w-[80%]">
                    <div className="text-[30px] leading-tight font-bold text-white">{selectedRecord.title}</div>
                    <div className="text-[15px] mt-2 leading-7" style={{ color: "#A8B6CC" }}>
                      {selectedRecord.service} • {selectedRecord.category}
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(selectedRecord)}
                    className="px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-[0.16em]"
                    style={{ color: "#FCA5A5", border: "1px solid rgba(239,68,68,0.35)", backgroundColor: "rgba(127,29,29,0.18)" }}
                  >
                    Delete
                  </button>
                </div>

                <DetailSection label="What this is">
                  <div className="text-[18px] leading-8 text-white">{selectedRecord.summary}</div>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {[selectedRecord.status, selectedRecord.severity].filter(Boolean).map((item) => (
                      <span
                        key={item}
                        className="inline-flex items-center px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-[0.16em]"
                        style={{ color: "#C9A84C", border: "1px solid rgba(201,168,76,0.28)", backgroundColor: "rgba(201,168,76,0.08)" }}
                      >
                        {titleCase(item)}
                      </span>
                    ))}
                    {selectedRecord.requiresFollowUp && (
                      <span
                        className="inline-flex items-center px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-[0.16em]"
                        style={{ color: "#FCD34D", border: "1px solid rgba(245,158,11,0.35)", backgroundColor: "rgba(120,53,15,0.18)" }}
                      >
                        Requires Follow Up
                      </span>
                    )}
                  </div>
                </DetailSection>

                <DetailSection label="Where it lives">
                  <div className="text-[17px] leading-8 text-white">{selectedRecord.folder}</div>
                  <div className="text-[14px] mt-3 leading-6" style={{ color: "#8A9BB5" }}>
                    Last updated by {selectedRecord.lastUpdatedBy} at {selectedRecord.time}
                  </div>
                </DetailSection>

                <DetailSection label="Notes">
                  <textarea
                    value={notesDrafts[selectedRecord.id] ?? selectedRecord.notes}
                    onChange={(event) => setNotesDrafts((prev) => ({ ...prev, [selectedRecord.id]: event.target.value }))}
                    placeholder="Add plain-English notes about what happened, what you tried, or what you need to remember later."
                    className="w-full min-h-[160px] rounded-xl p-4 text-[16px] leading-7"
                    style={{ backgroundColor: "#0D1B2E", border: "1px solid #1B2A4A", color: "#FFFFFF", resize: "vertical" }}
                  />

                  <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
                    <div className="text-[14px] leading-6" style={{ color: "#8A9BB5" }}>
                      Keep this simple. This box is meant to be readable first, technical second.
                    </div>
                    <button
                      onClick={() => handleSaveNotes(selectedRecord)}
                      className="px-4 py-3 rounded-lg text-xs font-bold uppercase tracking-[0.16em]"
                      style={{ color: "#0D1B2E", backgroundColor: "#C9A84C" }}
                    >
                      Save Notes
                    </button>
                  </div>
                </DetailSection>

                <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "#111D30", border: "1px solid #1B2A4A" }}>
                  <button
                    onClick={() => setAdvancedOpen((prev) => !prev)}
                    className="w-full flex items-center justify-between px-4 py-4 text-left"
                  >
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8A9BB5" }}>
                        Advanced
                      </div>
                      <div className="text-[17px] font-semibold text-white mt-1">
                        {advancedOpen ? "Hide extra tracking details" : "Show tags, custody trail, attachments, and technical metadata"}
                      </div>
                    </div>
                    <div className="text-[14px] font-bold" style={{ color: "#C9A84C" }}>
                      {advancedOpen ? "Hide" : "Open"}
                    </div>
                  </button>

                  {advancedOpen && (
                    <div className="px-4 pb-4 space-y-4">
                      <DetailSection label="Tags and metadata">
                        <div className="flex flex-wrap gap-2 mb-4">
                          {selectedRecord.tags.length === 0 ? (
                            <div className="text-[15px] leading-7" style={{ color: "#8A9BB5" }}>No tags yet.</div>
                          ) : (
                            selectedRecord.tags.map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-[0.14em]"
                                style={{ color: "#D7E0EC", border: "1px solid #1B2A4A", backgroundColor: "#0D1B2E" }}
                              >
                                {titleCase(tag)}
                              </span>
                            ))
                          )}
                        </div>
                        <div className="grid gap-3 md:grid-cols-2 text-[15px] leading-7" style={{ color: "#D7E0EC" }}>
                          <div><span style={{ color: "#8A9BB5" }}>Owner:</span> {selectedRecord.owner}</div>
                          <div><span style={{ color: "#8A9BB5" }}>Source:</span> {selectedRecord.source}</div>
                          <div><span style={{ color: "#8A9BB5" }}>Record Type:</span> {titleCase(selectedRecord.recordType)}</div>
                          <div><span style={{ color: "#8A9BB5" }}>Raw ID:</span> {String(selectedRecord.rawId)}</div>
                        </div>
                      </DetailSection>

                      <DetailSection label="Chain of custody">
                        <div className="space-y-3">
                          {selectedRecord.custodyTrail.map((entry, index) => (
                            <div key={`${entry.time}-${index}`} className="rounded-xl p-3 md:p-4" style={{ backgroundColor: "#0D1B2E", border: "1px solid #1B2A4A" }}>
                              <div className="flex flex-wrap items-center justify-between gap-3 text-[13px]">
                                <div className="font-bold" style={{ color: "#C9A84C" }}>{entry.action}</div>
                                <div style={{ color: "#8A9BB5" }}>{entry.time}</div>
                              </div>
                              <div className="text-[13px] mt-2 leading-6" style={{ color: "#93A4BD" }}>{entry.location}</div>
                              <div className="text-[15px] mt-2 leading-7 text-white">{entry.details}</div>
                            </div>
                          ))}
                        </div>
                      </DetailSection>

                      {(selectedRecord.relatedItems.length > 0 || selectedRecord.attachments.length > 0) && (
                        <div className="grid md:grid-cols-2 gap-4">
                          <DetailSection label="Related items">
                            <div className="space-y-2 text-[15px] leading-7 text-white">
                              {selectedRecord.relatedItems.length === 0 ? (
                                <div style={{ color: "#8A9BB5" }}>No related items linked yet.</div>
                              ) : (
                                selectedRecord.relatedItems.map((item, index) => <div key={`${item}-${index}`}>{item}</div>)
                              )}
                            </div>
                          </DetailSection>

                          <DetailSection label="Attachments">
                            <div className="space-y-2 text-[15px] leading-7 text-white">
                              {selectedRecord.attachments.length === 0 ? (
                                <div style={{ color: "#8A9BB5" }}>No attachments saved yet.</div>
                              ) : (
                                selectedRecord.attachments.map((item, index) => <div key={`${item}-${index}`}>{item}</div>)
                              )}
                            </div>
                          </DetailSection>
                        </div>
                      )}
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
