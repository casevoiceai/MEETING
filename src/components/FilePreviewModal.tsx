import { useState, useEffect } from "react";
import { X, Download, Tag, FileText, Image as ImageIcon, File, ExternalLink, Plus, Check, Shield, ShieldAlert, ShieldX, ShieldCheck } from "lucide-react";
import { getVaultFileUrl, updateVaultFile, upsertTags, type VaultFile, type Project, type Session } from "../lib/db";
import { isAccessBlocked, getStatusColors, getStatusLabel } from "../lib/quarantine";

const GOLD = "#C9A84C";
const NAVY = "#0D1B2E";
const CARD = "#111D30";
const BORDER = "#1B2A4A";
const MUTED = "#8A9BB5";
const DIM = "#3A4F6A";
const TEXT = "#D0DFEE";

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function TypeIcon({ fileType, mimeType, size = 24 }: { fileType: string; mimeType: string | null; size?: number }) {
  if (fileType === "image" || mimeType?.startsWith("image/")) return <ImageIcon size={size} style={{ color: "#60A5FA" }} />;
  if (fileType === "pdf" || mimeType === "application/pdf") return <FileText size={size} style={{ color: "#F87171" }} />;
  return <File size={size} style={{ color: GOLD }} />;
}

function QuarantinePanel({ status, reason, scannedAt }: { status: string; reason: string; scannedAt: string | null }) {
  const colors = getStatusColors(status);
  const label = getStatusLabel(status);
  const Icon = status === "blocked" ? ShieldX : ShieldAlert;
  return (
    <div
      className="flex items-start gap-3 px-4 py-3 rounded-xl"
      style={{ backgroundColor: colors.bg, border: `1px solid ${colors.border}` }}
    >
      <Icon size={16} style={{ color: colors.color, flexShrink: 0, marginTop: 1 }} />
      <div>
        <p className="text-xs font-bold tracking-widest uppercase" style={{ color: colors.color }}>{label}</p>
        {reason && (
          <p className="text-[10px] mt-1 leading-relaxed" style={{ color: MUTED }}>{reason}</p>
        )}
        {scannedAt && (
          <p className="text-[9px] mt-1.5" style={{ color: DIM }}>Scanned {new Date(scannedAt).toLocaleString()}</p>
        )}
      </div>
    </div>
  );
}

interface Props {
  file: VaultFile;
  projects: Project[];
  sessions: Session[];
  onClose: () => void;
  onUpdated: (patch: Partial<VaultFile>) => void;
}

