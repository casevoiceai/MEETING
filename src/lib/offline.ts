import { supabase } from "./supabase";

export type ConnectionStatus = "online" | "offline" | "unstable" | "syncing" | "sync_error";

export interface QueuedAction {
  id: string;
  type: "insert" | "update" | "delete" | "upsert";
  table: string;
  payload: Record<string, unknown>;
  matchColumn?: string;
  matchValue?: string;
  createdAt: number;
  retries: number;
  label?: string;
}

type StatusListener = (status: ConnectionStatus) => void;
type QueueListener = (queue: QueuedAction[]) => void;

const QUEUE_STORAGE_KEY = "offline_action_queue";
const PING_INTERVAL_MS = 8000;
const UNSTABLE_THRESHOLD_MS = 3000;

let currentStatus: ConnectionStatus = navigator.onLine ? "online" : "offline";
let actionQueue: QueuedAction[] = loadQueueFromStorage();
let pingTimer: ReturnType<typeof setInterval> | null = null;
let lastPingSuccess = Date.now();
let isSyncing = false;

const statusListeners = new Set<StatusListener>();
const queueListeners = new Set<QueueListener>();

function loadQueueFromStorage(): QueuedAction[] {
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as QueuedAction[]) : [];
  } catch {
    return [];
  }
}

function saveQueueToStorage(): void {
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(actionQueue));
  } catch {}
}

function emitStatus(status: ConnectionStatus): void {
  if (currentStatus === status) return;
  currentStatus = status;
  statusListeners.forEach((fn) => fn(status));
}

function emitQueue(): void {
  const snapshot = [...actionQueue];
  queueListeners.forEach((fn) => fn(snapshot));
}

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function pingSupabase(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const { error } = await supabase.from("approval_log").select("id").limit(1).abortSignal(controller.signal);
    clearTimeout(timer);
    return !error;
  } catch {
    return false;
  }
}

async function executeSingleAction(action: QueuedAction): Promise<void> {
  if (action.type === "insert") {
    const { error } = await supabase.from(action.table).insert(action.payload);
    if (error) throw error;
  } else if (action.type === "upsert") {
    const { error } = await supabase.from(action.table).upsert(action.payload);
    if (error) throw error;
  } else if (action.type === "update") {
    if (!action.matchColumn || action.matchValue == null) return;
    const { error } = await supabase
      .from(action.table)
      .update(action.payload)
      .eq(action.matchColumn, action.matchValue);
    if (error) throw error;
  } else if (action.type === "delete") {
    if (!action.matchColumn || action.matchValue == null) return;
    const { error } = await supabase
      .from(action.table)
      .delete()
      .eq(action.matchColumn, action.matchValue);
    if (error) throw error;
  }
}

async function drainQueue(): Promise<void> {
  if (isSyncing || actionQueue.length === 0) return;
  isSyncing = true;
  emitStatus("syncing");

  const toProcess = [...actionQueue];
  let hadError = false;

  for (const action of toProcess) {
    try {
      await executeSingleAction(action);
      actionQueue = actionQueue.filter((a) => a.id !== action.id);
      saveQueueToStorage();
      emitQueue();
    } catch {
      action.retries += 1;
      if (action.retries >= 5) {
        actionQueue = actionQueue.filter((a) => a.id !== action.id);
        saveQueueToStorage();
        emitQueue();
      }
      hadError = true;
      break;
    }
  }

  isSyncing = false;

  if (hadError) {
    emitStatus("sync_error");
    setTimeout(() => {
      if (currentStatus === "sync_error") emitStatus("online");
    }, 5000);
  } else {
    emitStatus("online");
  }
}

async function checkConnection(): Promise<void> {
  if (!navigator.onLine) {
    emitStatus("offline");
    return;
  }

  const ok = await pingSupabase();
  const now = Date.now();

  if (!ok) {
    const elapsed = now - lastPingSuccess;
    if (elapsed > UNSTABLE_THRESHOLD_MS) {
      emitStatus("unstable");
    } else {
      emitStatus("offline");
    }
    return;
  }

  lastPingSuccess = now;

  if (currentStatus !== "syncing") {
    if (actionQueue.length > 0) {
      await drainQueue();
    } else {
      emitStatus("online");
    }
  }
}

function startMonitoring(): void {
  if (pingTimer) return;

  window.addEventListener("online", () => {
    checkConnection();
  });

  window.addEventListener("offline", () => {
    emitStatus("offline");
  });

  pingTimer = setInterval(() => {
    checkConnection();
  }, PING_INTERVAL_MS);

  checkConnection();
}

startMonitoring();

export function getConnectionStatus(): ConnectionStatus {
  return currentStatus;
}

export function getQueuedActions(): QueuedAction[] {
  return [...actionQueue];
}

export function onStatusChange(fn: StatusListener): () => void {
  statusListeners.add(fn);
  return () => statusListeners.delete(fn);
}

export function onQueueChange(fn: QueueListener): () => void {
  queueListeners.add(fn);
  return () => queueListeners.delete(fn);
}

export function enqueueAction(
  action: Omit<QueuedAction, "id" | "createdAt" | "retries">
): void {
  const entry: QueuedAction = {
    ...action,
    id: generateId(),
    createdAt: Date.now(),
    retries: 0,
  };
  actionQueue.push(entry);
  saveQueueToStorage();
  emitQueue();
}

export async function executeSafe<T>(
  fn: () => Promise<T>,
  fallback: {
    table: string;
    type: QueuedAction["type"];
    payload: Record<string, unknown>;
    matchColumn?: string;
    matchValue?: string;
    label?: string;
  }
): Promise<T | null> {
  if (currentStatus === "offline" || currentStatus === "unstable") {
    enqueueAction(fallback);
    return null;
  }
  try {
    return await fn();
  } catch (err) {
    const isNetworkError =
      err instanceof TypeError && err.message.toLowerCase().includes("fetch");
    if (isNetworkError) {
      emitStatus("unstable");
      enqueueAction(fallback);
      return null;
    }
    throw err;
  }
}

export function triggerManualSync(): void {
  checkConnection();
}
