export type MemoryItemType =
  | "question"
  | "task"
  | "decision"
  | "topic"
  | "file"
  | "note";

export interface MemoryItem {
  id: string;
  type: MemoryItemType;
  content: string;
  createdAt: number;
  sessionId: string;
  linkedIds?: string[];
  status?: "open" | "resolved";
}

let memoryStore: MemoryItem[] = [];

export function addMemoryItem(item: MemoryItem) {
  memoryStore.push(item);
}

export function getMemoryBySession(sessionId: string) {
  return memoryStore.filter((m) => m.sessionId === sessionId);
}

export function getOpenItems(sessionId: string) {
  return memoryStore.filter(
    (m) => m.sessionId === sessionId && m.status !== "resolved"
  );
}

export function resolveMemoryItem(id: string) {
  memoryStore = memoryStore.map((m) =>
    m.id === id ? { ...m, status: "resolved" } : m
  );
}
