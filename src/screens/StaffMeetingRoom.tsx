import { useState, useRef, useEffect, useCallback } from "react";
import SideNoteModal, { SideNote } from "./SideNoteModal";
import { upsertTranscript, upsertJulieReport, saveSideNote, upsertTags, type TranscriptMessage } from "../lib/db";

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
  turnCount: number;
}

interface MeetingState {
  openQuestions: string[];
  answeredQuestions: { question: string; answer: string }[];
  assignedTasks: { task: string; owner: string }[];
  unresolvedTopics: string[];
  activeTopics: string[];
  decisionsMade: string[];
  pendingDecisions: string[];
  mentorParticipation: Record<string, number>;
  droppedIdeas: string[];
}

interface Message {
  id: number;
  text: string;
  speaker: "you" | "mentor";
  sender?: string;
  targets?: string[];
  isThinking?: boolean;
  isJulie?: boolean;
}

interface JulieRouting {
  mentors: string[];
  line?: string;
  action?: "route" | "summarize" | "acknowledge" | "refocus";
}

interface MentorMeta {
  department: string;
  realName: string;
  bullets: string[];
  humorDial: number;
  humorStyle: string;
}

const MENTOR_META: Record<string, MentorMeta> = {
  MARK:    { department: "STRATEGY",           realName: "Mark Reeves",   bullets: ["Strategic direction", "Vision & positioning", "High-level decisions"], humorDial: 3, humorStyle: "Dry executive wit. Occasional sarcastic clarity. 'Let's not tank the company today' energy. One wry observation, then back to the point." },
  SCOUT:   { department: "STRATEGY",           realName: "Scout",         bullets: ["Market intelligence", "Competitive landscape", "Opportunity mapping"],  humorDial: 2, humorStyle: "Dry intelligence-analyst humor. Brief, precise. 'Signal logged, confidence: moderate, concern: real.' Rare and understated." },
  DOC:     { department: "CRITICAL SYSTEMS",   realName: "Dr. Dana Cruz", bullets: ["Safety & harm analysis", "Emotional impact", "User wellbeing"],         humorDial: 2, humorStyle: "Gentle, grounding humor. Calm reassurance. Rare but human. Never jokes about harm — only about the absurdity of overlooking obvious safeguards." },
  CIPHER:  { department: "CRITICAL SYSTEMS",   realName: "Cipher",        bullets: ["Data & privacy", "Trust architecture", "Ethics & consent"],              humorDial: 2, humorStyle: "Dry, subtle. Occasional 'this is how breaches happen' wryness. Sounds slightly ominous but safe — like a trust engineer who reads terms of service for fun." },
  TECHGUY: { department: "CRITICAL SYSTEMS",   realName: "Tyler Marsh",   bullets: ["Engineering & systems", "Build feasibility", "Technical debt"],          humorDial: 3, humorStyle: "Nerd humor. 'This will break in production' jokes. 'We can build that — my concern is reality may file an objection.' Slightly blunt but never cruel." },
  RICK:    { department: "CRITICAL SYSTEMS",   realName: "Rick Alvarez",  bullets: ["Operational risk", "Failure scenarios", "Execution exposure"],            humorDial: 4, humorStyle: "Dark humor. Worst-case framing with wit. 'This has the energy of a postmortem.' Comfortable with grim outcomes, but frames them with dry levity." },
  SIGMA:   { department: "EXECUTION",          realName: "Sigma",         bullets: ["Workflows & systems", "Efficiency & scale", "Process design"],            humorDial: 2, humorStyle: "Quiet, efficient. Rare dry one-liners about broken processes. 'I can already feel a future checklist forming.' Nothing flashy." },
  PAUL:    { department: "EXECUTION",          realName: "Paul Bennett",  bullets: ["Prioritization", "Cuts scope", "Forces a next step"],                    humorDial: 2, humorStyle: "Minimal humor. Occasional deadpan delivery. 'Important, yes. Current-century important, unclear.' Cuts to the bone, occasionally with a quiet edge." },
  JAMES:   { department: "COMMUNICATION",      realName: "James",         bullets: ["Internal messaging", "Team alignment", "Clarity of voice"],               humorDial: 3, humorStyle: "Clever wordplay. Light reframing humor. Smooth, polished delivery. Notices when a well-meaning message is about to land badly — sometimes with a quiet smirk." },
  MAILMAN: { department: "COMMUNICATION",      realName: "Mailman",       bullets: ["Outbound messaging", "Email & comms delivery", "Audience tone"],          humorDial: 2, humorStyle: "Delivery tracking humor. 'Message received, stamped, and emotionally misdelivered.' Punchy and audience-aware." },
  PAT:     { department: "INTELLIGENCE",       realName: "Pat Vance",     bullets: ["Pattern recognition", "Cross-session insight", "Repeated mistakes"],      humorDial: 3, humorStyle: "Pattern-calling humor. 'We've seen this movie before.' Knows the ending before anyone else — and has a quiet amusement about it." },
  JERRY:   { department: "INTELLIGENCE",       realName: "Jerry",         bullets: ["Research & data", "Evidence gathering", "Fact-checking"],                 humorDial: 2, humorStyle: "Awkward but sharp. 'This may be a bad question, which is usually how I know it matters.' Slightly self-deprecating, always evidence-first." },
  ALEX:    { department: "USER & EXPERIENCE",  realName: "Alex Morgan",   bullets: ["UX & usability", "Interface clarity", "Friction reduction"],             humorDial: 4, humorStyle: "Observational humor. Calls out bad UX like a designer roasting a layout. 'A user will absolutely click the wrong thing there. Respectfully.' Light sarcasm, never mean." },
  ULYSES:  { department: "USER & EXPERIENCE",  realName: "Ulyses",        bullets: ["Real user perspective", "First impressions", "Honest reactions"],         humorDial: 4, humorStyle: "Storytelling humor. Human, narrative-driven. Occasional dramatic exaggeration of user confusion. 'If I were the user, I would have questions and maybe leave.'" },
  RAY:     { department: "USER & EXPERIENCE",  realName: "Ray",           bullets: ["Accessibility", "Inclusive design", "Barrier removal"],                  humorDial: 2, humorStyle: "Practical world-weariness. 'That may sound good in the room. The world is less polite.' Grounded, never sarcastic about real barriers." },
  ATK:     { department: "LEGAL",              realName: "ATK",           bullets: ["Legal offense", "IP & claims", "Contract leverage"],                     humorDial: 3, humorStyle: "Aggressive sarcasm. Sharp, pointed. 'A plaintiff would love this. I do not.' Legal offense framed with dark wit." },
  DEF:     { department: "LEGAL",              realName: "DEF",           bullets: ["Legal defense", "Risk exposure", "Compliance shielding"],                humorDial: 3, humorStyle: "Defensive wit. Calm but clever. 'That sounds dangerous until I phrase it properly.' Confident under pressure with quiet humor." },
  WATCHER: { department: "OPERATIONS",         realName: "Watcher",       bullets: ["Monitoring & alerts", "System health", "Silent observation"],            humorDial: 2, humorStyle: "Continuity humor. 'For the record, we said something very similar earlier.' Speaks rarely — but when it does, it sometimes lands with quiet irony." },
  KAREN:   { department: "OPERATIONS",         realName: "Karen",         bullets: ["Admin & logistics", "Process enforcement", "Keeps things moving"],       humorDial: 2, humorStyle: "Quality-control dryness. 'I am trying to be supportive while also noticing three problems.' No-nonsense with a slight edge." },
  THATGUY: { department: "OPERATIONS",         realName: "That Guy",      bullets: ["The wild card", "Unconventional takes", "Asks what no one will"],        humorDial: 4, humorStyle: "System gap humor. 'I regret to inform everyone that the handoff is where this goes to die.' Slightly irreverent, occasionally brilliant, always worth hearing once." },
  JAMISON: { department: "COMMUNICATION",      realName: "James Jamison", bullets: ["Copy & tone", "Message clarity", "Word choices"],                       humorDial: 3, humorStyle: "Copy editor weariness. 'That headline has three jobs and none of them are going well.' Sharp, observational, dry — like someone who's read too many bad taglines." },
  SAM:     { department: "EXECUTION",          realName: "Sam",           bullets: ["Task ownership", "Who does what", "Timeline tracking"],                  humorDial: 2, humorStyle: "Minimal humor. Occasionally dry about ownership gaps. 'Great plan. Who's doing it?' Operational directness with rare light levity." },
  JULIE:   { department: "FACILITATION",       realName: "Julie",         bullets: ["Routes all messages", "Meeting facilitator", "Session memory"],          humorDial: 4, humorStyle: "Warm, human humor. Light 4th wall slips about running the meeting. 'Filing that under important and mildly chaotic.' Keeps the energy alive without derailing it." },
};

