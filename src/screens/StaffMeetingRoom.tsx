import { useState, useRef, useEffect, useCallback } from "react";
import SideNoteModal, { SideNote } from "./SideNoteModal";
import {
  upsertTranscript,
  upsertJulieReport,
  updateSession,
  saveSideNote,
  loadSession,
  listAllTags,
  uploadFileToVault,
  getIntegrationSettings,
  type TranscriptMessage,
  type JulieReport,
  type VaultFile,
  type SideNote as DBSideNote,
} from "../lib/db";
import {
  syncFileToDrive,
  syncTranscriptToDrive,
  syncSideNoteToDrive,
  queueJulieReportForNotion,
} from "../lib/integrations";
import { ALL_MENTOR_NAMES } from "../lib/mentors";
import {
  readSourceOfTruth,
  formatSourceOfTruthForJulie,
  type SourceOfTruthEntry,
} from "../lib/sourceOfTruth";
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
  MARK: { department: "STRATEGY", realName: "Mark Reeves", bullets: ["Strategic direction", "Vision & positioning", "High-level decisions"], humorDial: 3, humorStyle: "Dry executive wit." },
  SCOUT: { department: "STRATEGY", realName: "Scout", bullets: ["Market intelligence", "Competitive landscape", "Opportunity mapping"], humorDial: 2, humorStyle: "Brief, precise." },
  DOC: { department: "CRITICAL SYSTEMS", realName: "Dr. Dana Cruz", bullets: ["Safety & harm analysis", "Emotional impact", "User wellbeing"], humorDial: 2, humorStyle: "Calm and grounded." },
  CIPHER: { department: "CRITICAL SYSTEMS", realName: "Cipher", bullets: ["Data & privacy", "Trust architecture", "Ethics & consent"], humorDial: 2, humorStyle: "Dry, subtle." },
  TECHGUY: { department: "CRITICAL SYSTEMS", realName: "Tyler Marsh", bullets: ["Engineering & systems", "Build feasibility", "Technical debt"], humorDial: 3, humorStyle: "Nerd humor." },
  RICK: { department: "CRITICAL SYSTEMS", realName: "Rick Alvarez", bullets: ["Operational risk", "Failure scenarios", "Execution exposure"], humorDial: 4, humorStyle: "Dark humor." },
  SIGMA: { department: "EXECUTION", realName: "Sigma", bullets: ["Workflows & systems", "Efficiency & scale", "Process design"], humorDial: 2, humorStyle: "Quiet, efficient." },
  PAUL: { department: "EXECUTION", realName: "Paul Bennett", bullets: ["Prioritization", "Cuts scope", "Forces a next step"], humorDial: 2, humorStyle: "Deadpan." },
  JAMES: { department: "COMMUNICATION", realName: "James", bullets: ["Internal messaging", "Team alignment", "Clarity of voice"], humorDial: 3, humorStyle: "Polished." },
  MAILMAN: { department: "COMMUNICATION", realName: "Mailman", bullets: ["Outbound messaging", "Email & comms delivery", "Audience tone"], humorDial: 2, humorStyle: "Punchy." },
  PAT: { department: "INTELLIGENCE", realName: "Pat Vance", bullets: ["Pattern recognition", "Cross-session insight", "Repeated mistakes"], humorDial: 3, humorStyle: "Pattern-aware." },
  JERRY: { department: "INTELLIGENCE", realName: "Jerry", bullets: ["Research & data", "Evidence gathering", "Fact-checking"], humorDial: 2, humorStyle: "Awkward but sharp." },
  ALEX: { department: "USER & EXPERIENCE", realName: "Alex Morgan", bullets: ["UX & usability", "Interface clarity", "Friction reduction"], humorDial: 4, humorStyle: "Observational." },
  ULYSES: { department: "USER & EXPERIENCE", realName: "Ulyses", bullets: ["Real user perspective", "First impressions", "Honest reactions"], humorDial: 4, humorStyle: "Human." },
  RAY: { department: "USER & EXPERIENCE", realName: "Ray", bullets: ["Accessibility", "Inclusive design", "Barrier removal"], humorDial: 2, humorStyle: "Practical." },
  ATK: { department: "LEGAL", realName: "ATK", bullets: ["Legal offense", "IP & claims", "Contract leverage"], humorDial: 3, humorStyle: "Aggressive sarcasm." },
  DEF: { department: "LEGAL", realName: "DEF", bullets: ["Legal defense", "Risk exposure", "Compliance shielding"], humorDial: 3, humorStyle: "Defensive wit." },
  WATCHER: { department: "OPERATIONS", realName: "Watcher", bullets: ["Monitoring & alerts", "System health", "Silent observation"], humorDial: 2, humorStyle: "Rare, precise." },
  KAREN: { department: "OPERATIONS", realName: "Karen", bullets: ["Admin & logistics", "Process enforcement", "Keeps things moving"], humorDial: 2, humorStyle: "No-nonsense." },
  THATGUY: { department: "OPERATIONS", realName: "That Guy", bullets: ["The wild card", "Unconventional takes", "Asks what no one will"], humorDial: 4, humorStyle: "Irreverent." },
  JAMISON: { department: "COMMUNICATION", realName: "James Jamison", bullets: ["Copy & tone", "Message clarity", "Word choices"], humorDial: 3, humorStyle: "Sharp." },
  SAM: { department: "EXECUTION", realName: "Sam", bullets: ["Task ownership", "Who does what", "Timeline tracking"], humorDial: 2, humorStyle: "Direct." },
  JULIE: { department: "FACILITATION", realName: "Julie", bullets: ["Routes all messages", "Meeting facilitator", "Session memory"], humorDial: 4, humorStyle: "Warm." },
};

