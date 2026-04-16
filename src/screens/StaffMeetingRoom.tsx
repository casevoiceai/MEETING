import { useState, useRef, useEffect } from "react";
import { Send, Save, Users, RefreshCw, StickyNote } from "lucide-react";
import { supabase } from "../lib/supabase";
import { saveMeetingToDrive } from "../lib/integrations";
import SideNotesPanel, { SideNote, loadOpenNoteIds, saveOpenNoteIds } from "./SideNoteModal";
import { listPendingQueueItems, BoysQueueItem } from "../lib/boysQueue";

const GOLD = "#C9A84C";
const NAVY = "#0D1B2E";
const CARD = "#0A1628";
const BORDER = "#1B2A4A";
const MUTED = "#8A9BB5";
const DIM = "#3A4F6A";
const TEXT = "#D0DFEE";

const TEAM_MEMBERS_BY_DEPT = [
  {
    dept: "BUILD",
    members: [
      { name: "Tech-9", role: "Build strategist. Writes build briefs. Owns what gets built and when." },
    ],
  },
  {
    dept: "DESIGN",
    members: [
      { name: "Jack", role: "Brand and UI designer. Flags visual drift before it ships." },
    ],
  },
  {
    dept: "RESEARCH",
    members: [
      { name: "Scout", role: "Market intelligence. Competitor signals, funding leads, white space." },
      { name: "Jerry", role: "Research and evidence. Challenges unsupported assumptions." },
    ],
  },
  {
    dept: "SAFETY",
    members: [
      { name: "Doc", role: "User safety and harm prevention. Names who gets hurt and how." },
      { name: "Max", role: "Accessibility. Finds barriers before real users do." },
      { name: "CIPHER", role: "Data privacy and trust. Flags consent gaps and exposure risks." },
    ],
  },
  {
    dept: "LEGAL",
    members: [
      { name: "Attack Lawyer", role: "Legal offense. IP protection, contract leverage, assertive moves." },
      { name: "Defense Lawyer", role: "Legal defense. Liability, compliance, regulatory exposure." },
    ],
  },
  {
    dept: "SALES & OPS",
    members: [
      { name: "Prez", role: "Sales strategy. Makes Daniel the most prepared person in the room." },
      { name: "Sam", role: "Execution and process. Owns tasks, timelines, and follow-through." },
      { name: "Karen", role: "Admin and logistics. Tracks action items and flags what is unowned." },
    ],
  },
  {
    dept: "COMMS",
    members: [
      { name: "Jamison", role: "Copy and messaging. Rewrites what is not landing." },
      { name: "Mailman", role: "Outbound email and delivery. Subject lines that get opened." },
    ],
  },
  {
    dept: "CREDIBILITY",
    members: [
      { name: "Flatfoot", role: "Law enforcement credibility. Flags what would kill a PD pitch." },
    ],
  },
  {
    dept: "OBSERVATION",
    members: [
      { name: "Watcher", role: "Silent observer. Speaks rarely. When it does, it matters." },
      { name: "That Guy", role: "Wild card. Asks the question nobody else will." },
    ],
  },
];

const MEMBER_COLORS: Record<string, { bubble: string; border: string; name: string; avatar: string }> = {
  Julie:           { bubble: "#1C2A1A", border: "#C9A84C", name: "#C9A84C", avatar: "#2A3D1A" },
  "Tech-9":        { bubble: "#0F1E35", border: "#60A5FA", name: "#60A5FA", avatar: "#152540" },
  Jack:            { bubble: "#1A1535", border: "#A78BFA", name: "#A78BFA", avatar: "#221A40" },
  Max:             { bubble: "#0F2820", border: "#34D399", name: "#34D399", avatar: "#133322" },
  Doc:             { bubble: "#2A1A0F", border: "#FB923C", name: "#FB923C", avatar: "#332210" },
  Flatfoot:        { bubble: "#131C2A", border: "#8BA4C2", name: "#8BA4C2", avatar: "#162030" },
  Prez:            { bubble: "#1C1A10", border: "#C9A84C", name: "#C9A84C", avatar: "#252215" },
  Sam:             { bubble: "#0F1E35", border: "#60A5FA", name: "#93C5FD", avatar: "#152540" },
  "Attack Lawyer": { bubble: "#2A0F0F", border: "#F87171", name: "#F87171", avatar: "#381212" },
  "Defense Lawyer":{ bubble: "#201010", border: "#FCA5A5", name: "#FCA5A5", avatar: "#2A1515" },
  Jamison:         { bubble: "#1A1535", border: "#A78BFA", name: "#C4B5FD", avatar: "#221A40" },
  Jerry:           { bubble: "#0F2820", border: "#34D399", name: "#6EE7B7", avatar: "#133322" },
  Watcher:         { bubble: "#0D1520", border: "#8BA4C2", name: "#93C5FD", avatar: "#111C28" },
  Karen:           { bubble: "#2A1A0F", border: "#FB923C", name: "#FDB877", avatar: "#332210" },
  Mailman:         { bubble: "#1A160A", border: "#C9A84C", name: "#E6C76A", avatar: "#221C0E" },
  Scout:           { bubble: "#0F2820", border: "#34D399", name: "#34D399", avatar: "#133322" },
  CIPHER:          { bubble: "#0D1830", border: "#60A5FA", name: "#60A5FA", avatar: "#112038" },
  "That Guy":      { bubble: "#1E1530", border: "#A78BFA", name: "#A78BFA", avatar: "#271A3A" },
  Founder:         { bubble: "#1C1A08", border: "#C9A84C", name: "#C9A84C", avatar: "#252210" },
};