const DEPARTMENT_ORDER = ["STRATEGY", "CRITICAL SYSTEMS", "EXECUTION", "COMMUNICATION", "INTELLIGENCE", "USER & EXPERIENCE", "LEGAL", "OPERATIONS", "FACILITATION"];

const DEPARTMENT_COLORS: Record<string, string> = {
  "STRATEGY":          "#C9A84C",
  "CRITICAL SYSTEMS":  "#E07B5A",
  "EXECUTION":         "#5A9BD3",
  "COMMUNICATION":     "#6BAF8E",
  "INTELLIGENCE":      "#A07BC9",
  "USER & EXPERIENCE": "#5AB8A8",
  "LEGAL":             "#C97B7B",
  "OPERATIONS":        "#7B8FA8",
  "FACILITATION":      "#8A9BB5",
};

const INITIAL_MENTORS: Mentor[] = [
  { id: "mark",    name: "MARK",    status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.7,  commentWeight: 0.6, riskSensitivity: 0.8,  lastRespondedTurn: null, hasTask: false, turnCount: 0 },
  { id: "scout",   name: "SCOUT",   status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.4,  commentWeight: 0.7, riskSensitivity: 0.6,  lastRespondedTurn: null, hasTask: false, turnCount: 0 },
  { id: "jamison", name: "JAMISON", status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.2,  commentWeight: 0.8, riskSensitivity: 0.7,  lastRespondedTurn: null, hasTask: false, turnCount: 0 },
  { id: "doc",     name: "DOC",     status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.9,  commentWeight: 0.7, riskSensitivity: 1.0,  lastRespondedTurn: null, hasTask: false, turnCount: 0 },
  { id: "tech9",   name: "TECHGUY", status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.5,  commentWeight: 0.7, riskSensitivity: 0.7,  lastRespondedTurn: null, hasTask: false, turnCount: 0 },
  { id: "sam",     name: "SAM",     status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.4,  commentWeight: 0.6, riskSensitivity: 0.6,  lastRespondedTurn: null, hasTask: false, turnCount: 0 },
  { id: "cipher",  name: "CIPHER",  status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.85, commentWeight: 0.6, riskSensitivity: 1.0,  lastRespondedTurn: null, hasTask: false, turnCount: 0 },
  { id: "rick",    name: "RICK",    status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.6,  commentWeight: 0.7, riskSensitivity: 0.9,  lastRespondedTurn: null, hasTask: false, turnCount: 0 },
  { id: "alex",    name: "ALEX",    status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.3,  commentWeight: 0.8, riskSensitivity: 0.5,  lastRespondedTurn: null, hasTask: false, turnCount: 0 },
  { id: "paul",    name: "PAUL",    status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.5,  commentWeight: 0.7, riskSensitivity: 0.4,  lastRespondedTurn: null, hasTask: false, turnCount: 0 },
  { id: "pat",     name: "PAT",     status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.2,  commentWeight: 0.5, riskSensitivity: 0.5,  lastRespondedTurn: null, hasTask: false, turnCount: 0 },
  { id: "ulyses",  name: "ULYSES",  status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.3,  commentWeight: 0.8, riskSensitivity: 0.3,  lastRespondedTurn: null, hasTask: false, turnCount: 0 },
  { id: "sigma",   name: "SIGMA",   status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.4,  commentWeight: 0.7, riskSensitivity: 0.5,  lastRespondedTurn: null, hasTask: false, turnCount: 0 },
  { id: "james",   name: "JAMES",   status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.3,  commentWeight: 0.8, riskSensitivity: 0.4,  lastRespondedTurn: null, hasTask: false, turnCount: 0 },
  { id: "mailman", name: "MAILMAN", status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.2,  commentWeight: 0.8, riskSensitivity: 0.3,  lastRespondedTurn: null, hasTask: false, turnCount: 0 },
  { id: "jerry",   name: "JERRY",   status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.3,  commentWeight: 0.7, riskSensitivity: 0.5,  lastRespondedTurn: null, hasTask: false, turnCount: 0 },
  { id: "ray",     name: "RAY",     status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.3,  commentWeight: 0.7, riskSensitivity: 0.5,  lastRespondedTurn: null, hasTask: false, turnCount: 0 },
  { id: "atk",     name: "ATK",     status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.5,  commentWeight: 0.6, riskSensitivity: 0.8,  lastRespondedTurn: null, hasTask: false, turnCount: 0 },
  { id: "def",     name: "DEF",     status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.5,  commentWeight: 0.6, riskSensitivity: 0.9,  lastRespondedTurn: null, hasTask: false, turnCount: 0 },
  { id: "watcher", name: "WATCHER", status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.1,  commentWeight: 0.4, riskSensitivity: 0.7,  lastRespondedTurn: null, hasTask: false, turnCount: 0 },
  { id: "karen",   name: "KAREN",   status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.4,  commentWeight: 0.6, riskSensitivity: 0.5,  lastRespondedTurn: null, hasTask: false, turnCount: 0 },
  { id: "thatguy", name: "THATGUY", status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.6,  commentWeight: 0.9, riskSensitivity: 0.3,  lastRespondedTurn: null, hasTask: false, turnCount: 0 },
  { id: "julie",   name: "JULIE",   status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.0,  commentWeight: 0.0, riskSensitivity: 0.0,  lastRespondedTurn: null, hasTask: false, turnCount: 0 },
];

