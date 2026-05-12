export type ReconciliationRow = {
  id: string;
  title: string;
  driveName?: string | null;
  driveFileId?: string | null;
  driveModifiedTime?: string | null;
  lastDriveSyncAt?: string | null;
  driveSyncStatus?: string | null;
  lineageGroupKey?: string | null;
  lineageRole?: string | null;
  lineageConfirmed?: boolean | null;
  canonicalFileId?: string | null;
};

export type ReconciliationStatus =
  | "reconciled"
  | "needs_grouping"
  | "missing_canonical"
  | "canonical_missing"
  | "canonical_conflict"
  | "needs_drive_sync";

export type ReconciliationResult = {
  rowId: string;
  status: ReconciliationStatus;
  reason: string;
  safeToAutoFix: boolean;
};

export function getLineageBaseTitle(value: string) {
  return value.toLowerCase().replace(/\.[a-z0-9]+$/i, "").replace(/\s*\(copy\s+\d+\)\s*/gi, "").replace(/\s+/g, " ").trim();
}

export function buildLineageGroupKey(row: ReconciliationRow) {
  const base = getLineageBaseTitle(row.driveName || row.title);
  if (!base) return null;
  return base.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase();
}

export function isCopyVariant(row: ReconciliationRow) {
  const title = row.driveName || row.title;
  return /\(copy\s+\d+\)/i.test(title);
}

export function getLineageFamily(row: ReconciliationRow, rows: ReconciliationRow[]) {
  const groupKey = row.lineageGroupKey || buildLineageGroupKey(row);
  if (!groupKey) return [];
  return rows.filter((item) => {
    const itemKey = item.lineageGroupKey || buildLineageGroupKey(item);
    return itemKey === groupKey;
  });
}

export function calculateCanonicalCandidate(row: ReconciliationRow, rows: ReconciliationRow[]) {
  const family = getLineageFamily(row, rows);
  if (family.length === 0) return row;
  if (family.length === 1) return family[0];
  const trusted = family.find((item) => item.lineageConfirmed);
  if (trusted) return trusted;
  const nonCopy = family.find((item) => !isCopyVariant(item));
  if (nonCopy) return nonCopy;
  return family[0];
}

export function detectCanonicalConflict(row: ReconciliationRow, rows: ReconciliationRow[]) {
  const family = getLineageFamily(row, rows);
  const confirmed = family.filter((item) => item.lineageConfirmed);
  if (confirmed.length > 1) return true;
  const canonicalIds = [...new Set(family.map((item) => item.canonicalFileId).filter(Boolean))];
  return canonicalIds.length > 1;
}

export function isDriveFresh(row: ReconciliationRow) {
  if (!row.driveFileId) return false;
  if (!row.lastDriveSyncAt || !row.driveModifiedTime) return false;
  const syncedAt = new Date(row.lastDriveSyncAt).getTime();
  const modifiedAt = new Date(row.driveModifiedTime).getTime();
  return syncedAt >= modifiedAt;
}

export function calculateReconciliationStatus(row: ReconciliationRow, rows: ReconciliationRow[]): ReconciliationResult {
  const groupKey = row.lineageGroupKey || buildLineageGroupKey(row);

  if (!groupKey) {
    return { rowId: row.id, status: "needs_grouping", reason: "No lineage group key exists.", safeToAutoFix: true };
  }

  if (detectCanonicalConflict(row, rows)) {
    return { rowId: row.id, status: "canonical_conflict", reason: "Conflicting canonical assignments or multiple founder confirmed files detected.", safeToAutoFix: false };
  }

  if (!row.canonicalFileId) {
    return { rowId: row.id, status: "missing_canonical", reason: "No canonical file assigned.", safeToAutoFix: true };
  }

  const canonicalExists = rows.some((item) => item.id === row.canonicalFileId);

  if (!canonicalExists) {
    return { rowId: row.id, status: "canonical_missing", reason: "Canonical file is missing from active rows.", safeToAutoFix: false };
  }

  if (!isDriveFresh(row)) {
    return { rowId: row.id, status: "needs_drive_sync", reason: "Drive metadata is stale or missing.", safeToAutoFix: false };
  }

  return { rowId: row.id, status: "reconciled", reason: "Row is reconciled.", safeToAutoFix: false };
}

export function detectSafeReconciliationCandidates(rows: ReconciliationRow[]) {
  return rows.filter((row) => calculateReconciliationStatus(row, rows).safeToAutoFix);
}

