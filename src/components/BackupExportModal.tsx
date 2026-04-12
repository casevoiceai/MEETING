import { useState, useEffect } from "react";
import {
  X,
  Download,
  FileJson,
  FileText,
  FileCode,
  HardDrive,
  Cloud,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Archive,
  MessageSquare,
  StickyNote,
  Folder,
  Layers,
  ChevronRight,
} from "lucide-react";
import {
  runExport,
  downloadBlob,
  type ExportFormat,
  type BackupScope,
  type BackupManifest,
} from "../lib/backup";
import { syncFileToDrive } from "../lib/integrations";

const BG = "#0D1B2E";
const CARD = "#111D30";
const BORDER = "#1B2A4A";
const MUTED = "#8A9BB5";
const DIM = "#3A4F6A";
const TEXT = "#D0DFEE";
const GOLD = "#C9A84C";

type ExportStep = "configure" | "exporting" | "done" | "error";

const FORMAT_OPTIONS: { id: ExportFormat; label: string; desc: string; icon: React.ReactNode }[] = [
  { id: "json", label: "JSON", desc: "Structured data — ideal for re-import and programmatic use", icon: <FileJson size={16} /> },
  { id: "markdown", label: "Markdown", desc: "Human-readable text with formatting — ideal for docs and review", icon: <FileText size={16} /> },
  { id: "html", label: "HTML", desc: "Styled web page — ideal for sharing and archiving", icon: <FileCode size={16} /> },
];

const SCOPE_OPTIONS: { key: keyof BackupScope; label: string; icon: React.ReactNode; desc: string }[] = [
  { key: "sessions", label: "Sessions", icon: <MessageSquare size={13} />, desc: "All sessions, transcripts and Julie reports" },
  { key: "notes", label: "Notes", icon: <StickyNote size={13} />, desc: "Side notes and project notes" },
  { key: "projects", label: "Projects", icon: <Layers size={13} />, desc: "Projects, tasks and related notes" },
  { key: "filesMetadata", label: "Files Metadata", icon: <Folder size={13} />, desc: "Vault file list and folder structure (no binary content)" },
];

interface Props {
  onClose: () => void;
  presetScope?: Partial<BackupScope>;
  title?: string;
  subtitle?: string;
}

function FormatCard({
  opt,
  selected,
  onClick,
}: {
  opt: (typeof FORMAT_OPTIONS)[0];
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-left w-full flex items-start gap-3 px-4 py-3 rounded-lg transition-all"
      style={{
        backgroundColor: selected ? "rgba(201,168,76,0.08)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${selected ? "rgba(201,168,76,0.35)" : BORDER}`,
        color: selected ? GOLD : TEXT,
      }}
    >
      <span className="mt-0.5 flex-shrink-0" style={{ color: selected ? GOLD : MUTED }}>{opt.icon}</span>
      <div>
        <p className="text-sm font-bold tracking-wider">{opt.label}</p>
        <p className="text-[11px] mt-0.5" style={{ color: MUTED }}>{opt.desc}</p>
      </div>
      {selected && <CheckCircle2 size={14} className="ml-auto mt-0.5 flex-shrink-0" style={{ color: GOLD }} />}
    </button>
  );
}

function ScopeToggle({
  opt,
  checked,
  onChange,
}: {
  opt: (typeof SCOPE_OPTIONS)[0];
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-all"
      style={{
        backgroundColor: checked ? "rgba(74,222,128,0.06)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${checked ? "rgba(74,222,128,0.2)" : BORDER}`,
      }}
    >
      <span style={{ color: checked ? "#4ADE80" : DIM }}>{opt.icon}</span>
      <div className="flex-1 text-left">
        <p className="text-xs font-bold" style={{ color: checked ? TEXT : MUTED }}>{opt.label}</p>
        <p className="text-[10px]" style={{ color: DIM }}>{opt.desc}</p>
      </div>
      <div
        className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: checked ? "#4ADE80" : "transparent", border: `1px solid ${checked ? "#4ADE80" : DIM}` }}
      >
        {checked && <CheckCircle2 size={10} style={{ color: "#0D1B2E" }} />}
      </div>
    </button>
  );
}

