import { useState, useEffect } from "react";
import { Archive, ChevronRight, FileText } from "lucide-react";
import { listSessions, archiveSession, loadSession, type Session } from "../lib/db";

interface Props {
  onOpenSession: (key: string) => void;
}

export default function SessionsView({ onOpenSession }: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedData, setExpandedData] = useState<Record<string, { transcript: string[]; tasks: string[]; questions: string[] }>>({});

  useEffect(() => {
    listSessions().then((s) => {
      setSessions(s);
      setLoading(false);
    });
  }, []);

  async function handleExpand(session: Session) {
    if (expandedId === session.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(session.id);
    if (!expandedData[session.id]) {
      const result = await loadSession(session.session_key);
      if (result) {
        const msgs = result.transcript?.messages ?? [];
        const preview = msgs
          .slice(-4)
          .map((m) => `${m.sender ?? (m.speaker === "you" ? "YOU" : "MENTOR")}: ${m.text.slice(0, 80)}${m.text.length > 80 ? "…" : ""}`);
        const tasks = (result.julieReport?.assigned_tasks ?? []).map((t) => `${t.owner}: ${t.task.slice(0, 60)}`);
        const questions = result.julieReport?.open_questions ?? [];
        setExpandedData((prev) => ({ ...prev, [session.id]: { transcript: preview, tasks, questions } }));
      }
    }
  }

  async function handleArchive(session: Session, e: React.MouseEvent) {
    e.stopPropagation();
    await archiveSession(session.id);
    setSessions((prev) => prev.map((s) => s.id === session.id ? { ...s, archived: true } : s));
  }

  const active = sessions.filter((s) => !s.archived);
  const archived = sessions.filter((s) => s.archived);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">
      <p className="text-xs tracking-widest uppercase mb-4" style={{ color: "#8A9BB5" }}>Sessions</p>

      {loading && (
        <p className="text-sm" style={{ color: "#3A4F6A" }}>Loading sessions...</p>
      )}

      {!loading && active.length === 0 && (
        <p className="text-sm" style={{ color: "#3A4F6A" }}>No sessions yet. Start a meeting to create one.</p>
      )}

      <div className="flex flex-col gap-2 mb-6">
        {active.map((session) => {
          const isOpen = expandedId === session.id;
          const data = expandedData[session.id];
          return (
            <div
              key={session.id}
              className="rounded-xl overflow-hidden"
              style={{ backgroundColor: "#111D30", border: "1px solid #1B2A4A" }}
            >
              <button
                onClick={() => handleExpand(session)}
                className="w-full flex items-center justify-between px-4 py-3 transition-colors hover:opacity-90"
              >
                <div className="flex items-center gap-3">
                  <FileText size={14} style={{ color: "#C9A84C" }} />
                  <span className="text-sm font-semibold" style={{ color: "#FFFFFF" }}>{session.session_key}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => handleArchive(session, e)}
                    className="p-1.5 rounded transition-opacity hover:opacity-70"
                    title="Archive session"
                  >
                    <Archive size={13} style={{ color: "#3A4F6A" }} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onOpenSession(session.session_key); }}
                    className="px-3 py-1 rounded-lg text-xs font-semibold tracking-wider uppercase transition-opacity hover:opacity-80"
                    style={{ backgroundColor: "#C9A84C", color: "#0D1B2E" }}
                  >
                    Open
                  </button>
                  <ChevronRight
                    size={14}
                    style={{ color: "#3A4F6A", transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}
                  />
                </div>
              </button>

              {isOpen && (
                <div className="px-4 pb-4 pt-1 border-t" style={{ borderColor: "#1B2A4A" }}>
                  {!data && <p className="text-xs" style={{ color: "#3A4F6A" }}>Loading preview...</p>}
                  {data && (
                    <div className="flex flex-col gap-3">
                      {data.transcript.length > 0 && (
                        <div>
                          <p className="text-[10px] tracking-widest uppercase mb-1.5" style={{ color: "#3A4F6A" }}>Last messages</p>
                          {data.transcript.map((line, i) => (
                            <p key={i} className="text-xs leading-relaxed" style={{ color: "#8A9BB5" }}>{line}</p>
                          ))}
                        </div>
                      )}
                      {data.tasks.length > 0 && (
                        <div>
                          <p className="text-[10px] tracking-widest uppercase mb-1.5" style={{ color: "#3A4F6A" }}>Tasks</p>
                          {data.tasks.map((t, i) => (
                            <p key={i} className="text-xs leading-relaxed" style={{ color: "#8A9BB5" }}>{t}</p>
                          ))}
                        </div>
                      )}
                      {data.questions.length > 0 && (
                        <div>
                          <p className="text-[10px] tracking-widest uppercase mb-1.5" style={{ color: "#3A4F6A" }}>Open questions</p>
                          {data.questions.map((q, i) => (
                            <p key={i} className="text-xs leading-relaxed" style={{ color: "#8A9BB5" }}>{q}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {archived.length > 0 && (
        <div>
          <p className="text-[10px] tracking-widest uppercase mb-3" style={{ color: "#3A4F6A" }}>Archived</p>
          <div className="flex flex-col gap-2">
            {archived.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between px-4 py-2.5 rounded-xl"
                style={{ backgroundColor: "#0D1422", border: "1px solid #141F32" }}
              >
                <span className="text-sm" style={{ color: "#3A4F6A" }}>{session.session_key}</span>
                <button
                  onClick={() => onOpenSession(session.session_key)}
                  className="text-xs tracking-widest uppercase font-semibold transition-opacity hover:opacity-70"
                  style={{ color: "#3A4F6A" }}
                >
                  View
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