const DEPARTMENT_ORDER = [
  "STRATEGY",
  "CRITICAL SYSTEMS",
  "EXECUTION",
  "COMMUNICATION",
  "INTELLIGENCE",
  "USER & EXPERIENCE",
  "LEGAL",
  "OPERATIONS",
  "FACILITATION",
];

const DEPARTMENT_COLORS: Record<string, string> = {
  STRATEGY: "#C9A84C",
  "CRITICAL SYSTEMS": "#E07B5A",
  EXECUTION: "#5A9BD3",
  COMMUNICATION: "#6BAF8E",
  INTELLIGENCE: "#A07BC9",
  "USER & EXPERIENCE": "#5AB8A8",
  LEGAL: "#C97B7B",
  OPERATIONS: "#7B8FA8",
  FACILITATION: "#8A9BB5",
};

const INITIAL_MENTORS: Mentor[] = [
  { id: "mark", name: "MARK", status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.7, commentWeight: 0.6, riskSensitivity: 0.8, lastRespondedTurn: null, hasTask: false, turnCount: 0 },
  { id: "scout", name: "SCOUT", status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.4, commentWeight: 0.7, riskSensitivity: 0.6, lastRespondedTurn: null, hasTask: false, turnCount: 0 },
  { id: "jamison", name: "JAMISON", status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.2, commentWeight: 0.8, riskSensitivity: 0.7, lastRespondedTurn: null, hasTask: false, turnCount: 0 },
  { id: "doc", name: "DOC", status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.9, commentWeight: 0.7, riskSensitivity: 1.0, lastRespondedTurn: null, hasTask: false, turnCount: 0 },
  { id: "tech9", name: "TECHGUY", status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.5, commentWeight: 0.7, riskSensitivity: 0.7, lastRespondedTurn: null, hasTask: false, turnCount: 0 },
  { id: "sam", name: "SAM", status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.4, commentWeight: 0.6, riskSensitivity: 0.6, lastRespondedTurn: null, hasTask: false, turnCount: 0 },
  { id: "cipher", name: "CIPHER", status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.85, commentWeight: 0.6, riskSensitivity: 1.0, lastRespondedTurn: null, hasTask: false, turnCount: 0 },
  { id: "rick", name: "RICK", status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.6, commentWeight: 0.7, riskSensitivity: 0.9, lastRespondedTurn: null, hasTask: false, turnCount: 0 },
  { id: "alex", name: "ALEX", status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.3, commentWeight: 0.8, riskSensitivity: 0.5, lastRespondedTurn: null, hasTask: false, turnCount: 0 },
  { id: "paul", name: "PAUL", status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.5, commentWeight: 0.7, riskSensitivity: 0.4, lastRespondedTurn: null, hasTask: false, turnCount: 0 },
  { id: "pat", name: "PAT", status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.2, commentWeight: 0.5, riskSensitivity: 0.5, lastRespondedTurn: null, hasTask: false, turnCount: 0 },
  { id: "ulyses", name: "ULYSES", status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.3, commentWeight: 0.8, riskSensitivity: 0.3, lastRespondedTurn: null, hasTask: false, turnCount: 0 },
  { id: "sigma", name: "SIGMA", status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.4, commentWeight: 0.7, riskSensitivity: 0.5, lastRespondedTurn: null, hasTask: false, turnCount: 0 },
  { id: "james", name: "JAMES", status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.3, commentWeight: 0.8, riskSensitivity: 0.4, lastRespondedTurn: null, hasTask: false, turnCount: 0 },
  { id: "mailman", name: "MAILMAN", status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.2, commentWeight: 0.8, riskSensitivity: 0.3, lastRespondedTurn: null, hasTask: false, turnCount: 0 },
  { id: "jerry", name: "JERRY", status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.3, commentWeight: 0.7, riskSensitivity: 0.5, lastRespondedTurn: null, hasTask: false, turnCount: 0 },
  { id: "ray", name: "RAY", status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.3, commentWeight: 0.7, riskSensitivity: 0.5, lastRespondedTurn: null, hasTask: false, turnCount: 0 },
  { id: "atk", name: "ATK", status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.5, commentWeight: 0.6, riskSensitivity: 0.8, lastRespondedTurn: null, hasTask: false, turnCount: 0 },
  { id: "def", name: "DEF", status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.5, commentWeight: 0.6, riskSensitivity: 0.9, lastRespondedTurn: null, hasTask: false, turnCount: 0 },
  { id: "watcher", name: "WATCHER", status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.1, commentWeight: 0.4, riskSensitivity: 0.7, lastRespondedTurn: null, hasTask: false, turnCount: 0 },
  { id: "karen", name: "KAREN", status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.4, commentWeight: 0.6, riskSensitivity: 0.5, lastRespondedTurn: null, hasTask: false, turnCount: 0 },
  { id: "thatguy", name: "THATGUY", status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.6, commentWeight: 0.9, riskSensitivity: 0.3, lastRespondedTurn: null, hasTask: false, turnCount: 0 },
  { id: "julie", name: "JULIE", status: "idle", hasComment: false, hasInterrupt: false, interruptWeight: 0.0, commentWeight: 0.0, riskSensitivity: 0.0, lastRespondedTurn: null, hasTask: false, turnCount: 0 },
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

const STATUS_STYLES: Record<MentorStatus, { backgroundColor: string; color: string }> = {
  idle: { backgroundColor: "#1B2A4A", color: "#FFFFFF" },
  assigned: { backgroundColor: "#1A3A5C", color: "#7ABFFF" },
  working: { backgroundColor: "#0E3050", color: "#A8D8FF" },
  ready: { backgroundColor: "#0D3320", color: "#4ADE80" },
  blocked: { backgroundColor: "#3A1010", color: "#F87171" },
};

const STATUS_DOT: Record<MentorStatus, string> = {
  idle: "#3A4F6A",
  assigned: "#7ABFFF",
  working: "#60AEFF",
  ready: "#4ADE80",
  blocked: "#F87171",
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
  return ["summary", "where are we", "recap", "what have we decided", "what's open", "status check"].some((k) =>
    lower.includes(k)
  );
}

function isOpenFloor(text: string): boolean {
  const lower = text.toLowerCase();
  return [
    "anyone else",
    "thoughts",
    "what do you all think",
    "who else",
    "other ideas",
    "what does everyone think",
    "any other",
  ].some((t) => lower.includes(t));
}

function isVenting(text: string): boolean {
  const lower = text.toLowerCase();
  return [
    "so frustrated",
    "i'm frustrated",
    "im frustrated",
    "pissed off",
    "i'm done",
    "im done",
    "this is ridiculous",
    "this is a mess",
    "nothing is working",
    "i hate this",
    "i can't deal",
    "i cant deal",
    "ugh",
    "argh",
    "i give up",
    "so annoying",
    "drives me crazy",
    "i'm losing it",
    "im losing it",
    "falling apart",
    "completely lost",
  ].some((k) => lower.includes(k));
}

function isAnyoneElse(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes("anyone else") || lower.includes("who else");
}

function detectDecision(text: string): string | null {
  const lower = text.toLowerCase();
  const triggers = [
    "we should",
    "we will",
    "we need to",
    "let's go with",
    "decided to",
    "agreed to",
    "the decision is",
    "moving forward with",
    "go with",
    "we're going to",
    "plan is to",
    "recommend",
    "recommendation:",
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
    "should handle",
    "will take care of",
    "can own",
    "needs to",
    "should look into",
    "should review",
    "should draft",
    "needs a review",
    "should check",
    "i'll",
    "i will",
    "i can",
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
  if (state.assignedTasks.length > 0) {
    parts.push(
      `Tasks: ${state.assignedTasks
        .slice(0, 2)
        .map((t) => `${t.owner}: ${t.task.slice(0, 40)}`)
        .join("; ")}`
    );
  }
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
  const [showMemoryPanel, setShowMemoryPanel] = useState(false);
  const [activeDeptTab, setActiveDeptTab] = useState<string | null>(null);
  const [driveConnected, setDriveConnected] = useState(false);
  const [notionConnected, setNotionConnected] = useState(false);
  const [syncingSession, setSyncingSession] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

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
  const sotEntriesRef = useRef<SourceOfTruthEntry[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    mentorsRef.current = mentors;
  }, [mentors]);

  useEffect(() => {
    meetingStateRef.current = meetingState;
  }, [meetingState]);

  useEffect(() => {
    readSourceOfTruth(50)
      .then((entries) => {
        sotEntriesRef.current = entries;
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!sessionKey) return;

    loadSession(sessionKey)
      .then((result) => {
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
          const r = result.julieReport as JulieReport;
          const memFiles: MemoryFile[] = (r.files_referenced ?? []).map((f) => ({
            id: f.id,
            name: f.name,
            type: f.type,
            tags: [],
          }));
          const memNotes: MemoryNote[] = (r.notes_referenced ?? []).map((n) => ({
            id: n.id,
            text: n.text,
            tags: n.tags ?? [],
            mentors: [],
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
              id: f.id,
              name: f.name,
              type: f.file_type,
              tags: f.tags ?? [],
              linkedSessionId: f.linked_session_id,
              linkedProjectId: f.linked_project_id,
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
              id: n.id,
              text: n.text,
              tags: n.tags ?? [],
              mentors: n.mentors ?? [],
              sessionId: n.session_id,
            })),
          }));
        }
      })
      .catch(() => {});

    listAllTags()
      .then((tags) => {
        setUsedTags(tags.map((t) => t.tag));
      })
      .catch(() => {});
  }, [sessionKey]);

  useEffect(() => {
    if (!sessionKey) return;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const prevKey = yesterday.toISOString().slice(0, 10);

    loadSession(prevKey)
      .then((result) => {
        if (!result) return;

        const session = result.session;
        const report = result.julieReport as JulieReport | null;

        const storedTasks = (session.carryover_tasks ?? []).filter((t) => t.task);
        const storedQs = (session.carryover_questions ?? []).filter(Boolean);
        const storedTopics = (session.carryover_topics ?? []).filter(Boolean);

        const unresolvedTopics =
          storedTopics.length > 0 ? storedTopics : (report?.unresolved_topics ?? []).filter(Boolean);
        const openQs = storedQs.length > 0 ? storedQs : (report?.open_questions ?? []).filter(Boolean);
        const assignedTasks =
          storedTasks.length > 0 ? storedTasks : (report?.assigned_tasks ?? []).filter((t) => t.task);

        const carryoverItems: CarryoverItem[] = [
          ...unresolvedTopics.map((t) => ({
            text: t,
            type: "topic" as const,
            resolved: false,
            fromSession: prevKey,
          })),
          ...openQs.map((q) => ({
            text: q,
            type: "question" as const,
            resolved: false,
            fromSession: prevKey,
          })),
          ...assignedTasks.map((t) => ({
            text: t.task,
            type: "task" as const,
            owner: t.owner,
            resolved: false,
            fromSession: prevKey,
          })),
        ];

        if (carryoverItems.length === 0) return;

        setMeetingState((prev) => ({
          ...prev,
          carryoverItems,
          unresolvedTopics: [
            ...unresolvedTopics,
            ...prev.unresolvedTopics.filter((t) => !unresolvedTopics.includes(t)),
          ],
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
          return [
            ...prev,
            {
              id: -99,
              text: `JULIE: ${carryMsg}`,
              speaker: "mentor",
              sender: "JULIE",
              targets: ["ALL"],
              isJulie: true,
            },
          ];
        });
      })
      .catch(() => {});
  }, [sessionKey]);

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    getIntegrationSettings("google_drive")
      .then((s) => {
        if (s?.connected) setDriveConnected(true);
      })
      .catch(() => {});

    getIntegrationSettings("notion")
      .then((s) => {
        if (s?.connected) setNotionConnected(true);
      })
      .catch(() => {});
  }, []);

  const persistSession = useCallback(() => {
    if (!sessionId) return;

    const persistable: TranscriptMessage[] = messagesRef.current
      .filter((m) => !m.isThinking)
      .map((m) => ({
        id: m.id,
        text: m.text,
        speaker: m.speaker,
        sender: m.sender,
        targets: m.targets,
      }));

    upsertTranscript(sessionId, persistable).catch(() => {});
    const s = meetingStateRef.current;

    const filesRef = s.memoryFiles.map((f) => ({ id: f.id, name: f.name, type: f.type }));
    const notesRef = s.memoryNotes.map((n) => ({
      id: n.id,
      text: n.text.slice(0, 100),
      tags: n.tags,
    }));
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

    const mentorsInvolved = Object.keys(s.mentorParticipation).filter(
      (k) => (s.mentorParticipation[k] ?? 0) > 0
    );
    const keyTopics = [...new Set([...s.activeTopics, ...s.decisionsMade.slice(0, 2)])].slice(0, 8);
    const summary = buildSessionSummary(s);

    const unresolvedTasks = s.assignedTasks.filter(
      (t) => !resolvedTasks.some((rt) => rt.task === t.task)
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

  function addMessage(
    text: string,
    speaker: "you" | "mentor",
    sender?: string,
    targets?: string[],
    isThinking?: boolean,
    isJulie?: boolean
  ): number {
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

  function setMentorStatus(name: string, status: MentorStatus) {
    setMentors((prev) => prev.map((m) => (m.name === name ? { ...m, status } : m)));
  }

  function trackMentorTurn(mentorName: string) {
    lastSpeakerRef.current = mentorName;
    recentSpeakersRef.current = [...recentSpeakersRef.current.slice(-4), mentorName];
    setMentors((prev) =>
      prev.map((m) => (m.name === mentorName ? { ...m, turnCount: m.turnCount + 1 } : m))
    );
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
        id: file.id,
        name: file.name,
        type: file.file_type,
        tags: file.tags ?? [],
        linkedSessionId: file.linked_session_id,
        linkedProjectId: file.linked_project_id,
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
        id: note.id,
        text: note.text,
        tags: note.tags ?? [],
        mentors: note.mentors ?? [],
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
      .map((m) => ({
        speaker: m.sender ?? (m.speaker === "you" ? "YOU" : "MENTOR"),
        text: m.text,
      }));
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
      body.sourceOfTruth = formatSourceOfTruthForJulie(sotEntriesRef.current);
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

  async function askJulieToRoute(
    userMessage: string,
    currentMode: Mode,
    forcedMentors?: string[]
  ): Promise<JulieRouting> {
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
${ventingSignal ? "VENTING DETECTED — user is emotionally frustrated. Include a short acknowledging line before routing. Do not skip straight to fixing." : ""}
${forcedMentors ? `USER EXPLICITLY SELECTED: ${forcedMentors.join(", ")} — route to them.` : ""}

ANTI-DOMINANCE RULE: MARK must NOT be routed to unless the topic is clearly strategic direction. MARK is not the default.
LAST SPEAKER RULE: NEVER route to "${lastSpeaker ?? "none"}" — they just spoke.

You are running the meeting.
You must briefly interpret the user's intent, decide who should speak, and keep momentum.

Return ONLY valid JSON in this exact format:
{"mentors":["NAME1"],"line":"brief facilitator line","action":"route"}

Rules:
- mentors: default 1 name. Up to ${maxMentors} if open floor or multiple clearly relevant domains
- NEVER include JULIE in mentors
- NEVER include "${lastSpeaker ?? ""}" in mentors
- If user is venting/emotional: include your line acknowledging it, then route
- line is REQUIRED unless action is acknowledge
- If user asks for summary: action "summarize", mentors: [], full summary in line
- If it's simple acknowledgment ("ok", "got it", "thanks"): action "acknowledge", mentors: [], no line
- If user is vague/unclear: action "route", mentors: [], line with ONE clarifying question
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
      return {
        mentors: [fallback],
        line: "Got it. Routing this to the right person.",
        action: "route",
      };
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

    setMentors((prev) => prev.map((m) => (m.id === mentor.id ? { ...m, status: "working" } : m)));

    const thinkingId = addMessage(`${mentor.name} is thinking...`, "mentor", mentor.name, ["YOU"], true);

    let responseText = "";
    try {
      responseText = await fetchMentorResponse(
        mentor.name,
        userMessage,
        currentMode,
        isInterrupt,
        isOpenFloorMsg
      );

      if (!isInterrupt && isTooSimilar(responseText, recentTopics.current)) {
        removeMessageById(thinkingId);
        return;
      }

      const lastWasQuestion =
        recentTopics.current.length > 0 &&
        isQuestion(recentTopics.current[recentTopics.current.length - 1]);

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
          return {
            ...prev,
            decisionsMade: [...prev.decisionsMade, detectedDecision],
          };
        });
      }

      const detectedTask = detectTask(responseText);
      if (detectedTask && !isInterrupt) {
        setMeetingState((prev) => {
          const exists = prev.assignedTasks.some((t) => t.task === detectedTask.task);
          if (exists) return prev;
          return {
            ...prev,
            assignedTasks: [...prev.assignedTasks, { task: detectedTask.task, owner: mentor.name }],
          };
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

      const allTasks = meetingStateRef.current.assignedTasks;
      const maybeResolved = allTasks.find(
        (t) =>
          responseText.toLowerCase().includes(t.task.toLowerCase().slice(0, 20)) &&
          (responseText.toLowerCase().includes("done") ||
            responseText.toLowerCase().includes("complete") ||
            responseText.toLowerCase().includes("finished"))
      );

      if (maybeResolved) {
        resolveTask(maybeResolved.task, maybeResolved.owner);
      }

      removeMessageById(thinkingId);
      addMessage(`${mentor.name}: ${responseText}`, "mentor", mentor.name, ["YOU"]);

      const state2 = meetingStateRef.current;
      const relatedFile = state2.memoryFiles.find((f) =>
        responseText.toLowerCase().includes(f.name.toLowerCase().split(".")[0]?.slice(0, 10) ?? "")
      );
      const openCount = state2.openQuestions.length;
      const taskCount = state2.assignedTasks.length;

      const shouldJulieComment =
        !isInterrupt &&
        turnId === currentTurnId.current &&
        lastJulieSpeakTurn.current < turnId - 1 &&
        (relatedFile || openCount > 2 || (taskCount > 1 && Math.random() < 0.3));

      if (shouldJulieComment) {
        setTimeout(() => {
          if (currentTurnId.current !== turnId) return;

          let julieNote = "";
          if (relatedFile) {
            julieNote = `We reviewed "${relatedFile.name}" earlier in this session — that may be relevant here.`;
          } else if (openCount > 2) {
            julieNote = `We still have ${openCount} open questions in memory.`;
          } else if (taskCount > 1) {
            julieNote = `${taskCount} tasks are tracked in session memory.`;
          }

          if (julieNote) {
            addMessage(`JULIE: ${julieNote}`, "mentor", "JULIE", ["ALL"], false, true);
            lastJulieSpeakTurn.current = turnId;
          }
        }, 2000);
      }
    } catch {
      removeMessageById(thinkingId);
      addMessage(`${mentor.name}: I hit a problem generating a response.`, "mentor", mentor.name, ["YOU"]);
    } finally {
      setMentors((prev) =>
        prev.map((m) => {
          if (m.id !== mentor.id) return m;
          if (m.hasTask) return { ...m, status: m.status };
          return {
            ...m,
            status: "idle",
            hasInterrupt: false,
            hasComment: false,
            lastRespondedTurn: turnId,
          };
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

  async function handleEndSession() {
    if (!sessionId || !sessionKey) return;

    setSyncingSession(true);
    setSyncStatus("Saving session...");
    persistSession();

    const s = meetingStateRef.current;
    const mentorsInvolved = Object.keys(s.mentorParticipation).filter(
      (k) => (s.mentorParticipation[k] ?? 0) > 0
    );
    const summary = buildSessionSummary(s);

    let driveTranscriptUrl = "";
    let driveReportUrl = "";

    if (driveConnected) {
      setSyncStatus("Syncing to Google Drive...");
      const transcript = messagesRef.current
        .filter((m) => !m.isThinking)
        .map((m) => ({
          id: m.id,
          speaker: m.sender ?? (m.speaker === "you" ? "YOU" : "MENTOR"),
          text: m.text,
        }));

      const julieReport = {
        open_questions: s.openQuestions,
        decisions_made: s.decisionsMade,
        assigned_tasks: s.assignedTasks,
        active_topics: s.activeTopics,
        unresolved_topics: s.unresolvedTopics,
        mentor_participation: s.mentorParticipation,
      };

      try {
        const result = await syncTranscriptToDrive({
          sessionId,
          sessionKey,
          transcript,
          julieReport,
        });

        if (result.success) {
          driveTranscriptUrl = result.transcriptUrl ?? "";
          driveReportUrl = result.reportUrl ?? "";
          setSyncStatus("Drive sync complete.");
        } else {
          setSyncStatus(`Drive sync failed: ${result.error}`);
        }
      } catch {
        setSyncStatus("Drive sync failed.");
      }
    }

    setSyncStatus("Queuing Notion report for approval...");
    const today = new Date().toISOString().slice(0, 10);

    try {
      await queueJulieReportForNotion({
        sessionId,
        sessionKey,
        sessionDate: today,
        summary,
        decisions: s.decisionsMade,
        openQuestions: s.openQuestions,
        assignedTasks: s.assignedTasks,
        activeTopics: s.activeTopics,
        mentorsInvolved,
        driveLinks: {
          transcript: driveTranscriptUrl,
          report: driveReportUrl,
        },
      });

      if (driveConnected) {
        setSyncStatus("Session synced to Drive. Notion report queued for approval in Integrations.");
        addMessage(
          "JULIE: Session wrapped up. Transcript saved to Drive. Notion report is queued for your approval in Integrations.",
          "mentor",
          "JULIE",
          ["ALL"],
          false,
          true
        );
      } else {
        setSyncStatus("Session saved. Notion report queued for approval.");
        addMessage(
          "JULIE: Session saved locally. Notion report queued for approval.",
          "mentor",
          "JULIE",
          ["ALL"],
          false,
          true
        );
      }
    } catch {
      if (driveConnected) {
        setSyncStatus("Session synced to Drive. Notion queue unavailable — data saved locally.");
      } else {
        setSyncStatus("Session saved locally. Notion unavailable — will retry when reconnected.");
      }

      addMessage(
        "JULIE: Session data saved locally. Notion is currently unavailable — all data is preserved and will sync automatically when Notion is restored.",
        "mentor",
        "JULIE",
        ["ALL"],
        false,
        true
      );
    }

    setSyncingSession(false);
    setTimeout(() => setSyncStatus(null), 8000);
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

    addMessage(
      "JULIE: Got it. Give me a second to route this.",
      "mentor",
      "JULIE",
      ["ALL"],
      false,
      true
    );
    lastJulieSpeakTurn.current = turnId;

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

    setMentors((prev) => prev.map((m) => (m.name === "JULIE" ? { ...m, status: "working" } : m)));

    let routing: JulieRouting;
    try {
      routing = await askJulieToRoute(
        trimmed,
        currentMode,
        explicitTargets.length > 0 ? explicitTargets : undefined
      );
    } catch {
      routing = {
        mentors: ["PAUL"],
        line: "Got it. Routing this to the right person.",
        action: "route",
      };
    } finally {
      setMentors((prev) => prev.map((m) => (m.name === "JULIE" ? { ...m, status: "idle" } : m)));
    }

    if (currentTurnId.current !== turnId) return;

    if (routing.action === "summarize" && routing.line) {
      addMessage(`JULIE: ${routing.line}`, "mentor", "JULIE", ["ALL"], false, true);
      lastJulieSpeakTurn.current = turnId;
      return;
    }

    if (routing.action === "acknowledge") {
      return;
    }

    const julieLine = routing.line?.trim() || "Got it. Routing this to the right people.";
    addMessage(`JULIE: ${julieLine}`, "mentor", "JULIE", ["ALL"], false, true);
    lastJulieSpeakTurn.current = turnId;

    if (routing.mentors.length === 0) {
      addMessage(
        "JULIE: I need a bit more clarity before I route this. Can you tighten the ask?",
        "mentor",
        "JULIE",
        ["ALL"],
        false,
        true
      );
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

    const allNoteTags = [...new Set([...note.tags, ...newTags])]
      .map((t) => t.trim())
      .filter(Boolean);

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

        const openItems =
          meetingStateRef.current.openQuestions.length + meetingStateRef.current.assignedTasks.length;

        if (openItems > 0 && meetingStateRef.current.memoryNotes.length === 1) {
          addMessage(
            `JULIE: Note saved. We still have ${openItems} open item${openItems > 1 ? "s" : ""} in memory from this session.`,
            "mentor",
            "JULIE",
            ["ALL"],
            false,
            true
          );
        }

        if (driveConnected && sessionId && sessionKey) {
          syncSideNoteToDrive({
            sessionId,
            sessionKey,
            noteText: note.text,
            noteTags: allNoteTags,
            noteMentors: note.mentors,
          }).catch(() => {});
        }
      }
    }

    setShowSideNoteModal(false);
  }

  async function handleFileUploaded(file: File, summary?: string, tags?: string[]) {
    if (!sessionId) return;

    try {
      const uploaded = await uploadFileToVault({
        session_id: sessionId,
        project_id: null,
        file,
        summary: summary ?? null,
        tags: tags ?? [],
      });

      if (uploaded) {
        setSessionFiles((prev) => [uploaded, ...prev]);
        trackFileDiscussed(uploaded);

        if (driveConnected) {
          syncFileToDrive({
            fileId: uploaded.id,
            fileName: uploaded.name,
            fileType: uploaded.file_type,
            linkedSessionId: uploaded.linked_session_id,
          }).catch(() => {});
        }
      }
    } catch {
      addMessage("JULIE: File upload failed. Try again.", "mentor", "JULIE", ["ALL"], false, true);
    }
  }

  async function handleDropUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    await handleFileUploaded(file);
  }

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
          className={[
            "flex flex-col rounded-lg transition-all duration-200 hover:opacity-90 active:scale-95 flex-shrink-0",
            mentor.status === "working" ? "animate-pulse" : "",
          ].join(" ")}
          style={{
            backgroundColor: "#0F1F36",
            border: isSelected
              ? "1px solid #8A9BB5"
              : mentor.status === "working"
              ? "1px solid #3A4F6A"
              : "1px solid #1B2A4A",
            boxShadow: isSelected ? "0 0 10px 2px rgba(138,155,181,0.15)" : "none",
            width: "130px",
            minHeight: "72px",
            padding: "10px 12px",
          }}
          title="JULIE — Facilitator"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold tracking-widest" style={{ color: "#8A9BB5" }}>
              JULIE
            </span>
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: mentor.status === "working" ? "#60AEFF" : "#1B2A4A" }}
            />
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
        className={[
          "flex flex-col rounded-lg transition-all duration-200 hover:opacity-90 active:scale-95 flex-shrink-0",
          mentor.status === "working" ? "animate-pulse" : "",
        ].join(" ")}
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
          <span className="text-xs font-bold tracking-widest" style={{ color: isSelected ? deptColor : "#FFFFFF" }}>
            {mentor.name}
          </span>
          <div className="flex items-center gap-1.5">
            {participation > 0 && (
              <span className="text-[10px] font-bold" style={{ color: "#4A6080" }}>
                {participation}
              </span>
            )}
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_DOT[mentor.status] }} />
          </div>
        </div>
        <span
          className="text-[10px] tracking-wider uppercase font-semibold block"
          style={{ color: isSelected ? `${deptColor}BB` : "#4A5E78" }}
        >
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

  const visibleMentors = currentDept
    ? mentors.filter((m) => (MENTOR_META[m.name]?.department ?? "FACILITATION") === currentDept)
    : mentors;

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden" style={{ backgroundColor: "#0D1B2E", color: "#FFFFFF", fontFamily: "'Inter', sans-serif" }}>
      {showSideNoteModal && (
        <SideNoteModal usedTags={usedTags} onSave={handleSaveNote} onClose={() => setShowSideNoteModal(false)} />
      )}

      {showFileUpload && (
        <FileUploadModal
          open={showFileUpload}
          onClose={() => setShowFileUpload(false)}
          onUpload={async (file: File, summary?: string, tags?: string[]) => {
            await handleFileUploaded(file, summary, tags);
            setShowFileUpload(false);
          }}
        />
      )}

      {previewFile && (
        <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
      )}

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-2.5 border-b flex-shrink-0" style={{ borderColor: "#1B2A4A" }}>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold tracking-widest uppercase" style={{ color: "#C9A84C" }}>
              Staff Meeting Room
            </span>
            <span
              className="text-[10px] tracking-widest uppercase px-2 py-0.5 rounded"
              style={{ backgroundColor: "rgba(138,155,181,0.1)", color: "#8A9BB5" }}
            >
              JULIE facilitating
            </span>
            {syncStatus && (
              <span className="text-[10px] px-2 py-0.5 rounded" style={{ backgroundColor: "rgba(201,168,76,0.14)", color: "#C9A84C" }}>
                {syncStatus}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              className="px-3 py-2 rounded text-sm font-medium"
              style={{
                backgroundColor: mode === "brainstorm" ? "#C9A84C" : "#13233C",
                color: mode === "brainstorm" ? "#0D1B2E" : "#FFFFFF",
                border: "1px solid #1B2A4A",
              }}
              onClick={() => setMode("brainstorm")}
            >
              Brainstorm
            </button>
            <button
              className="px-3 py-2 rounded text-sm font-medium"
              style={{
                backgroundColor: mode === "command" ? "#C9A84C" : "#13233C",
                color: mode === "command" ? "#0D1B2E" : "#FFFFFF",
                border: "1px solid #1B2A4A",
              }}
              onClick={() => setMode("command")}
            >
              Command
            </button>
            <button
              className="px-3 py-2 rounded text-sm font-medium"
              style={{ backgroundColor: "#13233C", color: "#FFFFFF", border: "1px solid #1B2A4A" }}
              onClick={() => setShowSideNoteModal(true)}
            >
              Side Note
            </button>
            <button
              className="px-3 py-2 rounded text-sm font-medium"
              style={{ backgroundColor: "#13233C", color: "#FFFFFF", border: "1px solid #1B2A4A" }}
              onClick={() => setShowFileUpload(true)}
            >
              Upload File
            </button>
            <button
              className="px-3 py-2 rounded text-sm font-medium"
              style={{ backgroundColor: "#13233C", color: "#FFFFFF", border: "1px solid #1B2A4A" }}
              onClick={() => setShowMemoryPanel((prev) => !prev)}
            >
              {showMemoryPanel ? "Hide Memory" : "Show Memory"}
            </button>
            <button
              className="px-3 py-2 rounded text-sm font-medium"
              style={{ backgroundColor: "#13233C", color: "#FFFFFF", border: "1px solid #1B2A4A" }}
              onClick={handleEndSession}
              disabled={syncingSession}
            >
              {syncingSession ? "Ending..." : "End Session"}
            </button>
          </div>
        </div>

        <div className="px-5 py-3 border-b flex-shrink-0" style={{ borderColor: "#1B2A4A" }}>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {activeDepts.map((dept) => {
              const active = dept === currentDept;
              return (
                <button
                  key={dept}
                  onClick={() => setActiveDeptTab(dept)}
                  className="px-3 py-2 rounded text-xs font-semibold whitespace-nowrap"
                  style={{
                    backgroundColor: active ? DEPARTMENT_COLORS[dept] : "#13233C",
                    color: active ? "#0D1B2E" : "#FFFFFF",
                    border: "1px solid #1B2A4A",
                  }}
                >
                  {dept}
                </button>
              );
            })}
          </div>

          <div className="flex gap-3 overflow-x-auto pt-2">
            {visibleMentors.map(renderMentorCard)}
          </div>
        </div>

        <div className="flex-1 min-h-0 flex overflow-hidden">
          <div className="flex-1 flex flex-col min-h-0">
            <div
              className="mx-5 mt-4 mb-3 rounded-lg border border-dashed flex items-center justify-center text-sm flex-shrink-0"
              style={{
                borderColor: isDragOver ? "#C9A84C" : "#2A4060",
                backgroundColor: isDragOver ? "rgba(201,168,76,0.08)" : "rgba(19,35,60,0.55)",
                color: "#9DB1C5",
                minHeight: "72px",
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={async (e) => {
                e.preventDefault();
                setIsDragOver(false);
                await handleDropUpload(e.dataTransfer.files);
              }}
            >
              Drag file here or use Upload File
            </div>

            <div
              ref={transcriptRef}
              className="flex-1 min-h-0 mx-5 mb-4 rounded-lg overflow-y-auto border"
              style={{ borderColor: "#1B2A4A", backgroundColor: "#101E33", padding: "16px" }}
            >
              {messages.length === 0 ? (
                <div style={{ color: "#6B819C" }}>Start the conversation.</div>
              ) : (
                <div className="flex flex-col gap-3">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className="rounded-lg px-3 py-2"
                      style={{
                        backgroundColor:
                          message.speaker === "you"
                            ? "#183354"
                            : message.isJulie
                            ? "#1B2A4A"
                            : "#142640",
                        border: message.isThinking
                          ? "1px dashed #3A4F6A"
                          : message.isJulie
                          ? "1px solid #304563"
                          : "1px solid #223654",
                        opacity: message.isThinking ? 0.7 : 1,
                      }}
                    >
                      <div
                        className="text-[10px] font-bold tracking-widest uppercase mb-1"
                        style={{ color: message.speaker === "you" ? "#C9A84C" : "#8AB0C8" }}
                      >
                        {message.speaker === "you" ? "YOU" : message.sender ?? "TEAM"}
                      </div>
                      <div className="text-sm whitespace-pre-wrap">{message.text}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mx-5 mb-5 flex flex-col gap-3 flex-shrink-0">
              {selectedMentors.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedMentors.map((name) => (
                    <button
                      key={name}
                      onClick={() => setSelectedMentors((prev) => prev.filter((n) => n !== name))}
                      className="px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={{
                        backgroundColor: "rgba(201,168,76,0.18)",
                        color: "#C9A84C",
                        border: "1px solid rgba(201,168,76,0.35)",
                      }}
                    >
                      @{name}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex gap-3">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type message..."
                  className="flex-1 rounded-lg px-4 py-3 outline-none"
                  style={{
                    backgroundColor: "#13233C",
                    border: "1px solid #1B2A4A",
                    color: "#FFFFFF",
                  }}
                />
                <button
                  onClick={handleSend}
                  className="px-5 py-3 rounded-lg font-semibold"
                  style={{ backgroundColor: "#C9A84C", color: "#0D1B2E" }}
                >
                  Send
                </button>
              </div>
            </div>
          </div>

          {showMemoryPanel && (
            <div
              className="w-[360px] min-w-[360px] border-l overflow-y-auto"
              style={{ borderColor: "#1B2A4A", backgroundColor: "#101B2C" }}
            >
              <div className="p-4 border-b" style={{ borderColor: "#1B2A4A" }}>
                <div className="text-sm font-semibold tracking-widest uppercase" style={{ color: "#C9A84C" }}>
                  Julie Memory
                </div>
              </div>

              <div className="p-4 space-y-5">
                <MemorySection title="Open Questions" items={meetingState.openQuestions} />
                <MemorySection
                  title="Tasks"
                  items={meetingState.assignedTasks.map((t) => `${t.owner}: ${t.task}`)}
                />
                <MemorySection title="Decisions" items={meetingState.decisionsMade} />
                <MemorySection title="Topics" items={meetingState.activeTopics} />
                <MemorySection
                  title="Files"
                  items={meetingState.memoryFiles.map((f) => f.name)}
                  onItemClick={(name) => {
                    const found = sessionFiles.find((f) => f.name === name);
                    if (found) setPreviewFile(found);
                  }}
                />
                <MemorySection title="Notes" items={meetingState.memoryNotes.map((n) => n.text)} />
                <MemorySection
                  title="Carryover"
                  items={meetingState.carryoverItems.filter((i) => !i.resolved).map((i) => i.text)}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MemorySection({
  title,
  items,
  onItemClick,
}: {
  title: string;
  items: string[];
  onItemClick?: (item: string) => void;
}) {
  return (
    <div>
      <div className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: "#8AB0C8" }}>
        {title}
      </div>
      {items.length === 0 ? (
        <div className="text-sm" style={{ color: "#5F7894" }}>
          None
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item, idx) => (
            <button
              key={`${title}-${idx}`}
              onClick={() => onItemClick?.(item)}
              className="text-left rounded px-3 py-2 text-sm"
              style={{
                backgroundColor: "#142640",
                border: "1px solid #223654",
                color: "#D7E4F0",
                cursor: onItemClick ? "pointer" : "default",
              }}
            >
              {item}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
