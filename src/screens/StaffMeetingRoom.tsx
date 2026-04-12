import { useState, useRef, useEffect } from "react";
import SideNoteModal, { SideNote } from "./SideNoteModal";

type MentorStatus = "idle" | "assigned" | "working" | "ready" | "blocked";
type Mode = "brainstorm" | "command";

interface Mentor {
  id: string;
  name: string;
  status: MentorStatus;
  hasComment: boolean;
  hasInterrupt: boolean;
  interruptWeight: number;
  commentWeight: number;
  riskSensitivity: number;
  lastRespondedTurn: number | null;
  hasTask: boolean;
}

interface Message {
  id: number;
  text: string;
  speaker: "you" | "mentor";
  sender?: string;
  targets?: string[];
  isThinking?: boolean;
}

const INITIAL_MENTORS: Mentor[] = [
  { id: "prez",    name: "PREZ",    status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.7,  commentWeight: 0.6, riskSensitivity: 0.8,  lastRespondedTurn: null, hasTask: false },
  { id: "jamison", name: "JAMISON", status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.2,  commentWeight: 0.8, riskSensitivity: 0.7,  lastRespondedTurn: null, hasTask: false },
  { id: "doc",     name: "DOC",     status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.9,  commentWeight: 0.7, riskSensitivity: 1.0,  lastRespondedTurn: null, hasTask: false },
  { id: "tech9",   name: "TECHGUY", status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.5,  commentWeight: 0.7, riskSensitivity: 0.7,  lastRespondedTurn: null, hasTask: false },
  { id: "sam",     name: "SAM",     status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.4,  commentWeight: 0.6, riskSensitivity: 0.6,  lastRespondedTurn: null, hasTask: false },
  { id: "cipher",  name: "CIPHER",  status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.85, commentWeight: 0.6, riskSensitivity: 1.0,  lastRespondedTurn: null, hasTask: false },
];

const STATUS_STYLES: Record<MentorStatus, React.CSSProperties> = {
  idle:     { backgroundColor: "#1B2A4A", color: "#FFFFFF" },
  assigned: { backgroundColor: "#1A3A5C", color: "#7ABFFF" },
  working:  { backgroundColor: "#0E3050", color: "#A8D8FF" },
  ready:    { backgroundColor: "#0D3320", color: "#4ADE80" },
  blocked:  { backgroundColor: "#3A1010", color: "#F87171" },
};

const STATUS_LABEL: Record<MentorStatus, string> = {
  idle:     "Idle",
  assigned: "Assigned",
  working:  "Working",
  ready:    "Ready",
  blocked:  "Blocked",
};

const STATUS_DOT: Record<MentorStatus, string> = {
  idle:     "#3A4F6A",
  assigned: "#7ABFFF",
  working:  "#60AEFF",
  ready:    "#4ADE80",
  blocked:  "#F87171",
};

const MENTOR_KEYWORDS: Record<string, string[]> = {
  DOC:     ["risk", "problem", "issue", "concern", "wrong"],
  CIPHER:  ["data", "privacy", "user", "trust"],
  TECHGUY: ["build", "how", "system", "implement", "code"],
  SAM:     ["next", "plan", "steps", "who", "process"],
  JAMISON: ["user", "message", "sound", "clear", "write"],
};

const MENTOR_PRIORITY: Record<string, string[]> = {
  TECHGUY: ["build", "how", "implement", "system", "code"],
  DOC:     ["risk", "issue", "problem", "danger"],
  CIPHER:  ["data", "privacy", "trust"],
  SAM:     ["plan", "steps", "process", "who"],
  JAMISON: ["message", "clear", "write"],
};

function getBestMentor(message: string): string | null {
  const lower = message.toLowerCase();
  for (const mentor in MENTOR_PRIORITY) {
    const keywords = MENTOR_PRIORITY[mentor];
    if (keywords.some((k) => lower.includes(k))) {
      return mentor;
    }
  }
  return null;
}

function isHighRisk(message: string): boolean {
  const lower = message.toLowerCase();
  return [
    "remove safeguards",
    "disable safety",
    "ignore rules",
    "bypass",
    "no restrictions",
    "skip checks",
  ].some((k) => lower.includes(k));
}

