import { useState, useRef, useEffect, useCallback } from "react";
import SideNoteModal, { SideNote } from "./SideNoteModal";
import { upsertTranscript, upsertJulieReport, updateSession, saveSideNote, upsertTags, loadSession, listAllTags, uploadFileToVault, type TranscriptMessage, type JulieReport, type VaultFile, type SideNote as DBSideNote } from "../lib/db";
import { ALL_MENTOR_NAMES } from "../lib/mentors";
import FileUploadModal from "../components/FileUploadModal";
import FilePreviewModal from "../components/FilePreviewModal";

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

interface CarryoverItem {
  text: string;
  type: "task" | "question" | "topic";
  owner?: string;
  resolved: boolean;
  fromSession: string;
}

interface MemoryFile {
  id: string;
  name: string;
  type: string;
  linkedSessionId?: string | null;
  linkedProjectId?: string | null;
  tags: string[];
}

interface MemoryNote {
  id: string;
  text: string;
  tags: string[];
  mentors: string[];
  sessionId?: string | null;
}

interface MeetingState {
  openQuestions: string[];
  answeredQuestions: { question: string; answer: string }[];
  assignedTasks: { task: string; owner: string }[];
  resolvedTasks: { task: string; owner: string }[];
  unresolvedTopics: string[];
  activeTopics: string[];
  decisionsMade: string[];
  pendingDecisions: string[];
  mentorParticipation: Record<string, number>;
  droppedIdeas: string[];
  filesDiscussed: string[];
  notesCreated: string[];
  carryoverItems: CarryoverItem[];
  memoryFiles: MemoryFile[];
  memoryNotes: MemoryNote[];
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
  resolvedTasks: [],
  unresolvedTopics: [],
  activeTopics: [],
  decisionsMade: [],
  pendingDecisions: [],
  mentorParticipation: {},
  droppedIdeas: [],
  filesDiscussed: [],
  notesCreated: [],
  carryoverItems: [],
  memoryFiles: [],
  memoryNotes: [],
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
  return ["anyone else", "thoughts", "what do you all think", "who else", "other ideas", "what does everyone think", "any other"].some(
    (t) => lower.includes(t)
  );
}

function isVenting(text: string): boolean {
  const lower = text.toLowerCase();
  return [
    "so frustrated", "i'm frustrated", "im frustrated", "pissed off", "i'm done", "im done",
    "this is ridiculous", "this is a mess", "nothing is working", "i hate this", "i can't deal",
    "i cant deal", "ugh", "argh", "i give up", "so annoying", "drives me crazy",
    "i'm losing it", "im losing it", "falling apart", "completely lost",
  ].some((k) => lower.includes(k));
}

function isAnyoneElse(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes("anyone else") || lower.includes("who else");
}

function detectDecision(text: string): string | null {
  const lower = text.toLowerCase();
  const triggers = [
    "we should", "we will", "we need to", "let's go with", "decided to",
    "agreed to", "the decision is", "moving forward with", "go with",
    "we're going to", "plan is to", "recommend", "recommendation:",
  ];
  for (const t of triggers) {
    const idx = lower.indexOf(t);
    if (idx !== -1) {
      const snippet = text.slice(idx, idx + 120).split(/[.!?\n]/)[0].trim();
      if (snippet.length > 15) return snippet;
    }
  }
  return null;
}

function detectTask(text: string): { task: string; owner: string } | null {
  const lower = text.toLowerCase();
  const triggers = [
    "should handle", "will take care of", "can own", "needs to", "should look into",
    "should review", "should draft", "needs a review", "should check",
    "i'll", "i will", "i can",
  ];
  for (const t of triggers) {
    const idx = lower.indexOf(t);
    if (idx !== -1) {
      const snippet = text.slice(Math.max(0, idx - 10), idx + 100).split(/[.!?\n]/)[0].trim();
      if (snippet.length > 10) return { task: snippet, owner: "TBD" };
    }
  }
  return null;
}

function buildSessionSummary(state: MeetingState): string {
  const parts: string[] = [];
  if (state.activeTopics.length > 0) parts.push(`Topics: ${state.activeTopics.slice(0, 3).join("; ")}`);
  if (state.decisionsMade.length > 0) parts.push(`Decisions: ${state.decisionsMade.slice(0, 2).join("; ")}`);
  if (state.assignedTasks.length > 0) parts.push(`Tasks: ${state.assignedTasks.slice(0, 2).map((t) => `${t.owner}: ${t.task.slice(0, 40)}`).join("; ")}`);
  if (state.openQuestions.length > 0) parts.push(`Unresolved: ${state.openQuestions.slice(0, 2).join("; ")}`);
  return parts.join(" · ");
}

interface Props {
  sessionId: string | null;
  sessionKey?: string | null;
}

