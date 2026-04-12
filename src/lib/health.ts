import { supabase } from "./supabase";
import { getNotionFallbackStatus, testDriveConnection } from "./integrations";
import { getQueuedActions } from "./offline";

export type HealthStatus = "ok" | "warning" | "error" | "unknown" | "checking";

export interface ServiceHealth {
  name: string;
  status: HealthStatus;
  label: string;
  detail?: string;
  checkedAt: number;
}

export interface SystemHealth {
  database: ServiceHealth;
  drive: ServiceHealth;
  notion: ServiceHealth;
  syncQueue: ServiceHealth;
  recentErrors: RecentError[];
  lastRefreshed: number;
}

export interface RecentError {
  service: string;
  message: string;
  at: string | null;
}

const HEALTH_CACHE_MS = 30_000;
let cachedHealth: SystemHealth | null = null;
let lastFetched = 0;
let inflight: Promise<SystemHealth> | null = null;

async function checkDatabase(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const { error } = await supabase
      .from("approval_log")
      .select("id")
      .limit(1)
      .abortSignal(controller.signal);
    clearTimeout(timer);
    if (error) throw error;
    return {
      name: "database",
      status: "ok",
      label: "Connected",
      detail: `${Date.now() - start}ms`,
      checkedAt: Date.now(),
    };
  } catch (err) {
    return {
      name: "database",
      status: "error",
      label: "Error",
      detail: err instanceof Error ? err.message : "Unreachable",
      checkedAt: Date.now(),
    };
  }
}

async function checkDrive(): Promise<ServiceHealth> {
  try {
    const result = await testDriveConnection();
    if (result.success) {
      return { name: "drive", status: "ok", label: "Connected", checkedAt: Date.now() };
    }
    return {
      name: "drive",
      status: "error",
      label: "Error",
      detail: result.error ?? "Connection failed",
      checkedAt: Date.now(),
    };
  } catch (err) {
    return {
      name: "drive",
      status: "error",
      label: "Error",
      detail: err instanceof Error ? err.message : "Network error",
      checkedAt: Date.now(),
    };
  }
}

async function checkNotion(): Promise<ServiceHealth> {
  try {
    const fallback = await getNotionFallbackStatus();
    if (fallback.inFallback) {
      return {
        name: "notion",
        status: fallback.pendingCount > 0 ? "warning" : "warning",
        label: "Pending",
        detail: fallback.lastError || `${fallback.pendingCount} items queued`,
        checkedAt: Date.now(),
      };
    }
    return {
      name: "notion",
      status: "ok",
      label: "Connected",
      detail: fallback.pendingCount > 0 ? `${fallback.pendingCount} pending` : undefined,
      checkedAt: Date.now(),
    };
  } catch (err) {
    return {
      name: "notion",
      status: "error",
      label: "Error",
      detail: err instanceof Error ? err.message : "Unreachable",
      checkedAt: Date.now(),
    };
  }
}

function checkSyncQueue(): ServiceHealth {
  const queue = getQueuedActions();
  const count = queue.length;
  if (count === 0) {
    return { name: "syncQueue", status: "ok", label: "Empty", checkedAt: Date.now() };
  }
  const hasHighRetry = queue.some((a) => a.retries >= 3);
  return {
    name: "syncQueue",
    status: hasHighRetry ? "error" : "warning",
    label: `${count} queued`,
    detail: hasHighRetry ? "Some actions failing" : undefined,
    checkedAt: Date.now(),
  };
}

function collectRecentErrors(
  db: ServiceHealth,
  drive: ServiceHealth,
  notion: ServiceHealth,
  notionFallbackError?: string,
  notionFallbackAt?: string | null
): RecentError[] {
  const errors: RecentError[] = [];
  if (db.status === "error" && db.detail) {
    errors.push({ service: "Database", message: db.detail, at: null });
  }
  if (drive.status === "error" && drive.detail) {
    errors.push({ service: "Google Drive", message: drive.detail, at: null });
  }
  if (notion.status !== "ok" && (notionFallbackError || notion.detail)) {
    errors.push({
      service: "Notion",
      message: notionFallbackError || notion.detail || "Connection issue",
      at: notionFallbackAt ?? null,
    });
  }
  return errors;
}

async function fetchHealth(): Promise<SystemHealth> {
  let notionFallbackError = "";
  let notionFallbackAt: string | null = null;

  const [db, drive, notionFallback] = await Promise.all([
    checkDatabase(),
    checkDrive(),
    getNotionFallbackStatus().catch(() => ({
      inFallback: false,
      lastError: "",
      lastErrorAt: null as string | null,
      pendingCount: 0,
    })),
  ]);

  notionFallbackError = notionFallback.lastError;
  notionFallbackAt = notionFallback.lastErrorAt;

  const notion: ServiceHealth = notionFallback.inFallback
    ? {
        name: "notion",
        status: notionFallback.pendingCount > 0 ? "warning" : "warning",
        label: "Pending",
        detail:
          notionFallback.lastError ||
          (notionFallback.pendingCount > 0 ? `${notionFallback.pendingCount} items queued` : undefined),
        checkedAt: Date.now(),
      }
    : {
        name: "notion",
        status: "ok",
        label: "Connected",
        detail: notionFallback.pendingCount > 0 ? `${notionFallback.pendingCount} pending` : undefined,
        checkedAt: Date.now(),
      };

  const syncQueue = checkSyncQueue();
  const recentErrors = collectRecentErrors(db, drive, notion, notionFallbackError, notionFallbackAt);

  return {
    database: db,
    drive,
    notion,
    syncQueue,
    recentErrors,
    lastRefreshed: Date.now(),
  };
}

export async function getSystemHealth(forceRefresh = false): Promise<SystemHealth> {
  const now = Date.now();
  if (!forceRefresh && cachedHealth && now - lastFetched < HEALTH_CACHE_MS) {
    return cachedHealth;
  }
  if (inflight) return inflight;

  inflight = fetchHealth()
    .then((h) => {
      cachedHealth = h;
      lastFetched = Date.now();
      inflight = null;
      return h;
    })
    .catch((err) => {
      inflight = null;
      throw err;
    });

  return inflight;
}

export function getOverallStatus(health: SystemHealth): HealthStatus {
  const statuses = [health.database.status, health.drive.status, health.notion.status, health.syncQueue.status];
  if (statuses.includes("error")) return "error";
  if (statuses.includes("warning")) return "warning";
  return "ok";
}
