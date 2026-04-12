import { supabase } from "./supabase";

export type TrustLevel = "trusted" | "untrusted" | "quarantined";
export type ContentType = "email" | "attachment" | "document" | "paste" | "web";

export interface InjectionScanResult {
  trustLevel: TrustLevel;
  injectionDetected: boolean;
  injectionFlags: string[];
  blockedInstructions: string[];
  sandboxSummary: string;
  sandboxTags: string[];
  sandboxMetadata: Record<string, unknown>;
  rawContentHash: string;
  scannedAt: string;
}

export interface SandboxAnalysis {
  summary: string;
  tags: string[];
  metadata: Record<string, unknown>;
  flaggedAsSuspicious: boolean;
  suspicionReasons: string[];
}

const INJECTION_PATTERNS: { pattern: RegExp; flag: string }[] = [
  { pattern: /ignore\s+(all\s+)?previous\s+instructions?/i,         flag: "ignore-previous-instructions" },
  { pattern: /disregard\s+(all\s+)?previous\s+instructions?/i,      flag: "disregard-instructions" },
  { pattern: /forget\s+(all\s+)?previous\s+instructions?/i,          flag: "forget-instructions" },
  { pattern: /you\s+are\s+now\s+(?:a|an)\s+\w/i,                    flag: "role-override-attempt" },
  { pattern: /act\s+as\s+(?:a|an)\s+\w+\s+(?:without|ignoring)/i,   flag: "role-override-attempt" },
  { pattern: /new\s+system\s+prompt\s*:/i,                           flag: "system-prompt-injection" },
  { pattern: /\[system\]/i,                                           flag: "system-tag-injection" },
  { pattern: /<\s*system\s*>/i,                                       flag: "system-tag-injection" },
  { pattern: /###\s*system/i,                                         flag: "system-tag-injection" },
  { pattern: /do\s+not\s+follow\s+(?:your\s+)?(?:rules|guidelines|instructions)/i, flag: "rule-bypass-attempt" },
  { pattern: /bypass\s+(?:your\s+)?(?:safety|filter|restriction|guardrail)/i,      flag: "safety-bypass-attempt" },
  { pattern: /override\s+(?:your\s+)?(?:safety|filter|restriction|permission)/i,   flag: "permission-override-attempt" },
  { pattern: /grant\s+(?:me\s+)?(?:admin|root|superuser|full)\s+access/i,          flag: "privilege-escalation-attempt" },
  { pattern: /you\s+have\s+(?:sudo|admin|root)\s+(?:rights|access|privileges)/i,  flag: "privilege-escalation-attempt" },
  { pattern: /execute\s+(?:this\s+)?(?:command|code|script)\s*:/i,                 flag: "code-execution-attempt" },
  { pattern: /run\s+(?:this\s+)?(?:shell|bash|cmd|powershell|terminal)/i,          flag: "shell-execution-attempt" },
  { pattern: /eval\s*\(|exec\s*\(|system\s*\(/i,                                   flag: "code-execution-attempt" },
  { pattern: /\$\(\s*[a-z]/i,                                                        flag: "shell-substitution-attempt" },
  { pattern: /`[^`]{1,200}`/,                                                        flag: "shell-backtick-attempt" },
  { pattern: /change\s+(?:the\s+)?(?:team\s+role|permission|access\s+level)\s+(?:for|of)/i, flag: "role-change-attempt" },
  { pattern: /(?:add|remove|grant|revoke)\s+(?:admin|role|permission)\s+(?:to|from)/i,       flag: "permission-change-attempt" },
  { pattern: /print\s+(?:your\s+)?(?:system\s+prompt|instructions|configuration)/i,          flag: "prompt-extraction-attempt" },
  { pattern: /reveal\s+(?:your\s+)?(?:system\s+prompt|hidden\s+instructions|prompt)/i,       flag: "prompt-extraction-attempt" },
  { pattern: /show\s+(?:me\s+)?(?:your\s+)?(?:system\s+prompt|raw\s+instructions)/i,        flag: "prompt-extraction-attempt" },
  { pattern: /send\s+(?:all\s+)?(?:user\s+data|credentials|passwords|secrets)\s+to/i,        flag: "data-exfiltration-attempt" },
  { pattern: /exfiltrate|exfil\s+(?:data|credentials)/i,                                      flag: "data-exfiltration-attempt" },
];

const SUSPICIOUS_INDICATORS: { pattern: RegExp; reason: string }[] = [
  { pattern: /\{[^}]{0,200}\}/,                          reason: "Contains template-like curly braces" },
  { pattern: /<<[^>]{0,100}>>/,                           reason: "Contains double angle bracket markers" },
  { pattern: /\[\[.*?\]\]/,                               reason: "Contains double bracket markers" },
  { pattern: /---\s*BEGIN\s+INSTRUCTIONS?\s*---/i,        reason: "Contains instruction block markers" },
  { pattern: /---\s*END\s+INSTRUCTIONS?\s*---/i,          reason: "Contains instruction block markers" },
  { pattern: /CONFIDENTIAL:\s*(?:DO\s+NOT\s+)?READ/i,    reason: "Suspicious confidentiality marker" },
  { pattern: /https?:\/\/[^\s]{5,}/,                      reason: "Contains external URL" },
  { pattern: /data:\s*(?:text|application|image)\//i,    reason: "Contains data URI" },
  { pattern: /<script[\s>]/i,                             reason: "Contains script tag" },
  { pattern: /javascript:/i,                              reason: "Contains javascript: URI scheme" },
  { pattern: /vbscript:/i,                               reason: "Contains vbscript: URI scheme" },
  { pattern: /on(?:load|click|error|mouseover)\s*=/i,    reason: "Contains inline event handler" },
];

async function hashContent(text: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return "";
  }
}

function detectInjection(text: string): { flags: string[]; blocked: string[] } {
  const flags: string[] = [];
  const blocked: string[] = [];
  const seen = new Set<string>();

  for (const { pattern, flag } of INJECTION_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      if (!seen.has(flag)) {
        flags.push(flag);
        seen.add(flag);
      }
      const snippet = match[0].slice(0, 120);
      blocked.push(snippet);
    }
  }

  return { flags, blocked };
}

export function sandboxAnalyze(text: string): SandboxAnalysis {
  const suspicionReasons: string[] = [];

  for (const { pattern, reason } of SUSPICIOUS_INDICATORS) {
    if (pattern.test(text)) {
      suspicionReasons.push(reason);
    }
  }

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const charCount = text.length;

  const urlMatches = text.match(/https?:\/\/[^\s]+/g) ?? [];
  const emailMatches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? [];
  const dateMatches = text.match(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}(?:,\s*\d{4})?/gi) ?? [];

  const tags: string[] = [];
  if (urlMatches.length > 0) tags.push("contains-urls");
  if (emailMatches.length > 0) tags.push("contains-emails");
  if (dateMatches.length > 0) tags.push("contains-dates");
  if (wordCount > 500) tags.push("long-content");
  if (wordCount <= 50) tags.push("short-content");
  if (suspicionReasons.length > 0) tags.push("suspicious-patterns");

  const summaryText = lines.slice(0, 3).join(" ").slice(0, 300);
  const summary = summaryText
    ? `[SANDBOX] ${wordCount} words, ${lines.length} lines. Preview: "${summaryText}"`
    : `[SANDBOX] ${wordCount} words, ${charCount} chars.`;

  return {
    summary,
    tags,
    metadata: {
      wordCount,
      charCount,
      lineCount: lines.length,
      urlCount: urlMatches.length,
      emailCount: emailMatches.length,
      dateCount: dateMatches.length,
    },
    flaggedAsSuspicious: suspicionReasons.length > 0,
    suspicionReasons,
  };
}

export async function scanContent(
  text: string,
  contentRef: string,
  contentType: ContentType
): Promise<InjectionScanResult> {
  const scannedAt = new Date().toISOString();

  const { flags, blocked } = detectInjection(text);
  const injectionDetected = flags.length > 0;

  const sandbox = sandboxAnalyze(text);

  const trustLevel: TrustLevel = injectionDetected
    ? "quarantined"
    : sandbox.flaggedAsSuspicious
    ? "untrusted"
    : "untrusted";

  const rawContentHash = await hashContent(text);

  const result: InjectionScanResult = {
    trustLevel,
    injectionDetected,
    injectionFlags: flags,
    blockedInstructions: blocked,
    sandboxSummary: sandbox.summary,
    sandboxTags: [...sandbox.tags, ...(sandbox.suspicionReasons.length > 0 ? ["suspicious"] : [])],
    sandboxMetadata: sandbox.metadata,
    rawContentHash,
    scannedAt,
  };

  supabase.from("content_trust_labels").insert({
    content_ref: contentRef,
    content_type: contentType,
    trust_level: result.trustLevel,
    injection_detected: result.injectionDetected,
    injection_flags: result.injectionFlags,
    sandbox_summary: result.sandboxSummary,
    sandbox_tags: result.sandboxTags,
    sandbox_metadata: result.sandboxMetadata,
    blocked_instructions: result.blockedInstructions,
    raw_content_hash: result.rawContentHash,
    scanned_at: result.scannedAt,
  }).then().catch(() => {});

  return result;
}

export async function getTrustLabel(contentRef: string): Promise<InjectionScanResult | null> {
  const { data } = await supabase
    .from("content_trust_labels")
    .select("*")
    .eq("content_ref", contentRef)
    .order("scanned_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  return {
    trustLevel: data.trust_level as TrustLevel,
    injectionDetected: data.injection_detected,
    injectionFlags: data.injection_flags ?? [],
    blockedInstructions: data.blocked_instructions ?? [],
    sandboxSummary: data.sandbox_summary ?? "",
    sandboxTags: data.sandbox_tags ?? [],
    sandboxMetadata: data.sandbox_metadata ?? {},
    rawContentHash: data.raw_content_hash ?? "",
    scannedAt: data.scanned_at,
  };
}

export function getTrustColors(level: TrustLevel): { color: string; bg: string; border: string } {
  switch (level) {
    case "trusted":
      return { color: "#4ADE80", bg: "rgba(74,222,128,0.08)", border: "rgba(74,222,128,0.2)" };
    case "untrusted":
      return { color: "#F59E0B", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.25)" };
    case "quarantined":
      return { color: "#F87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.3)" };
  }
}

export function getTrustLabel2(level: TrustLevel): string {
  switch (level) {
    case "trusted":     return "Trusted";
    case "untrusted":   return "Untrusted";
    case "quarantined": return "Quarantined";
  }
}

export function isSafeToDisplay(result: InjectionScanResult): boolean {
  return !result.injectionDetected;
}

export function getSandboxOnlyText(text: string): string {
  const analysis = sandboxAnalyze(text);
  return analysis.summary;
}
