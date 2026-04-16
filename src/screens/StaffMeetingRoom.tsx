import { useState, useRef, useEffect } from "react";
import { Send, Save, Users, RefreshCw } from "lucide-react";
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
        <span className="text-[10px] px-3 py-1 rounded-full" style={{ color: DIM, backgroundColor: "rgba(255,255,255,0.02)" }}>
          {msg.text}
        </span>
      </div>
    );
  }
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
        style={{
          backgroundColor: msg.isFounder ? "rgba(201,168,76,0.15)" : "rgba(255,255,255,0.05)",
          color: msg.isFounder ? GOLD : MUTED,
          border: msg.isFounder ? "1px solid rgba(201,168,76,0.3)" : `1px solid ${BORDER}`,
        }}>
        {msg.speaker.slice(0, 2).toUpperCase()}
      </div>
      <div className="flex flex-col max-w-[80%] items-start">
        <span className="text-[9px] font-bold tracking-widest uppercase mb-1" style={{ color: msg.isJulie ? GOLD : MUTED }}>
          {msg.speaker}
        </span>
        <div className="px-4 py-3 rounded-2xl rounded-bl-sm text-sm leading-relaxed"
          style={{ backgroundColor: CARD, color: TEXT, border: `1px solid ${BORDER}` }}>
          {msg.text}
        </div>
        <span className="text-[9px] mt-1" style={{ color: DIM }}>
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
    if (error || !data?.response) retur
