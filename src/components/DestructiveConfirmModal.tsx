import { useState, useEffect, useRef } from "react";
import { AlertTriangle, X, ShieldAlert, Database, CheckCircle2 } from "lucide-react";
import { saveSnapshot, getRiskColors, getRiskLabel, getDefaultConfirmWord, type GuardrailConfig, type GuardrailRisk } from "../lib/guardrail";

const NAVY = "#0D1B2E";
const CARD = "#111D30";
const BORDER = "#1B2A4A";
const MUTED = "#8A9BB5";
const DIM = "#3A4F6A";
const TEXT = "#D0DFEE";

interface Props {
  config: GuardrailConfig;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export default function DestructiveConfirmModal({ config, onConfirm, onCancel }: Props) {
  const [backupConfirmed, setBackupConfirmed] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmWord = config.typedConfirmationWord ?? getDefaultConfirmWord(config.actionType);
  const colors = getRiskColors(config.risk);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, []);

  const backupReady = !config.requireBackupConfirmation || backupConfirmed;
  const typedReady = !config.requireTypedConfirmation || typedText.trim().toUpperCase() === confirmWord;
  const canProceed = backupReady && typedReady && !executing;

  async function handleConfirm() {
    if (!canProceed) return;
    setExecuting(true);
    setError(null);
    try {
      await saveSnapshot({
        actionType: config.actionType,
        targetId: config.targetId,
        targetLabel: config.targetLabel,
        confirmationText: typedText,
        backupConfirmed,
        snapshotData: config.snapshotData ?? {},
      });
      await onConfirm();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
      setExecuting(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && canProceed) handleConfirm();
    if (e.key === "Escape") onCancel();
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl flex flex-col shadow-2xl"
        style={{ backgroundColor: NAVY, border: `1px solid ${colors.border}` }}
        onKeyDown={handleKeyDown}
      >
        <div
          className="flex items-start gap-3 px-6 py-5 border-b rounded-t-2xl"
          style={{ borderColor: colors.border, backgroundColor: colors.bg }}
        >
          <div className="p-2 rounded-lg flex-shrink-0" style={{ backgroundColor: colors.bg, border: `1px solid ${colors.border}` }}>
            <AlertTriangle size={18} style={{ color: colors.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span
                className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded"
                style={{ color: colors.color, backgroundColor: colors.bg, border: `1px solid ${colors.border}` }}
              >
                {getRiskLabel(config.risk)} — Destructive Action
              </span>
            </div>
            <h2 className="text-sm font-bold mt-1" style={{ color: "#FFFFFF" }}>{config.title}</h2>
          </div>
          <button onClick={onCancel} className="p-1 rounded hover:opacity-70 transition-opacity flex-shrink-0">
            <X size={15} style={{ color: MUTED }} />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-5">
          <div className="rounded-xl p-4" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
            <p className="text-xs font-bold tracking-widest uppercase mb-1.5" style={{ color: MUTED }}>Consequence</p>
            <p className="text-sm leading-relaxed" style={{ color: TEXT }}>{config.consequence}</p>
          </div>

          {config.requireBackupConfirmation && (
            <div
              className="rounded-xl p-4 flex flex-col gap-3"
              style={{ backgroundColor: backupConfirmed ? "rgba(74,222,128,0.05)" : CARD, border: `1px solid ${backupConfirmed ? "rgba(74,222,128,0.25)" : BORDER}` }}
            >
              <div className="flex items-center gap-2">
                <Database size={14} style={{ color: backupConfirmed ? "#4ADE80" : MUTED }} />
                <p className="text-xs font-bold tracking-widest uppercase" style={{ color: backupConfirmed ? "#4ADE80" : MUTED }}>Backup Check</p>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: DIM }}>
                Before proceeding, confirm that a backup of this data exists or that you accept this action is irreversible.
              </p>
              <label className="flex items-center gap-3 cursor-pointer group">
                <div
                  className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all"
                  style={{
                    backgroundColor: backupConfirmed ? "#4ADE80" : "transparent",
                    border: `2px solid ${backupConfirmed ? "#4ADE80" : BORDER}`,
                  }}
                  onClick={() => setBackupConfirmed((v) => !v)}
                >
                  {backupConfirmed && <CheckCircle2 size={12} style={{ color: "#0D1B2E" }} />}
                </div>
                <span
                  className="text-xs font-semibold leading-relaxed"
                  style={{ color: backupConfirmed ? "#4ADE80" : TEXT }}
                  onClick={() => setBackupConfirmed((v) => !v)}
                >
                  I confirm a backup exists, or I accept that this action cannot be undone
                </span>
              </label>
            </div>
          )}

          {config.requireTypedConfirmation && (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold tracking-widest uppercase" style={{ color: MUTED }}>
                Type <span style={{ color: colors.color, fontFamily: "monospace" }}>{confirmWord}</span> to confirm
              </label>
              <input
                ref={inputRef}
                type="text"
                className="w-full text-sm px-3 py-2.5 rounded-xl outline-none font-mono tracking-wider"
                style={{
                  backgroundColor: CARD,
                  color: typedReady ? colors.color : "#FFFFFF",
                  border: `1px solid ${typedReady ? colors.border : BORDER}`,
                  transition: "border-color 0.15s, color 0.15s",
                }}
                value={typedText}
                onChange={(e) => setTypedText(e.target.value.toUpperCase())}
                placeholder={confirmWord}
                autoComplete="off"
                spellCheck={false}
              />
              {typedText && !typedReady && (
                <p className="text-[10px]" style={{ color: DIM }}>Keep typing — must match exactly</p>
              )}
            </div>
          )}

          {error && (
            <p className="text-xs px-3 py-2.5 rounded-lg" style={{ backgroundColor: "rgba(248,113,113,0.1)", color: "#F87171", border: "1px solid rgba(248,113,113,0.25)" }}>
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: BORDER }}>
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-80 transition-opacity"
            style={{ backgroundColor: CARD, color: MUTED, border: `1px solid ${BORDER}` }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canProceed}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold tracking-wider uppercase transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ backgroundColor: canProceed ? colors.buttonBg : "#1B2A4A", color: "#FFFFFF" }}
          >
            {executing ? (
              <>
                <div className="w-3.5 h-3.5 border-2 rounded-full animate-spin" style={{ borderColor: "rgba(255,255,255,0.2)", borderTopColor: "#FFFFFF" }} />
                Processing...
              </>
            ) : (
              <>
                <ShieldAlert size={13} />
                Confirm Action
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
