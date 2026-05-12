export type WatcherEvent = {
  time: number;
  system: "backend" | "ai" | "drive" | "env" | "recon";
  status: "ok" | "fail";
  detail: string;
  duration?: number;
};

const MAX_LOG = 200;

function getLog(): WatcherEvent[] {
  try {
    return JSON.parse(localStorage.getItem("watcher_log") || "[]");
  } catch {
    return [];
  }
}

function saveLog(log: WatcherEvent[]) {
  localStorage.setItem("watcher_log", JSON.stringify(log.slice(-MAX_LOG)));
}

export function logWatcherEvent(event: WatcherEvent) {
  const log = getLog();
  log.push(event);
  saveLog(log);
}

export function getRecentWatcherEvents(): WatcherEvent[] {
  return getLog().slice(-20).reverse();
}