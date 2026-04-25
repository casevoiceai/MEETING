import { supabase } from "./supabase";
import { getNotionFallbackStatus, testDriveConnection } from "./integrations";
import { getQueuedActions } from "./offline";
import { getAllLockStates, type IntegrationLock } from "./deadManSwitch";
import { getPendingQueueCount } from "./boysQueue";

export interface ReconciliationServiceStatus {
  reachable: boolean;
  detail?: string;
}

export interface ReconciliationResult {
  ok: boolean;
  checkedAt: string;
  services: {
    backend: ReconciliationServiceStatus;
    localAI: ReconciliationServiceStatus;
    queue: { pendingCount: number; detail?: string };
  };
  warnings: string[];
}

async function pingWithTimeout(url: string, timeoutMs = 3000): Promise<{ ok: boolean; detail?: string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return { ok: res.ok, detail: res.ok ? undefined : `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : "Unreachable" };
  }
}

export async function reconcileSystemState(): Promise<ReconciliationResult> {
  const [backendPing, aiPing, queueCount] = await Promise.all([
    pingWithTimeout("http://127.0.0.1:5174/api/ping"),
    pingWithTimeout("http://127.0.0.1:5000/status"),
    getPendingQueueCount().catch(() => -1),
  ]);

  const warnings: string[] = [];

  if (!backendPing.ok) {
    warnings.push(`Backend unreachable: ${backendPing.detail ?? "no response"}`);
  }
  if (!aiPing.ok) {
    warnings.push(`Local AI unreachable: ${aiPing.detail ?? "no response"}`);
  }
  if (queueCount === -1) {
    warnings.push("Could not read queue count from database.");
  }

  return {
    ok: warnings.length === 0,
    checkedAt: new Date().toISOString(),
    services: {
      backend: { reachable: backendPing.ok, detail: backendPing.detail },
      localAI: { reachable: aiPing.ok, detail: aiPing.detail },
      queue: {
        pendingCount: queueCount,
        detail: queueCount === -1 ? "Read error" : `${queueCount} pending`,
      },
    },
    warnings,
  };
}

export type HealthStatus = "ok" | "warning" | "error" | "unknown" | "checking" | "locked";

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
  locks: IntegrationLock[];
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

  const [db, drive, notionFallback, locks] = await Promise.all([
    checkDatabase(),
    checkDrive(),
    getNotionFallbackStatus().catch(() => ({
      inFallback: false,
      lastError: "",
      lastErrorAt: null as string | null,
      pendingCount: 0,
    })),
    getAllLockStates().catch(() => [] as IntegrationLock[]),
  ]);

  notionFallbackError = notionFallback.lastError;
  notionFallbackAt = notionFallback.lastErrorAt;

  const notionLock = locks.find((l) => l.integration === "notion");
  const driveLock = locks.find((l) => l.integration === "drive");

  const resolvedDrive: ServiceHealth = driveLock?.locked
    ? {
        name: "drive",
        status: "locked",
        label: "Locked",
        detail: `Writes paused — ${driveLock.consecutive_failures} consecutive failures (last: ${driveLock.last_error_code || "unknown"})`,
        checkedAt: Date.now(),
      }
    : driveLock && driveLock.consecutive_failures > 0
    ? {
        ...drive,
        status: "warning",
        label: "Warning",
        detail: `${driveLock.consecutive_failures} failure${driveLock.consecutive_failures > 1 ? "s" : ""} — ${driveLock.last_error_code || drive.detail || ""}`,
      }
    : drive;

  const notion: ServiceHealth = notionLock?.locked
    ? {
        name: "notion",
        status: "locked",
        label: "Locked",
        detail: `Writes paused — ${notionLock.consecutive_failures} consecutive failures (last: ${notionLock.last_error_code || "unknown"})`,
        checkedAt: Date.now(),
      }
    : notionFallback.inFallback
    ? {
        name: "notion",
        status: "warning",
        label: "Warning",
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
  const recentErrors = collectRecentErrors(db, resolvedDrive, notion, notionFallbackError, notionFallbackAt);

  if (driveLock?.locked && driveLock.last_error_message) {
    recentErrors.unshift({
      service: "Google Drive",
      message: `LOCKED: ${driveLock.last_error_message}`,
      at: driveLock.locked_at ?? null,
    });
  }
  if (notionLock?.locked && notionLock.last_error_message) {
    recentErrors.unshift({
      service: "Notion",
      message: `LOCKED: ${notionLock.last_error_message}`,
      at: notionLock.locked_at ?? null,
    });
  }

  return {
    database: db,
    drive: resolvedDrive,
    notion,
    syncQueue,
    recentErrors,
    locks,
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
  if (statuses.includes("locked")) return "locked";
  if (statuses.includes("error")) return "error";
  if (statuses.includes("warning")) return "warning";
  return "ok";
}

export function hasLockedIntegration(health: SystemHealth): boolean {
  return health.locks.some((l) => l.locked);
}
