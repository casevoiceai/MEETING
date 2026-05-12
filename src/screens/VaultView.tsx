import { useEffect, useState } from "react";
import FilePreviewModal from "../components/FilePreviewModal";
import { supabase, getSupabaseAccessToken } from "../lib/supabase";
import { getDriveFileContent } from "../lib/driveBrainIndex";
import {
  buildLineageGroupKey,
  calculateCanonicalCandidate,
  detectCanonicalConflict,
  getLineageBaseTitle,
  getLineageFamily as getHelperLineageFamily,
  isCopyVariant,
  isDriveFresh,
} from "../lib/reconciliation";

type Row = {
  id: string;
  title: string;
  type: string;
  tags: string[];
  status: string;
  use: string;
  size?: number;
  driveLink?: string;
  driveFileId?: string;
  driveName?: string;
  driveModifiedTime?: string;
  lastDriveSyncAt?: string;
  driveSyncStatus?: string;
  recommendation?: string;
  recommendationReason?: string;
  lineageGroupKey?: string | null;
  lineageRole?: string | null;
  lineageConfirmed?: boolean | null;
  lineageConfirmedAt?: string | null;
  canonicalFileId?: string | null;
};

type FileRoomEvent = {
  id: string;
  file_room_file_id: string;
  event_type: string;
  actor: string;
  old_value?: string | null;
  new_value?: string | null;
  note?: string | null;
  created_at: string;
};

type VaultFocusMode = "current" | "parked" | "all";

type EvidencePreview = {
  rowId: string;
  title: string;
  fileName: string;
  text: string;
  textLength: number;
  readable: boolean;
  extractionStatus: string;
  supportHint: string;
  error?: string;
};

type EvidenceReceipt = {
  label: string;
  hint: string;
  tone: "good" | "review" | "blocked";
};
type VaultCurrentBucketName =
  | "Priority Evidence"
  | "Recent CASEVOICE / MyStatement Reports"
  | "Source Authority / Project Rooms"
  | "GitHub / Publish Readiness"
  | "my420journal / Cannabis"
  | "Other Current Work";

const STORAGE_KEY = "casevoice_file_room_rows";
const CASEVOICE_VAULT_FOCUS_FILTER_V1 = true;
const CASEVOICE_VAULT_CURRENT_WORK_GROUPS_V1 = true;
const CASEVOICE_VAULT_EVIDENCE_READ_PREVIEW_V1 = true;
const CASEVOICE_VAULT_EVIDENCE_CLEAN_PREVIEW_V2 = true;
const CASEVOICE_VAULT_EVIDENCE_FORMATTED_PREVIEW_V3 = true;
const CASEVOICE_VAULT_EVIDENCE_RECEIPT_V4 = true;

const statusOptions = ["Raw", "Indexed", "Vaulted", "Archived", "Quarantined"];
const useOptions = [
  "Do Not Use",
  "Reference Only",
  "Working Use",
  "Official Use",
];

function dbRowToUi(row: any): Row {
  return {
    id: row.id,
    title: row.title,
    type: row.file_type || "",
    tags: Array.isArray(row.tags) ? row.tags : [],
    status: row.page_status || "Raw",
    use: row.use_permission || "Do Not Use",
    size: row.size_bytes || undefined,
    driveLink: row.drive_link || undefined,
    driveFileId: row.drive_file_id || undefined,
    driveName: row.drive_name || undefined,
    driveModifiedTime: row.drive_modified_time || undefined,
    lastDriveSyncAt: row.last_drive_sync_at || undefined,
    driveSyncStatus: row.drive_sync_status || "not_synced",
    recommendation: row.tm_recommendation || "No recommendation yet",
    recommendationReason: row.tm_recommendation_reason || "",
    lineageGroupKey: row.lineage_group_key || null,
    lineageRole: row.lineage_role || null,
    lineageConfirmed: !!row.lineage_confirmed,
    lineageConfirmedAt: row.lineage_confirmed_at || null,
    canonicalFileId: row.canonical_file_id || null,
  };
}

