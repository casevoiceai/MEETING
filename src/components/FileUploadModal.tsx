import { useState, useRef, DragEvent } from "react";
import { Upload, X, File, Image, FileText, Plus, Shield, ShieldAlert, ShieldX, ShieldCheck } from "lucide-react";
import { uploadFileToVault, type VaultFile, type VaultFolder, type Project } from "../lib/db";
import { getStatusColors, getStatusLabel, type QuarantineStatus } from "../lib/quarantine";

const GOLD = "#C9A84C";
const NAVY = "#0D1B2E";
const CARD = "#111D30";
const BORDER = "#1B2A4A";
const MUTED = "#8A9BB5";
const TEXT = "#D0DFEE";

const ALLOWED_TYPES = [
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpg",
  "image/jpeg",
];
const ALLOWED_EXTS = [".pdf", ".txt", ".doc", ".docx", ".png", ".jpg", ".jpeg"];

function FileIcon({ mimeType, size = 20 }: { mimeType: string; size?: number }) {
  if (mimeType.startsWith("image/")) return <Image size={size} style={{ color: "#60A5FA" }} />;
  if (mimeType === "application/pdf") return <FileText size={size} style={{ color: "#F87171" }} />;
  return <File size={size} style={{ color: GOLD }} />;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ScanStatusIcon({ status }: { status: QuarantineStatus | null }) {
  if (!status) return <Shield size={14} style={{ color: MUTED }} />;
  switch (status) {
    case "clean":       return <ShieldCheck size={14} style={{ color: "#4ADE80" }} />;
    case "quarantined": return <ShieldAlert size={14} style={{ color: "#F59E0B" }} />;
    case "blocked":     return <ShieldX size={14} style={{ color: "#F87171" }} />;
    default:            return <Shield size={14} style={{ color: MUTED }} />;
  }
}

interface Props {
  onClose: () => void;
  onUploaded: (file: VaultFile) => void;
  folders: VaultFolder[];
  projects: Project[];
  defaultSessionId?: string | null;
  defaultProjectId?: string | null;
  defaultFolderId?: string | null;
}

export default function FileUploadModal({
  onClose,
  onUploaded,
  folders,
  projects,
  defaultSessionId = null,
  defaultProjectId = null,
  defaultFolderId = null,
}: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [summary, setSummary] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [folderId, setFolderId] = useState<string | null>(defaultFolderId);
  const [projectId, setProjectId] = useState<string | null>(defaultProjectId);
  const [uploading, setUploading] = useState(false);
  const [scanPhase, setScanPhase] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<{ status: QuarantineStatus; reason: string } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function validateFile(file: File): string | null {
    const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
    const allowed = ALLOWED_TYPES.includes(file.type) || ALLOWED_EXTS.includes(ext);
    if (!allowed) return `File type not supported. Allowed: PDF, TXT, DOCX, PNG, JPG`;
    if (file.size > 50 * 1024 * 1024) return "File must be under 50 MB";
    return null;
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    const err = validateFile(file);
    if (err) { setFileError(err); setSelectedFile(null); return; }
    setFileError(null);
    setScanResult(null);
    setUploadError(null);
    setSelectedFile(file);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  function addTag() {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags((p) => [...p, t]);
    setTagInput("");
  }

  async function handleUpload() {
    if (!selectedFile) return;
    setUploading(true);
    setUploadError(null);
    setScanResult(null);
    setScanPhase("Scanning file for threats...");
    try {
      const record = await uploadFileToVault(selectedFile, {
        folderId,
        linkedSessionId: defaultSessionId,
        linkedProjectId: projectId,
        tags,
        summary,
        onScanProgress: (phase) => setScanPhase(phase),
      });

      setScanResult({ status: record.quarantine_status, reason: record.quarantine_reason });

      if (record.quarantine_status === "blocked") {
        setUploadError(`File blocked: ${record.quarantine_reason}`);
        setUploading(false);
        setScanPhase(null);
        return;
      }

      onUploaded(record);
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      setUploadError(msg);
      if (msg.toLowerCase().includes("blocked")) {
        setScanResult({ status: "blocked", reason: msg });
      }
    } finally {
      setUploading(false);
      setScanPhase(null);
    }
  }

  const scanColors = scanResult ? getStatusColors(scanResult.status) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-2xl flex flex-col"
        style={{ backgroundColor: NAVY, border: `1px solid ${BORDER}`, maxHeight: "90vh" }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: BORDER }}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: "rgba(201,168,76,0.15)" }}>
              <Upload size={16} style={{ color: GOLD }} />
            </div>
            <h2 className="text-base font-bold tracking-wide" style={{ color: "#FFFFFF" }}>Upload File</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-lg" style={{ backgroundColor: "rgba(201,168,76,0.06)", color: MUTED, border: `1px solid ${BORDER}` }}>
              <Shield size={10} style={{ color: GOLD }} />
              Malware Scan Active
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:opacity-70 transition-opacity">
              <X size={16} style={{ color: MUTED }} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          <div
            className="rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 cursor-pointer transition-all"
            style={{
              borderColor: dragOver ? GOLD : BORDER,
              backgroundColor: dragOver ? "rgba(201,168,76,0.07)" : CARD,
              minHeight: "160px",
              padding: "2rem",
            }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            {selectedFile ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <FileIcon mimeType={selectedFile.type} size={36} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: "#FFFFFF" }}>{selectedFile.name}</p>
                  <p className="text-xs mt-1" style={{ color: MUTED }}>{formatSize(selectedFile.size)}</p>
                </div>
                <button
                  className="text-xs px-3 py-1 rounded-lg"
                  style={{ backgroundColor: BORDER, color: MUTED }}
                  onClick={(e) => { e.stopPropagation(); setSelectedFile(null); setScanResult(null); }}
                >
                  Change file
                </button>
              </div>
            ) : (
              <>
                <div className="p-4 rounded-full" style={{ backgroundColor: "rgba(201,168,76,0.1)" }}>
                  <Upload size={28} style={{ color: GOLD }} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold" style={{ color: TEXT }}>Drop file here or click to browse</p>
                  <p className="text-xs mt-1" style={{ color: MUTED }}>PDF, TXT, DOCX, PNG, JPG — up to 50 MB</p>
                </div>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept={ALLOWED_EXTS.join(",")}
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>

          {fileError && (
            <p className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#F87171" }}>
              {fileError}
            </p>
          )}

          {scanPhase && (
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg" style={{ backgroundColor: "rgba(201,168,76,0.06)", border: `1px solid rgba(201,168,76,0.2)` }}>
              <div className="w-3.5 h-3.5 border-2 rounded-full animate-spin flex-shrink-0" style={{ borderColor: `rgba(201,168,76,0.2)`, borderTopColor: GOLD }} />
              <p className="text-xs font-semibold" style={{ color: GOLD }}>{scanPhase}</p>
            </div>
          )}

          {scanResult && !scanPhase && (
            <div
              className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg"
              style={{ backgroundColor: scanColors?.bg, border: `1px solid ${scanColors?.border}` }}
            >
              <ScanStatusIcon status={scanResult.status} />
              <div className="min-w-0">
                <p className="text-xs font-bold tracking-widest uppercase" style={{ color: scanColors?.color }}>
                  {getStatusLabel(scanResult.status)}
                </p>
                {scanResult.reason && (
                  <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color: MUTED }}>{scanResult.reason}</p>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-bold tracking-widest uppercase mb-1.5 block" style={{ color: MUTED }}>Summary <span style={{ color: "#3A4F6A" }}>(optional)</span></label>
            <textarea
              className="w-full resize-none text-sm rounded-xl p-3 outline-none"
              style={{ backgroundColor: CARD, color: TEXT, border: `1px solid ${BORDER}`, minHeight: "64px" }}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Briefly describe this file..."
            />
          </div>

          <div>
            <label className="text-xs font-bold tracking-widest uppercase mb-1.5 block" style={{ color: MUTED }}>Tags <span style={{ color: "#3A4F6A" }}>(optional)</span></label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-semibold"
                  style={{ backgroundColor: "rgba(201,168,76,0.15)", color: GOLD }}>
                  {t}
                  <button onClick={() => setTags((p) => p.filter((x) => x !== t))} className="opacity-60 hover:opacity-100">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 text-sm px-3 py-2 rounded-lg outline-none"
                style={{ backgroundColor: CARD, color: "#FFFFFF", border: `1px solid ${BORDER}` }}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                placeholder="Type tag and press Enter..."
              />
              <button onClick={addTag} className="px-3 py-2 rounded-lg" style={{ backgroundColor: "rgba(201,168,76,0.15)", color: GOLD }}>
                <Plus size={14} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold tracking-widest uppercase mb-1.5 block" style={{ color: MUTED }}>Folder</label>
              <select
                className="w-full text-sm px-3 py-2 rounded-lg outline-none"
                style={{ backgroundColor: CARD, color: TEXT, border: `1px solid ${BORDER}` }}
                value={folderId ?? ""}
                onChange={(e) => setFolderId(e.target.value || null)}
              >
                <option value="">No folder</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold tracking-widest uppercase mb-1.5 block" style={{ color: MUTED }}>Link to Project</label>
              <select
                className="w-full text-sm px-3 py-2 rounded-lg outline-none"
                style={{ backgroundColor: CARD, color: TEXT, border: `1px solid ${BORDER}` }}
                value={projectId ?? ""}
                onChange={(e) => setProjectId(e.target.value || null)}
              >
                <option value="">No project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          {defaultSessionId && (
            <p className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: "rgba(201,168,76,0.07)", color: MUTED }}>
              This file will be automatically linked to the current session.
            </p>
          )}

          {uploadError && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg" style={{ backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)" }}>
              <ShieldX size={13} style={{ color: "#F87171", flexShrink: 0, marginTop: 1 }} />
              <p className="text-xs" style={{ color: "#F87171" }}>{uploadError}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t flex-shrink-0" style={{ borderColor: BORDER }}>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ backgroundColor: CARD, color: MUTED, border: `1px solid ${BORDER}` }}
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold tracking-wider uppercase transition-all disabled:opacity-40"
            style={{ backgroundColor: GOLD, color: NAVY }}
          >
            {uploading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 rounded-full animate-spin" style={{ borderColor: `${NAVY}40`, borderTopColor: NAVY }} />
                {scanPhase ? "Scanning..." : "Uploading..."}
              </>
            ) : (
              <>
                <Shield size={14} />
                Scan & Upload
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
