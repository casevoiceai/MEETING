import { useState, useEffect } from "react";
import {
  getConnectionStatus,
  getQueuedActions,
  onStatusChange,
  onQueueChange,
  type ConnectionStatus,
  type QueuedAction,
} from "./offline";

export interface OfflineState {
  status: ConnectionStatus;
  queuedCount: number;
  queuedActions: QueuedAction[];
  isOffline: boolean;
  isOnline: boolean;
  isSyncing: boolean;
}

export function useOffline(): OfflineState {
  const [status, setStatus] = useState<ConnectionStatus>(getConnectionStatus);
  const [queue, setQueue] = useState<QueuedAction[]>(getQueuedActions);

  useEffect(() => {
    const unsubStatus = onStatusChange(setStatus);
    const unsubQueue = onQueueChange(setQueue);
    return () => {
      unsubStatus();
      unsubQueue();
    };
  }, []);

  return {
    status,
    queuedCount: queue.length,
    queuedActions: queue,
    isOffline: status === "offline" || status === "unstable",
    isOnline: status === "online",
    isSyncing: status === "syncing",
  };
}