const INITIAL_MEETING_STATE: MeetingState = {
  openQuestions: [],
  answeredQuestions: [],
  assignedTasks: [],
  unresolvedTopics: [],
  activeTopics: [],
  decisionsMade: [],
  pendingDecisions: [],
  mentorParticipation: {},
  droppedIdeas: [],
};

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

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const ALL_MENTOR_NAMES = ["MARK", "SCOUT", "JAMISON", "DOC", "TECHGUY", "SAM", "CIPHER", "RICK", "ALEX", "PAUL", "PAT", "ULYSES", "SIGMA", "JAMES", "MAILMAN", "JERRY", "RAY", "ATK", "DEF", "WATCHER", "KAREN", "THATGUY"];

function isHighRisk(message: string): boolean {
  const lower = message.toLowerCase();
  return [
    "remove safeguards",
    "remove all safeguards",
    "disable safety",
    "no safeguards",
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

function isSummaryRequest(text: string): boolean {
  const lower = text.toLowerCase();
  return ["summary", "where are we", "recap", "what have we decided", "what's open", "status check"].some(
    (k) => lower.includes(k)
  );
}

function isOpenFloor(text: string): boolean {
  const lower = text.toLowerCase();
  return ["anyone else", "thoughts", "what do you all think", "who else", "other ideas"].some(
    (t) => lower.includes(t)
  );
}

function isAnyoneElse(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes("anyone else") || lower.includes("who else");
}

interface Props {
  sessionId: string | null;
}

export default function StaffMeetingRoom({ sessionId }: Props) {
  const [mentors, setMentors] = useState<Mentor[]>(INITIAL_MENTORS);
  const [mode, setMode] = useState<Mode>("brainstorm");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [sideNotes, setSideNotes] = useState<SideNote[]>([]);
  const [usedTags, setUsedTags] = useState<string[]>([]);
  const [showSideNoteModal, setShowSideNoteModal] = useState(false);
  const [selectedMentors, setSelectedMentors] = useState<string[]>([]);
  const [meetingState, setMeetingState] = useState<MeetingState>(INITIAL_MEETING_STATE);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const msgCounter = useRef(0);
  const currentTurnId = useRef(0);
  const messagesRef = useRef<Message[]>([]);
  const mentorsRef = useRef<Mentor[]>(INITIAL_MENTORS);
  const meetingStateRef = useRef<MeetingState>(INITIAL_MEETING_STATE);
  const recentTopics = useRef<string[]>([]);
  const highRiskTurnId = useRef<number | null>(null);
  const lastJulieSpeakTurn = useRef<number>(-10);

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { mentorsRef.current = mentors; }, [mentors]);
  useEffect(() => { meetingStateRef.current = meetingState; }, [meetingState]);

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [messages]);

  const persistSession = useCallback(() => {
    if (!sessionId) return;
    const persistable: TranscriptMessage[] = messagesRef.current
      .filter((m) => !m.isThinking)
      .map((m) => ({ id: m.id, text: m.text, speaker: m.speaker, sender: m.sender, targets: m.targets }));
    upsertTranscript(sessionId, persistable).catch(() => {});
    const s = meetingStateRef.current;
    upsertJulieReport(sessionId, {
      open_questions: s.openQuestions,
      answered_questions: s.answeredQuestions,
      assigned_tasks: s.assignedTasks,
      unresolved_topics: s.unresolvedTopics,
      active_topics: s.activeTopics,
      decisions_made: s.decisionsMade,
      pending_decisions: s.pendingDecisions,
      mentor_participation: s.mentorParticipation,
      dropped_ideas: s.droppedIdeas,
    }).catch(() => {});
  }, [sessionId]);

  useEffect(() => {
    const timer = setTimeout(persistSession, 2000);
    return () => clearTimeout(timer);
  }, [messages, meetingState, persistSession]);

  function nextId() {
    msgCounter.current += 1;
    return msgCounter.current;
  }

  function addMessage(text: string, speaker: "you" | "mentor", sender?: string, targets?: string[], isThinking?: boolean, isJulie?: boolean): number {
    const id = nextId();
    setMessages((prev) => [...prev, { id, text, speaker, sender, targets, isThinking, isJulie }]);
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

  function setMentorStatus(name: string, status: MentorStatus) {
    setMentors((prev) => prev.map((m) => (m.name === name ? { ...m, status } : m)));
  }

  function trackMentorTurn(mentorName: string) {
    setMentors((prev) => prev.map((m) => m.name === mentorName ? { ...m, turnCount: m.turnCount + 1 } : m));
    setMeetingState((prev) => ({
      ...prev,
      mentorParticipation: {
        ...prev.mentorParticipation,
        [mentorName]: (prev.mentorParticipation[mentorName] ?? 0) + 1,
      },
    }));
  }

  function trackUserMessage(text: string) {
    if (!text.trimEnd().endsWith("?")) return;
    setMeetingState((prev) => ({
      ...prev,
      openQuestions: [...prev.openQuestions, text],
    }));
  }

  function markQuestionAnswered(question: string, answer: string) {
    setMeetingState((prev) => ({
      ...prev,
      openQuestions: prev.openQuestions.filter((q) => q !== question),
      answeredQuestions: [...prev.answeredQuestions, { question, answer }],
    }));
  }

  function trackActiveTopic(text: string) {
    const topic = text.slice(0, 80);
    setMeetingState((prev) => {
      if (prev.activeTopics.includes(topic)) return prev;
      return { ...prev, activeTopics: [...prev.activeTopics.slice(-4), topic] };
    });
  }

  function trackDroppedIdea(text: string) {
    const idea = text.slice(0, 80);
    setMeetingState((prev) => ({
      ...prev,
      droppedIdeas: [...prev.droppedIdeas.slice(-9), idea],
    }));
  }

  function trackAssignedTask(task: string, owner: string) {
    setMeetingState((prev) => ({
      ...prev,
      assignedTasks: [...prev.assignedTasks, { task, owner }],
    }));
  }

  function getRecentTranscript(limit = 8) {
    return messagesRef.current
      .filter((m) => !m.isThinking)
      .slice(-limit)
      .map((m) => ({ speaker: m.sender ?? (m.speaker === "you" ? "YOU" : "MENTOR"), text: m.text }));
  }

  async function fetchMentorResponse(
    mentorName: string,
    userMessage: string,
    currentMode: Mode,
    isInterrupt = false,
    isOpenFloorMsg = false
  ): Promise<string> {
    const meta = MENTOR_META[mentorName];
    const body: Record<string, unknown> = {
      mentor: mentorName,
      message: userMessage,
      mode: currentMode,
      recentTranscript: getRecentTranscript(),
      isInterrupt,
      isOpenFloor: isOpenFloorMsg,
      humorDial: meta?.humorDial ?? 2,
      humorStyle: meta?.humorStyle ?? "",
    };

    if (mentorName === "JULIE") {
      body.meetingState = meetingStateRef.current;
    }

    const res = await fetch(`${SUPABASE_URL}/functions/v1/mentor-response`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.response) throw new Error("Empty response");
    return data.response as string;
  }

  async function askJulieToRoute(userMessage: string, currentMode: Mode, forcedMentors?: string[]): Promise<JulieRouting> {
    const participationMap = meetingStateRef.current.mentorParticipation;
    const currentMentors = mentorsRef.current;

    const mentorCounts = ALL_MENTOR_NAMES.map((name) => ({
      name,
      count: participationMap[name] ?? 0,
      turnCount: currentMentors.find((m) => m.name === name)?.turnCount ?? 0,
    }));

    const leastSpoken = [...mentorCounts].sort((a, b) => a.count - b.count).map((m) => m.name);

    const anyoneElse = isAnyoneElse(userMessage);

    const juliePrompt = `USER MESSAGE: "${userMessage}"
MEETING MODE: ${currentMode}
MENTOR TURN COUNTS THIS SESSION: ${JSON.stringify(mentorCounts)}
LEAST SPOKEN MENTORS (in order): ${leastSpoken.join(", ")}
${anyoneElse ? "USER ASKED 'ANYONE ELSE' — do NOT route to MARK. Pick from those who have spoken least." : ""}
${forcedMentors ? `USER EXPLICITLY SELECTED: ${forcedMentors.join(", ")} — route to them.` : ""}

Your job is to decide who should speak. Return ONLY valid JSON in this exact format:
{"mentors":["NAME1"],"line":"optional brief line you want to say out loud","action":"route"}

Rules:
- mentors: 1 or 2 names from [MARK, SCOUT, JAMISON, DOC, TECHGUY, SAM, CIPHER, RICK, ALEX, PAUL, PAT, ULYSES, SIGMA, JAMES, MAILMAN, JERRY, RAY, ATK, DEF, WATCHER, KAREN, THATGUY]
- Never include JULIE in mentors
- If user is venting/emotional: include your "line" acknowledging it briefly, still route
- "line" is OPTIONAL — only include if you have something worth saying (not to fill space)
- If user asks for summary: set action to "summarize" and include your full summary in "line", mentors: []
- If it's simple acknowledgment ("ok", "got it", "thanks"): action "acknowledge", mentors: [], no line
- Prefer mentors who have spoken less. Avoid letting one mentor dominate.
- Only pick 2 mentors if both domains are clearly relevant
- Return ONLY the JSON object, no other text`;

    try {
      const raw = await fetchMentorResponse("JULIE", juliePrompt, currentMode);
      const cleaned = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned) as JulieRouting;
      if (!Array.isArray(parsed.mentors)) parsed.mentors = [];
      parsed.mentors = parsed.mentors.filter((n) => ALL_MENTOR_NAMES.includes(n));
      return parsed;
    } catch {
      const fallback = leastSpoken.find((n) => n !== "PREZ") ?? "PREZ";
      return { mentors: [fallback], action: "route" };
    }
  }

  async function dispatchMentorResponse(
    mentor: Mentor,
    userMessage: string,
    currentMode: Mode,
    turnId: number,
    isInterrupt = false,
    isOpenFloorMsg = false,
    delayMs = 0
  ) {
    await new Promise((r) => setTimeout(r, delayMs));
    if (currentTurnId.current !== turnId) return;

    setMentors((prev) => prev.map((m) => m.id === mentor.id ? { ...m, status: "working" } : m));

    const thinkingId = addMessage(`${mentor.name} is thinking...`, "mentor", mentor.name, ["YOU"], true);

    let responseText = "";
    try {
      responseText = await fetchMentorResponse(mentor.name, userMessage, currentMode, isInterrupt, isOpenFloorMsg);

      if (!isInterrupt && isTooSimilar(responseText, recentTopics.current)) {
        removeMessageById(thinkingId);
        return;
      }

      const lastWasQuestion = recentTopics.current.length > 0 && isQuestion(recentTopics.current[recentTopics.current.length - 1]);
      if (!isInterrupt && isQuestion(responseText) && lastWasQuestion) {
        responseText = await fetchMentorResponse(
          mentor.name,
          `${userMessage}\n\n[Instruction: Do NOT ask a question. Give a concrete suggestion or recommendation instead.]`,
          currentMode
        );
        if (isTooSimilar(responseText, recentTopics.current)) {
          removeMessageById(thinkingId);
          return;
        }
      }

      recentTopics.current = [...recentTopics.current, responseText.toLowerCase()].slice(-3);
      trackMentorTurn(mentor.name);

      const openQs = meetingStateRef.current.openQuestions;
      if (openQs.length > 0) {
        const matched = openQs.find((q) =>
          responseText.toLowerCase().includes(q.toLowerCase().slice(0, 30))
        );
        if (matched) markQuestionAnswered(matched, responseText);
      }

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
  }

  function handleMentorClick(mentor: Mentor) {
    if (mentor.name === "JULIE") {
      toggleMentorSelection(mentor.name);
      inputRef.current?.focus();
      return;
    }

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

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed) return;

    currentTurnId.current += 1;
    const turnId = currentTurnId.current;
    recentTopics.current = [];
    const currentMode = mode;
    const explicitTargets = selectedMentors.filter((n) => n !== "JULIE");
    const julieSelected = selectedMentors.includes("JULIE");

    const targets = selectedMentors.length > 0 ? [...selectedMentors] : ["ALL"];
    addMessage(trimmed, "you", "YOU", targets);
    setSelectedMentors([]);
    setInput("");

    trackUserMessage(trimmed);
    trackActiveTopic(trimmed);

    const state = meetingStateRef.current;
    if (state.activeTopics.length > 2) {
      const maybeDrop = state.activeTopics[0];
      const recentText = messagesRef.current
        .filter((m) => !m.isThinking)
        .slice(-6)
        .map((m) => m.text.toLowerCase())
        .join(" ");
      if (!recentText.includes(maybeDrop.toLowerCase().slice(0, 20))) {
        trackDroppedIdea(maybeDrop);
        setMeetingState((prev) => ({
          ...prev,
          activeTopics: prev.activeTopics.filter((t) => t !== maybeDrop),
        }));
      }
    }

    if (isHighRisk(trimmed)) {
      highRiskTurnId.current = turnId;
      const doc = mentorsRef.current.find((m) => m.name === "DOC");
      const cipher = mentorsRef.current.find((m) => m.name === "CIPHER");
      if (doc) {
        const riskPrompt = `${trimmed}\n\n[Instruction: This is a high-risk request. Start with a firm interrupt phrase. State the specific risk immediately. Name one concrete consequence. Do not soften the message. Do not ask a question.]`;
        dispatchMentorResponse(doc, riskPrompt, currentMode, turnId, true, false, 400);
      }
      if (cipher) {
        const trustPrompt = `${trimmed}\n\n[Instruction: This is a high-risk request. Start with a firm interrupt phrase. State how this breaks user trust and system safety. Name the user impact directly. Do not soften the message. Do not ask a question.]`;
        dispatchMentorResponse(cipher, trustPrompt, currentMode, turnId, true, false, 1800);
      }
      return;
    }

    const taskPattern = /^([A-Za-z0-9]+):\s*.+$/;
    const taskMatch = trimmed.match(taskPattern);
    const taskMentorName = taskMatch
      ? mentorsRef.current.find((m) => m.name === taskMatch[1].toUpperCase())?.name ?? null
      : null;

    if (taskMentorName && taskMentorName !== "JULIE") {
      assignMentor(taskMentorName);
      trackAssignedTask(trimmed, taskMentorName);
      return;
    }

    if (julieSelected && !isSummaryRequest(trimmed)) {
      const julie = mentorsRef.current.find((m) => m.name === "JULIE");
      if (julie) {
        await dispatchMentorResponse(julie, trimmed, currentMode, turnId);
      }
      return;
    }

    setMentors((prev) => prev.map((m) => m.name === "JULIE" ? { ...m, status: "working" } : m));

    let routing: JulieRouting;
    try {
      routing = await askJulieToRoute(trimmed, currentMode, explicitTargets.length > 0 ? explicitTargets : undefined);
    } catch {
      routing = { mentors: ["PREZ"], action: "route" };
    } finally {
      setMentors((prev) => prev.map((m) => m.name === "JULIE" ? { ...m, status: "idle" } : m));
    }

    const turnId2 = currentTurnId.current;
    if (turnId2 !== turnId) return;

    if (routing.action === "summarize" && routing.line) {
      addMessage(`JULIE: ${routing.line}`, "mentor", "JULIE", ["ALL"], false, true);
      lastJulieSpeakTurn.current = turnId;
      return;
    }

    if (routing.action === "acknowledge") {
      return;
    }

    if (routing.line && routing.line.trim()) {
      addMessage(`JULIE: ${routing.line}`, "mentor", "JULIE", ["ALL"], false, true);
      lastJulieSpeakTurn.current = turnId;
    }

    const mentorsToCall = routing.mentors
      .map((name) => mentorsRef.current.find((m) => m.name === name))
      .filter((m): m is Mentor => !!m && m.status === "idle");

    const isOpenFloorMsg = isOpenFloor(trimmed);

    mentorsToCall.forEach((mentor, i) => {
      dispatchMentorResponse(mentor, trimmed, currentMode, turnId, false, isOpenFloorMsg, i * 1200);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleSend();
  }

  async function handleSaveNote(note: SideNote, newTags: string[]) {
    setSideNotes((prev) => [...prev, note]);
    if (newTags.length > 0) {
      setUsedTags((prev) => [...prev, ...newTags]);
      await upsertTags(newTags);
    }
    if (sessionId) {
      await saveSideNote({
        session_id: sessionId,
        project_id: null,
        text: note.text,
        mentors: note.mentors,
        tags: note.tags,
        archived: false,
      });
    }
    setShowSideNoteModal(false);
  }

  const lastNote = sideNotes[sideNotes.length - 1];
  const [showMemoryPanel, setShowMemoryPanel] = useState(false);
  const [activeDeptTab, setActiveDeptTab] = useState<string | null>(null);

  const activeDepts = DEPARTMENT_ORDER.filter((dept) =>
    mentors.some((m) => MENTOR_META[m.name]?.department === dept)
  );
  const currentDept = activeDeptTab ?? activeDepts[0] ?? null;

  function renderMentorCard(mentor: Mentor) {
    const isSelected = selectedMentors.includes(mentor.name);
    const isJulie = mentor.name === "JULIE";
    const meta = MENTOR_META[mentor.name];
    const participation = meetingState.mentorParticipation[mentor.name] ?? 0;
    const dept = meta?.department ?? "FACILITATION";
    const deptColor = DEPARTMENT_COLORS[dept] ?? "#8A9BB5";

    if (isJulie) {
      return (
        <button
          key={mentor.id}
          onClick={() => handleMentorClick(mentor)}
          className={["flex flex-col rounded-lg transition-all duration-200 hover:opacity-90 active:scale-95 flex-shrink-0", mentor.status === "working" ? "animate-pulse" : ""].join(" ")}
          style={{
            backgroundColor: "#0F1F36",
            border: isSelected ? "1px solid #8A9BB5" : mentor.status === "working" ? "1px solid #3A4F6A" : "1px solid #1B2A4A",
            boxShadow: isSelected ? "0 0 10px 2px rgba(138,155,181,0.15)" : "none",
            width: "100px",
            padding: "8px 10px",
          }}
          title="JULIE — Facilitator"
        >
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] font-bold tracking-widest" style={{ color: "#8A9BB5" }}>JULIE</span>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: mentor.status === "working" ? "#60AEFF" : "#1B2A4A" }} />
          </div>
          <span className="text-[8px] tracking-widest uppercase" style={{ color: "#3A4F6A" }}>
            {mentor.status === "working" ? "ROUTING" : "HOST"}
          </span>
        </button>
      );
    }

    return (
      <button
        key={mentor.id}
        onClick={() => handleMentorClick(mentor)}
        className={["flex flex-col rounded-lg transition-all duration-200 hover:opacity-90 active:scale-95 flex-shrink-0", mentor.status === "working" ? "animate-pulse" : ""].join(" ")}
        style={{
          ...STATUS_STYLES[mentor.status],
          boxShadow: isSelected ? `0 0 0 1.5px ${deptColor}, 0 0 10px 2px ${deptColor}33` : "none",
          width: "100px",
          padding: "8px 10px",
        }}
        title={mentor.status === "ready" ? "Click to receive result" : isSelected ? `Deselect ${mentor.name}` : `Select ${mentor.name}`}
      >
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[10px] font-bold tracking-widest" style={{ color: isSelected ? deptColor : "#FFFFFF" }}>{mentor.name}</span>
          <div className="flex items-center gap-1">
            {participation > 0 && (
              <span className="text-[8px] font-bold" style={{ color: "#3A4F6A" }}>{participation}</span>
            )}
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_DOT[mentor.status] }} />
          </div>
        </div>
        {meta?.realName && (
          <span className="text-[8px] block" style={{ color: "#3A4F6A" }}>{meta.realName}</span>
        )}
        <span className="text-[8px] leading-tight block mt-0.5" style={{ color: isSelected ? `${deptColor}99` : "#2A3D5E" }}>
          {meta?.bullets[0] ?? ""}
        </span>
      </button>
    );
  }

  return (
    <div
      className="flex-1 flex min-h-0 overflow-hidden"
      style={{ backgroundColor: "#0D1B2E", color: "#FFFFFF", fontFamily: "'Inter', sans-serif" }}
    >
      {showSideNoteModal && (
        <SideNoteModal
          usedTags={usedTags}
          onSave={handleSaveNote}
          onClose={() => setShowSideNoteModal(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

        <div
          className="flex items-center justify-between px-5 py-2.5 border-b flex-shrink-0"
          style={{ borderColor: "#1B2A4A" }}
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold tracking-widest uppercase" style={{ color: "#C9A84C" }}>
              Staff Meeting Room
            </span>
            <span className="text-[10px] tracking-widest uppercase px-2 py-0.5 rounded" style={{ backgroundColor: "rgba(138,155,181,0.1)", color: "#8A9BB5" }}>
              JULIE facilitating
            </span>
          </div>
          <div className="flex items-center gap-2">
            {(["brainstorm", "command"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="px-3 py-1 text-xs font-semibold tracking-wider uppercase rounded transition-all duration-150"
                style={
                  mode === m
                    ? { backgroundColor: "#C9A84C", color: "#0D1B2E" }
                    : { backgroundColor: "#1B2A4A", color: "#8A9BB5" }
                }
              >
                {m}
              </button>
            ))}
            <button
              onClick={() => setShowMemoryPanel((v) => !v)}
              className="px-3 py-1 text-xs font-semibold tracking-wider uppercase rounded transition-all duration-150 ml-1"
              style={
                showMemoryPanel
                  ? { backgroundColor: "#1B2A4A", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.4)" }
                  : { backgroundColor: "#1B2A4A", color: "#3A4F6A", border: "1px solid #1B2A4A" }
              }
              title="Toggle session memory panel"
            >
              Memory
            </button>
          </div>
        </div>

        <div
          className="flex-shrink-0 border-b"
          style={{ borderColor: "#1B2A4A", backgroundColor: "#0A1525" }}
        >
          <div className="flex items-center gap-1 px-5 pt-2 pb-0 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {activeDepts.map((dept) => {
              const deptColor = DEPARTMENT_COLORS[dept] ?? "#8A9BB5";
              const isActive = dept === currentDept;
              const hasActive = mentors.some(
                (m) => MENTOR_META[m.name]?.department === dept && (m.status === "working" || selectedMentors.includes(m.name))
              );
              return (
                <button
                  key={dept}
                  onClick={() => setActiveDeptTab(dept)}
                  className="flex-shrink-0 px-3 py-1.5 text-[9px] font-bold tracking-widest uppercase rounded-t transition-all duration-150 relative"
                  style={{
                    color: isActive ? deptColor : "#3A4F6A",
                    backgroundColor: isActive ? "rgba(255,255,255,0.04)" : "transparent",
                    borderBottom: isActive ? `2px solid ${deptColor}` : "2px solid transparent",
                  }}
                >
                  {dept}
                  {hasActive && (
                    <span
                      className="absolute top-1 right-1 w-1 h-1 rounded-full"
                      style={{ backgroundColor: deptColor }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div
            className="flex gap-1.5 px-5 py-2 overflow-x-auto"
            style={{ scrollbarWidth: "thin", scrollbarColor: "#1B2A4A transparent" }}
          >
            {currentDept &&
              mentors
                .filter((m) => MENTOR_META[m.name]?.department === currentDept)
                .map((mentor) => renderMentorCard(mentor))
            }
          </div>
        </div>

        {sideNotes.length > 0 && (
          <div
            className="mx-5 mt-2 mb-0 px-3 py-2 rounded-lg flex items-center gap-3 text-xs flex-shrink-0"
            style={{ backgroundColor: "#111D30", color: "#8A9BB5" }}
          >
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <span style={{ color: "#C9A84C" }} className="font-semibold whitespace-nowrap">
                Side Notes ({sideNotes.length})
              </span>
              <span className="truncate text-[11px]">{lastNote?.text}</span>
              {lastNote && lastNote.tags.map((t) => (
                <span
                  key={t}
                  className="flex-shrink-0 inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold"
                  style={{ backgroundColor: "rgba(201,168,76,0.15)", color: "#C9A84C" }}
                >
                  {t}
                </span>
              ))}
            </div>
            <button
              onClick={() => setShowSideNoteModal(true)}
              className="text-[10px] tracking-widest uppercase font-semibold whitespace-nowrap transition-colors hover:opacity-80 flex-shrink-0"
              style={{ color: "#C9A84C" }}
            >
              + Add
            </button>
          </div>
        )}

        <div className="flex-1 flex flex-col min-h-0 px-5 pt-3 pb-2 overflow-hidden">
          <p className="text-[9px] tracking-widest uppercase mb-1.5 flex-shrink-0" style={{ color: "#3A4F6A" }}>
            Transcript
          </p>
          <div
            ref={transcriptRef}
            className="flex-1 overflow-y-auto rounded-lg p-3"
            style={{ backgroundColor: "#111D30" }}
          >
            {messages.length === 0 ? (
              <p className="text-sm text-center mt-8" style={{ color: "#3A4F6A" }}>
                No messages yet. JULIE will route your message to the right mentors.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {messages.map((msg) => {
                  const isYou = msg.speaker === "you";
                  const sender = msg.sender ?? (isYou ? "YOU" : "MENTOR");
                  const targets = msg.targets ?? ["ALL"];
                  const isJulieMsg = msg.isJulie || sender === "JULIE";
                  return (
                    <div
                      key={msg.id}
                      className="rounded-lg px-3 py-2.5"
                      style={{
                        backgroundColor: msg.isThinking
                          ? "rgba(255,255,255,0.015)"
                          : isJulieMsg
                          ? "rgba(138,155,181,0.04)"
                          : "rgba(255,255,255,0.03)",
                        borderLeft: isJulieMsg && !msg.isThinking ? "2px solid #2A3D5E" : "none",
                      }}
                    >
                      <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                        <span
                          className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded"
                          style={
                            isYou
                              ? { color: "#FFFFFF", backgroundColor: "rgba(255,255,255,0.1)" }
                              : isJulieMsg
                              ? { color: "#8A9BB5", backgroundColor: "rgba(138,155,181,0.1)" }
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
                              style={{ color: "#8A9BB5", border: "1px solid #3A4F6A" }}
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
                          color: isYou ? "#FFFFFF" : msg.isThinking ? "#3A4F6A" : isJulieMsg ? "#8A9BB5" : "#D0DFEE",
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

        <div className="px-5 py-3 border-t flex-shrink-0" style={{ borderColor: "#1B2A4A" }}>
          {selectedMentors.length > 0 && (
            <div className="flex gap-2 mb-2 flex-wrap">
              {selectedMentors.map((name) => (
                <span
                  key={name}
                  className="flex items-center gap-1 text-[10px] tracking-widest uppercase font-semibold px-2 py-0.5 rounded"
                  style={{
                    color: name === "JULIE" ? "#8A9BB5" : "#C9A84C",
                    border: `1px solid ${name === "JULIE" ? "#8A9BB5" : "#C9A84C"}`,
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
              placeholder="Type your message... JULIE routes it to the right people."
              className="flex-1 px-4 py-2.5 rounded-lg text-sm outline-none transition-all"
              style={{
                backgroundColor: "#1B2A4A",
                color: "#FFFFFF",
                border: selectedMentors.length > 0 ? "1px solid rgba(201,168,76,0.5)" : "1px solid #2A3D5E",
              }}
            />
            <button
              onClick={handleSend}
              className="px-4 py-2.5 rounded-lg font-semibold text-sm tracking-wider uppercase transition-all duration-150 hover:opacity-90 active:scale-95"
              style={{ backgroundColor: "#C9A84C", color: "#0D1B2E" }}
            >
              Send
            </button>
            <button
              onClick={() => setShowSideNoteModal(true)}
              className="px-4 py-2.5 rounded-lg font-semibold text-sm tracking-wider uppercase transition-all duration-150 hover:opacity-90 active:scale-95"
              style={{ backgroundColor: "#1B2A4A", color: "#8A9BB5", border: "1px solid #2A3D5E" }}
            >
              Note{sideNotes.length > 0 ? ` (${sideNotes.length})` : ""}
            </button>
          </div>
          <p className="text-[10px] mt-1.5" style={{ color: "#2A3D5E" }}>
            Select mentor tiles to direct your message. JULIE always decides who speaks.
          </p>
        </div>
      </div>

      {showMemoryPanel && (
        <div
          className="flex-shrink-0 flex flex-col border-l overflow-y-auto"
          style={{ width: "200px", minWidth: "200px", borderColor: "#1B2A4A", backgroundColor: "#0A1628" }}
        >
          <div className="flex items-center justify-between px-3 py-2.5 border-b flex-shrink-0" style={{ borderColor: "#1B2A4A" }}>
            <span className="text-[9px] tracking-widest uppercase font-bold" style={{ color: "#8A9BB5" }}>Session Memory</span>
            <button onClick={() => setShowMemoryPanel(false)} className="text-xs opacity-40 hover:opacity-80 leading-none" style={{ color: "#8A9BB5" }}>×</button>
          </div>

          <div className="px-3 py-2.5 border-b" style={{ borderColor: "#1B2A4A" }}>
            <p className="text-[9px] tracking-widest uppercase font-semibold mb-1.5" style={{ color: "#F87171" }}>
              Unanswered ({meetingState.openQuestions.length})
            </p>
            {meetingState.openQuestions.length === 0 ? (
              <p className="text-[10px]" style={{ color: "#2A3D5E" }}>None</p>
            ) : (
              <div className="flex flex-col gap-1">
                {meetingState.openQuestions.slice(-5).map((q, i) => (
                  <p key={i} className="text-[10px] leading-snug" style={{ color: "#8A9BB5" }}>· {q.slice(0, 55)}{q.length > 55 ? "…" : ""}</p>
                ))}
              </div>
            )}
          </div>

          <div className="px-3 py-2.5 border-b" style={{ borderColor: "#1B2A4A" }}>
            <p className="text-[9px] tracking-widest uppercase font-semibold mb-1.5" style={{ color: "#5A9BD3" }}>
              Active Tasks ({meetingState.assignedTasks.length})
            </p>
            {meetingState.assignedTasks.length === 0 ? (
              <p className="text-[10px]" style={{ color: "#2A3D5E" }}>None assigned</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {meetingState.assignedTasks.slice(-6).map((t, i) => (
                  <div key={i}>
                    <p className="text-[10px] leading-snug" style={{ color: "#8A9BB5" }}>{t.task.slice(0, 45)}{t.task.length > 45 ? "…" : ""}</p>
                    <p className="text-[9px]" style={{ color: "#3A4F6A" }}>→ {t.owner}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="px-3 py-2.5 border-b" style={{ borderColor: "#1B2A4A" }}>
            <p className="text-[9px] tracking-widest uppercase font-semibold mb-1.5" style={{ color: "#4ADE80" }}>
              Decisions ({meetingState.decisionsMade.length})
            </p>
            {meetingState.decisionsMade.length === 0 ? (
              <p className="text-[10px]" style={{ color: "#2A3D5E" }}>None recorded</p>
            ) : (
              <div className="flex flex-col gap-1">
                {meetingState.decisionsMade.slice(-5).map((d, i) => (
                  <p key={i} className="text-[10px] leading-snug" style={{ color: "#8A9BB5" }}>· {d.slice(0, 55)}{d.length > 55 ? "…" : ""}</p>
                ))}
              </div>
            )}
          </div>

          <div className="px-3 py-2.5 border-b" style={{ borderColor: "#1B2A4A" }}>
            <p className="text-[9px] tracking-widest uppercase font-semibold mb-1.5" style={{ color: "#C9A84C" }}>
              Active Topics
            </p>
            {meetingState.activeTopics.length === 0 ? (
              <p className="text-[10px]" style={{ color: "#2A3D5E" }}>None</p>
            ) : (
              <div className="flex flex-col gap-1">
                {meetingState.activeTopics.slice(-4).map((t, i) => (
                  <p key={i} className="text-[10px] leading-snug" style={{ color: "#8A9BB5" }}>· {t.slice(0, 50)}{t.length > 50 ? "…" : ""}</p>
                ))}
              </div>
            )}
          </div>

          <div className="px-3 py-2.5">
            <p className="text-[9px] tracking-widest uppercase font-semibold mb-1.5" style={{ color: "#8A9BB5" }}>
              Participation
            </p>
            {Object.keys(meetingState.mentorParticipation).length === 0 ? (
              <p className="text-[10px]" style={{ color: "#2A3D5E" }}>No responses yet</p>
            ) : (
              <div className="flex flex-col gap-1">
                {Object.entries(meetingState.mentorParticipation)
                  .sort((a, b) => b[1] - a[1])
                  .map(([name, count]) => (
                    <div key={name} className="flex items-center justify-between">
                      <span className="text-[9px] tracking-widest uppercase font-semibold" style={{ color: "#3A4F6A" }}>{name}</span>
                      <span className="text-[9px]" style={{ color: "#C9A84C" }}>{count}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