function CountBadge({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ backgroundColor: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}` }}>
      <span className="text-xs" style={{ color: MUTED }}>{label}</span>
      <span className="text-xs font-bold" style={{ color: TEXT }}>{count.toLocaleString()}</span>
    </div>
  );
}

export default function BackupExportModal({ onClose, presetScope, title, subtitle }: Props) {
  const [format, setFormat] = useState<ExportFormat>("json");
  const [scope, setScope] = useState<BackupScope>({
    sessions: presetScope?.sessions ?? true,
    notes: presetScope?.notes ?? true,
    projects: presetScope?.projects ?? true,
    filesMetadata: presetScope?.filesMetadata ?? true,
  });
  const [mirrorToDrive, setMirrorToDrive] = useState(false);
  const [step, setStep] = useState<ExportStep>("configure");
  const [progress, setProgress] = useState("");
  const [manifest, setManifest] = useState<BackupManifest | null>(null);
  const [error, setError] = useState("");
  const [lastBlob, setLastBlob] = useState<{ blob: Blob; filename: string } | null>(null);

  const anySelected = Object.values(scope).some(Boolean);

  function toggleScope(key: keyof BackupScope, v: boolean) {
    setScope((s) => ({ ...s, [key]: v }));
  }

  async function handleExport() {
    if (!anySelected) return;
    setStep("exporting");
    setError("");
    setProgress("Fetching data from database...");

    try {
      const { blob, filename, manifest: m } = await runExport(format, scope);
      setManifest(m);
      setLastBlob({ blob, filename });
      setProgress("Saving to local file...");
      downloadBlob(blob, filename);

      if (mirrorToDrive) {
        setProgress("Mirroring to Google Drive...");
        try {
          const text = await blob.text();
          await syncFileToDrive({
            localFileId: `backup_${Date.now()}`,
            sessionId: "backup",
            fileName: filename,
            fileContent: text,
            mimeType: blob.type,
            driveFolder: "backups",
          });
        } catch {
          // non-critical — local download already succeeded
        }
      }

      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
      setStep("error");
    }
  }

  function handleRedownload() {
    if (lastBlob) downloadBlob(lastBlob.blob, lastBlob.filename);
  }

  function handleReset() {
    setStep("configure");
    setManifest(null);
    setError("");
    setLastBlob(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
      <div
        className="w-full max-w-lg rounded-2xl shadow-2xl flex flex-col"
        style={{ backgroundColor: BG, border: `1px solid ${BORDER}`, maxHeight: "90vh" }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: BORDER }}>
          <div className="flex items-center gap-3">
            <Archive size={16} style={{ color: GOLD }} />
            <div>
              <p className="text-sm font-bold tracking-widest uppercase" style={{ color: TEXT }}>
                {title ?? "Backup & Export"}
              </p>
              {subtitle && (
                <p className="text-[10px] mt-0.5" style={{ color: MUTED }}>{subtitle}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="hover:opacity-70 transition-opacity">
            <X size={16} style={{ color: MUTED }} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          {step === "configure" && (
            <div className="flex flex-col gap-6">
              <div>
                <p className="text-[10px] font-bold tracking-widest uppercase mb-3" style={{ color: DIM }}>
                  Export Format
                </p>
                <div className="flex flex-col gap-2">
                  {FORMAT_OPTIONS.map((opt) => (
                    <FormatCard key={opt.id} opt={opt} selected={format === opt.id} onClick={() => setFormat(opt.id)} />
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold tracking-widest uppercase mb-3" style={{ color: DIM }}>
                  Data Scope
                </p>
                <div className="flex flex-col gap-2">
                  {SCOPE_OPTIONS.map((opt) => (
                    <ScopeToggle
                      key={opt.key}
                      opt={opt}
                      checked={scope[opt.key]}
                      onChange={(v) => toggleScope(opt.key, v)}
                    />
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold tracking-widest uppercase mb-3" style={{ color: DIM }}>
                  Destination
                </p>
                <div className="flex flex-col gap-2">
                  <div
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
                    style={{ backgroundColor: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.2)" }}
                  >
                    <HardDrive size={13} style={{ color: "#4ADE80" }} />
                    <div className="flex-1">
                      <p className="text-xs font-bold" style={{ color: TEXT }}>Local Download</p>
                      <p className="text-[10px]" style={{ color: DIM }}>Always saved to your device</p>
                    </div>
                    <CheckCircle2 size={12} style={{ color: "#4ADE80" }} />
                  </div>
                  <button
                    onClick={() => setMirrorToDrive((v) => !v)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all"
                    style={{
                      backgroundColor: mirrorToDrive ? "rgba(96,165,250,0.06)" : "rgba(255,255,255,0.02)",
                      border: `1px solid ${mirrorToDrive ? "rgba(96,165,250,0.2)" : BORDER}`,
                    }}
                  >
                    <Cloud size={13} style={{ color: mirrorToDrive ? "#60A5FA" : DIM }} />
                    <div className="flex-1 text-left">
                      <p className="text-xs font-bold" style={{ color: mirrorToDrive ? TEXT : MUTED }}>Mirror to Google Drive</p>
                      <p className="text-[10px]" style={{ color: DIM }}>Optional — uploads file to Drive backups folder</p>
                    </div>
                    <div
                      className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: mirrorToDrive ? "#60A5FA" : "transparent", border: `1px solid ${mirrorToDrive ? "#60A5FA" : DIM}` }}
                    >
                      {mirrorToDrive && <CheckCircle2 size={10} style={{ color: "#0D1B2E" }} />}
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === "exporting" && (
            <div className="flex flex-col items-center justify-center gap-4 py-12">
              <RefreshCw size={28} style={{ color: GOLD }} className="animate-spin" />
              <p className="text-sm font-semibold" style={{ color: TEXT }}>{progress}</p>
              <p className="text-xs" style={{ color: MUTED }}>This may take a moment...</p>
            </div>
          )}

          {step === "done" && manifest && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ backgroundColor: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.25)" }}>
                <CheckCircle2 size={18} style={{ color: "#4ADE80" }} />
                <div>
                  <p className="text-sm font-bold" style={{ color: "#4ADE80" }}>Export Complete</p>
                  <p className="text-[11px]" style={{ color: MUTED }}>File downloaded to your device</p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: DIM }}>
                  Export Summary
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <CountBadge label="Sessions" count={manifest.counts.sessions} />
                  <CountBadge label="Notes" count={manifest.counts.notes} />
                  <CountBadge label="Projects" count={manifest.counts.projects} />
                  <CountBadge label="Files" count={manifest.counts.files} />
                </div>
              </div>

              <div className="px-3 py-2.5 rounded-lg" style={{ backgroundColor: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}` }}>
                <p className="text-[10px] font-bold" style={{ color: DIM }}>Format</p>
                <p className="text-xs mt-0.5" style={{ color: MUTED }}>{manifest.format.toUpperCase()}</p>
              </div>
            </div>
          )}

          {step === "error" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl w-full" style={{ backgroundColor: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)" }}>
                <AlertTriangle size={16} style={{ color: "#F87171" }} />
                <div>
                  <p className="text-sm font-bold" style={{ color: "#F87171" }}>Export Failed</p>
                  <p className="text-[11px] mt-0.5" style={{ color: MUTED }}>{error}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t flex-shrink-0 flex items-center justify-between gap-3" style={{ borderColor: BORDER }}>
          {step === "configure" && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-bold tracking-wider uppercase hover:opacity-80 transition-opacity"
                style={{ color: MUTED, border: `1px solid ${BORDER}` }}
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                disabled={!anySelected}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold tracking-wider uppercase transition-all disabled:opacity-40"
                style={{ backgroundColor: GOLD, color: "#0D1B2E" }}
              >
                <Download size={13} />
                Export
                <ChevronRight size={12} />
              </button>
            </>
          )}

          {step === "exporting" && (
            <div className="w-full flex justify-center">
              <p className="text-xs" style={{ color: DIM }}>Please wait...</p>
            </div>
          )}

          {step === "done" && (
            <>
              <button
                onClick={handleRedownload}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold tracking-wider uppercase hover:opacity-80 transition-opacity"
                style={{ color: MUTED, border: `1px solid ${BORDER}` }}
              >
                <Download size={12} />
                Re-download
              </button>
              <div className="flex gap-2">
                <button
                  onClick={handleReset}
                  className="px-4 py-2 rounded-lg text-xs font-bold tracking-wider uppercase hover:opacity-80 transition-opacity"
                  style={{ color: MUTED, border: `1px solid ${BORDER}` }}
                >
                  Export Again
                </button>
                <button
                  onClick={onClose}
                  className="px-5 py-2 rounded-lg text-xs font-bold tracking-wider uppercase hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: GOLD, color: "#0D1B2E" }}
                >
                  Done
                </button>
              </div>
            </>
          )}

          {step === "error" && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-bold tracking-wider uppercase hover:opacity-80 transition-opacity"
                style={{ color: MUTED, border: `1px solid ${BORDER}` }}
              >
                Close
              </button>
              <button
                onClick={handleReset}
                className="px-5 py-2 rounded-lg text-xs font-bold tracking-wider uppercase hover:opacity-80 transition-opacity"
                style={{ backgroundColor: GOLD, color: "#0D1B2E" }}
              >
                Try Again
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