function getVaultSearchText(row: Row): string {
  return [
    row.title,
    row.driveName,
    row.type,
    row.status,
    row.use,
    row.recommendation,
    row.recommendationReason,
    ...(Array.isArray(row.tags) ? row.tags : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getVaultFocusBucket(row: Row): "current" | "parked" {
  const haystack = getVaultSearchText(row);

  const currentMarkers = [
    "casevoice",
    "case voice",
    "my statement",
    "mystatement",
    "haven",
    "source authority",
    "project rooms",
    "founder crm",
    "meeting",
    "drive brain",
    "file room",
    "vault",
    "queue",
    "github publish",
    "readiness",
    "my420journal",
    "420journal",
    "cannabis journal",
    "vogtcom",
  ];

  const parkedMarkers = [
    "faerun",
    "faerûn",
    "townsfolk",
    "baldur",
    "baldur's gate",
    "class options",
    "archetype",
    "ancestry",
    "dnd",
    "d&d",
    "ttrpg",
    "wizard",
    "cleric",
    "fighter",
    "rogue",
    "bard",
    "sorcerer",
    "warlock",
    "paladin",
    "ranger",
  ];

  if (currentMarkers.some((marker) => haystack.includes(marker)))
    return "current";
  if (parkedMarkers.some((marker) => haystack.includes(marker)))
    return "parked";

  return "parked";
}

function getVaultFocusLabel(mode: VaultFocusMode) {
  if (mode === "current") return "Current Work";
  if (mode === "parked") return "Parked / Archive";
  return "All Rows";
}

function getEvidenceReadabilityReceipt(row: Row): EvidenceReceipt {
  const fileType = row.type || "unknown type";

  if (!row.driveFileId) {
    return {
      label: `${fileType} · no Drive ID`,
      hint: "Cannot read on demand until a Drive file ID is present.",
      tone: "blocked",
    };
  }

  const readableTypes = [
    "text/html",
    "text/plain",
    "text/markdown",
    "text/csv",
    "application/json",
    "application/vnd.google-apps.document",
    "application/vnd.google-apps.spreadsheet",
  ];

  if (readableTypes.includes(fileType)) {
    return {
      label: `${fileType} · readable on demand`,
      hint: "Drive text preview only. No DB write.",
      tone: "good",
    };
  }

  return {
    label: `${fileType} · review before relying`,
    hint: "Drive ID exists, but this file type may need extraction support.",
    tone: "review",
  };
}

function getEvidenceReceiptStyle(tone: EvidenceReceipt["tone"]): React.CSSProperties {
  if (tone === "good") {
    return {
      ...evidenceReceiptStyle,
      color: "#86EFAC",
      borderColor: "rgba(74,222,128,0.28)",
      background: "rgba(22,101,52,0.14)",
    };
  }

  if (tone === "blocked") {
    return {
      ...evidenceReceiptStyle,
      color: "#FCA5A5",
      borderColor: "rgba(248,113,113,0.28)",
      background: "rgba(127,29,29,0.14)",
    };
  }

  return {
    ...evidenceReceiptStyle,
    color: "#FACC15",
    borderColor: "rgba(250,204,21,0.28)",
    background: "rgba(113,63,18,0.14)",
  };
}

function decodeBasicHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '\"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'");
}

function normalizeEvidencePreviewSpacing(value: string): string {
  return decodeBasicHtmlEntities(value)
    .replace(/\r/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/([a-z0-9.)])([A-Z][A-Z0-9 /&:;,.()'’"-]{8,})/g, "$1\n\n$2")
    .replace(/([.!?])([A-Z][a-z])/g, "$1\n\n$2")
    .trim();
}

function extractReadableTextFromHtml(source: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(source, "text/html");
  doc.querySelectorAll("script, style, noscript, svg").forEach((node) => node.remove());

  const blockTags = new Set([
    "ARTICLE",
    "ASIDE",
    "BLOCKQUOTE",
    "BR",
    "DD",
    "DETAILS",
    "DIV",
    "DL",
    "DT",
    "FIGCAPTION",
    "FIGURE",
    "FOOTER",
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    "HEADER",
    "HR",
    "LI",
    "MAIN",
    "NAV",
    "OL",
    "P",
    "PRE",
    "SECTION",
    "TABLE",
    "TBODY",
    "TD",
    "TFOOT",
    "TH",
    "THEAD",
    "TR",
    "UL",
  ]);

  const parts: string[] = [];
  const appendBreak = () => {
    if (parts.length === 0 || parts[parts.length - 1] !== "\n") {
      parts.push("\n");
    }
  };

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || "";
      if (text.trim().length > 0) {
        parts.push(text);
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const element = node as HTMLElement;
    const isBlock = blockTags.has(element.tagName);

    if (element.tagName === "BR" || element.tagName === "HR") {
      appendBreak();
      return;
    }

    if (isBlock) appendBreak();
    element.childNodes.forEach(walk);
    if (isBlock) appendBreak();
  };

  const root = doc.body || doc.documentElement;
  root.childNodes.forEach(walk);

  return normalizeEvidencePreviewSpacing(parts.join(" "));
}

function cleanEvidenceText(rawText: string): string {
  const source = rawText || "";
  const looksLikeHtml = /<\s*(html|head|body|article|main|section|div|p|h[1-6]|style|script|span|table)\b/i.test(source);

  if (looksLikeHtml && typeof DOMParser !== "undefined") {
    try {
      const cleaned = extractReadableTextFromHtml(source);
      if (cleaned.length > 0) {
        return cleaned;
      }
    } catch {
      // Fall through to the plain regex cleaner below.
    }
  }

  return normalizeEvidencePreviewSpacing(
    source
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<\/(p|div|article|section|header|main|li|ul|ol|blockquote|pre|h[1-6]|tr|td|th)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  );
}

function hasAnyVaultMarker(text: string, markers: string[]) {
  return markers.some((marker) => text.includes(marker));
}

function getVaultCurrentBucketName(row: Row): VaultCurrentBucketName {
  const haystack = getVaultSearchText(row);

  if (
    hasAnyVaultMarker(haystack, [
      "source authority",
      "project rooms",
      "room source",
      "room map",
    ])
  ) {
    return "Source Authority / Project Rooms";
  }

  if (
    hasAnyVaultMarker(haystack, [
      "github",
      "publish",
      "readiness",
      "commit",
      "repo",
      "repository",
      "gitguardian",
    ])
  ) {
    return "GitHub / Publish Readiness";
  }

  if (
    hasAnyVaultMarker(haystack, [
      "my420journal",
      "420journal",
      "cannabis",
      "stoner",
      "dispensary",
      "cbd journal",
    ])
  ) {
    return "my420journal / Cannabis";
  }

  if (
    hasAnyVaultMarker(haystack, [
      "hard save",
      "handoff",
      "receipt",
      "evidence",
      "audit",
      "bug",
      "sprint",
      "plan",
      "qa",
      "verification",
    ])
  ) {
    return "Priority Evidence";
  }

  if (
    hasAnyVaultMarker(haystack, [
      "casevoice",
      "case voice",
      "mystatement",
      "my statement",
      "haven",
      "report",
      "intake",
      "statement",
    ])
  ) {
    return "Recent CASEVOICE / MyStatement Reports";
  }

  return "Other Current Work";
}

const currentBucketOrder: VaultCurrentBucketName[] = [
  "Priority Evidence",
  "Recent CASEVOICE / MyStatement Reports",
  "Source Authority / Project Rooms",
  "GitHub / Publish Readiness",
  "my420journal / Cannabis",
  "Other Current Work",
];

export default function VaultView() {
  const [preview, setPreview] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [savingId, setSavingId] = useState("");
  const [recommendingId, setRecommendingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncNote, setSyncNote] = useState("");
  const [historyFileTitle, setHistoryFileTitle] = useState("");
  const [historyEvents, setHistoryEvents] = useState<FileRoomEvent[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [deleteStage, setDeleteStage] = useState("");
  const [syncingDriveId, setSyncingDriveId] = useState("");
  const [rowNoteById, setRowNoteById] = useState<Record<string, string>>({});
  const [lineageConfirmedIds, setLineageConfirmedIds] = useState<
    Record<string, boolean>
  >({});
  const [vaultFocusMode, setVaultFocusMode] =
    useState<VaultFocusMode>("current");
  const [evidencePreview, setEvidencePreview] = useState<EvidencePreview | null>(
    null,
  );
  const [evidenceLoadingId, setEvidenceLoadingId] = useState("");

  const [rows, setRows] = useState<Row[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const currentWorkRows = rows.filter(
    (row) => getVaultFocusBucket(row) === "current",
  );
  const parkedArchiveRows = rows.filter(
    (row) => getVaultFocusBucket(row) === "parked",
  );
  const displayRows =
    vaultFocusMode === "all"
      ? rows
      : vaultFocusMode === "parked"
        ? parkedArchiveRows
        : currentWorkRows;

  const currentWorkGroups = currentBucketOrder.map((name) => ({
    name,
    rows: currentWorkRows.filter(
      (row) => getVaultCurrentBucketName(row) === name,
    ),
  }));

  useEffect(() => {
    loadRowsFromSupabase();
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  }, [rows]);

  async function loadRowsFromSupabase() {
    setLoading(true);
    setSyncNote("");

    const { data, error } = await supabase
      .from("file_room_files")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      setSyncNote(`Supabase load failed: ${error.message}`);
      setLoading(false);
      return;
    }

    const loadedRows = (data || []).map(dbRowToUi);
    setRows(loadedRows);

    const hydratedLineageConfirmedIds: Record<string, boolean> = {};
    loadedRows.forEach((row) => {
      if (row.lineageConfirmed) {
        hydratedLineageConfirmedIds[row.id] = true;
      }
    });
    setLineageConfirmedIds(hydratedLineageConfirmedIds);

    setSyncNote(`Loaded ${loadedRows.length} file room row(s) from Supabase.`);
    setLoading(false);
  }

  function addUploadedFile(file: {
    title: string;
    type: string;
    size: number;
    driveLink?: string;
    driveFileId?: string;
  }) {
    void file;
    setSyncNote(
      "File Room upload is locked in read-only safe mode. No Drive file or File Room index row was created.",
    );
  }

  async function loadHistory(row: Row) {
    setHistoryLoading(true);
    setHistoryFileTitle(row.title);
    setHistoryEvents([]);
    setSyncNote("Loading details...");

    const { data, error } = await supabase
      .from("file_room_events")
      .select("*")
      .eq("file_room_file_id", row.id)
      .order("created_at", { ascending: false });

    if (error) {
      setSyncNote(`Details load failed: ${error.message}`);
    } else {
      setHistoryEvents(data || []);
      const auditCount = (data || []).length;
      setSyncNote(
        auditCount > 0
          ? `Loaded ${auditCount} audit event${auditCount === 1 ? "" : "s"} for this file.`
          : "No detail events found for this file.",
      );
    }

    setHistoryLoading(false);
  }

  async function logFileRoomEvent(args: {
    fileId: string;
    eventType: string;
    oldValue?: string;
    newValue?: string;
    note?: string;
  }) {
    await supabase.from("file_room_events").insert({
      file_room_file_id: args.fileId,
      event_type: args.eventType,
      actor: "founder",
      old_value: args.oldValue || null,
      new_value: args.newValue || null,
      note: args.note || null,
    });
  }

  function updateReviewField(row: Row, field: "status" | "use", value: string) {
    void row;
    void field;
    void value;
    setSyncNote(
      "File Room review dropdowns are locked in read-only safe mode. Status and Use were not changed.",
    );
  }

  function setRowNote(rowId: string, message: string) {
    setRowNoteById((prev) => ({ ...prev, [rowId]: message }));
  }

  function hasCanonicalConflict(row: Row) {
    return detectCanonicalConflict(row, rows);
  }

  function getConflictReason(row: Row) {
    if (!hasCanonicalConflict(row)) return "";

    const family = rows.filter(
      (item) => item.lineageGroupKey === row.lineageGroupKey,
    );

    const confirmed = family.filter((item) => item.lineageConfirmed);

    if (confirmed.length > 1) {
      return "Multiple founder-confirmed files detected.";
    }

    return "Conflicting canonical assignments detected.";
  }

  function getCanonicalCandidate(row: Row) {
    return calculateCanonicalCandidate(row, rows);
  }

  function getLineageFamily(row: Row) {
    return getHelperLineageFamily(row, rows);
  }

  function getLineageAuthority(row: Row) {
    const family = getLineageFamily(row);

    if (family.length <= 1) return "";

    const canonical = getCanonicalCandidate(row);

    if (canonical?.id === row.id) {
      if (hasCanonicalConflict(row)) {
        return `Conflict detected. ${getConflictReason(row)}`;
      }

      return isLineageConfirmed(row)
        ? "Trusted canonical candidate."
        : "Primary canonical candidate.";
    }

    if (isCopyVariant(row)) {
      return isLineageConfirmed(row)
        ? "Trusted by founder."
        : "Possible duplicate. Trust before automation uses it.";
    }

    return "Original candidate. Prefer this row for automation.";
  }

  function confirmLineage(row: Row) {
    void row;
    setSyncNote(
      "File Room lineage trust is locked in read-only safe mode. Trust state was not changed.",
    );
  }

  function isLineageConfirmed(row: Row) {
    return !!lineageConfirmedIds[row.id] || !!row.lineageConfirmed;
  }

  function syncDriveMetadata(row: Row): Row | null {
    void row;
    setSyncNote(
      "File Room Drive metadata sync is locked in read-only safe mode. No Drive or File Room metadata was changed.",
    );
    return null;
  }

  function viewOnlyLineageGrouping(row: Row) {
    return row;
  }

  function generateRecommendation(row: Row) {
    void row;
    setSyncNote(
      "File Room Review File is locked in read-only safe mode. No recommendation was saved.",
    );
  }

  function approveRecommendation(row: Row) {
    void row;
    setSyncNote(
      "File Room Finalize is locked in read-only safe mode. Status, Use, and trust state were not changed.",
    );
  }

  function removeRow(row: Row) {
    void row;
    setSyncNote(
      "File Room remove is locked in read-only safe mode. No Drive file or File Room index changed.",
    );
  }

  async function readEvidencePreview(row: Row) {
    if (!row.driveFileId) {
      setEvidencePreview({
        rowId: row.id,
        title: row.title,
        fileName: row.driveName || row.title,
        text: "No Drive file ID is available for this row.",
        textLength: 0,
        readable: false,
        extractionStatus: "missing_drive_file_id",
        supportHint: "This is a read-only preview. No File Room row was changed.",
        error: "Missing Drive file ID.",
      });
      setSyncNote("Read-only evidence preview could not run because this row has no Drive file ID.");
      return;
    }

    setEvidenceLoadingId(row.id);
    setSyncNote("Reading evidence from Drive in read-only mode...");

    try {
      const content = await getDriveFileContent(row.driveFileId);
      const rawText = typeof content.text === "string" ? content.text : "";
      const cleanedText = cleanEvidenceText(rawText);
      const textLength =
        typeof content.textLength === "number" ? content.textLength : rawText.length;
      const readable =
        content.readable !== false && cleanedText.trim().length > 0 && textLength > 0;

      setEvidencePreview({
        rowId: row.id,
        title: row.title,
        fileName: content.file?.name || row.driveName || row.title,
        text: readable
          ? cleanedText.slice(0, 2200)
          : "Drive returned no readable text for this file.",
        textLength,
        readable,
        extractionStatus: content.extractionStatus || (readable ? "readable" : "empty_text"),
        supportHint:
          content.supportHint ||
          "Read-only evidence preview completed. No File Room row was changed.",
      });

      setSyncNote(
        readable
          ? `Read-only evidence preview loaded: ${textLength} characters available.`
          : "Read-only evidence preview loaded, but no readable text was returned.",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setEvidencePreview({
        rowId: row.id,
        title: row.title,
        fileName: row.driveName || row.title,
        text: "Evidence preview failed. No File Room row was changed.",
        textLength: 0,
        readable: false,
        extractionStatus: "read_failed",
        supportHint: "Check the Drive Brain read route before using this file as evidence.",
        error: message,
      });
      setSyncNote(`Read-only evidence preview failed: ${message}`);
    } finally {
      setEvidenceLoadingId("");
    }
  }

  function renderFileRow(r: Row) {
    const isPriorityEvidenceRow =
      getVaultCurrentBucketName(r) === "Priority Evidence";
    const isPriorityEvidence = isPriorityEvidenceRow && !!r.driveFileId;
    const evidenceReceipt = isPriorityEvidenceRow
      ? getEvidenceReadabilityReceipt(r)
      : null;

    return (
      <tr key={r.id}>
        <td style={td} onClick={() => setPreview(true)}>
          <div>{r.title}</div>
          {evidenceReceipt && (
            <div
              data-casevoice-vault-evidence-receipt-v4={
                CASEVOICE_VAULT_EVIDENCE_RECEIPT_V4 ? "true" : "false"
              }
              style={getEvidenceReceiptStyle(evidenceReceipt.tone)}
              title={evidenceReceipt.hint}
            >
              {evidenceReceipt.label}
            </div>
          )}
          {getLineageAuthority(r) && (
            <div style={lineageAuthorityStyle}>{getLineageAuthority(r)}</div>
          )}
          {isCopyVariant(r) && !isLineageConfirmed(r) && (
            <button
              style={{ ...smallButton, marginTop: 6, opacity: 0.55 }}
              disabled={true}
              title="Read-only safe mode: lineage trust is locked."
            >
              Trust Locked
            </button>
          )}
        </td>

        <td style={td}>
          <select
            style={{
              ...selectStyle,
              fontSize: 11,
              padding: "4px 6px",
              opacity: 0.88,
            }}
            value={r.status}
            disabled={true}
            title="Read-only safe mode: review fields are locked."
          >
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </td>

        <td style={td}>
          <select
            style={{
              ...selectStyle,
              fontSize: 11,
              padding: "4px 6px",
              opacity: 0.88,
            }}
            value={r.use}
            disabled={true}
            title="Read-only safe mode: review fields are locked."
          >
            {useOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </td>

        <td style={td}>
          <div style={{ fontWeight: 600 }}>
            {r.recommendation || "Waiting for TM review"}
          </div>
          {r.recommendationReason && (
            <div style={{ fontSize: 11, opacity: 0.72, marginTop: 4 }}>
              {r.recommendationReason}
            </div>
          )}
        </td>

        <td style={td}>
          <button
            style={{ ...smallButton, opacity: 0.55 }}
            disabled={true}
            title="Read-only safe mode: Drive sync is locked."
          >
            Sync Locked
          </button>
          <div
            style={{
              color: isDriveFresh(r) ? "#86EFAC" : "#FCA5A5",
              fontSize: 12,
              marginTop: 4,
            }}
          >
            {isDriveFresh(r) ? "Fresh" : "Needs Sync"}
            {rowNoteById[r.id] && (
              <div
                style={{
                  marginTop: 6,
                  fontSize: 11,
                  color: "#C9A84C",
                  maxWidth: 180,
                }}
              >
                {rowNoteById[r.id]}
              </div>
            )}
          </div>
        </td>

        <td style={td}>
          {r.driveLink ? (
            <a
              href={r.driveLink}
              target="_blank"
              rel="noreferrer"
              style={{ color: "#D4AF37", fontWeight: 700 }}
            >
              Open
            </a>
          ) : (
            ""
          )}
        </td>

        <td style={td}>
          {isPriorityEvidence ? (
            <button
              style={smallButton}
              onClick={() => readEvidencePreview(r)}
              disabled={evidenceLoadingId === r.id}
              title="Read-only mode: fetches Drive text for preview only. No File Room row is changed."
            >
              {evidenceLoadingId === r.id ? "Reading..." : "Read Evidence"}
            </button>
          ) : (
            <button
              style={{ ...smallButton, opacity: 0.55 }}
              disabled={true}
              title="Read-only safe mode: Review File is locked."
            >
              Review Locked
            </button>
          )}
        </td>

        <td style={td}>
          <button
            style={smallButton}
            disabled={true}
            title="Read-only safe mode: Finalize is locked."
          >
            Locked
          </button>
        </td>

        <td style={td}>
          <button
            style={smallButton}
            onClick={() => loadHistory(r)}
            disabled={historyLoading}
          >
            History
          </button>
        </td>

        <td style={{ ...td, opacity: 0.55 }}>
          <button
            style={{ ...smallButton, fontSize: 11, padding: "4px 8px" }}
            disabled={true}
            title="Read-only safe mode: remove is locked."
          >
            Locked
          </button>
        </td>
      </tr>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>FILE ROOM</h2>

      <div
        style={{ display: "flex", gap: 10, marginBottom: 15, flexWrap: "wrap" }}
      >
        <button
          style={{ ...goldButton, opacity: 0.55 }}
          disabled={true}
          title="Read-only safe mode: upload is locked."
        >
          UPLOAD LOCKED
        </button>
        <button style={goldButton} onClick={loadRowsFromSupabase}>
          {loading ? "LOADING..." : "REFRESH"}
        </button>
        <button
          style={{ ...goldButton, opacity: 0.55 }}
          disabled={true}
          title="Read-only safe mode: Tag Bank is locked."
        >
          TAG BANK LOCKED
        </button>
      </div>

      <div
        data-casevoice-vault-focus-filter-v1={
          CASEVOICE_VAULT_FOCUS_FILTER_V1 ? "true" : "false"
        }
        style={focusBox}
      >
        <div style={focusTitle}>
          VAULT FOCUS: {getVaultFocusLabel(vaultFocusMode)}
        </div>

        <div style={focusButtonRow}>
          {(["current", "parked", "all"] as VaultFocusMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setVaultFocusMode(mode)}
              style={{
                ...smallButton,
                borderColor: vaultFocusMode === mode ? "#D4AF37" : "#334155",
                color: vaultFocusMode === mode ? "#FACC15" : "#E8EEF8",
                background:
                  vaultFocusMode === mode ? "rgba(201,168,76,0.14)" : "#1A2433",
              }}
            >
              {getVaultFocusLabel(mode)}
            </button>
          ))}
        </div>

        <div style={focusText}>
          Showing {displayRows.length} of {rows.length}. Current work:{" "}
          {currentWorkRows.length}. Parked/archive: {parkedArchiveRows.length}.
        </div>

        <div style={focusText}>
          Current Work is grouped by evidence priority so the first screen is
          usable. No File Room rows are deleted or changed.
        </div>
      </div>

      {syncNote && (
        <div style={{ marginBottom: 12, color: "#D4AF37", fontWeight: 600 }}>
          {syncNote}
        </div>
      )}

      {deleteStage && (
        <div style={{ marginBottom: 12, color: "#93C5FD", fontWeight: 700 }}>
          {deleteStage}
        </div>
      )}

      {evidencePreview && (
        <div
          data-casevoice-vault-evidence-read-preview-v1={
            CASEVOICE_VAULT_EVIDENCE_READ_PREVIEW_V1 ? "true" : "false"
          }
          data-casevoice-vault-evidence-clean-preview-v2={
            CASEVOICE_VAULT_EVIDENCE_CLEAN_PREVIEW_V2 ? "true" : "false"
          }
          data-casevoice-vault-evidence-formatted-preview-v3={
            CASEVOICE_VAULT_EVIDENCE_FORMATTED_PREVIEW_V3 ? "true" : "false"
          }
          style={evidencePreviewBox}
        >
          <div style={evidencePreviewHeader}>
            <div>
              <div style={focusTitle}>READ-ONLY EVIDENCE PREVIEW</div>
              <div style={{ color: "#F8FAFC", fontWeight: 800, marginTop: 4 }}>
                {evidencePreview.fileName}
              </div>
            </div>
            <button style={smallButton} onClick={() => setEvidencePreview(null)}>
              Close Preview
            </button>
          </div>

          <div style={focusText}>
            Status: {evidencePreview.extractionStatus}. Text available: {evidencePreview.textLength} chars.
            {evidencePreview.error ? ` Error: ${evidencePreview.error}` : ""}
          </div>
          <div style={focusText}>{evidencePreview.supportHint}</div>
          <pre style={evidencePreviewText}>{evidencePreview.text}</pre>
        </div>
      )}

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={th}>Title</th>
            <th style={{ ...th, opacity: 0.65 }}>Status</th>
            <th style={{ ...th, opacity: 0.65 }}>Use</th>
            <th style={th}>TM/Page Suggestion</th>
            <th style={th}>Drive Sync</th>
            <th style={th}>Open</th>
            <th style={th}>Next Action</th>
            <th style={{ ...th, opacity: 0.45 }}>Finalize</th>
            <th style={{ ...th, opacity: 0.45 }}>Details</th>
            <th style={{ ...th, opacity: 0.35 }}>Remove Locked</th>
          </tr>
        </thead>
        <tbody>
          {displayRows.length === 0 && (
            <tr>
              <td style={emptyTd} colSpan={10}>
                No files match the current Vault Focus filter.
              </td>
            </tr>
          )}

          {vaultFocusMode === "current"
            ? currentWorkGroups.flatMap((group) =>
                group.rows.length === 0
                  ? []
                  : [
                      <tr key={`${group.name}-header`}>
                        <td style={groupHeaderTd} colSpan={10}>
                          {group.name} ({group.rows.length})
                        </td>
                      </tr>,
                      ...group.rows.map((r) => renderFileRow(r)),
                    ],
              )
            : displayRows.map((r) => renderFileRow(r))}
        </tbody>
      </table>

      {historyFileTitle && (
        <div style={historyBox}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
            }}
          >
            <h3 style={{ margin: 0 }}>File Details: {historyFileTitle}</h3>
            <button
              style={smallButton}
              onClick={() => {
                setHistoryFileTitle("");
                setHistoryEvents([]);
              }}
            >
              Close Details
            </button>
          </div>

          {historyLoading && <div style={historyEmpty}>Loading details...</div>}

          {!historyLoading && historyEvents.length === 0 && (
            <div style={historyEmpty}>No additional details available yet.</div>
          )}

          {!historyLoading && historyEvents.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {historyEvents.map((event) => (
                <div key={event.id} style={historyItem}>
                  <div style={{ fontWeight: 700, color: "#D4AF37" }}>
                    {event.event_type}
                  </div>
                  <div>Actor: {event.actor || "unknown"}</div>
                  <div>Old: {event.old_value || ""}</div>
                  <div>New: {event.new_value || ""}</div>
                  <div>Note: {event.note || ""}</div>
                  <div style={{ color: "#94A3B8" }}>
                    {event.created_at
                      ? new Date(event.created_at).toLocaleString()
                      : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {preview && <FilePreviewModal onClose={() => setPreview(false)} />}
    </div>
  );
}

const goldButton: React.CSSProperties = {
  background: "#D4AF37",
  color: "#05070D",
  border: "1px solid #B8952F",
  borderRadius: 8,
  padding: "10px 18px",
  cursor: "pointer",
  fontWeight: 700,
  letterSpacing: "0.02em",
  transition: "all 0.15s ease",
  boxShadow: "0 0 0 rgba(0,0,0,0)",
};

const smallButton: React.CSSProperties = {
  background: "#1A2433",
  color: "#E8EEF8",
  border: "1px solid #334155",
  borderRadius: 6,
  padding: "6px 10px",
  cursor: "pointer",
  fontWeight: 600,
};

const selectStyle: React.CSSProperties = {
  background: "#101827",
  color: "#E8EEF8",
  border: "1px solid #334155",
  borderRadius: 6,
  padding: "6px 8px",
  fontWeight: 600,
};

const th: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #ccc",
  padding: 8,
};

const td: React.CSSProperties = {
  padding: 8,
  borderBottom: "1px solid #eee",
};

const emptyTd: React.CSSProperties = {
  padding: 18,
  borderBottom: "1px solid #eee",
  color: "#94A3B8",
  fontStyle: "italic",
  textAlign: "center",
};

const focusBox: React.CSSProperties = {
  marginBottom: 14,
  padding: 12,
  border: "1px solid rgba(201,168,76,0.35)",
  borderRadius: 10,
  background: "rgba(13,27,46,0.72)",
};

const focusTitle: React.CSSProperties = {
  color: "#D4AF37",
  fontWeight: 800,
  letterSpacing: 1.2,
  textTransform: "uppercase",
  fontSize: 12,
};

const focusButtonRow: React.CSSProperties = {
  marginTop: 8,
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  alignItems: "center",
};

const focusText: React.CSSProperties = {
  marginTop: 6,
  color: "#93A4BC",
  fontSize: 12,
};

const groupHeaderTd: React.CSSProperties = {
  padding: "10px 8px",
  borderBottom: "1px solid #334155",
  background: "rgba(201,168,76,0.08)",
  color: "#FACC15",
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 1.1,
  textTransform: "uppercase",
};

const evidenceReceiptStyle: React.CSSProperties = {
  display: "inline-block",
  marginTop: 6,
  padding: "3px 8px",
  border: "1px solid rgba(148,163,184,0.24)",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.2,
};

const evidencePreviewBox: React.CSSProperties = {
  marginBottom: 14,
  padding: 14,
  border: "1px solid rgba(96,165,250,0.45)",
  borderRadius: 10,
  background: "rgba(8,17,31,0.94)",
};

const evidencePreviewHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
};

const evidencePreviewText: React.CSSProperties = {
  marginTop: 10,
  padding: 12,
  maxHeight: 260,
  overflow: "auto",
  whiteSpace: "pre-wrap",
  color: "#D0DFEE",
  background: "#050B14",
  border: "1px solid rgba(148,163,184,0.2)",
  borderRadius: 8,
  fontSize: 12,
  lineHeight: 1.6,
};

const historyBox: React.CSSProperties = {
  marginTop: 18,
  padding: 16,
  border: "1px solid #334155",
  borderRadius: 10,
  background: "#0F172A",
  color: "#E8EEF8",
};

const historyItem: React.CSSProperties = {
  padding: 12,
  borderBottom: "1px solid #334155",
  fontSize: 13,
  lineHeight: 1.5,
};

const historyEmpty: React.CSSProperties = {
  marginTop: 12,
  color: "#94A3B8",
  fontStyle: "italic",
};

const lineageAuthorityStyle: React.CSSProperties = {
  color: "#92400e",
  background: "#fef3c7",
  border: "1px solid #f59e0b",
  borderRadius: 8,
  display: "inline-block",
  fontSize: 11,
  fontWeight: 700,
  marginTop: 6,
  padding: "3px 8px",
};
