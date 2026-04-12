import { addMemoryItem } from "./julieMemory";

export function detectAndStore(content: string, sessionId: string) {
  const lower = content.toLowerCase();

  if (content.includes("?")) {
    addMemoryItem({
      id: crypto.randomUUID(),
      type: "question",
      content,
      createdAt: Date.now(),
      sessionId,
      status: "open",
    });
  }

  if (lower.includes("we should") || lower.includes("let's")) {
    addMemoryItem({
      id: crypto.randomUUID(),
      type: "task",
      content,
      createdAt: Date.now(),
      sessionId,
      status: "open",
    });
  }

  if (lower.includes("we decided") || lower.includes("decision")) {
    addMemoryItem({
      id: crypto.randomUUID(),
      type: "decision",
      content,
      createdAt: Date.now(),
      sessionId,
      status: "open",
    });
  }
}
