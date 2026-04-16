import { useState, useRef, useEffect } from "react";
import { Send, Save, Users, RefreshCw, StickyNote } from "lucide-react";
import { supabase } from "../lib/supabase";
import { saveMeetingToDrive } from "../lib/integrations";
import SideNoteModal, { SideNote } from "./SideNoteModal";

const GOLD = "#C9A84C";
const NAVY = "#0D1B2E";
const CARD = "#0A1628";
const BORDER = "#1B2A4A";
const MUTED = "#8A9BB5";
const DIM = "#3A4F6A";
const TEXT = "#D0DFEE";
const STEEL = "#8BA4C2";

const TEAM_MEMBERS = [
  "Tech-9", "Jack", "Max", "Doc", "Flatfoot",
  "Prez", "Sam", "Attack Lawyer", "Defense Lawyer", "Jamison",
  "Jerry", "Watcher", "Karen", "Mailman", "Scout",
  "CIPHER", "That Guy",
];

interface Message {
  id: string;
  speaker: string;
  text: string;
  timestamp: Date;
  isJulie?: boolean;
  isFounder?: boolean;
  isSystem?: boolean;
}

function MessageBubble({ msg }: { msg: Message }) {
  if (msg.isSystem) {
    return (
      <div className="flex justify-center py-1">
        <span className="text-xs px-3 py-1 rounded-full" style={{ color: DIM, backgroundColor: "rgba(255,255,255,0.02)" }}>
          {msg.text}
        </span>
      </div>
    );
  }

  const bubbleBg = msg.isFounder
    ? "rgba(201,168,76,0.12)"
    : msg.isJulie
    ? "rgba(201,168,76,0.07)"
    : "rgba(139,164,194,0.12)";

  const bubbleBorder = msg.isFounder
    ? "1px solid rgba(201,168,76,0.3)"
    : msg.isJulie
    ? "1px solid rgba(201,168,76,0.2)"
    : "1px solid rgba(139,164,194,0.25)";

  const nameColor = msg.isFounder ? GOLD : msg.isJulie ? GOLD : STEEL;

  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold"
        style={{
          backgroundColor: msg.isFounder ? "rgba(201,168,76,0.15)" : "rgba(139,164,194,0.1)",
          color: msg.isFounder ? GOLD : STEEL,
          border: msg.isFounder ? "1px solid rgba(201,168,76,0.3)" : "1px solid rgba(139,164,194,0.25)",
        }}>
        {msg.speaker.slice(0, 2).toUpperCase()}
      </div>
      <div className="flex flex-col max-w-[80%] items-start">
        <span className="text-[10px] font-bold tracking-widest uppercase mb-1.5" style={{ color: nameColor }}>
          {msg.speaker}
        </span>
        <div className="px-5 py-4 rounded-2xl rounded-tl-sm text-base leading-relaxed"
          style={{ backgroundColor: bubbleBg, color: TEXT, border: bubbleBorder }}>
          {msg.text}
        </div>
        <span className="text-[10px] mt-1.5" style={{ color: DIM }}>
          {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
  );
}

export default function StaffMeetingRoom() {
  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome", speaker: "Julie", text: "Room is open. What are we working on?", timestamp: new Date(), isJulie: true },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [showCallPanel, setShowCallPanel] = useState(false);
  const [callingMember, setCallingMember] = useState<string | null>(null);
  const [showSideNote, setShowSideNote] = useState(false);
  const [sideNotes, setSideNotes] = useState<SideNote[]>([]);
  const [usedTags, setUsedTags] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  function addMessage(msg: Omit<Message, "id" | "timestamp">) {
    setMessages((prev) => [...prev, { ...msg, id: crypto.randomUUID(), timestamp: new Date() }]);
  }

  async function callMentor(mentor: string, message: string) {
    const recentTranscript = messages.filter((m) => !m.isSystem).slice(-8).map((m) => ({ speaker: m.speaker, text: m.text }));
    const { data, error } = await supabase.functions.invoke("mentor-response", {
      body: { mentor, message, mode: "meeting", recentTranscript, isInterrupt: false, isOpenFloor: false, humorDial: 2, humorStyle: "dry" },
    });
    if (error || !data?.response) return null;
    return data.response as string;
  }

  async function routeWithJulie(message: string): Promise<string[]> {
    const recentTranscript = messages.filter((m) => !m.isSystem).slice(-8).map((m) => ({ speaker: m.speaker, text: m.text }));
    const lastSpeaker = messages.filter((m) => !m.isFounder && !m.isSystem).slice(-1)[0]?.speaker ?? "";
    const routingMessage = `USER MESSAGE: ${message}\n\nLAST_SPEAKER: ${lastSpeaker}\n\nReturn only valid JSON: {"mentors":["NAME"],"line":"optional","action":"route"}`;
    const { data, error } = await supabase.functions.invoke("mentor-response", {
      body: {
        mentor: "JULIE", message: routingMessage, mode: "route", recentTranscript,
        isInterrupt: false, isOpenFloor: false, humorDial: 1,
        meetingState: { openQuestions: [], answeredQuestions: [], assignedTasks: [], unresolvedTopics: [], activeTopics: [], decisionsMade: [], pendingDecisions: [], mentorParticipation: {}, droppedIdeas: [] },
      },
    });
    if (error || !data?.response) return ["Sam"];
    try {
      const clean = (data.response as string).replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      if (parsed.line) addMessage({ speaker: "Julie", text: parsed.line, isJulie: true });
      if (parsed.action === "acknowledge") return [];
      if (Array.isArray(parsed.mentors) && parsed.mentors.length > 0) return parsed.mentors;
    } catch { }
    return ["Sam"];
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);
    addMessage({ speaker: "Founder", text, isFounder: true });
    try {
      const mentors = await routeWithJulie(text);
      for (const mentor of mentors.slice(0, 2)) {
        const response = await callMentor(mentor, text);
        if (response) addMessage({ speaker: mentor, text: response });
      }
    } catch {
      addMessage({ speaker: "Julie", text: "Lost the connection for a moment. Try again.", isJulie: true });
    } finally {
      setSending(false);
    }
  }

  async function handleCal