function getColors(speaker: string, isFounder?: boolean) {
  if (isFounder) return MEMBER_COLORS["Founder"];
  return MEMBER_COLORS[speaker] ?? { bubble: "#131C2A", border: "#8BA4C2", name: "#8BA4C2", avatar: "#162030" };
}

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
        <span
          className="text-lg px-4 py-1.5 rounded-full"
          style={{ color: DIM, backgroundColor: "rgba(255,255,255,0.02)" }}
        >
          {msg.text}
        </span>
      </div>
    );
  }
  const colors = getColors(msg.speaker, msg.isFounder);
  return (
    <div className="flex gap-4">
      <div
        className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold"
        style={{
          backgroundColor: colors.avatar,
          color: colors.name,
          border: `2px solid ${colors.border}`,
        }}
      >
        {msg.speaker.slice(0, 2).toUpperCase()}
      </div>
      <div className="flex flex-col max-w-[80%] items-start">
        <span
          className="text-xl font-bold tracking-wider uppercase mb-2"
          style={{ color: colors.name }}
        >
          {msg.speaker}
        </span>
        <div
          className="px-6 py-4 rounded-2xl rounded-tl-sm text-xl leading-relaxed"
          style={{
            backgroundColor: colors.bubble,
            color: TEXT,
            border: `1px solid ${colors.border}`,
          }}
        >
          {msg.text}
        </div>
        <span className="text-base mt-1.5" style={{ color: DIM }}>
          {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
  );
}

function buildJulieBriefing(items: BoysQueueItem[]): string {
  const now = Date.now();
  const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;

  if (items.length === 0) {
    return "Room is open. Queue is clear. What are we working on?";
  }

  // Oldest first
  const sorted = [...items].reverse();

  const stale = sorted.filter(
    (item) => now - new Date(item.created_at).getTime() > FORTY_EIGHT_HOURS
  );

  const lines: string[] = [];

  lines.push(
    `Room is open. ${items.length} pending item${items.length !== 1 ? "s" : ""} in the queue.`
  );

  const listStr = sorted
    .map((item) => `${item.boy_name} (${item.item_type})`)
    .join(", ");
  lines.push(`Oldest first: ${listStr}.`);

  if (stale.length > 0) {
    const staleNames = stale.map((item) => item.boy_name).join(", ");
    lines.push(
      `\u26A0 ${stale.length} item${stale.length !== 1 ? "s" : ""} past 48 hours: ${staleNames}.`
    );
  }

  const next = sorted[0];
  lines.push(`Start with ${next.boy_name} -- oldest item is still unresolved.`);

  return lines.join(" ");
}

