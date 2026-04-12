export type QuarantineStatus = "pending" | "clean" | "quarantined" | "blocked";

export interface ScanResult {
  status: QuarantineStatus;
  reason: string;
  scannedAt: string;
}

const BLOCKED_MIME_TYPES = new Set([
  "application/x-msdownload",
  "application/x-executable",
  "application/x-sharedlib",
  "application/x-dosexec",
  "application/x-elf",
  "application/x-mach-binary",
  "application/vnd.android.package-archive",
  "application/x-sh",
  "application/x-bat",
  "application/x-cmd",
  "application/x-csh",
  "application/x-ksh",
  "application/java-archive",
  "text/x-shellscript",
]);

const BLOCKED_EXTENSIONS = new Set([
  "exe", "dll", "so", "elf", "bat", "cmd", "sh", "bash", "csh", "ksh",
  "ps1", "psm1", "psd1", "vbs", "vbe", "js", "jse", "wsf", "wsh",
  "msi", "msp", "mst", "apk", "app", "deb", "rpm", "pkg", "dmg",
  "jar", "war", "ear", "com", "scr", "pif", "gadget", "inf",
  "reg", "hta", "cpl", "msc", "mde", "mdb", "accde",
]);

const SUSPICIOUS_EXTENSIONS = new Set([
  "php", "asp", "aspx", "jsp", "cfm", "pl", "py", "rb", "lua",
  "xml", "svg", "html", "htm", "xhtml",
]);

const MAX_FILE_SIZE = 50 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
]);

const MALICIOUS_BYTE_PATTERNS = [
  { pattern: new Uint8Array([0x4d, 0x5a]), name: "Windows PE executable header (MZ)" },
  { pattern: new Uint8Array([0x7f, 0x45, 0x4c, 0x46]), name: "Linux ELF executable header" },
  { pattern: new Uint8Array([0xca, 0xfe, 0xba, 0xbe]), name: "Java class file or Mach-O binary" },
  { pattern: new Uint8Array([0xfe, 0xed, 0xfa, 0xce]), name: "Mach-O 32-bit binary" },
  { pattern: new Uint8Array([0xfe, 0xed, 0xfa, 0xcf]), name: "Mach-O 64-bit binary" },
];

function startsWithPattern(bytes: Uint8Array, pattern: Uint8Array): boolean {
  if (bytes.length < pattern.length) return false;
  for (let i = 0; i < pattern.length; i++) {
    if (bytes[i] !== pattern[i]) return false;
  }
  return true;
}

async function scanFileBytes(file: File): Promise<{ threat: string | null }> {
  const SCAN_BYTES = 512;
  const slice = file.slice(0, SCAN_BYTES);
  const buffer = await slice.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  for (const { pattern, name } of MALICIOUS_BYTE_PATTERNS) {
    if (startsWithPattern(bytes, pattern)) {
      return { threat: name };
    }
  }

  return { threat: null };
}

function getFileExtension(fileName: string): string {
  return (fileName.split(".").pop() ?? "").toLowerCase();
}

export async function scanFile(file: File): Promise<ScanResult> {
  const scannedAt = new Date().toISOString();
  const ext = getFileExtension(file.name);
  const mimeType = file.type || "";

  if (BLOCKED_EXTENSIONS.has(ext)) {
    return {
      status: "blocked",
      reason: `File extension ".${ext}" is not permitted — executable or script files are blocked`,
      scannedAt,
    };
  }

  if (BLOCKED_MIME_TYPES.has(mimeType)) {
    return {
      status: "blocked",
      reason: `MIME type "${mimeType}" is not permitted — executable files are blocked`,
      scannedAt,
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      status: "blocked",
      reason: `File exceeds maximum allowed size of 50 MB (actual: ${(file.size / 1024 / 1024).toFixed(1)} MB)`,
      scannedAt,
    };
  }

  if (file.size === 0) {
    return {
      status: "quarantined",
      reason: "File is empty — zero-byte files are quarantined pending review",
      scannedAt,
    };
  }

  if (!ALLOWED_MIME_TYPES.has(mimeType) && mimeType !== "") {
    return {
      status: "quarantined",
      reason: `Unrecognised MIME type "${mimeType}" — file quarantined pending manual review`,
      scannedAt,
    };
  }

  if (SUSPICIOUS_EXTENSIONS.has(ext)) {
    return {
      status: "quarantined",
      reason: `File extension ".${ext}" is treated as potentially unsafe — quarantined pending review`,
      scannedAt,
    };
  }

  try {
    const byteResult = await scanFileBytes(file);
    if (byteResult.threat) {
      return {
        status: "blocked",
        reason: `Binary signature detected: ${byteResult.threat} — file blocked`,
        scannedAt,
      };
    }
  } catch {
    return {
      status: "quarantined",
      reason: "Could not read file bytes for scanning — quarantined pending review",
      scannedAt,
    };
  }

  return {
    status: "clean",
    reason: "",
    scannedAt,
  };
}

export function isAccessBlocked(status: QuarantineStatus | string | undefined): boolean {
  return status === "quarantined" || status === "blocked" || status === "pending";
}

export function getStatusLabel(status: QuarantineStatus | string | undefined): string {
  switch (status) {
    case "clean":       return "Clean";
    case "quarantined": return "Quarantined";
    case "blocked":     return "Blocked";
    case "pending":     return "Scanning";
    default:            return "Unknown";
  }
}

export function getStatusColors(status: QuarantineStatus | string | undefined): { color: string; bg: string; border: string } {
  switch (status) {
    case "clean":
      return { color: "#4ADE80", bg: "rgba(74,222,128,0.1)", border: "rgba(74,222,128,0.25)" };
    case "quarantined":
      return { color: "#F59E0B", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.25)" };
    case "blocked":
      return { color: "#F87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.25)" };
    case "pending":
    default:
      return { color: "#8A9BB5", bg: "rgba(138,155,181,0.1)", border: "rgba(138,155,181,0.2)" };
  }
}
