import { useState, useEffect } from "react";
import { Archive, ChevronRight, FileText, Tag, Users, AlertCircle, CheckSquare, StickyNote } from "lucide-react";
import { listSessions, archiveSession, loadSession, type Session } from "../lib/db";

const GOLD = "#C9A84C";
const NAVY = "#0D1B2E";
const CARD = "#111D30";
const BORDER = "#1B2A4A";
const MUTED = "#8A9BB5";
const DIM = "#3A4F6A";
const TEXT = "#D0DFEE";

interface Props {
  onOpenSession: (key: string) => void | Promise<void>;
}

interface SessionData {
  transcript: string[];
  tasks: string[];
  questions: string[];
  decisions: string[];
  mentors: string[];
  unresolved: string[];
  sideNotes: { text: string; mentors: string[]; tags: string[] }[];
  summary: string;
}

export default function SessionsView({ onOpenSession }: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedData, setExpandedData] = useState<Record<string, SessionData>>({});

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
          .map((m) => `${m.sender ?? (m.speaker === "you" ? "YOU" : "MENTOR")}: ${m.text.slice(0, 100)}${m.text.length > 100 ? "…" : ""}`);
        const tasks = (result.julieReport?.assigned_tasks ?? []).map((t) => `${t.owner ? t.owner + ": " : ""}${t.task.slice(0, 80)}`);
        const questions = result.julieReport?.open_questions ?? [];
        const decisions = result.julieReport?.decisions_made ?? [];
        const unresolved = result.julieReport?.unresolved_topics ?? [];
        const mentorParticipation = result.julieReport?.mentor_participation ?? {};
        const mentors = Object.keys(mentorParticipation).filter((k) => (mentorParticipation[k] ?? 0) > 0);
        const sideNotes = (result.sideNotes ?? []).map((n) => ({ text: n.text, mentors: n.mentors ?? [], tags: n.tags ?? [] }));
        const summary = result.session?.session_summary ?? "";
        setExpandedData((prev) => ({ ...prev, [session.id]: { transcript: preview, tasks, questions, decisions, mentors, unresolved, sideNotes, summary } }));
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
    <div className="flex-1 flex flex-col min-h-0" style={{ backgroundColor: NAVY, color: "#FFFFFF" }}>
      <div className="px-5 py-4 border-b flex items-center" style={{ borderColor: BORDER }}>
        <span className="text-sm font-bold tracking-widest uppercase" style={{ color: MUTED }}>Sessions</span>
        <span className="text-sm ml-3" style={{ color: DIM }}>— {active.length} active</span>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {loading && <p className="text-sm" style={{ color: DIM }}>Loading sessions...</p>}

        {!loading && active.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 gap-3">
            <FileText size={32} style={{ color: DIM }} />
            <p className="text-sm" style={{ color: DIM }}>No sessions yet. Start a meeting to create one.</p>
          </div>
        )}

        <div className="flex flex-col gap-3 mb-8">
          {active.map((session) => {
            const isOpen = expandedId === session.id;
            const data = expandedData[session.id];
            return (
              <div
                key={session.id}
                className="rounded-xl overflow-hidden transition-all"
                style={{ backgroundColor: CARD, border: `1px solid ${isOpen ? "rgba(201,168,76,0.3)" : BORDER}` }}
              >
                <button
                  onClick={() => handleExpand(session)}
                  className="w-full flex items-center justify-between px-5 py-4 transition-all hover:opacity-90"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(201,168,76,0.12)" }}>
                      <FileText size={15} style={{ color: GOLD }} />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold" style={{ color: "#FFFFFF" }}>{session.session_key}</p>
                      <p className="text-xs" style={{ color: DIM }}>{new Date(session.session_date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); onOpenSession(session.session_key); }}
                      className="px-4 py-2 rounded-lg text-xs font-bold tracking-wider uppercase transition-all hover:opacity-90"
                      style={{ backgroundColor: GOLD, color: NAVY }}
                    >
                      Open
                    </button>
                    <button
                      onClick={(e) => handleArchive(session, e)}
                      className="p-2 rounded-lg transition-opacity hover:opacity-70"
                      title="Archive session"
                    >
                      <Archive size={14} style={{ color: DIM }} />
                    </button>
                    <ChevronRight
                      size={15}
                      style={{ color: DIM, transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}
                    />
                  </div>
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 border-t" style={{ borderColor: BORDER }}>
                    {!data && <p className="text-sm pt-4" style={{ color: DIM }}>Loading preview...</p>}
                    {data && (
                      <div className="pt-4 grid grid-cols-2 gap-4">
                        {data.summary && (
                          <div className="col-span-2 px-3 py-2.5 rounded-xl" style={{ backgroundColor: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.15)" }}>
                            <p className="text-[10px] font-bold tracking-widest uppercase mb-1" style={{ color: GOLD }}>Summary</p>
                            <p className="text-xs leading-relaxed" style={{ color: TEXT }}>{data.summary}</p>
                          </div>
                        )}

                        {data.mentors.length > 0 && (
                          <div className="col-span-2 flex items-center gap-2 flex-wrap">
                            <Users size={13} style={{ color: MUTED }} />
                            <p className="text-xs font-bold tracking-widest uppercase mr-1" style={{ color: MUTED }}>Team</p>
                            {data.mentors.map((m) => (
                              <span key={m} className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(201,168,76,0.12)", color: GOLD }}>
                                {m}
                              </span>
                            ))}
                          </div>
                        )}

                        {data.transcript.length > 0 && (
                          <div className="col-span-2">
                            <p className="text-xs font-bold tracking-widest uppercase mb-2 flex items-center gap-1.5" style={{ color: MUTED }}>
                              <FileText size={11} />
                              Last Messages
                            </p>
                            <div className="px-3 py-2.5 rounded-xl" style={{ backgroundColor: NAVY, border: `1px solid ${BORDER}` }}>
                              {data.transcript.map((line, i) => (
                                <p key={i} className="text-xs leading-relaxed py-0.5" style={{ color: MUTED }}>{line}</p>
                              ))}
                            </div>
                          </div>
                        )}

                        {data.tasks.length > 0 && (
                          <div>
                            <p className="text-xs font-bold tracking-widest uppercase mb-2 flex items-center gap-1.5" style={{ color: MUTED }}>
                              <CheckSquare size={11} />
                              Tasks ({data.tasks.length})
                            </p>
                            <div className="flex flex-col gap-1">
                              {data.tasks.map((t, i) => (
                                <p key={i} className="text-xs leading-relaxed px-3 py-2 rounded-lg" style={{ color: TEXT, backgroundColor: NAVY, border: `1px solid ${BORDER}` }}>{t}</p>
                              ))}
                            </div>
                          </div>
                        )}

                        {data.decisions.length > 0 && (
                          <div>
                            <p className="text-xs font-bold tracking-widest uppercase mb-2 flex items-center gap-1.5" style={{ color: MUTED }}>
                              <Tag size={11} />
                              Decisions ({data.decisions.length})
                            </p>
                            <div className="flex flex-col gap-1">
                              {data.decisions.map((d, i) => (
                                <p key={i} className="text-xs leading-relaxed px-3 py-2 rounded-lg" style={{ color: TEXT, backgroundColor: NAVY, border: `1px solid ${BORDER}` }}>{d}</p>
                              ))}
                            </div>
                          </div>
                        )}

                        {data.questions.length > 0 && (
                          <div>
                            <p className="text-xs font-bold tracking-widest uppercase mb-2 flex items-center gap-1.5" style={{ color: MUTED }}>
                              <AlertCircle size={11} />
                              Open Questions ({data.questions.length})
                            </p>
                            <div className="flex flex-col gap-1">
                              {data.questions.map((q, i) => (
                                <p key={i} className="text-xs leading-relaxed px-3 py-2 rounded-lg" style={{ color: "#FCD34D", backgroundColor: "rgba(252,211,77,0.06)", border: `1px solid rgba(252,211,77,0.15)` }}>{q}</p>
                              ))}
                            </div>
                          </div>
                        )}

                        {data.unresolved.length > 0 && (
                          <div>
                            <p className="text-xs font-bold tracking-widest uppercase mb-2 flex items-center gap-1.5" style={{ color: "#F97316" }}>
                              <AlertCircle size={11} />
                              Unresolved ({data.unresolved.length})
                            </p>
                            <div className="flex flex-col gap-1">
                              {data.unresolved.map((u, i) => (
                                <p key={i} className="text-xs leading-relaxed px-3 py-2 rounded-lg" style={{ color: "#FB923C", backgroundColor: "rgba(249,115,22,0.06)", border: `1px solid rgba(249,115,22,0.2)` }}>{u}</p>
                              ))}
                            </div>
                          </div>
                        )}

                        {data.sideNotes.length > 0 && (
                          <div className="col-span-2">
                            <p className="text-xs font-bold tracking-widest uppercase mb-2 flex items-center gap-1.5" style={{ color: MUTED }}>
                              <StickyNote size={11} />
                              Side Notes ({data.sideNotes.length})
                            </p>
                            <div className="flex flex-col gap-2">
                              {data.sideNotes.map((n, i) => (
                                <div key={i} className="px-3 py-2.5 rounded-xl" style={{ backgroundColor: "#F5E6A3", border: "1px solid #D6C47A" }}>
                                  <p className="text-xs leading-relaxed" style={{ color: "#1B1B1B" }}>{n.text}</p>
                                  {(n.mentors.length > 0 || n.tags.length > 0) && (
                                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                                      {n.mentors.map((m) => (
                                        <span key={m} className="text-[9px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "#C9A84C33", color: "#3A2D00", border: "1px solid #C9A84C66" }}>{m}</span>
                                      ))}
                                      {n.tags.map((t) => (
                                        <span key={t} className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "#D6C47A", color: "#1B1B1B" }}>{t}</span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
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
            <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: DIM }}>Archived Sessions</p>
            <div className="flex flex-col gap-2">
              {archived.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between px-4 py-3 rounded-xl"
                  style={{ backgroundColor: "#0D1422", border: `1px solid #141F32` }}
                >
                  <div className="flex items-center gap-3">
                    <FileText size={13} style={{ color: DIM }} />
                    <span className="text-sm" style={{ color: DIM }}>{session.session_key}</span>
                  </div>
                  <button
                    onClick={() => onOpenSession(session.session_key)}
                    className="text-xs tracking-widest uppercase font-bold transition-opacity hover:opacity-70 px-3 py-1.5 rounded-lg"
                    style={{ backgroundColor: "#1B2A4A", color: MUTED }}
                  >
                    View
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
