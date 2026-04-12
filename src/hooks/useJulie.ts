import { detectAndStore } from "../lib/julieDetector";

export function useJulie(sessionId: string) {
  function processMessage(content: string) {
    detectAndStore(content, sessionId);
  }

  return { processMessage };
}
