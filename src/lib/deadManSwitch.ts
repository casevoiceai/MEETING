import { supabase } from "./supabase";

export type IntegrationName = "notion" | "drive";

export interface IntegrationLock {
  id: string;
  integration: IntegrationName;
  locked: boolean;
  consecutive_failures: number;
  locked_at: string | null;
  last_error_code: string;
  last_error_message: string;
  affected_operations: string[];
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FailureRecord {
  id: string;
  integration: IntegrationName;
  error_code: string;
  error_message: string;
  operation: string;
  created_at: string;
}

const LOCK_THRESHOLD = 3;

export function extractErrorCode(error: string): string {
  if (/\b401\b/.test(error)) return "401";
  if (/\b403\b/.test(error)) return "403";
  if (/\b404\b/.test(error)) return "404";
  if (/network|fetch|timeout|aborted|unreachable/i.test(error)) return "network";
  const match = error.match(/\b([45]\d{2})\b/);
  if (match) return match[1];
  return "unknown";
}

export async function getLockState(integration: IntegrationName): Promise<IntegrationLock | null> {
  const { data, error } = await supabase
    .from("integration_locks")
    .select("*")
    .eq("integration", integration)
    .maybeSingle();
  if (error) return null;
  return data as IntegrationLock | null;
}

export async function getAllLockStates(): Promise<IntegrationLock[]> {
  const { data } = await supabase
    .from("integration_locks")
    .select("*")
    .order("integration");
  return (data ?? []) as IntegrationLock[];
}

export async function recordFailure(
  integration: IntegrationName,
  errorMessage: string,
  operation: string
): Promise<{ locked: boolean; consecutiveFailures: number }> {
  const errorCode = extractErrorCode(errorMessage);

  await supabase.from("integration_failure_log").insert({
    integration,
    error_code: errorCode,
    error_message: errorMessage,
    operation,
  });

  const current = await getLockState(integration);
  const prev = current?.consecutive_failures ?? 0;
  const newCount = prev + 1;
  const shouldLock = newCount >= LOCK_THRESHOLD;

  const update: Record<string, unknown> = {
    consecutive_failures: newCount,
    last_error_code: errorCode,
    last_error_message: errorMessage,
    affected_operations: Array.from(
      new Set([...(current?.affected_operations ?? []), operation])
    ),
    updated_at: new Date().toISOString(),
  };

  if (shouldLock && !current?.locked) {
    update.locked = true;
    update.locked_at = new Date().toISOString();
    update.resolved_at = null;
  }

  await supabase
    .from("integration_locks")
    .update(update)
    .eq("integration", integration);

  return { locked: shouldLock, consecutiveFailures: newCount };
}

export async function recordSuccess(integration: IntegrationName): Promise<void> {
  const current = await getLockState(integration);
  if (!current) return;

  if (current.consecutive_failures === 0 && !current.locked) return;

  await supabase
    .from("integration_locks")
    .update({
      consecutive_failures: 0,
      last_error_code: "",
      last_error_message: "",
      affected_operations: [],
      updated_at: new Date().toISOString(),
    })
    .eq("integration", integration);
}

export async function resolveLock(integration: IntegrationName): Promise<void> {
  await supabase
    .from("integration_locks")
    .update({
      locked: false,
      consecutive_failures: 0,
      last_error_code: "",
      last_error_message: "",
      affected_operations: [],
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("integration", integration);
}

export async function isLocked(integration: IntegrationName): Promise<boolean> {
  const state = await getLockState(integration);
  return state?.locked ?? false;
}

export async function getRecentFailures(
  integration: IntegrationName,
  limit = 20
): Promise<FailureRecord[]> {
  const { data } = await supabase
    .from("integration_failure_log")
    .select("*")
    .eq("integration", integration)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as FailureRecord[];
}
