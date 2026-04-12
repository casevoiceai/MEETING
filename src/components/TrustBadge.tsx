import { Shield, ShieldAlert, ShieldOff, ShieldCheck, AlertTriangle } from "lucide-react";
import { getTrustColors, getTrustLabel2, type TrustLevel, type InjectionScanResult } from "../lib/injectionGuard";

interface TrustBadgeProps {
  level: TrustLevel;
  compact?: boolean;
}

export function TrustBadge({ level, compact = false }: TrustBadgeProps) {
  const { color, bg, border } = getTrustColors(level);
  const label = getTrustLabel2(level);

  const Icon = level === "trusted"
    ? ShieldCheck
    : level === "quarantined"
    ? ShieldOff
    : Shield;

  if (compact) {
    return (
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase flex-shrink-0"
        style={{ color, backgroundColor: bg, border: `1px solid ${border}` }}
        title={label}
      >
        <Icon size={8} />
        {label}
      </span>
    );
  }

  return (
    <div
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wider uppercase"
      style={{ color, backgroundColor: bg, border: `1px solid ${border}` }}
    >
      <Icon size={10} />
      {label}
    </div>
  );
}

interface InjectionWarningProps {
  result: InjectionScanResult;
  onDismiss?: () => void;
}

export function InjectionWarning({ result, onDismiss }: InjectionWarningProps) {
  if (!result.injectionDetected && result.trustLevel !== "quarantined") return null;

  const isInjection = result.injectionDetected;

  return (
    <div
      className="rounded-lg px-4 py-3 flex flex-col gap-2"
      style={{
        backgroundColor: isInjection ? "rgba(248,113,113,0.07)" : "rgba(245,158,11,0.07)",
        border: `1px solid ${isInjection ? "rgba(248,113,113,0.3)" : "rgba(245,158,11,0.3)"}`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldAlert size={13} style={{ color: isInjection ? "#F87171" : "#F59E0B", flexShrink: 0 }} />
          <p className="text-xs font-bold" style={{ color: isInjection ? "#F87171" : "#F59E0B" }}>
            {isInjection ? "Prompt Injection Detected" : "Suspicious Content Flagged"}
          </p>
        </div>
        {onDismiss && (
          <button onClick={onDismiss} className="text-[10px] opacity-60 hover:opacity-90 flex-shrink-0" style={{ color: "#8A9BB5" }}>
            dismiss
          </button>
        )}
      </div>

      {isInjection && result.injectionFlags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {result.injectionFlags.map((flag) => (
            <span
              key={flag}
              className="text-[9px] font-bold px-1.5 py-0.5 rounded"
              style={{ color: "#F87171", backgroundColor: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.2)" }}
            >
              {flag}
            </span>
          ))}
        </div>
      )}

      <p className="text-[10px]" style={{ color: "#8A9BB5" }}>
        {isInjection
          ? "Instructions embedded in this content have been blocked and will not be executed. The content is safe to read but cannot alter system behavior."
          : "This content was flagged for suspicious patterns. It is displayed in read-only sandbox mode."}
      </p>

      {isInjection && result.blockedInstructions.length > 0 && (
        <div className="mt-1">
          <p className="text-[9px] font-bold tracking-wider uppercase mb-1" style={{ color: "#607A96" }}>
            Blocked Instructions
          </p>
          {result.blockedInstructions.slice(0, 3).map((instr, i) => (
            <div
              key={i}
              className="text-[9px] px-2 py-1 rounded mb-1 font-mono break-all"
              style={{ backgroundColor: "rgba(248,113,113,0.06)", color: "#8A9BB5", border: "1px solid rgba(248,113,113,0.1)" }}
            >
              &ldquo;{instr.slice(0, 100)}{instr.length > 100 ? "…" : ""}&rdquo;
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface SandboxBannerProps {
  contentType: string;
}

export function SandboxBanner({ contentType }: SandboxBannerProps) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
      style={{ backgroundColor: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)" }}
    >
      <AlertTriangle size={10} style={{ color: "#F59E0B", flexShrink: 0 }} />
      <p className="text-[9px] font-semibold" style={{ color: "#F59E0B" }}>
        SANDBOX MODE — External {contentType} content. Read-only. Cannot execute commands or alter system logic.
      </p>
    </div>
  );
}
