import { supabase } from "./supabase";

export type DriveListFile = {
  id: string;
  name: string;
  mimeType?: string;
  webViewLink?: string;
  modifiedTime?: string;
  size?: string | number;
  parents?: string[];
};

export type DriveListResponse = {
  success: boolean;
  count?: number;
  nextPageToken?: string | null;
  files?: DriveListFile[];
  error?: string;
  details?: string;
};

export type DriveFileContentResponse = {
  success: boolean;
  file?: {
    id: string;
    name: string;
    mimeType?: string;
    webViewLink?: string;
    modifiedTime?: string;
    size?: string | number;
    parents?: string[];
  };
  text?: string;
  textLength?: number;
  sample?: string;
  readable?: boolean;
  canExtractText?: boolean;
  extractionStatus?: string;
  supportHint?: string;
  error?: string;
  details?: string;
};

export type DriveBrainIndexedRow = {
  id: string;
  title: string;
  drive_file_id: string | null;
  drive_link: string | null;
  drive_sync_status: string | null;
  drive_modified_time: string | null;
  file_type: string | null;
  tags: string[] | null;
  source: string | null;
  drive_name: string | null;
};

export type DriveBrainEvidenceItem = {
  id: string;
  title: string;
  driveFileId: string;
  driveLink: string;
  driveSyncStatus: string;
  driveModifiedTime: string | null;
  fileType: string;
  tags: string[];
  textLength: number;
  excerpt: string;
  fetchStatus: "fetched" | "skipped" | "failed";
  error?: string;
};

export type DriveBrainEvidencePack = {
  success: boolean;
  query: string;
  searchedRows: number;
  evidenceCount: number;
  failedCount: number;
  evidence: DriveBrainEvidenceItem[];
  errors: string[];
};

type DriveBrainFunctionResponse = {
  success?: boolean;
  error?: string;
  details?: string;
};

type EvidencePackOptions = {
  limit?: number;
  excerptChars?: number;
};

const DRIVE_BRAIN_ROW_SELECT =
  "id,title,drive_file_id,drive_link,drive_sync_status,drive_modified_time,file_type,tags,source,drive_name";

function normalizeScoreText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
function isLikelyCorruptedDriveName(name: string) {
  const suspiciousFragments = ["Ã¢", "Ã¢", "Ã°Å¸", "ÃƒÂ¢", "\uFFFD", "âˆ©â•—â”"];

  return suspiciousFragments.some((fragment) => name.includes(fragment));
}

function getSafeDriveTitle(file: DriveListFile) {
  const fallback = `Drive file ${file.id}`;

  if (!file.name || isLikelyCorruptedDriveName(file.name)) {
    return {
      title: fallback,
      needsFilenameCleanup: true,
    };
  }

  return {
    title: file.name,
    needsFilenameCleanup: false,
  };
}