export default function StaffMeetingRoom({ sessionId, sessionKey }: Props) {
  const [mentors, setMentors] = useState<Mentor[]>(INITIAL_MENTORS);
  const [mode, setMode] = useState<Mode>("brainstorm");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [sideNotes, setSideNotes] = useState<SideNote[]>([]);
  const [usedTags, setUsedTags] = useState<string[]>([]);
  const [showSideNoteModal, setShowSideNoteModal] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [previewFile, setPreviewFile] = useState<VaultFile | null>(null);
  const [sessionFiles, setSessionFiles] = useState<VaultFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
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
  const lastSpeakerRef = useRef<string | null>(null);
  const recentSpeakersRef = useRef<string[]>([]);

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { mentorsRef.current = mentors; }, [mentors]);
  useEffect(() => { meetingStateRef.current = meetingState; }, [meetingState]);

  useEffect(() => {
    if (!sessionKey) return;
    loadSession(sessionKey).then((result) => {
      if (!result) return;

      if (result.transcript?.messages && result.transcript.messages.length > 0) {
        const restored: Message[] = result.transcript.messages.map((m) => ({
          id: m.id,
          text: m.text,
          speaker: m.speaker,
          sender: m.sender,
          targets: m.targets,
        }));
        setMessages(restored);
        msgCounter.current = Math.max(...result.transcript.messages.map((m) => m.id), 0);
      }

      if (result.julieReport) {
        const r = result.julieReport;
        const memFiles: MemoryFile[] = (r.files_referenced ?? []).map((f) => ({
          id: f.id, name: f.name, type: f.type, tags: [],
        }));
        const memNotes: MemoryNote[] = (r.notes_referenced ?? []).map((n) => ({
          id: n.id, text: n.text, tags: n.tags ?? [], mentors: [],
        }));
        setMeetingState((prev) => ({
          ...prev,
          openQuestions: r.open_questions ?? [],
          answeredQuestions: r.answered_questions ?? [],
          assignedTasks: r.assigned_tasks ?? [],
          resolvedTasks: r.resolved_tasks ?? [],
          unresolvedTopics: r.unresolved_topics ?? [],
          activeTopics: r.active_topics ?? [],
          decisionsMade: r.decisions_made ?? [],
          pendingDecisions: r.pending_decisions ?? [],
          mentorParticipation: r.mentor_participation ?? {},
          droppedIdeas: r.dropped_ideas ?? [],
          memoryFiles: memFiles,
          memoryNotes: memNotes,
        }));
      }

      if (result.vaultFiles && result.vaultFiles.length > 0) {
        setSessionFiles(result.vaultFiles);
        setMeetingState((prev) => ({
          ...prev,
          filesDiscussed: result.vaultFiles.map((f) => f.id),
          memoryFiles: result.vaultFiles.map((f) => ({
            id: f.id, name: f.name, type: f.file_type, tags: f.tags ?? [],
            linkedSessionId: f.linked_session_id, linkedProjectId: f.linked_project_id,
          })),
        }));
      }

      if (result.sideNotes && result.sideNotes.length > 0) {
        const restored: SideNote[] = result.sideNotes.map((n) => ({
          text: n.text,
          mentors: n.mentors ?? [],
          tags: n.tags ?? [],
          timestamp: new Date(n.created_at).getTime(),
        }));
        setSideNotes(restored);
        setMeetingState((prev) => ({
          ...prev,
          notesCreated: result.sideNotes.map((n) => n.id),
          memoryNotes: result.sideNotes.map((n) => ({
            id: n.id, text: n.text, tags: n.tags ?? [], mentors: n.mentors ?? [],
            sessionId: n.session_id,
          })),
        }));
      }
    }).catch(() => {});

    listAllTags().then((tags) => {
      setUsedTags(tags.map((t) => t.tag));
    }).catch(() => {});
  }, [sessionKey]);

  useEffect(() => {
    if (!sessionKey) return;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const prevKey = yesterday.toISOString().slice(0, 10);
    loadSession(prevKey).then((result) => {
      if (!result) return;
      const session = result.session;
      const report = result.julieReport as JulieReport | null;

      const storedTasks = (session.carryover_tasks ?? []).filter((t) => t.task);
      const storedQs = (session.carryover_questions ?? []).filter(Boolean);
      const storedTopics = (session.carryover_topics ?? []).filter(Boolean);

      const unresolvedTopics = storedTopics.length > 0 ? storedTopics : (report?.unresolved_topics ?? []).filter(Boolean);
      const openQs = storedQs.length > 0 ? storedQs : (report?.open_questions ?? []).filter(Boolean);
      const assignedTasks = storedTasks.length > 0 ? storedTasks : (report?.assigned_tasks ?? []).filter((t) => t.task);

      const carryoverItems: CarryoverItem[] = [
        ...unresolvedTopics.map((t) => ({ text: t, type: "topic" as const, resolved: false, fromSession: prevKey })),
        ...openQs.map((q) => ({ text: q, type: "question" as const, resolved: false, fromSession: prevKey })),
        ...assignedTasks.map((t) => ({ text: t.task, type: "task" as const, owner: t.owner, resolved: false, fromSession: prevKey })),
      ];

      if (carryoverItems.length === 0) return;

      setMeetingState((prev) => ({
        ...prev,
        carryoverItems,
        unresolvedTopics: [...unresolvedTopics, ...prev.unresolvedTopics.filter((t) => !unresolvedTopics.includes(t))],
        openQuestions: [...openQs, ...prev.openQuestions.filter((q) => !openQs.includes(q))],
      }));

      const taskCount = assignedTasks.length;
      const qCount = openQs.length;
      const topicCount = unresolvedTopics.length;
      const parts: string[] = [];
      if (taskCount > 0) parts.push(`${taskCount} unfinished task${taskCount > 1 ? "s" : ""}`);
      if (qCount > 0) parts.push(`${qCount} open question${qCount > 1 ? "s" : ""}`);
      if (topicCount > 0) parts.push(`${topicCount} unresolved topic${topicCount > 1 ? "s" : ""}`);

      const carryMsg = `We still have ${parts.join(", ")} carried over from last session (${prevKey}). I've loaded them into memory — let's pick up where we left off.`;
      setMessages((prev) => {
        if (prev.some((m) => m.id === -99)) return prev;
        return [...prev, { id: -99, text: `JULIE: ${carryMsg}`, speaker: "mentor", sender: "JULIE", targets: ["ALL"], isJulie: true }];
      });
    }).catch(() => {});
  }, [sessionKey]);

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

    const filesRef = s.memoryFiles.map((f) => ({ id: f.id, name: f.name, type: f.type }));
    const notesRef = s.memoryNotes.map((n) => ({ id: n.id, text: n.text.slice(0, 100), tags: n.tags }));
    const resolvedTasks = s.resolvedTasks ?? [];

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
      files_referenced: filesRef,
      notes_referenced: notesRef,
      resolved_tasks: resolvedTasks,
      resolved_questions: s.answeredQuestions,
    }).catch(() => {});

    const mentorsInvolved = Object.keys(s.mentorParticipation).filter((k) => (s.mentorParticipation[k] ?? 0) > 0);
    const keyTopics = [...new Set([...s.activeTopics, ...s.decisionsMade.slice(0, 2)])].slice(0, 8);
    const summary = buildSessionSummary(s);

    const unresolvedTasks = s.assignedTasks.filter((t) =>
      !resolvedTasks.some((rt) => rt.task === t.task)
    );

    updateSession(sessionId, {
      mentors_involved: mentorsInvolved,
      key_topics: keyTopics,
      session_summary: summary || undefined,
      carryover_tasks: unresolvedTasks,
      carryover_questions: s.openQuestions,
      carryover_topics: s.unresolvedTopics,
      files_discussed: s.filesDiscussed,
      notes_created: s.notesCreated,
      participants: mentorsInvolved,
      decisions_made: s.decisionsMade,
      unresolved_topics: s.unresolvedTopics,
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
    lastSpeakerRef.current = mentorName;
    recentSpeakersRef.current = [...recentSpeakersRef.current.slice(-4), mentorName];
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

  function trackFileDiscussed(file: VaultFile) {
    setMeetingState((prev) => {
      if (prev.filesDiscussed.includes(file.id)) return prev;
      const memFile: MemoryFile = {
        id: file.id, name: file.name, type: file.file_type, tags: file.tags ?? [],
        linkedSessionId: file.linked_session_id, linkedProjectId: file.linked_project_id,
      };
      return {
        ...prev,
        filesDiscussed: [...prev.filesDiscussed, file.id],
        memoryFiles: [...prev.memoryFiles, memFile],
      };
    });
  }

  function trackNoteCreated(note: DBSideNote) {
    setMeetingState((prev) => {
      if (prev.notesCreated.includes(note.id)) return prev;
      const memNote: MemoryNote = {
        id: note.id, text: note.text, tags: note.tags ?? [], mentors: note.mentors ?? [],
        sessionId: note.session_id,
      };
      return {
        ...prev,
        notesCreated: [...prev.notesCreated, note.id],
        memoryNotes: [...prev.memoryNotes, memNote],
      };
    });
  }

  function resolveTask(task: string, owner: string) {
    setMeetingState((prev) => {
      const exists = prev.resolvedTasks?.some((t) => t.task === task);
      if (exists) return prev;
      return {
        ...prev,
        resolvedTasks: [...(prev.resolvedTasks ?? []), { task, owner }],
        assignedTasks: prev.assignedTasks.filter((t) => t.task !== task),
      };
    });
  }

  function resolveCarryoverItem(text: string) {
    setMeetingState((prev) => ({
      ...prev,
      carryoverItems: prev.carryoverItems.map((item) =>
        item.text.slice(0, 30) === text.slice(0, 30) ? { ...item, resolved: true } : item
      ),
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
      const s = meetingStateRef.current;
      body.meetingState = s;
      body.carryoverItems = s.carryoverItems;
      body.filesDiscussed = s.filesDiscussed;
      body.notesCreated = s.notesCreated;
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
    const lastSpeaker = lastSpeakerRef.current;
    const recentSpeakers = recentSpeakersRef.current;

    const mentorCounts = ALL_MENTOR_NAMES.map((name) => ({
      name,
      count: participationMap[name] ?? 0,
      turnCount: currentMentors.find((m) => m.name === name)?.turnCount ?? 0,
    }));

    const leastSpoken = [...mentorCounts]
      .sort((a, b) => a.count - b.count)
      .map((m) => m.name)
      .filter((n) => n !== lastSpeaker);

    const openFloor = isOpenFloor(userMessage);
    const anyoneElse = isAnyoneElse(userMessage);
    const ventingSignal = isVenting(userMessage);
    const maxMentors = openFloor ? 3 : 2;

    const juliePrompt = `USER MESSAGE: "${userMessage}"
MEETING MODE: ${currentMode}
LAST SPEAKER: ${lastSpeaker ?? "none"}
RECENT SPEAKERS (last 4): ${recentSpeakers.join(", ") || "none"}
MENTOR TURN COUNTS THIS SESSION: ${JSON.stringify(mentorCounts)}
LEAST SPOKEN MENTORS EXCLUDING LAST SPEAKER (in order): ${leastSpoken.join(", ")}
${anyoneElse || openFloor ? `OPEN FLOOR — invite UP TO ${maxMentors} relevant mentors. Do NOT pick MARK unless strategy is the explicit topic. Do NOT pick the last speaker (${lastSpeaker ?? "none"}).` : ""}
${ventingSignal ? "VENTING DETECTED — user is emotionally frustrated. Include a short acknowledging 'line' before routing. Do not skip straight to fixing." : ""}
${forcedMentors ? `USER EXPLICITLY SELECTED: ${forcedMentors.join(", ")} — route to them.` : ""}

ANTI-DOMINANCE RULE: MARK must NOT be routed to unless the topic is clearly strategic direction. MARK is not the default.
LAST SPEAKER RULE: NEVER route to "${lastSpeaker ?? "none"}" — they just spoke.

Your job is to decide who should speak. Return ONLY valid JSON in this exact format:
{"mentors":["NAME1"],"line":"optional brief line","action":"route"}

Rules:
- mentors: default 1 name. Up to ${maxMentors} if open floor or multiple clearly relevant domains
- NEVER include JULIE in mentors
- NEVER include "${lastSpeaker ?? ""}" in mentors (they just spoke)
- If user is venting/emotional: include your "line" acknowledging it, then route
- "line" is OPTIONAL — only if genuinely useful (venting, drift, refocus, open floor invite)
- If user asks for summary: action "summarize", mentors: [], full summary in "line"
- If it's simple acknowledgment ("ok", "got it", "thanks"): action "acknowledge", mentors: [], no line
- If user is vague/unclear: action "route", mentors: [], "line" with ONE clarifying question
- Prefer mentors who have spoken less. Rotate the roster.
- Return ONLY the JSON object, no other text`;

    try {
      const raw = await fetchMentorResponse("JULIE", juliePrompt, currentMode);
      const cleaned = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned) as JulieRouting;
      if (!Array.isArray(parsed.mentors)) parsed.mentors = [];

      parsed.mentors = parsed.mentors
        .filter((n) => ALL_MENTOR_NAMES.includes(n))
        .filter((n) => n !== lastSpeaker)
        .slice(0, maxMentors);

      if (parsed.mentors.includes("MARK") && !forcedMentors?.includes("MARK")) {
        const markCount = recentSpeakers.filter((s) => s === "MARK").length;
        if (markCount >= 2) {
          parsed.mentors = parsed.mentors.filter((n) => n !== "MARK");
          const replacement = leastSpoken.find((n) => !parsed.mentors.includes(n) && n !== "MARK");
          if (replacement && parsed.mentors.length === 0) parsed.mentors = [replacement];
        }
      }

      return parsed;
    } catch {
      const fallback = leastSpoken.find((n) => n !== lastSpeaker && n !== "MARK") ?? leastSpoken[0] ?? "PAUL";
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

      const detectedDecision = detectDecision(responseText);
      if (detectedDecision) {
        setMeetingState((prev) => {
          if (prev.decisionsMade.includes(detectedDecision)) return prev;
          return { ...prev, decisionsMade: [...prev.decisionsMade, detectedDecision] };
        });
      }

      const detectedTask = detectTask(responseText);
      if (detectedTask && !isInterrupt) {
        setMeetingState((prev) => {
          const exists = prev.assignedTasks.some((t) => t.task === detectedTask.task);
          if (exists) return prev;
          return { ...prev, assignedTasks: [...prev.assignedTasks, { task: detectedTask.task, owner: mentor.name }] };
        });
      }

      const openQs = meetingStateRef.current.openQuestions;
      if (openQs.length > 0) {
        const matched = openQs.find((q) =>
          responseText.toLowerCase().includes(q.toLowerCase().slice(0, 30))
        );
        if (matched) {
          markQuestionAnswered(matched, responseText);
          resolveCarryoverItem(matched);
        }
      }

      const carryover = meetingStateRef.current.carryoverItems.filter((c) => !c.resolved);
      if (carryover.length > 0) {
        const resolvedCarryItem = carryover.find((c) =>
          responseText.toLowerCase().includes(c.text.toLowerCase().slice(0, 25))
        );
        if (resolvedCarryItem) resolveCarryoverItem(resolvedCarryItem.text);
      }

      const detectedTask2 = detectTask(responseText);
      if (detectedTask2 && mentor.name !== "JULIE") {
        const allTasks = meetingStateRef.current.assignedTasks;
        const maybeResolved = allTasks.find((t) =>
          responseText.toLowerCase().includes(t.task.toLowerCase().slice(0, 20)) &&
          (responseText.toLowerCase().includes("done") || responseText.toLowerCase().includes("complete") || responseText.toLowerCase().includes("finished"))
        );
        if (maybeResolved) {
          resolveTask(maybeResolved.task, maybeResolved.owner);
        }
      }

      const state2 = meetingStateRef.current;
      const relatedFile = state2.memoryFiles.find((f) =>
        responseText.toLowerCase().includes(f.name.toLowerCase().split(".")[0]?.slice(0, 10) ?? "")
      );
      const openCount = state2.openQuestions.length;
      const taskCount = state2.assignedTasks.length;
      const shouldJulieComment =
        !isInterrupt &&
        turnId === currentTurnId.current &&
        lastJulieSpeakTurn.current < turnId - 2 &&
        (relatedFile || openCount > 2 || (taskCount > 1 && Math.random() < 0.3));

      removeMessageById(thinkingId);
      addMessage(`${mentor.name}: ${responseText}`, "mentor", mentor.name, ["YOU"]);

      if (shouldJulieComment && !isInterrupt) {
        setTimeout(() => {
          if (currentTurnId.current !== turnId) return;
          let julieNote = "";
          if (relatedFile) {
            julieNote = `We reviewed "${relatedFile.name}" earlier in this session — that may be relevant here.`;
          } else if (openCount > 2) {
            julieNote = `We still have ${openCount} open questions in memory. Want to address any of them?`;
          } else if (taskCount > 1) {
            julieNote = `${taskCount} tasks are tracked in session memory. I'll flag if we should revisit any of them.`;
          }
          if (julieNote) {
            addMessage(`JULIE: ${julieNote}`, "mentor", "JULIE", ["ALL"], false, true);
            lastJulieSpeakTurn.current = turnId;
          }
        }, 2500);
      }
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
      routing = { mentors: ["MARK"], action: "route" };
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

    if (routing.action === "refocus" && routing.line) {
      addMessage(`JULIE: ${routing.line}`, "mentor", "JULIE", ["ALL"], false, true);
      lastJulieSpeakTurn.current = turnId;
    } else if (routing.line && routing.line.trim()) {
      addMessage(`JULIE: ${routing.line}`, "mentor", "JULIE", ["ALL"], false, true);
      lastJulieSpeakTurn.current = turnId;
    }

    if (routing.mentors.length === 0) {
      return;
    }

    const mentorsToCall = routing.mentors
      .map((name) => mentorsRef.current.find((m) => m.name === name))
      .filter((m): m is Mentor => !!m && m.status === "idle");

    const isOpenFloorMsg = isOpenFloor(trimmed);
    const staggerMs = isOpenFloorMsg ? 1500 : 1200;

    mentorsToCall.forEach((mentor, i) => {
      dispatchMentorResponse(mentor, trimmed, currentMode, turnId, false, isOpenFloorMsg, i * staggerMs);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleSend();
  }

  async function handleSaveNote(note: SideNote, newTags: string[]) {
    setSideNotes((prev) => [...prev, note]);
    const allNoteTags = [...new Set([...note.tags, ...newTags])].map((t) => t.trim()).filter(Boolean);
    if (allNoteTags.length > 0) {
      setUsedTags((prev) => [...new Set([...prev, ...allNoteTags])]);
    }
    if (sessionId) {
      const saved = await saveSideNote({
        session_id: sessionId,
        project_id: null,
        text: note.text,
        mentors: note.mentors,
        tags: allNoteTags,
        archived: false,
      });
      if (saved?.id) {
        trackNoteCreated(saved);
        if (allNoteTags.length > 0) {
          const currentTopics = meetingStateRef.current.activeTopics;
          const merged = Array.from(new Set([...currentTopics, ...allNoteTags]));
          updateSession(sessionId, {
            key_topics: merged,
            notes_created: [...meetingStateRef.current.notesCreated, saved.id],
          }).catch(() => {});
        }
        const openItems = meetingStateRef.current.openQuestions.length + meetingStateRef.current.assignedTasks.length;
        if (openItems > 0 && meetingStateRef.current.memoryNotes.length === 1) {
          addMessage(
            `JULIE: Note saved. We still have ${openItems} open item${openItems > 1 ? "s" : ""} in memory from this session.`,
            "mentor", "JULIE", ["ALL"], false, true
          );
        }
      }
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
            width: "130px",
            minHeight: "72px",
            padding: "10px 12px",
          }}
          title="JULIE — Facilitator"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold tracking-widest" style={{ color: "#8A9BB5" }}>JULIE</span>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: mentor.status === "working" ? "#60AEFF" : "#1B2A4A" }} />
          </div>
          <span className="text-[10px] tracking-wider uppercase font-semibold" style={{ color: "#4A6080" }}>
            Facilitation
          </span>
          <span className="text-[10px] leading-snug block mt-1" style={{ color: "#5A7090" }}>
            {mentor.status === "working" ? "Routing now..." : "Meeting host"}
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
          width: "130px",
          minHeight: "72px",
          padding: "10px 12px",
        }}
        title={mentor.status === "ready" ? "Click to receive result" : isSelected ? `Deselect ${mentor.name}` : `Select ${mentor.name}`}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold tracking-widest" style={{ color: isSelected ? deptColor : "#FFFFFF" }}>{mentor.name}</span>
          <div className="flex items-center gap-1.5">
            {participation > 0 && (
              <span className="text-[10px] font-bold" style={{ color: "#4A6080" }}>{participation}</span>
            )}
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_DOT[mentor.status] }} />
          </div>
        </div>
        <span className="text-[10px] tracking-wider uppercase font-semibold block" style={{ color: isSelected ? deptColor + "BB" : "#4A5E78" }}>
          {meta?.department ?? ""}
        </span>
        <div className="flex flex-col gap-0.5 mt-1">
          {(meta?.bullets ?? []).slice(0, 2).map((b, i) => (
            <span key={i} className="text-[10px] leading-snug" style={{ color: isSelected ? "#8AB0C8" : "#4A6080" }}>
              · {b}
            </span>
          ))}
        </div>
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
          <p className="text-[10px] tracking-widest uppercase mb-1.5 flex-shrink-0 font-semibold" style={{ color: "#5A7A9A" }}>
            Transcript
          </p>
          <div
            ref={transcriptRef}
            className="flex-1 overflow-y-auto rounded-lg p-3"
            style={{ backgroundColor: "#111D30" }}
          >
            {messages.length === 0 ? (
              <p className="text-sm text-center mt-8" style={{ color: "#5A7A9A" }}>
                No messages yet. JULIE will route your message to the right team members.
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
                        className="leading-relaxed"
                        style={{
                          color: isYou ? "#FFFFFF" : msg.isThinking ? "#3A4F6A" : isJulieMsg ? "#A0B2C8" : "#D8E8F5",
                          fontStyle: msg.isThinking ? "italic" : "normal",
                          fontSize: "15px",
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
          {sessionFiles.length > 0 && (
            <div className="mb-2 flex items-center gap-2 flex-wrap">
              <span className="text-[9px] tracking-widest uppercase font-semibold flex-shrink-0" style={{ color: "#5A7A9A" }}>Files:</span>
              {sessionFiles.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setPreviewFile(f)}
                  className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-lg font-semibold transition-opacity hover:opacity-80"
                  style={{ backgroundColor: "rgba(201,168,76,0.1)", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.2)" }}
                >
                  <span>📄</span>
                  {f.name.length > 20 ? f.name.slice(0, 20) + "…" : f.name}
                </button>
              ))}
            </div>
          )}
          <div
            className="relative mb-2"
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={async (e) => {
              e.preventDefault();
              setIsDragOver(false);
              const file = e.dataTransfer.files[0];
              if (!file || !sessionId) return;
              try {
                const record = await uploadFileToVault(file, { linkedSessionId: sessionId });
                setSessionFiles((prev) => [...prev, record]);
                trackFileDiscussed(record);
                updateSession(sessionId, { files_discussed: [...meetingStateRef.current.filesDiscussed, record.id] }).catch(() => {});
                addMessage(`JULIE: File "${record.name}" saved to Vault and linked to this session.`, "mentor", "JULIE", ["ALL"], false, true);
              } catch {
                addMessage(`[File upload failed]`, "mentor", "JULIE", ["ALL"], false, true);
              }
            }}
          >
            {isDragOver && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg pointer-events-none"
                style={{ backgroundColor: "rgba(201,168,76,0.08)", border: "2px dashed #C9A84C" }}>
                <span className="text-xs font-semibold" style={{ color: "#C9A84C" }}>Drop file — saves to Vault + links to session</span>
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
                className="flex-1 px-4 py-3 rounded-lg outline-none transition-all"
                style={{
                  backgroundColor: "#1B2A4A",
                  color: "#FFFFFF",
                  fontSize: "15px",
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
                className="px-4 py-3 rounded-lg font-semibold text-sm tracking-wider uppercase transition-all duration-150 hover:opacity-90 active:scale-95"
                style={{ backgroundColor: "#1B2A4A", color: "#8A9BB5", border: "1px solid #2A3D5E" }}
              >
                Note{sideNotes.length > 0 ? ` (${sideNotes.length})` : ""}
              </button>
              <button
                onClick={() => setShowFileUpload(true)}
                className="px-4 py-3 rounded-lg font-semibold text-sm tracking-wider uppercase transition-all duration-150 hover:opacity-80 active:scale-95 flex items-center gap-2"
                style={{ backgroundColor: "#1B2A4A", color: "#8A9BB5", border: "1px solid #2A3D5E" }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                File
              </button>
            </div>
          </div>
          <p className="text-xs mt-2" style={{ color: "#5A7A9A" }}>
            Select team member tiles to direct your message. JULIE always decides who speaks.
          </p>
        </div>
      </div>

      {showMemoryPanel && (
        <div
          className="flex-shrink-0 flex flex-col border-l overflow-y-auto"
          style={{ width: "240px", minWidth: "240px", borderColor: "#1B2A4A", backgroundColor: "#080F1C" }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0" style={{ borderColor: "#1B2A4A" }}>
            <div>
              <p className="text-[9px] tracking-widest uppercase font-bold" style={{ color: "#8A9BB5" }}>Session Memory</p>
              <p className="text-[8px] mt-0.5" style={{ color: "#3A4F6A" }}>Persisted · Auto-synced</p>
            </div>
            <button onClick={() => setShowMemoryPanel(false)} className="text-sm opacity-40 hover:opacity-80 leading-none" style={{ color: "#8A9BB5" }}>×</button>
          </div>

          {meetingState.carryoverItems.filter((c) => !c.resolved).length > 0 && (
            <div className="px-4 py-3 border-b" style={{ borderColor: "#1B2A4A", backgroundColor: "rgba(249,115,22,0.05)" }}>
              <p className="text-[9px] tracking-widest uppercase font-bold mb-2 flex items-center gap-1.5" style={{ color: "#F97316" }}>
                ⟳ Carryover ({meetingState.carryoverItems.filter((c) => !c.resolved).length} open)
              </p>
              <div className="flex flex-col gap-1.5">
                {meetingState.carryoverItems.slice(0, 6).map((item, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition-all hover:opacity-80"
                    style={{
                      backgroundColor: item.resolved ? "transparent" : "rgba(249,115,22,0.06)",
                      border: `1px solid ${item.resolved ? "transparent" : "rgba(249,115,22,0.15)"}`,
                    }}
                    onClick={() => {
                      if (!item.resolved) {
                        setInput(item.text.slice(0, 80));
                        inputRef.current?.focus();
                      }
                    }}
                    title={item.resolved ? "Resolved" : "Click to address"}
                  >
                    <span className="text-[9px] mt-0.5 flex-shrink-0 font-bold" style={{
                      color: item.resolved ? "#2A3D5E" : item.type === "task" ? "#5A9BD3" : item.type === "question" ? "#F87171" : "#F97316"
                    }}>
                      {item.type === "task" ? "T" : item.type === "question" ? "?" : "~"}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] leading-snug" style={{ color: item.resolved ? "#2A3D5E" : "#8A9BB5", textDecoration: item.resolved ? "line-through" : "none" }}>
                        {item.text.slice(0, 50)}{item.text.length > 50 ? "…" : ""}
                      </p>
                      {item.owner && !item.resolved && (
                        <p className="text-[9px] mt-0.5" style={{ color: "#4A6080" }}>→ {item.owner}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="px-4 py-3 border-b" style={{ borderColor: "#1B2A4A" }}>
            <p className="text-[9px] tracking-widest uppercase font-bold mb-2" style={{ color: "#F87171" }}>
              Open Questions {meetingState.openQuestions.length > 0 && `(${meetingState.openQuestions.length})`}
            </p>
            {meetingState.openQuestions.length === 0 ? (
              <p className="text-[10px]" style={{ color: "#2A3D5E" }}>None raised yet</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {meetingState.openQuestions.slice(-5).map((q, i) => (
                  <button
                    key={i}
                    className="text-left px-2 py-1.5 rounded-lg text-[10px] leading-snug transition-all hover:opacity-80"
                    style={{ backgroundColor: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.15)", color: "#C08080" }}
                    onClick={() => {
                      setInput(`About: ${q.slice(0, 60)}`);
                      inputRef.current?.focus();
                    }}
                    title="Click to address this question"
                  >
                    ? {q.slice(0, 55)}{q.length > 55 ? "…" : ""}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="px-4 py-3 border-b" style={{ borderColor: "#1B2A4A" }}>
            <p className="text-[9px] tracking-widest uppercase font-bold mb-2" style={{ color: "#5A9BD3" }}>
              Active Tasks {meetingState.assignedTasks.length > 0 && `(${meetingState.assignedTasks.length})`}
            </p>
            {meetingState.assignedTasks.length === 0 ? (
              <p className="text-[10px]" style={{ color: "#2A3D5E" }}>None assigned</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {meetingState.assignedTasks.slice(-6).map((t, i) => (
                  <div
                    key={i}
                    className="px-2 py-1.5 rounded-lg cursor-pointer transition-all hover:opacity-80"
                    style={{ backgroundColor: "rgba(90,155,211,0.06)", border: "1px solid rgba(90,155,211,0.15)" }}
                    onClick={() => {
                      setInput(`Status update: ${t.task.slice(0, 60)}`);
                      inputRef.current?.focus();
                    }}
                    title="Click to follow up"
                  >
                    <p className="text-[10px] leading-snug" style={{ color: "#8AB5D5" }}>{t.task.slice(0, 50)}{t.task.length > 50 ? "…" : ""}</p>
                    <p className="text-[9px] mt-0.5" style={{ color: "#3A6080" }}>→ {t.owner}</p>
                  </div>
                ))}
              </div>
            )}
            {meetingState.resolvedTasks && meetingState.resolvedTasks.length > 0 && (
              <div className="mt-2 flex flex-col gap-1">
                {meetingState.resolvedTasks.slice(-3).map((t, i) => (
                  <p key={i} className="text-[9px] leading-snug" style={{ color: "#2A4D3A", textDecoration: "line-through" }}>✓ {t.task.slice(0, 40)}</p>
                ))}
              </div>
            )}
          </div>

          <div className="px-4 py-3 border-b" style={{ borderColor: "#1B2A4A" }}>
            <p className="text-[9px] tracking-widest uppercase font-bold mb-2" style={{ color: "#4ADE80" }}>
              Decisions {meetingState.decisionsMade.length > 0 && `(${meetingState.decisionsMade.length})`}
            </p>
            {meetingState.decisionsMade.length === 0 ? (
              <p className="text-[10px]" style={{ color: "#2A3D5E" }}>None recorded yet</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {meetingState.decisionsMade.slice(-4).map((d, i) => (
                  <div
                    key={i}
                    className="px-2 py-1.5 rounded-lg"
                    style={{ backgroundColor: "rgba(74,222,128,0.04)", border: "1px solid rgba(74,222,128,0.12)" }}
                  >
                    <p className="text-[10px] leading-snug" style={{ color: "#6AB87A" }}>✓ {d.slice(0, 60)}{d.length > 60 ? "…" : ""}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="px-4 py-3 border-b" style={{ borderColor: "#1B2A4A" }}>
            <p className="text-[9px] tracking-widest uppercase font-bold mb-2" style={{ color: "#C9A84C" }}>
              Active Topics {meetingState.activeTopics.length > 0 && `(${meetingState.activeTopics.length})`}
            </p>
            {meetingState.activeTopics.length === 0 ? (
              <p className="text-[10px]" style={{ color: "#2A3D5E" }}>No topics tracked yet</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {meetingState.activeTopics.slice(-5).map((t, i) => (
                  <span
                    key={i}
                    className="inline-block text-[9px] px-1.5 py-0.5 rounded font-semibold cursor-pointer hover:opacity-80"
                    style={{ backgroundColor: "rgba(201,168,76,0.1)", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.2)" }}
                    onClick={() => { setInput(t.slice(0, 60)); inputRef.current?.focus(); }}
                    title="Click to revisit topic"
                  >
                    {t.slice(0, 28)}{t.length > 28 ? "…" : ""}
                  </span>
                ))}
              </div>
            )}
          </div>

          {meetingState.memoryFiles.length > 0 && (
            <div className="px-4 py-3 border-b" style={{ borderColor: "#1B2A4A" }}>
              <p className="text-[9px] tracking-widest uppercase font-bold mb-2" style={{ color: "#60A5FA" }}>
                Files ({meetingState.memoryFiles.length})
              </p>
              <div className="flex flex-col gap-1.5">
                {meetingState.memoryFiles.slice(-5).map((f) => {
                  const vf = sessionFiles.find((sf) => sf.id === f.id);
                  return (
                    <button
                      key={f.id}
                      className="text-left px-2 py-1.5 rounded-lg text-[10px] leading-snug transition-all hover:opacity-80"
                      style={{ backgroundColor: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.15)", color: "#93C5FD" }}
                      onClick={() => { if (vf) setPreviewFile(vf); }}
                      title={vf ? "Click to preview" : f.name}
                    >
                      <span className="font-semibold">{f.name.slice(0, 28)}{f.name.length > 28 ? "…" : ""}</span>
                      <span className="ml-1.5 text-[9px] uppercase opacity-60">{f.type}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {meetingState.memoryNotes.length > 0 && (
            <div className="px-4 py-3 border-b" style={{ borderColor: "#1B2A4A" }}>
              <p className="text-[9px] tracking-widest uppercase font-bold mb-2" style={{ color: "#10B981" }}>
                Notes ({meetingState.memoryNotes.length})
              </p>
              <div className="flex flex-col gap-1.5">
                {meetingState.memoryNotes.slice(-4).map((n, i) => (
                  <div
                    key={i}
                    className="px-2 py-1.5 rounded-lg"
                    style={{ backgroundColor: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.15)" }}
                  >
                    <p className="text-[10px] leading-snug" style={{ color: "#6EBA9C" }}>{n.text.slice(0, 55)}{n.text.length > 55 ? "…" : ""}</p>
                    {n.tags.length > 0 && (
                      <div className="flex gap-1 mt-0.5 flex-wrap">
                        {n.tags.slice(0, 3).map((t) => (
                          <span key={t} className="text-[8px] px-1 rounded" style={{ backgroundColor: "rgba(201,168,76,0.12)", color: "#C9A84C" }}>{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="px-4 py-3 border-b" style={{ borderColor: "#1B2A4A" }}>
            <p className="text-[9px] tracking-widest uppercase font-bold mb-2" style={{ color: "#A07BC9" }}>
              Team Involved
            </p>
            {Object.keys(meetingState.mentorParticipation).length === 0 ? (
              <p className="text-[10px]" style={{ color: "#2A3D5E" }}>No responses yet</p>
            ) : (
              <div className="flex flex-col gap-1">
                {Object.entries(meetingState.mentorParticipation)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 8)
                  .map(([name, count]) => (
                    <div key={name} className="flex items-center justify-between">
                      <span className="text-[9px] tracking-widest uppercase font-semibold" style={{ color: "#4A5E78" }}>{name}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ color: "#C9A84C", backgroundColor: "rgba(201,168,76,0.1)" }}>{count}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {meetingState.answeredQuestions.length > 0 && (
            <div className="px-4 py-3">
              <p className="text-[9px] tracking-widest uppercase font-bold mb-1.5" style={{ color: "#2A6A3A" }}>
                Resolved ({meetingState.answeredQuestions.length})
              </p>
              <div className="flex flex-col gap-1">
                {meetingState.answeredQuestions.slice(-4).map((aq, i) => (
                  <p key={i} className="text-[10px] leading-snug" style={{ color: "#2A5A3A" }}>✓ {aq.question.slice(0, 50)}{aq.question.length > 50 ? "…" : ""}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showFileUpload && (
        <FileUploadModal
          folders={[]}
          projects={[]}
          defaultSessionId={sessionId ?? null}
          onClose={() => setShowFileUpload(false)}
          onUploaded={(record) => {
            setSessionFiles((prev) => [...prev, record]);
            trackFileDiscussed(record);
            if (sessionId) {
              updateSession(sessionId, { files_discussed: [...meetingStateRef.current.filesDiscussed, record.id] }).catch(() => {});
            }
            addMessage(`JULIE: File "${record.name}" saved to Vault and linked to this session.`, "mentor", "JULIE", ["ALL"], false, true);
          }}
        />
      )}

      {previewFile && (
        <FilePreviewModal
          file={previewFile}
          projects={[]}
          sessions={[]}
          onClose={() => setPreviewFile(null)}
          onUpdated={() => {}}
        />
      )}
    </div>
  );
}