export default function StaffMeetingRoom() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [showCallPanel, setShowCallPanel] = useState(false);
  const [callingMember, setCallingMember] = useState<string | null>(null);
  const [usedTags, setUsedTags] = useState<string[]>([]);
  const [noteContents, setNoteContents] = useState<Record<string, boolean>>({});

  // Persistent open notes -- restored from localStorage on mount
  const [openNoteIds, setOpenNoteIds] = useState<string[]>(() => loadOpenNoteIds());

  // Persist open note IDs whenever they change
  useEffect(() => {
    saveOpenNoteIds(openNoteIds);
  }, [openNoteIds]);

  // NS4: Julie opens the session with a queue briefing
  useEffect(() => {
    async function openSession() {
      let briefing = "Room is open. What are we working on?";
      try {
        const items = await listPendingQueueItems();
        briefing = buildJulieBriefing(items);
      } catch {
        briefing = "Room is open. Could not reach the queue right now. What are we working on?";
      }
      setMessages([
        {
          id: "welcome",
          speaker: "Julie",
          text: briefing,
          timestamp: new Date(),
          isJulie: true,
        },
      ]);
    }
    openSession();
  }, []);

  const anyNoteHasContent = Object.values(noteContents).some(Boolean);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function addMessage(msg: Omit<Message, "id" | "timestamp">) {
    setMessages((prev) => [
      ...prev,
      { ...msg, id: crypto.randomUUID(), timestamp: new Date() },
    ]);
  }

  function handleNewNote() {
    const id = crypto.randomUUID();
    setOpenNoteIds((prev) => [...prev, id]);
  }

  function handleNoteClose(id: string) {
    setOpenNoteIds((prev) => prev.filter((nid) => nid !== id));
    setNoteContents((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function handleNoteContentChange(id: string, hasContent: boolean) {
    setNoteContents((prev) => ({ ...prev, [id]: hasContent }));
  }

  async function callMentor(mentor: string, message: string) {
    const recentTranscript = messages
      .filter((m) => !m.isSystem)
      .slice(-8)
      .map((m) => ({ speaker: m.speaker, text: m.text }));
    const { data, error } = await supabase.functions.invoke("mentor-response", {
      body: {
        mentor,
        message,
        mode: "meeting",
        recentTranscript,
        isInterrupt: false,
        isOpenFloor: false,
        humorDial: 2,
        humorStyle: "dry",
      },
    });
    if (error || !data?.response) return null;
    return data.response as string;
  }

  async function routeWithJulie(message: string): Promise<string[]> {
    const recentTranscript = messages
      .filter((m) => !m.isSystem)
      .slice(-8)
      .map((m) => ({ speaker: m.speaker, text: m.text }));
    const lastSpeaker =
      messages.filter((m) => !m.isFounder && !m.isSystem).slice(-1)[0]?.speaker ?? "";
    const routingMessage = `USER MESSAGE: ${message}\n\nLAST_SPEAKER: ${lastSpeaker}\n\nReturn only valid JSON: {"mentors":["NAME"],"line":"optional","action":"route"}`;
    const { data, error } = await supabase.functions.invoke("mentor-response", {
      body: {
        mentor: "JULIE",
        message: routingMessage,
        mode: "route",
        recentTranscript,
        isInterrupt: false,
        isOpenFloor: false,
        humorDial: 1,
        meetingState: {
          openQuestions: [],
          answeredQuestions: [],
          assignedTasks: [],
          unresolvedTopics: [],
          activeTopics: [],
          decisionsMade: [],
          pendingDecisions: [],
          mentorParticipation: {},
          droppedIdeas: [],
        },
      },
    });
    if (error || !data?.response) return ["Sam"];
    try {
      const clean = (data.response as string).replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      if (parsed.line) addMessage({ speaker: "Julie", text: parsed.line, isJulie: true });
      if (parsed.action === "acknowledge") return [];
      if (Array.isArray(parsed.mentors) && parsed.mentors.length > 0) return parsed.mentors;
    } catch {}
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
      addMessage({
        speaker: "Julie",
        text: "Lost the connection for a moment. Try again.",
        isJulie: true,
      });
    } finally {
      setSending(false);
    }
  }

  async function handleCallMember(member: string) {
    if (callingMember) return;
    setCallingMember(member);
    setShowCallPanel(false);
    addMessage({ speaker: "Julie", text: `Bringing in ${member}.`, isJulie: true });
    const lastMessage =
      messages.filter((m) => m.isFounder).slice(-1)[0]?.text ?? "Check in with the team.";
    try {
      const response = await callMentor(member, lastMessage);
      if (response) addMessage({ speaker: member, text: response });
    } catch {
      addMessage({
        speaker: "Julie",
        text: `Could not reach ${member} right now.`,
        isJulie: true,
      });
    } finally {
      setCallingMember(null);
    }
  }

  async function handleSaveSession() {
    setSaving(true);
    setSaveStatus(null);
    try {
      const result = await saveMeetingToDrive();
      setSaveStatus(
        result?.success
          ? "Session saved to Google Drive."
          : "Save failed. Check Google Drive connection."
      );
    } catch {
      setSaveStatus("Save failed.");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveStatus(null), 4000);
    }
  }

  return (
    <div className="flex flex-col h-full relative" style={{ backgroundColor: "#08111F" }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-4 border-b flex-shrink-0"
        style={{ borderColor: BORDER }}
      >
        <span className="text-sm font-bold tracking-widest uppercase" style={{ color: GOLD }}>
          Staff Meeting Room
        </span>
        <div className="ml-auto flex items-center gap-3">
          {saveStatus && (
            <span
              className="text-sm font-semibold"
              style={{ color: saveStatus.includes("failed") ? "#F87171" : "#4ADE80" }}
            >
              {saveStatus}
            </span>
          )}
          <button
            onClick={() => setShowCallPanel((v) => !v)}
            disabled={callingMember !== null}
            className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold tracking-wider uppercase transition-all hover:opacity-90 disabled:opacity-40"
            style={{
              backgroundColor: showCallPanel
                ? "rgba(201,168,76,0.18)"
                : "rgba(201,168,76,0.08)",
              color: GOLD,
              border: `1px solid ${showCallPanel ? "rgba(201,168,76,0.6)" : "rgba(201,168,76,0.25)"}`,
            }}
          >
            {callingMember ? (
              <>
                <RefreshCw size={14} className="animate-spin" /> {callingMember}...
              </>
            ) : (
              <>
                <Users size={14} /> Call Team
              </>
            )}
          </button>
          <button
            onClick={handleSaveSession}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold tracking-wider uppercase transition-all hover:opacity-90 disabled:opacity-40"
            style={{ backgroundColor: CARD, color: MUTED, border: `1px solid ${BORDER}` }}
          >
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? "Saving..." : "Save Session"}
          </button>
        </div>
      </div>

      {/* Call Team Panel -- floats over chat */}
      {showCallPanel && (
        <div
          style={{
            position: "absolute",
            top: 61,
            left: 0,
            right: 0,
            zIndex: 50,
            backgroundColor: "#0A1628",
            borderBottom: `1px solid ${BORDER}`,
            maxHeight: "70vh",
            overflowY: "auto",
          }}
        >
          <div className="px-5 py-4">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              {TEAM_MEMBERS_BY_DEPT.map((group) => (
                <div key={group.dept}>
                  <p
                    className="text-xs font-bold tracking-widest uppercase mb-2"
                    style={{ color: MUTED }}
                  >
                    {group.dept}
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {group.members.map((m) => {
                      const c = getColors(m.name);
                      return (
                        <button
                          key={m.name}
                          onClick={() => handleCallMember(m.name)}
                          className="flex items-baseline gap-3 px-4 py-3 rounded-xl text-left transition-all hover:opacity-90 w-full"
                          style={{
                            backgroundColor: c.bubble,
                            border: `1px solid ${c.border}`,
                          }}
                        >
                          <span
                            className="text-sm font-bold flex-shrink-0 w-28"
                            style={{ color: c.name }}
                          >
                            {m.name}
                          </span>
                          <span
                            className="text-sm leading-snug"
                            style={{ color: TEXT }}
                          >
                            {m.role}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Chat */}
      <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col gap-6">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        {sending && (
          <div className="flex gap-4">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "#1C2A1A", border: "2px solid #C9A84C" }}
            >
              <RefreshCw size={14} className="animate-spin" style={{ color: GOLD }} />
            </div>
            <div
              className="px-6 py-4 rounded-2xl rounded-tl-sm text-xl"
              style={{ backgroundColor: "#1C2A1A", color: DIM, border: "1px solid #C9A84C" }}
            >
              ...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input Bar */}
      <div className="px-5 py-4 border-t flex-shrink-0" style={{ borderColor: BORDER }}>
        <div className="flex gap-3 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
            rows={3}
            className="flex-1 px-5 py-3 rounded-xl text-xl outline-none resize-none"
            style={{
              backgroundColor: CARD,
              color: TEXT,
              border: `1px solid ${BORDER}`,
              lineHeight: "1.6",
            }}
          />
          <button
            onClick={handleNewNote}
            className="flex-shrink-0 w-16 h-16 rounded-xl flex items-center justify-center transition-all hover:opacity-90"
            style={{
              backgroundColor: anyNoteHasContent ? "#2A3D1A" : "rgba(201,168,76,0.08)",
              border: anyNoteHasContent
                ? "2px solid #C9A84C"
                : "1px solid rgba(201,168,76,0.25)",
            }}
            title="New Side Note"
          >
            <StickyNote size={26} style={{ color: GOLD }} />
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            className="flex-shrink-0 w-16 h-16 rounded-xl flex items-center justify-center transition-all hover:opacity-90 disabled:opacity-30"
            style={{ backgroundColor: GOLD }}
          >
            <Send size={26} style={{ color: NAVY }} />
          </button>
        </div>
        <p className="text-xs mt-2" style={{ color: DIM }}>
          Julie routes your message to the right Team Member.
        </p>
      </div>

      {/* Side Notes -- all open notes rendered via SideNotesPanel */}
      <SideNotesPanel
        noteIds={openNoteIds}
        usedTags={usedTags}
        onNoteClose={handleNoteClose}
        onSave={(note, newTags) => {
          setUsedTags((prev) => [...prev, ...newTags]);
        }}
        onContentChange={handleNoteContentChange}
      />
    </div>
  );
}