function isTooSimilar(newText: string, history: string[]): boolean {
  const lower = newText.toLowerCase();
  return history.some((h) => lower.includes(h.slice(0, 20)));
}

function isQuestion(text: string): boolean {
  return text.trimEnd().endsWith("?");
}

const MAX_RESPONSES_PER_TURN = 2;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export default function StaffMeetingRoom() {
  const [mentors, setMentors] = useState<Mentor[]>(INITIAL_MENTORS);
  const [mode, setMode] = useState<Mode>("brainstorm");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [sideNotes, setSideNotes] = useState<SideNote[]>([]);
  const [usedTags, setUsedTags] = useState<string[]>([]);
  const [showSideNoteModal, setShowSideNoteModal] = useState(false);
  const [selectedMentors, setSelectedMentors] = useState<string[]>([]);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const msgCounter = useRef(0);
  const currentTurnId = useRef(0);
  const messagesRef = useRef<Message[]>([]);
  const mentorsRef = useRef<Mentor[]>(INITIAL_MENTORS);
  const recentTopics = useRef<string[]>([]);
  const highRiskTurnId = useRef<number | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    mentorsRef.current = mentors;
  }, [mentors]);

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [messages]);

  function setMentorStatus(name: string, status: MentorStatus) {
    setMentors((prev) =>
      prev.map((m) => (m.name === name ? { ...m, status } : m))
    );
  }

  function nextId() {
    msgCounter.current += 1;
    return msgCounter.current;
  }

  function addMessage(text: string, speaker: "you" | "mentor", sender?: string, targets?: string[], isThinking?: boolean): number {
    const id = nextId();
    setMessages((prev) => [...prev, { id, text, speaker, sender, targets, isThinking }]);
    return id;
  }

  function removeMessageById(id: number) {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }

  function toggleMentorSelection(name: string) {
    setSelectedMentors((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  }

  function removeSelectedMentor(name: string) {
    setSelectedMentors((prev) => prev.filter((n) => n !== name));
  }

  function isMentorRelevant(mentorName: string, text: string): boolean {
    if (mentorName === "PREZ") return true;
    const keywords = MENTOR_KEYWORDS[mentorName];
    if (!keywords) return true;
    const lower = text.toLowerCase();
    return keywords.some((kw) => lower.includes(kw));
  }

  async function fetchMentorResponse(
    mentorName: string,
    userMessage: string,
    currentMode: Mode
  ): Promise<string> {
    const recent = messagesRef.current
      .filter((m) => !m.isThinking)
      .slice(-8)
      .map((m) => ({ speaker: m.sender ?? (m.speaker === "you" ? "YOU" : "MENTOR"), text: m.text }));

    const res = await fetch(`${SUPABASE_URL}/functions/v1/mentor-response`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        mentor: mentorName,
        message: userMessage,
        mode: currentMode,
        recentTranscript: recent,
      }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.response) throw new Error("Empty response");
    return data.response as string;
  }

  async function maybeTriggerFollowUp(
    originalMentorName: string,
    lastResponseText: string,
    userMessage: string,
    currentMode: Mode,
    turnId: number
  ) {
    if (Math.random() > 0.30) return;

    const currentMentors = mentorsRef.current;
    const otherMentors = currentMentors.filter(
      (m) => m.name !== originalMentorName && m.status === "idle"
    );
    if (otherMentors.length === 0) return;

    const relevant = otherMentors.filter((m) => isMentorRelevant(m.name, lastResponseText));
    const pool = relevant.length > 0 ? relevant : otherMentors;

    const sorted = [...pool].sort((a, b) => b.commentWeight - a.commentWeight);
    const topWeight = sorted[0].commentWeight;
    const topTier = sorted.filter((m) => m.commentWeight === topWeight);
    const chosen = topTier[Math.floor(Math.random() * topTier.length)];

    setMentors((prev) =>
      prev.map((m) => m.id === chosen.id ? { ...m, status: "working" } : m)
    );

    const thinkingId = addMessage(
      `${chosen.name} is thinking...`,
      "mentor",
      chosen.name,
      [originalMentorName],
      true
    );

    try {
      const contextMessage = `${originalMentorName} just said: "${lastResponseText}"\n\nOriginal topic: ${userMessage}`;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/mentor-response`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          mentor: chosen.name,
          message: contextMessage,
          mode: currentMode,
          recentTranscript: messagesRef.current
            .filter((m) => !m.isThinking)
            .slice(-10)
            .map((m) => ({ speaker: m.sender ?? (m.speaker === "you" ? "YOU" : "MENTOR"), text: m.text })),
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.response) throw new Error("Empty response");

      const followUpText = data.response as string;
      if (isTooSimilar(followUpText, recentTopics.current)) {
        removeMessageById(thinkingId);
        return;
      }

      recentTopics.current = [...recentTopics.current, followUpText.toLowerCase()].slice(-3);

      removeMessageById(thinkingId);
      addMessage(`${chosen.name}: ${followUpText}`, "mentor", chosen.name, [originalMentorName]);
    } catch {
      removeMessageById(thinkingId);
    } finally {
      setMentors((prev) =>
        prev.map((m) => {
          if (m.id !== chosen.id) return m;
          if (m.hasTask) return m;
          return { ...m, status: "idle", hasInterrupt: false, hasComment: false, lastRespondedTurn: turnId };
        })
      );
    }
  }

  async function dispatchMentorResponse(
    mentor: Mentor,
    userMessage: string,
    currentMode: Mode,
    turnId: number
  ) {
    setMentors((prev) =>
      prev.map((m) => m.id === mentor.id ? { ...m, status: "working" } : m)
    );

    const thinkingId = addMessage(
      `${mentor.name} is thinking...`,
      "mentor",
      mentor.name,
      ["YOU"],
      true
    );

    let responseText = "";
    try {
      responseText = await fetchMentorResponse(mentor.name, userMessage, currentMode);

      const lastWasQuestion = recentTopics.current.length > 0 && isQuestion(recentTopics.current[recentTopics.current.length - 1]);
      if (isTooSimilar(responseText, recentTopics.current)) {
        removeMessageById(thinkingId);
        return;
      }

      if (isQuestion(responseText) && lastWasQuestion) {
        responseText = await fetchMentorResponse(mentor.name, `${userMessage}\n\n[Instruction: Do NOT ask a question. Give a concrete suggestion or recommendation instead.]`, currentMode);
        if (isTooSimilar(responseText, recentTopics.current)) {
          removeMessageById(thinkingId);
          return;
        }
      }

      recentTopics.current = [...recentTopics.current, responseText.toLowerCase()].slice(-3);

      removeMessageById(thinkingId);
      addMessage(`${mentor.name}: ${responseText}`, "mentor", mentor.name, ["YOU"]);
    } catch {
      removeMessageById(thinkingId);
      addMessage(`${mentor.name}: I hit a problem generating a response.`, "mentor", mentor.name, ["YOU"]);
    } finally {
      setMentors((prev) =>
        prev.map((m) => {
          if (m.id !== mentor.id) return m;
          if (m.hasTask) return { ...m, status: m.status };
          return { ...m, status: "idle", hasInterrupt: false, hasComment: false, lastRespondedTurn: turnId };
        })
      );
    }

    if (responseText && highRiskTurnId.current !== turnId) {
      setTimeout(() => {
        maybeTriggerFollowUp(mentor.name, responseText, userMessage, currentMode, turnId);
      }, 800);
    }
  }

  function triggerSignals(targetMentors: Mentor[], messageText: string, currentMode: Mode) {
    const turnId = currentTurnId.current;
    const riskFactor = messageText.length > 20 ? 1 : 0.5;

    type SignalResult = { id: string; hasInterrupt: boolean; hasComment: boolean };

    const eligibleMentors = targetMentors.filter(
      (m) => m.lastRespondedTurn !== turnId
    );

    if (eligibleMentors.length === 0) return;

    const bestMentorMatch = getBestMentor(messageText);
    const relevantMentors = eligibleMentors.filter((m) => isMentorRelevant(m.name, messageText));
    const nonPrezRelevant = relevantMentors.filter((m) => m.name !== "PREZ");
    const poolMentors = nonPrezRelevant.length > 0
      ? (bestMentorMatch ? relevantMentors : nonPrezRelevant)
      : relevantMentors.length > 0
      ? relevantMentors
      : eligibleMentors;

    let signals: SignalResult[] = poolMentors.map((m) => {
      const interruptChance = m.interruptWeight * m.riskSensitivity * riskFactor;
      const commentChance = m.commentWeight;
      const roll = Math.random();
      if (roll < interruptChance) return { id: m.id, hasInterrupt: true, hasComment: false };
      if (roll < commentChance) return { id: m.id, hasInterrupt: false, hasComment: true };
      return { id: m.id, hasInterrupt: false, hasComment: false };
    });

    const anyResponded = signals.some((s) => s.hasInterrupt || s.hasComment);
    if (!anyResponded) {
      const sorted = [...poolMentors].sort((a, b) => b.commentWeight - a.commentWeight);
      const topWeight = sorted[0].commentWeight;
      const topTier = sorted.filter((m) => m.commentWeight === topWeight);
      const chosen = topTier[Math.floor(Math.random() * topTier.length)];
      signals = signals.map((s) =>
        s.id === chosen.id ? { ...s, hasComment: true } : s
      );
      if (!signals.find((s) => s.id === chosen.id)) {
        signals.push({ id: chosen.id, hasInterrupt: false, hasComment: true });
      }
    }

    const allResponding = signals.filter((s) => s.hasInterrupt || s.hasComment);

    const bestMentorName = getBestMentor(messageText);

    const sorted = [...allResponding].sort((a, b) => {
      const mA = poolMentors.find((m) => m.id === a.id);
      const mB = poolMentors.find((m) => m.id === b.id);
      if (!mA || !mB) return 0;

      if (bestMentorName) {
        const aIsBest = mA.name === bestMentorName;
        const bIsBest = mB.name === bestMentorName;
        if (aIsBest && !bIsBest) return -1;
        if (bIsBest && !aIsBest) return 1;
        const aIsPrez = mA.name === "PREZ";
        const bIsPrez = mB.name === "PREZ";
        if (aIsPrez && !bIsPrez) return 1;
        if (bIsPrez && !aIsPrez) return -1;
      }

      if (a.hasInterrupt !== b.hasInterrupt) return a.hasInterrupt ? -1 : 1;
      if (mB.riskSensitivity !== mA.riskSensitivity) return mB.riskSensitivity - mA.riskSensitivity;
      return mB.interruptWeight - mA.interruptWeight;
    });

    const respondingSignals = sorted.slice(0, MAX_RESPONSES_PER_TURN);
    const silencedSignals = sorted.slice(MAX_RESPONSES_PER_TURN);

    const silencedIds = new Set(silencedSignals.map((s) => s.id));
    setMentors((prev) =>
      prev.map((m) => {
        if (silencedIds.has(m.id)) {
          return { ...m, hasInterrupt: false, hasComment: false };
        }
        return m;
      })
    );

    respondingSignals.forEach((s) => {
      const mentor = poolMentors.find((m) => m.id === s.id);
      if (!mentor) return;
      dispatchMentorResponse(mentor, messageText, currentMode, turnId);
    });
  }

  function handleMentorClick(mentor: Mentor) {
    if (mentor.status === "ready" && mentor.hasTask) {
      addMessage(`${mentor.name}: Task complete. Ready for your review.`, "mentor", mentor.name, ["YOU"]);
      setMentors((prev) =>
        prev.map((m) =>
          m.id === mentor.id
            ? { ...m, status: "idle", hasComment: false, hasInterrupt: false, hasTask: false }
            : m
        )
      );
      return;
    }

    if (mentor.hasInterrupt || mentor.hasComment) {
      toggleMentorSelection(mentor.name);
      inputRef.current?.focus();
      return;
    }

    toggleMentorSelection(mentor.name);
    inputRef.current?.focus();
  }

  function assignMentor(mentorName: string) {
    setMentors((prev) =>
      prev.map((m) => (m.name === mentorName ? { ...m, status: "assigned", hasTask: true } : m))
    );
    setTimeout(() => setMentorStatus(mentorName, "working"), 1000);
    setTimeout(() => setMentorStatus(mentorName, "ready"), 3000);
  }

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed) return;

    currentTurnId.current += 1;
    const turnId = currentTurnId.current;
    recentTopics.current = [];
    const currentMode = mode;

    const taskPattern = /^([A-Za-z0-9]+):\s*.+$/;
    const taskMatch = trimmed.match(taskPattern);
    const taskMentorName = taskMatch
      ? mentors.find((m) => m.name === taskMatch[1].toUpperCase())?.name ?? null
      : null;

    const targets = selectedMentors.length > 0 ? [...selectedMentors] : ["ALL"];
    addMessage(trimmed, "you", "YOU", targets);

    if (taskMentorName) {
      assignMentor(taskMentorName);
    }

    const activeMentorObjs = mentors.filter((m) => selectedMentors.includes(m.name));
    setSelectedMentors([]);
    setInput("");

    if (isHighRisk(trimmed)) {
      highRiskTurnId.current = turnId;
      const doc = mentors.find((m) => m.name === "DOC");
      const cipher = mentors.find((m) => m.name === "CIPHER");
      if (doc) {
        const riskPrompt = `${trimmed}\n\n[Instruction: This is a high-risk request. Respond with a clear concern, explain what could go wrong in concrete terms, and do NOT respond with only a question.]`;
        setTimeout(() => dispatchMentorResponse(doc, riskPrompt, currentMode, turnId), 400);
      }
      if (cipher) {
        const trustPrompt = `${trimmed}\n\n[Instruction: This is a high-risk request. Respond by addressing trust, safety, and the impact on users. Be direct and specific.]`;
        setTimeout(() => dispatchMentorResponse(cipher, trustPrompt, currentMode, turnId), 1800);
      }
      return;
    }

    if (activeMentorObjs.length > 0) {
      const nonTaskTargets = activeMentorObjs.filter((m) => m.name !== taskMentorName);
      nonTaskTargets.slice(0, MAX_RESPONSES_PER_TURN).forEach((mentor) => {
        setTimeout(() => dispatchMentorResponse(mentor, trimmed, currentMode, turnId), 400);
      });
    } else {
      const conversationTargets = mentors.filter((m) => m.name !== taskMentorName);
      setTimeout(() => triggerSignals(conversationTargets, trimmed, currentMode), 600);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleSend();
  }

  function handleSaveNote(note: SideNote, newTags: string[]) {
    setSideNotes((prev) => [...prev, note]);
    if (newTags.length > 0) {
      setUsedTags((prev) => [...prev, ...newTags]);
    }
    setShowSideNoteModal(false);
  }

  const lastNote = sideNotes[sideNotes.length - 1];

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: "#0D1B2E", color: "#FFFFFF", fontFamily: "'Inter', sans-serif" }}
    >
      {showSideNoteModal && (
        <SideNoteModal
          usedTags={usedTags}
          onSave={handleSaveNote}
          onClose={() => setShowSideNoteModal(false)}
        />
      )}

      {/* TOP BAR */}
      <div
        className="flex items-center justify-between px-6 py-3 border-b"
        style={{ borderColor: "#1B2A4A" }}
      >
        <span className="text-sm font-semibold tracking-widest uppercase" style={{ color: "#C9A84C" }}>
          Staff Meeting Room
        </span>
        <div className="flex gap-2">
          {(["brainstorm", "command"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="px-4 py-1.5 text-sm font-semibold tracking-wider uppercase rounded transition-all duration-150"
              style={
                mode === m
                  ? { backgroundColor: "#C9A84C", color: "#0D1B2E" }
                  : { backgroundColor: "#1B2A4A", color: "#8A9BB5" }
              }
            >
              {m}
            </button>
          ))}
        </div>
        <span className="text-xs tracking-widest uppercase" style={{ color: "#8A9BB5" }}>
          Mode:{" "}
          <span style={{ color: "#C9A84C" }} className="font-bold">
            {mode.toUpperCase()}
          </span>
        </span>
      </div>

      {/* MENTOR GRID */}
      <div className="px-6 pt-5 pb-4">
        <p className="text-xs tracking-widest uppercase mb-3" style={{ color: "#8A9BB5" }}>
          Mentors
        </p>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {mentors.map((mentor) => {
            const isSelected = selectedMentors.includes(mentor.name);
            return (
              <button
                key={mentor.id}
                onClick={() => handleMentorClick(mentor)}
                className={[
                  "aspect-square flex flex-col items-center justify-center rounded-lg transition-all duration-200 hover:opacity-90 active:scale-95 relative overflow-hidden",
                  mentor.status === "working" && !mentor.hasInterrupt ? "animate-pulse" : "",
                ].join(" ")}
                style={{
                  ...STATUS_STYLES[mentor.status],
                  boxShadow: mentor.hasInterrupt
                    ? "0 0 0 2px #F87171, 0 0 14px 4px rgba(248,113,113,0.45)"
                    : isSelected
                    ? "0 0 0 1.5px #C9A84C, 0 0 12px 3px rgba(201,168,76,0.25)"
                    : "none",
                }}
                title={
                  mentor.hasInterrupt
                    ? `${mentor.name}: INTERRUPT — click to respond`
                    : mentor.hasComment
                    ? `${mentor.name}: has a comment — click to hear it`
                    : mentor.status === "ready"
                    ? "Click to receive result"
                    : isSelected
                    ? `Deselect ${mentor.name}`
                    : `Select ${mentor.name}`
                }
              >
                {mentor.hasInterrupt && (
                  <span
                    className="absolute top-0 left-0 right-0 h-1 animate-pulse"
                    style={{ backgroundColor: "#F87171" }}
                  />
                )}

                {mentor.hasComment && !mentor.hasInterrupt && (
                  <span
                    className="absolute top-2 left-2 w-2 h-2 rounded-full"
                    style={{ backgroundColor: "#C9A84C", boxShadow: "0 0 6px 1px rgba(201,168,76,0.6)" }}
                  />
                )}

                <span
                  className="absolute top-2 right-2 w-2 h-2 rounded-full"
                  style={{ backgroundColor: STATUS_DOT[mentor.status] }}
                />

                <span className="text-xs font-bold tracking-widest leading-none">{mentor.name}</span>
                <span
                  className="mt-1.5 text-[9px] tracking-widest uppercase font-medium"
                  style={{
                    color: mentor.hasInterrupt
                      ? "#F87171"
                      : mentor.hasComment
                      ? "#C9A84C"
                      : STATUS_DOT[mentor.status],
                  }}
                >
                  {mentor.hasInterrupt
                    ? "INTERRUPT"
                    : mentor.hasComment
                    ? "COMMENT"
                    : STATUS_LABEL[mentor.status]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SIDE NOTES BAR */}
      {sideNotes.length > 0 && (
        <div
          className="mx-6 mb-3 px-4 py-2.5 rounded-lg flex items-start gap-3 text-xs"
          style={{ backgroundColor: "#111D30", color: "#8A9BB5" }}
        >
          <div className="flex-1 min-w-0">
            <span style={{ color: "#C9A84C" }} className="font-semibold">
              Side Notes ({sideNotes.length}):
            </span>{" "}
            <span className="truncate">{lastNote?.text}</span>
            {lastNote && lastNote.tags.length > 0 && (
              <span className="ml-2">
                {lastNote.tags.map((t) => (
                  <span
                    key={t}
                    className="inline-block mr-1 px-1.5 py-0.5 rounded text-[9px] font-semibold"
                    style={{ backgroundColor: "rgba(201,168,76,0.15)", color: "#C9A84C" }}
                  >
                    {t}
                  </span>
                ))}
              </span>
            )}
          </div>
          <button
            onClick={() => setShowSideNoteModal(true)}
            className="text-[10px] tracking-widest uppercase font-semibold whitespace-nowrap transition-colors hover:opacity-80"
            style={{ color: "#C9A84C" }}
          >
            + Add
          </button>
        </div>
      )}

      {/* TRANSCRIPT */}
      <div className="flex-1 flex flex-col min-h-0 px-6 pb-2">
        <p className="text-xs tracking-widest uppercase mb-2" style={{ color: "#8A9BB5" }}>
          Transcript
        </p>
        <div
          ref={transcriptRef}
          className="flex-1 overflow-y-auto rounded-lg p-4"
          style={{ backgroundColor: "#111D30", minHeight: "200px" }}
        >
          {messages.length === 0 ? (
            <p className="text-sm text-center mt-8" style={{ color: "#3A4F6A" }}>
              No messages yet. Select mentors and type below to begin.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {messages.map((msg) => {
                const isYou = msg.speaker === "you";
                const sender = msg.sender ?? (isYou ? "YOU" : "MENTOR");
                const targets = msg.targets ?? ["ALL"];
                return (
                  <div
                    key={msg.id}
                    className="rounded-lg px-3 py-2.5"
                    style={{
                      backgroundColor: msg.isThinking
                        ? "rgba(255,255,255,0.015)"
                        : "rgba(255,255,255,0.03)",
                    }}
                  >
                    <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                      <span
                        className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded"
                        style={
                          isYou
                            ? { color: "#FFFFFF", backgroundColor: "rgba(255,255,255,0.1)" }
                            : { color: "#4ADE80", backgroundColor: "rgba(74,222,128,0.1)" }
                        }
                      >
                        {sender}
                      </span>
                      <span style={{ color: "#3A4F6A", fontSize: "10px" }}>→</span>
                      {targets.map((t) =>
                        t === "ALL" ? (
                          <span
                            key={t}
                            className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded"
                            style={{
                              color: "#8A9BB5",
                              border: "1px solid #3A4F6A",
                              backgroundColor: "transparent",
                            }}
                          >
                            ALL
                          </span>
                        ) : (
                          <span
                            key={t}
                            className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded"
                            style={{ backgroundColor: "#C9A84C", color: "#0D1B2E" }}
                          >
                            {t}
                          </span>
                        )
                      )}
                    </div>
                    <p
                      className="text-sm leading-relaxed"
                      style={{
                        color: isYou ? "#FFFFFF" : msg.isThinking ? "#3A4F6A" : "#D0DFEE",
                        fontStyle: msg.isThinking ? "italic" : "normal",
                      }}
                    >
                      {msg.text}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* INPUT BAR */}
      <div className="px-6 py-4 border-t" style={{ borderColor: "#1B2A4A" }}>
        {selectedMentors.length > 0 && (
          <div className="flex gap-2 mb-2.5 flex-wrap">
            {selectedMentors.map((name) => (
              <span
                key={name}
                className="flex items-center gap-1 text-[10px] tracking-widest uppercase font-semibold px-2 py-0.5 rounded"
                style={{
                  backgroundColor: "transparent",
                  color: "#C9A84C",
                  border: "1px solid #C9A84C",
                }}
              >
                {name}
                <button
                  onClick={() => removeSelectedMentor(name)}
                  className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity leading-none"
                  style={{ fontSize: "11px" }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            className="flex-1 px-4 py-3 rounded-lg text-sm outline-none transition-all"
            style={{
              backgroundColor: "#1B2A4A",
              color: "#FFFFFF",
              border: selectedMentors.length > 0 ? "1px solid rgba(201,168,76,0.5)" : "1px solid #2A3D5E",
            }}
          />
          <button
            onClick={handleSend}
            className="px-5 py-3 rounded-lg font-semibold text-sm tracking-wider uppercase transition-all duration-150 hover:opacity-90 active:scale-95"
            style={{ backgroundColor: "#C9A84C", color: "#0D1B2E" }}
          >
            Send
          </button>
          <button
            onClick={() => setShowSideNoteModal(true)}
            className="px-5 py-3 rounded-lg font-semibold text-sm tracking-wider uppercase transition-all duration-150 hover:opacity-90 active:scale-95"
            style={{ backgroundColor: "#1B2A4A", color: "#8A9BB5", border: "1px solid #2A3D5E" }}
          >
            Side Note{sideNotes.length > 0 ? ` (${sideNotes.length})` : ""}
          </button>
        </div>
        <p className="text-xs mt-2" style={{ color: "#3A4F6A" }}>
          Click mentor tiles to select targets. Leave unselected to message all. Click a ready mentor to receive their result.
        </p>
      </div>
    </div>
  );
}