function normalizeEvidenceQuery(query: string) {
  return query
    .replace(/[^\w\s.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getEvidenceTokens(query: string) {
  return normalizeEvidenceQuery(query)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
    .slice(0, 6);
}

function normalizeEvidenceText(text: string) {
  return text
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function makeExcerpt(text: string, excerptChars: number) {
  const normalized = normalizeEvidenceText(text);

  if (normalized.length <= excerptChars) {
    return normalized;
  }

  return `${normalized.slice(0, excerptChars).trim()}...`;
}

function dedupeRows(rows: DriveBrainIndexedRow[]) {
  const seen = new Set<string>();
  const result: DriveBrainIndexedRow[] = [];

  for (const row of rows) {
    const key = row.drive_file_id || row.id;

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(row);
  }

  return result;
}

async function ensureDriveBrainSession() {
  const sessionResult = await supabase.auth.getSession();

  if (sessionResult.error) {
    throw new Error(`Supabase session check failed: ${sessionResult.error.message}`);
  }

  if (sessionResult.data.session?.access_token) {
    return;
  }

  const signInResult = await supabase.auth.signInAnonymously();

  if (signInResult.error) {
    throw new Error(`Supabase anonymous sign-in failed: ${signInResult.error.message}`);
  }
}

async function invokeDriveBrainAction<T extends DriveBrainFunctionResponse>(
  body: Record<string, unknown>
): Promise<T> {
  await ensureDriveBrainSession();

  const { data, error } = await supabase.functions.invoke("google-drive-sync", {
    body,
  });

  if (error) {
    throw new Error(error.message || "Drive Brain Edge Function call failed.");
  }

  if (!data || typeof data !== "object") {
    throw new Error("Drive Brain Edge Function returned an empty response.");
  }

  const response = data as T;

  if (response.success === false) {
    const details = [response.error, response.details].filter(Boolean).join(": ");
    throw new Error(details || "Drive Brain Edge Function returned success false.");
  }

  return response;
}

export async function callDriveList(pageToken?: string): Promise<DriveListResponse> {
  const body: Record<string, unknown> = {
    action: "list_drive_files",
  };

  if (pageToken) {
    body.pageToken = pageToken;
    body.page_token = pageToken;
  }

  return invokeDriveBrainAction<DriveListResponse>(body);
}

export async function getDriveFileContent(fileId: string): Promise<DriveFileContentResponse> {
  const cleanFileId = fileId.trim();

  if (!cleanFileId) {
    throw new Error("Missing Drive file ID.");
  }

  return invokeDriveBrainAction<DriveFileContentResponse>({
    action: "get_file_content",
    file_id: cleanFileId,
  });
}

function mapDriveFileToFileRoomRow(file: DriveListFile) {
  const safeTitle = getSafeDriveTitle(file);
  const tags = safeTitle.needsFilenameCleanup
    ? ["drive-brain", "drive-index", "filename-needs-cleanup"]
    : ["drive-brain", "drive-index"];

  return {
    title: safeTitle.title,
    file_type: file.mimeType || "unknown",
    size_bytes: typeof file.size === "number" ? file.size : file.size ? Number(file.size) || null : null,
    tags,
    page_status: "Indexed",
    use_permission: "Review Before Use",
    drive_file_id: file.id,
    drive_link: file.webViewLink || "",
    source: "drive_brain_index",
    is_active: true,
    drive_name: safeTitle.title,
    drive_modified_time: file.modifiedTime || null,
    drive_sync_status: safeTitle.needsFilenameCleanup ? "indexed_filename_needs_cleanup" : "indexed",
    last_drive_sync_at: new Date().toISOString(),
  };
}

export async function indexDriveFilesIntoFileRoom(files: DriveListFile[]) {
  const attempted = Array.isArray(files) ? files.filter((file) => file.id).length : 0;

  return {
    success: false,
    inserted: 0,
    attempted,
    errors: ["Drive Brain index writes are locked in read-only safe mode. No File Room rows were inserted or updated."],
    message: "Drive Brain index writes are locked in read-only safe mode.",
  };
}

function getRowModifiedTime(row: DriveBrainIndexedRow) {
  const parsed = Date.parse(row.drive_modified_time || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function scoreDriveBrainRow(row: DriveBrainIndexedRow, query: string, tokens: string[]) {
  const normalizedQuery = normalizeScoreText(query);
  const title = normalizeScoreText(row.title);
  const driveName = normalizeScoreText(row.drive_name);
  const tagText = normalizeScoreText((row.tags || []).join(" "));

  let score = 0;

  if (title === normalizedQuery) {
    score += 1000;
  }

  if (driveName === normalizedQuery) {
    score += 950;
  }

  if (title.includes(normalizedQuery)) {
    score += 800;
  }

  if (driveName.includes(normalizedQuery)) {
    score += 750;
  }

  for (const token of tokens) {
    const cleanToken = normalizeScoreText(token);

    if (!cleanToken) {
      continue;
    }

    if (title === cleanToken) {
      score += 160;
    } else if (title.includes(cleanToken)) {
      score += 70;
    }

    if (driveName === cleanToken) {
      score += 120;
    } else if (driveName.includes(cleanToken)) {
      score += 45;
    }

    if (tagText.includes(cleanToken)) {
      score += 15;
    }
  }

  if (row.drive_file_id) {
    score += 25;
  } else {
    score -= 500;
  }

  if (row.drive_sync_status === "indexed") {
    score += 10;
  }

  return score;
}

function sortDriveBrainRowsByRelevance(rows: DriveBrainIndexedRow[], query: string) {
  const cleanQuery = normalizeEvidenceQuery(query);
  const tokens = getEvidenceTokens(cleanQuery);

  return dedupeRows(rows)
    .map((row) => ({
      row,
      score: scoreDriveBrainRow(row, cleanQuery, tokens),
      modifiedTime: getRowModifiedTime(row),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return b.modifiedTime - a.modifiedTime;
    })
    .map((item) => item.row);
}

async function collectDriveBrainRowsByTerm(term: string, limit: number) {
  const rows: DriveBrainIndexedRow[] = [];

  const titleQuery = await supabase
    .from("file_room_files")
    .select(DRIVE_BRAIN_ROW_SELECT)
    .eq("source", "drive_brain_index")
    .not("drive_file_id", "is", null)
    .ilike("title", "%" + term + "%")
    .limit(limit);

  if (titleQuery.error) {
    throw new Error("Drive Brain title search failed: " + titleQuery.error.message);
  }

  rows.push(...((titleQuery.data || []) as DriveBrainIndexedRow[]));

  const driveNameQuery = await supabase
    .from("file_room_files")
    .select(DRIVE_BRAIN_ROW_SELECT)
    .eq("source", "drive_brain_index")
    .not("drive_file_id", "is", null)
    .ilike("drive_name", "%" + term + "%")
    .limit(limit);

  if (driveNameQuery.error) {
    throw new Error("Drive Brain drive_name search failed: " + driveNameQuery.error.message);
  }

  rows.push(...((driveNameQuery.data || []) as DriveBrainIndexedRow[]));

  return rows;
}

export async function searchDriveBrainIndex(query: string, limit = 8): Promise<DriveBrainIndexedRow[]> {
  await ensureDriveBrainSession();

  const safeLimit = Math.max(1, Math.min(limit, 20));
  const cleanQuery = normalizeEvidenceQuery(query);

  if (!cleanQuery) {
    const { data, error } = await supabase
      .from("file_room_files")
      .select(DRIVE_BRAIN_ROW_SELECT)
      .eq("source", "drive_brain_index")
      .not("drive_file_id", "is", null)
      .order("drive_modified_time", { ascending: false })
      .limit(safeLimit);

    if (error) {
      throw new Error("Drive Brain index search failed: " + error.message);
    }

    return (data || []) as DriveBrainIndexedRow[];
  }

  const rows: DriveBrainIndexedRow[] = [];
  const tokens = getEvidenceTokens(cleanQuery);
  const searchTerms = [cleanQuery, ...tokens].filter((term, index, arr) => arr.indexOf(term) === index);

  for (const term of searchTerms) {
    const termRows = await collectDriveBrainRowsByTerm(term, safeLimit * 2);
    rows.push(...termRows);
  }

  return sortDriveBrainRowsByRelevance(rows, cleanQuery).slice(0, safeLimit);
}

function getEvidenceDisplayRank(item: DriveBrainEvidenceItem) {
  const hasReadableText =
    item.fetchStatus === "fetched" &&
    item.readable !== false &&
    item.textLength > 0;

  if (hasReadableText) {
    return 0;
  }

  if (item.fetchStatus === "fetched") {
    return 1;
  }

  if (item.extractionStatus === "unsupported_type") {
    return 2;
  }

  return 3;
}

function sortEvidenceForDisplay(evidence: DriveBrainEvidenceItem[]) {
  return [...evidence].sort((a, b) => {
    const rankDiff = getEvidenceDisplayRank(a) - getEvidenceDisplayRank(b);

    if (rankDiff !== 0) {
      return rankDiff;
    }

    return b.textLength - a.textLength;
  });
}

export async function buildDriveBrainEvidencePack(
  query: string,
  options: EvidencePackOptions = {}
): Promise<DriveBrainEvidencePack> {
  const limit = Math.max(1, Math.min(options.limit || 5, 10));
  const excerptChars = Math.max(250, Math.min(options.excerptChars || 1800, 5000));
  const rows = await searchDriveBrainIndex(query, limit);

  const evidence: DriveBrainEvidenceItem[] = [];
  const errors: string[] = [];

  for (const row of rows) {
    const driveFileId = row.drive_file_id || "";

    if (!driveFileId) {
      evidence.push({
        id: row.id,
        title: row.title || "Untitled Drive file",
        driveFileId: "",
        driveLink: row.drive_link || "",
        driveSyncStatus: row.drive_sync_status || "unknown",
        driveModifiedTime: row.drive_modified_time || null,
        fileType: row.file_type || "unknown",
        tags: row.tags || [],
        textLength: 0,
        excerpt: "",
        fetchStatus: "skipped",
        error: "Missing Drive file ID.",
      });

      continue;
    }

    try {
      const content = await getDriveFileContent(driveFileId);
      const text = content.text || "";
      const textLength = typeof content.textLength === "number" ? content.textLength : text.length;
      const readable =
        content.readable !== false &&
        textLength > 0 &&
        text.trim().length > 0;
      const extractionStatus = content.extractionStatus || (readable ? "readable" : "empty_text");
      const supportHint =
        content.supportHint ||
        (readable
          ? "Readable text extracted successfully."
          : "No readable text was extracted from this Drive file.");

      if (!readable) {
        evidence.push({
          id: row.id,
          title: content.file?.name || row.title || "Untitled Drive file",
          driveFileId,
          driveLink: content.file?.webViewLink || row.drive_link || "",
          driveSyncStatus: row.drive_sync_status || "unknown",
          driveModifiedTime: content.file?.modifiedTime || row.drive_modified_time || null,
          fileType: content.file?.mimeType || row.file_type || "unknown",
          tags: row.tags || [],
          textLength,
          readable: false,
          extractionStatus,
          supportHint,
          excerpt: "",
          fetchStatus: "failed",
          error: supportHint,
        });

        continue;
      }

      evidence.push({
        id: row.id,
        title: content.file?.name || row.title || "Untitled Drive file",
        driveFileId,
        driveLink: content.file?.webViewLink || row.drive_link || "",
        driveSyncStatus: row.drive_sync_status || "unknown",
        driveModifiedTime: content.file?.modifiedTime || row.drive_modified_time || null,
        fileType: content.file?.mimeType || row.file_type || "unknown",
        tags: row.tags || [],
        textLength,
        readable: true,
        extractionStatus,
        supportHint,
        excerpt: makeExcerpt(text, excerptChars),
        fetchStatus: "fetched",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${row.title || driveFileId}: ${message}`);

      evidence.push({
        id: row.id,
        title: row.title || "Untitled Drive file",
        driveFileId,
        driveLink: row.drive_link || "",
        driveSyncStatus: row.drive_sync_status || "unknown",
        driveModifiedTime: row.drive_modified_time || null,
        fileType: row.file_type || "unknown",
        tags: row.tags || [],
        textLength: 0,
        excerpt: "",
        fetchStatus: "failed",
        error: message,
      });
    }
  }

  const failedCount = evidence.filter((item) => item.fetchStatus === "failed").length;

  return {
    success: evidence.some((item) => item.fetchStatus === "fetched"),
    query,
    searchedRows: rows.length,
    evidenceCount: evidence.filter((item) => item.fetchStatus === "fetched").length,
    failedCount,
    evidence: sortEvidenceForDisplay(evidence),
    errors,
  };
}

export async function driveBrainIndexPlaceholderStatus() {
  return {
    success: true,
    status: "helper_wired_with_evidence_pack",
    next: "Drive Brain helper can search indexed rows, fetch readable content, and return evidence packs.",
  };
}

