import { getOpenItems } from "./julieMemory";

export function getCarryover(sessionId: string) {
  return getOpenItems(sessionId);
}