export default function FilePreviewModal({ file, projects, sessions, onClose, onUpdated }: Props) {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(file.tags ?? []);
  const [summary, setSummary] = useState(file.summary ?? "");
  const [summaryEditing, setSummaryEditing] = useState(false);
  const [savedSummary, setSavedSummary] = useState(false);
  const [linkedProject, setLinkedProject] = useState<string | null>(file.linked_project_id);
  const [linkedSession, setLinkedSession] = useState<string | null>(file.linked_session_id);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState(false);

  const blocked = isAccessBlocked(file.quarantine_status);
  const statusColors = getStatusColors(file.quarantine_status ?? "clean");

  useEffect(() => {
    if (file.storage_path && !blocked) {
      const url = getVaultFileUrl(file.storage_path);
      setFileUrl(url);
      if (file.file_type === "text") {
        setLoadingText(true);
        fetch(url)
          .then((r) => r.text())
          .then((t) => setTextContent(t))
          .catch(() => setTextContent(null))
          .finally(() => setLoadingText(false));
      }
    }
  }, [file.storage_path, file.file_type, blocked]);

  function addTag() {
    const t = tagInput.trim().toLowerCase();
    if (!t || tags.includes(t)) { setTagInput(""); return; }
    const next = [...tags, t];
    setTags(next);
    setTagInput("");
    updateVaultFile(file.id, { tags: next }).catch(() => {});
    upsertTags([t]).catch(() => {});
    onUpdated({ tags: next });
  }

  function removeTag(t: string) {
    const next = tags.filter((x) => x !== t);
    setTags(next);
    updateVaultFile(file.id, { tags: next }).catch(() => {});
    onUpdated({ tags: next });
  }

  function saveSummary() {
    updateVaultFile(file.id, { summary }).catch(() => {});
    onUpdated({ summary });
    setSummaryEditing(false);
    setSavedSummary(true);
    setTimeout(() => setSavedSummary(false), 1500);
  }

  function handleProjectLink(id: string | null) {
    setLinkedProject(id);
    updateVaultFile(file.id, { linked_project_id: id }).catch(() => {});
    onUpdated({ linked_project_id: id });
  }

  function handleSessionLink(id: string | null) {
    setLinkedSession(id);
    updateVaultFile(file.id, { linked_session_id: id }).catch(() => {});
    onUpdated({ linked_session_id: id });
  }

  const isImage = file.file_type === "image" || file.mime_type?.startsWith("image/");
  const isPdf = file.file_type === "pdf" || file.mime_type === "application/pdf";
  const isText = file.file_type === "text";
  const isDocument = file.file_type === "document";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.8)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full flex rounded-2xl overflow-hidden"
        style={{ backgroundColor: NAVY, border: `1px solid ${BORDER}`, maxWidth: "1000px", maxHeight: "90vh", height: "85vh" }}
      >
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center gap-3 px-5 py-3.5 border-b flex-shrink-0" style={{ borderColor: BORDER }}>
            <TypeIcon fileType={file.file_type} mimeType={file.mime_type} size={18} />
            <span className="text-sm font-bold tracking-wide truncate flex-1" style={{ color: "#FFFFFF" }}>{file.name}</span>
            <div className="flex items-center gap-2 flex-shrink-0">
              {file.quarantine_status && (
                <span
                  className="flex items-center gap-1 text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded"
                  style={{ color: statusColors.color, backgroundColor: statusColors.bg, border: `1px solid ${statusColors.border}` }}
                >
                  <Shield size={8} />
                  {getStatusLabel(file.quarantine_status)}
                </span>
              )}
              {fileUrl && !blocked && (
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  download={file.original_name ?? file.name}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wider uppercase hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: "#1B2A4A", color: MUTED }}
                >
                  <Download size={12} />
                  Download
                </a>
              )}
              {fileUrl && !blocked && (
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wider uppercase hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: "#1B2A4A", color: MUTED }}
                >
                  <ExternalLink size={12} />
                  Open
                </a>
              )}
              <button onClick={onClose} className="p-1.5 rounded-lg hover:opacity-70 transition-opacity">
                <X size={16} style={{ color: MUTED }} />
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-auto flex items-center justify-center p-4" style={{ backgroundColor: "#080F1A" }}>
            {blocked ? (
              <div className="text-center flex flex-col items-center gap-5 max-w-sm">
                {file.quarantine_status === "blocked" ? (
                  <ShieldX size={56} style={{ color: "#F87171", opacity: 0.7 }} />
                ) : (
                  <ShieldAlert size={56} style={{ color: "#F59E0B", opacity: 0.7 }} />
                )}
                <div>
                  <p className="text-base font-bold" style={{ color: file.quarantine_status === "blocked" ? "#F87171" : "#F59E0B" }}>
                    {file.quarantine_status === "blocked" ? "File Blocked" : "File Quarantined"}
                  </p>
                  <p className="text-sm mt-2 leading-relaxed" style={{ color: MUTED }}>
                    {file.quarantine_status === "blocked"
                      ? "This file has been permanently blocked. It cannot be previewed, downloaded, or shared."
                      : "This file has been quarantined and requires manual review before it can be accessed."}
                  </p>
                  {file.quarantine_reason && (
                    <p className="text-xs mt-3 px-4 py-2.5 rounded-xl leading-relaxed text-left" style={{ backgroundColor: "rgba(255,255,255,0.03)", color: "#6A7D94", border: `1px solid ${BORDER}` }}>
                      {file.quarantine_reason}
                    </p>
                  )}
                </div>
                {file.quarantine_scanned_at && (
                  <p className="text-[10px]" style={{ color: DIM }}>
                    Scanned {new Date(file.quarantine_scanned_at).toLocaleString()}
                  </p>
                )}
              </div>
            ) : (
              <>
                {!fileUrl && !file.storage_path && (
                  <div className="text-center flex flex-col items-center gap-4">
                    <TypeIcon fileType={file.file_type} mimeType={file.mime_type} size={64} />
                    <div>
                      <p className="text-base font-semibold" style={{ color: TEXT }}>{file.name}</p>
                      <p className="text-xs mt-1" style={{ color: MUTED }}>No file stored — text-only entry</p>
                    </div>
                    {file.content && (
                      <div className="text-left w-full max-w-xl rounded-xl p-4 text-sm leading-relaxed" style={{ backgroundColor: CARD, color: TEXT, border: `1px solid ${BORDER}` }}>
                        <pre className="whitespace-pre-wrap font-mono text-xs">{file.content.slice(0, 2000)}</pre>
                      </div>
                    )}
                  </div>
                )}

                {fileUrl && isImage && (
                  <img
                    src={fileUrl}
                    alt={file.name}
                    className="max-w-full max-h-full object-contain rounded-lg"
                    style={{ boxShadow: "0 0 40px rgba(0,0,0,0.5)" }}
                  />
                )}

                {fileUrl && isPdf && (
                  <iframe
                    src={fileUrl}
                    title={file.name}
                    className="w-full h-full rounded-lg"
                    style={{ border: "none", backgroundColor: "#fff" }}
                  />
                )}

                {fileUrl && isText && (
                  <div className="w-full h-full overflow-auto rounded-xl p-5" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
                    {loadingText ? (
                      <p className="text-sm" style={{ color: MUTED }}>Loading content...</p>
                    ) : textContent !== null ? (
                      <pre className="whitespace-pre-wrap text-sm leading-relaxed font-mono" style={{ color: TEXT }}>{textContent}</pre>
                    ) : (
                      <p className="text-sm" style={{ color: MUTED }}>Could not load text content.</p>
                    )}
                  </div>
                )}

                {fileUrl && isDocument && (
                  <div className="text-center flex flex-col items-center gap-5">
                    <TypeIcon fileType={file.file_type} mimeType={file.mime_type} size={64} />
                    <div>
                      <p className="text-sm font-semibold" style={{ color: TEXT }}>{file.name}</p>
                      <p className="text-xs mt-1" style={{ color: MUTED }}>DOCX preview not available in browser</p>
                    </div>
                    <a
                      href={fileUrl}
                      download={file.original_name ?? file.name}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold tracking-wider uppercase"
                      style={{ backgroundColor: GOLD, color: NAVY }}
                    >
                      <Download size={14} />
                      Download to View
                    </a>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="w-72 flex-shrink-0 flex flex-col border-l overflow-y-auto" style={{ borderColor: BORDER }}>
          {(file.quarantine_status === "quarantined" || file.quarantine_status === "blocked") && (
            <div className="p-4 border-b" style={{ borderColor: BORDER }}>
              <QuarantinePanel
                status={file.quarantine_status}
                reason={file.quarantine_reason ?? ""}
                scannedAt={file.quarantine_scanned_at ?? null}
              />
            </div>
          )}

          <div className="p-5 border-b" style={{ borderColor: BORDER }}>
            <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: MUTED }}>File Info</p>
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs">
                <span style={{ color: DIM }}>Type</span>
                <span className="font-semibold uppercase tracking-wider" style={{ color: TEXT }}>{file.file_type}</span>
              </div>
              {file.file_size && (
                <div className="flex justify-between text-xs">
                  <span style={{ color: DIM }}>Size</span>
                  <span style={{ color: TEXT }}>{formatSize(file.file_size)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs">
                <span style={{ color: DIM }}>Uploaded</span>
                <span style={{ color: TEXT }}>{formatDate(file.created_at)}</span>
              </div>
              <div className="flex justify-between text-xs items-center">
                <span style={{ color: DIM }}>Security</span>
                <span
                  className="flex items-center gap-1 text-[9px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded"
                  style={{ color: statusColors.color, backgroundColor: statusColors.bg }}
                >
                  <Shield size={8} />
                  {getStatusLabel(file.quarantine_status ?? "pending")}
                </span>
              </div>
              {file.quarantine_scanned_at && (
                <div className="flex justify-between text-xs">
                  <span style={{ color: DIM }}>Scanned</span>
                  <span style={{ color: DIM }}>{new Date(file.quarantine_scanned_at).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>

          <div className="p-5 border-b" style={{ borderColor: BORDER }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold tracking-widest uppercase" style={{ color: MUTED }}>Summary</p>
              {!summaryEditing && (
                <button onClick={() => setSummaryEditing(true)} className="text-xs hover:opacity-80" style={{ color: GOLD }}>Edit</button>
              )}
            </div>
            {summaryEditing ? (
              <div className="flex flex-col gap-2">
                <textarea
                  className="w-full resize-none text-xs rounded-lg p-2.5 outline-none leading-relaxed"
                  style={{ backgroundColor: CARD, color: TEXT, border: `1px solid ${BORDER}`, minHeight: "80px" }}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={saveSummary}
                    className="flex-1 py-1.5 rounded-lg text-xs font-bold"
                    style={{ backgroundColor: GOLD, color: NAVY }}
                  >
                    {savedSummary ? <Check size={12} className="mx-auto" /> : "Save"}
                  </button>
                  <button
                    onClick={() => { setSummary(file.summary ?? ""); setSummaryEditing(false); }}
                    className="px-3 py-1.5 rounded-lg text-xs"
                    style={{ backgroundColor: CARD, color: MUTED, border: `1px solid ${BORDER}` }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs leading-relaxed" style={{ color: summary ? TEXT : DIM }}>
                {summary || "No summary yet. Click Edit to add one."}
              </p>
            )}
          </div>

          <div className="p-5 border-b" style={{ borderColor: BORDER }}>
            <p className="text-xs font-bold tracking-widest uppercase mb-2.5 flex items-center gap-1.5" style={{ color: MUTED }}>
              <Tag size={10} />
              Tags
            </p>
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ backgroundColor: "rgba(201,168,76,0.15)", color: GOLD }}>
                  {t}
                  <button onClick={() => removeTag(t)} className="opacity-50 hover:opacity-100">×</button>
                </span>
              ))}
              {tags.length === 0 && <p className="text-xs" style={{ color: DIM }}>No tags</p>}
            </div>
            <div className="flex gap-1.5">
              <input
                className="flex-1 text-xs px-2.5 py-1.5 rounded-lg outline-none"
                style={{ backgroundColor: CARD, color: "#FFFFFF", border: `1px solid ${BORDER}` }}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                placeholder="Add tag..."
              />
              <button onClick={addTag} className="px-2 py-1.5 rounded-lg" style={{ backgroundColor: "rgba(201,168,76,0.15)", color: GOLD }}>
                <Plus size={11} />
              </button>
            </div>
          </div>

          <div className="p-5 border-b" style={{ borderColor: BORDER }}>
            <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: MUTED }}>Linked Project</p>
            <select
              className="w-full text-xs px-2.5 py-2 rounded-lg outline-none"
              style={{ backgroundColor: CARD, color: TEXT, border: `1px solid ${BORDER}` }}
              value={linkedProject ?? ""}
              onChange={(e) => handleProjectLink(e.target.value || null)}
            >
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="p-5">
            <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: MUTED }}>Linked Session</p>
            <select
              className="w-full text-xs px-2.5 py-2 rounded-lg outline-none"
              style={{ backgroundColor: CARD, color: TEXT, border: `1px solid ${BORDER}` }}
              value={linkedSession ?? ""}
              onChange={(e) => handleSessionLink(e.target.value || null)}
            >
              <option value="">No session</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>{s.session_key}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
