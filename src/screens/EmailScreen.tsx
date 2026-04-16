import { useState } from "react";
import { Send, RefreshCw, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "../lib/supabase";

const GOLD = "#C9A84C";
const NAVY = "#0D1B2E";
const CARD = "#0A1628";
const BORDER = "#1B2A4A";
const MUTED = "#8A9BB5";
const DIM = "#3A4F6A";
const TEXT = "#D0DFEE";

const SENT_LOG_KEY = "casevoice_sent_emails";

interface SentEmail {
  id: string;
  to: string;
  subject: string;
  body: string;
  sentAt: string;
}

function loadSentLog(): SentEmail[] {
  try {
    const raw = localStorage.getItem(SENT_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function appendToSentLog(email: SentEmail) {
  try {
    const log = loadSentLog();
    log.unshift(email);
    localStorage.setItem(SENT_LOG_KEY, JSON.stringify(log.slice(0, 50)));
  } catch {}
}

export default function EmailScreen() {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [sentLog, setSentLog] = useState<SentEmail[]>(() => loadSentLog());
  const [showLog, setShowLog] = useState(false);

  async function handleSend() {
    if (!to.trim() || !subject.trim() || !body.trim()) {
      setStatus({ type: "error", message: "To, Subject, and Body are all required." });
      return;
    }
    setSending(true);
    setStatus(null);

    try {
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: { to: to.trim(), subject: subject.trim(), body: body.trim() },
      });

      if (error || !data?.success) {
        const msg = data?.error ?? error?.message ?? "Send failed. Check System Health.";
        setStatus({ type: "error", message: msg });
      } else {
        const entry: SentEmail = {
          id: crypto.randomUUID(),
          to: to.trim(),
          subject: subject.trim(),
          body: body.trim(),
          sentAt: new Date().toISOString(),
        };
        appendToSentLog(entry);
        setSentLog(loadSentLog());
        setStatus({ type: "success", message: `Sent to ${to.trim()}` });
        setTo("");
        setSubject("");
        setBody("");
      }
    } catch (err) {
      setStatus({ type: "error", message: String(err) });
    } finally {
      setSending(false);
      setTimeout(() => setStatus(null), 5000);
    }
  }

  return (
    <div className="h-full w-full flex flex-col" style={{ backgroundColor: "#08111F" }}>
      {/* Header */}
      <div
        className="flex items-center gap-4 px-6 py-4 border-b flex-shrink-0"
        style={{ borderColor: BORDER }}
      >
        <span
          className="text-xs font-bold tracking-[0.22em] uppercase"
          style={{ color: GOLD }}
        >
          Mailman
        </span>
        <span className="text-xs" style={{ color: DIM }}>
          Direct outbound email.
        </span>
        <div className="ml-auto flex items-center gap-3">
          {status && (
            <div className="flex items-center gap-2">
              {status.type === "success" ? (
                <CheckCircle size={14} style={{ color: "#4ADE80" }} />
              ) : (
                <XCircle size={14} style={{ color: "#F87171" }} />
              )}
              <span
                className="text-xs font-semibold"
                style={{ color: status.type === "success" ? "#4ADE80" : "#F87171" }}
              >
                {status.message}
              </span>
            </div>
          )}
          {sentLog.length > 0 && (
            <button
              onClick={() => setShowLog((v) => !v)}
              className="text-xs px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
              style={{
                color: showLog ? GOLD : MUTED,
                border: `1px solid ${showLog ? "rgba(201,168,76,0.4)" : BORDER}`,
                backgroundColor: showLog ? "rgba(201,168,76,0.08)" : "transparent",
              }}
            >
              Sent ({sentLog.length})
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Compose */}
        <div className="flex flex-col flex-1 p-6 gap-4">
          {/* To */}
          <div>
            <label
              className="block text-xs font-bold uppercase tracking-widest mb-1.5"
              style={{ color: DIM }}
            >
              To
            </label>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ backgroundColor: CARD, color: TEXT, border: `1px solid ${BORDER}` }}
            />
          </div>

          {/* Subject */}
          <div>
            <label
              className="block text-xs font-bold uppercase tracking-widest mb-1.5"
              style={{ color: DIM }}
            >
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ backgroundColor: CARD, color: TEXT, border: `1px solid ${BORDER}` }}
            />
          </div>

          {/* Body */}
          <div className="flex-1 flex flex-col">
            <label
              className="block text-xs font-bold uppercase tracking-widest mb-1.5"
              style={{ color: DIM }}
            >
              Message
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message here..."
              className="flex-1 w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
              style={{
                backgroundColor: CARD,
                color: TEXT,
                border: `1px solid ${BORDER}`,
                lineHeight: "1.7",
                minHeight: "240px",
              }}
            />
          </div>

          {/* Signature preview */}
          <div
            className="rounded-xl px-4 py-3 text-xs leading-relaxed"
            style={{ backgroundColor: CARD, border: `1px solid ${BORDER}`, color: DIM }}
          >
            <span style={{ color: MUTED }}>Signature:</span> Daniel J. Vogt | Founder, Vogtcom LLC | casevoice.ai@gmail.com | (570) 281-2357
          </div>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={sending || !to.trim() || !subject.trim() || !body.trim()}
            className="flex items-center justify-center gap-3 px-6 py-4 rounded-xl text-sm font-bold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-30"
            style={{ backgroundColor: GOLD, color: NAVY }}
          >
            {sending ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send size={16} />
                Send
              </>
            )}
          </button>
        </div>

        {/* Sent Log Panel */}
        {showLog && (
          <div
            className="w-80 flex-shrink-0 border-l flex flex-col overflow-hidden"
            style={{ borderColor: BORDER, backgroundColor: "#08111F" }}
          >
            <div
              className="px-4 py-3 border-b flex-shrink-0 flex items-center justify-between"
              style={{ borderColor: BORDER }}
            >
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: MUTED }}>
                Sent
              </span>
              <button
                onClick={() => {
                  localStorage.removeItem(SENT_LOG_KEY);
                  setSentLog([]);
                  setShowLog(false);
                }}
                className="text-xs"
                style={{ color: DIM }}
              >
                Clear all
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {sentLog.map((email) => (
                <div
                  key={email.id}
                  className="px-4 py-3 border-b"
                  style={{ borderColor: BORDER }}
                >
                  <div className="text-xs font-semibold mb-0.5 truncate" style={{ color: TEXT }}>
                    {email.subject}
                  </div>
                  <div className="text-xs truncate mb-1" style={{ color: MUTED }}>
                    To: {email.to}
                  </div>
                  <div className="text-xs" style={{ color: DIM }}>
                    {new Date(email.sentAt).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
