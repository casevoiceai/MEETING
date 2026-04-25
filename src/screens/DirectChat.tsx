import { useState, useRef, useEffect } from "react";
import { Send, ArrowLeft, RefreshCw } from "lucide-react";
import { supabase } from "../lib/supabase";

const GOLD = "#C9A84C";
const NAVY = "#0D1B2E";
const CARD = "#0A1628";
const BORDER = "#1B2A4A";
const MUTED = "#8A9BB5";
const DIM = "#3A4F6A";
const TEXT = "#D0DFEE";

const MEMBER_TO_EDGE: Record<string, string> = {
  "Prez": "MARK",
  "Scout": "SCOUT",
  "Sam": "SAM",
  "Jamison": "JAMISON",
  "Mailman": "MAILMAN",
  "Jerry": "JERRY",
  "Max": "RAY",
  "Attack Lawyer": "ATK",
  "Defense Lawyer": "DEF",
  "Watcher": "WATCHER",
  "Karen": "KAREN",
  "That Guy": "THATGUY",
  "Doc": "DOC",
  "Tech": "TECHGUY",
  "CIPHER": "CIPHER",
  "Flatfoot": "RICK",
  "Jack": "ALEX",
  "Julie": "JULIE",
};

const MEMBER_COLORS: Record<string, { bubble: string; border: string; name: string; avatar: string }> = {
  Founder:          { bubble: "#1C1A08", border: "#C9A84C", name: "#C9A84C", avatar: "#252210" },
  "Tech":           { bubble: "#0F1E35", border: "#60A5FA", name: "#60A5FA", avatar: "#152540" },
  Jack:             { bubble: "#1A1535", border: "#A78BFA", name: "#A78BFA", avatar: "#221A40" },
  Scout:            { bubble: "#0F2820", border: "#34D399", name: "#34D399", avatar: "#133322" },
  Jerry:            { bubble: "#0F2820", border: "#34D399", name: "#6EE7B7", avatar: "#133322" },
  Doc:              { bubble: "#2A1A0F", border: "#FB923C", name: "#FB923C", avatar: "#332210" },
  Max:              { bubble: "#2A1A0F", border: "#FB923C", name: "#FDB877", avatar: "#332210" },
  CIPHER:           { bubble: "#2A1A0F", border: "#FB923C", name: "#FD9A50", avatar: "#332210" },
  "Attack Lawyer":  { bubble: "#2A0F0F", border: "#F87171", name: "#F87171", avatar: "#381212" },
  "Defense Lawyer": { bubble: "#201010", border: "#FCA5A5", name: "#FCA5A5", avatar: "#2A1515" },
  Prez:             { bubble: "#1C1A10", border: "#C9A84C", name: "#C9A84C", avatar: "#252215" },
  Sam:              { bubble: "#1C1A10", border: "#C9A84C", name: "#E6C76A", avatar: "#252215" },
  Karen:            { bubble: "#1C1A10", border: "#C9A84C", name: "#D4B55A", avatar: "#252215" },
  Jamison:          { bubble: "#0E1E2A", border: "#38BDF8", name: "#38BDF8", avatar: "#122434" },
  Mailman:          { bubble: "#0E1E2A", border: "#38BDF8", name: "#7DD3FC", avatar: "#122434" },
  Flatfoot:         { bubble: "#131C2A", border: "#8BA4C2", name: "#8BA4C2", avatar: "#162030" },
  Watcher:          { bubble: "#0D1520", border: "#94A3B8", name: "#94A3B8", avatar: "#111C28" },
  "That Guy":       { bubble: "#131820", border: "#94A3B8", name: "#CBD5E1", avatar: "#171E28" },
};

const ALL_MEMBERS = [
  { name: "Tech",          role: "Build strategist. Owns what gets built and when.",           dept: "BUILD"        },
  { name: "Jack",          role: "Brand and UI designer. Flags visual drift before it ships.", dept: "DESIGN"       },
  { name: "Scout",         role: "Market intelligence. Competitor signals, funding leads.",     dept: "RESEARCH"     },
  { name: "Jerry",         role: "Research and evidence. Challenges unsupported assumptions.",  dept: "RESEARCH"     },
  { name: "Doc",           role: "User safety and harm prevention.",                            dept: "SAFETY"       },
  { name: "Max",           role: "Accessibility. Finds barriers before real users do.",         dept: "SAFETY"       },
  { name: "CIPHER",        role: "Data privacy and trust. Flags consent gaps.",                 dept: "SAFETY"       },
  { name: "Attack Lawyer", role: "Legal offense. IP protection, contract leverage.",            dept: "LEGAL"        },
  { name: "Defense Lawyer",role: "Legal defense. Liability, compliance, regulatory exposure.",  dept: "LEGAL"        },
  { name: "Prez",          role: "Sales strategy. Makes you the most prepared in the room.",    dept: "SALES & OPS"  },
  { name: "Sam",           role: "Execution and process. Owns tasks and follow-through.",       dept: "SALES & OPS"  },
  { name: "Karen",         role: "Admin and logistics. Tracks action items.",                   dept: "SALES & OPS"  },
  { name: "Jamison",       role: "Copy and messaging. Rewrites what is not landing.",           dept: "COMMS"        },
  { name: "Mailman",       role: "Outbound email and delivery. Subject lines that get opened.", dept: "COMMS"        },
  { name: "Flatfoot",      role: "Law enforcement credibility. Flags what kills a PD pitch.",   dept: "CREDIBILITY"  },
  { name: "Watcher",       role: "Silent observer. Speaks rarely. When it does, it matters.",   dept: "OBSERVATION"  },
  { name: "That Guy",      role: "Wild card. Asks the question nobody else will.",              dept: "OBSERVATION"  },
];

const STORAGE_KEY_PREFIX = "casevoice_direct_";

interface DirectMessage {
  id: string;
  speaker: string;
  text: string;
  timestamp: string;
  isFounder?: boolean;
}

function loadHistory(memberName: string): DirectMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + memberName);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(memberName: string, messages: DirectMessage[]) {
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + memberName, JSON.stringify(messages.slice(-50)));
  } catch {}
}

function getColors(name: string, isFounder?: boolean) {
  if (isFounder) return MEMBER_COLORS["Founder"];
  return MEMBER_COLORS[name] ?? { bubble: "#131C2A", border: "#8BA4C2", name: "#8BA4C2", avatar: "#162030" };
}

function MessageBubble({ msg }: { msg: DirectMessage }) {
  const colors = getColors(msg.speaker, msg.isFounder);
  const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <div className="flex gap-3">
      <div
        className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold"
        style={{ backgroundColor: colors.avatar, color: colors.name, border: `2px solid ${colors.border}` }}
      >
        {msg.speaker.slice(0, 2).toUpperCase()}
      </div>
      <div className="flex flex-col max-w-[80%]">
        <span
          className="text-xs font-bold tracking-wider uppercase mb-1"
          style={{ color: colors.name }}
        >
          {msg.speaker}
        </span>
        <div
          className="px-4 py-3 rounded-xl rounded-tl-sm text-sm leading-relaxed"
          style={{ backgroundColor: colors.bubble, color: TEXT, border: `1px solid ${colors.border}` }}
        >
          {msg.text}
        </div>
        <span className="text-xs mt-1" style={{ color: DIM }}>{time}</span>
      </div>
    </div>
  );
}

interface ChatWindowProps {
  member: typeof ALL_MEMBERS[0];
  onBack: () => void;
}

function DirectChatWindow({ member, onBack }: ChatWindowProps) {
  const [messages, setMessages] = useState<DirectMessage[]>(() => loadHistory(member.name));
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const colors = getColors(member.name);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function addMessage(msg: Omit<DirectMessage, "id" | "timestamp">) {
    const newMsg: DirectMessage = {
      ...msg,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => {
      const updated = [...prev, newMsg];
      saveHistory(member.name, updated);
      return updated;
    });
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);
    addMessage({ speaker: "Founder", text, isFounder: true });

    const edgeKey = MEMBER_TO_EDGE[member.name] ?? member.name.toUpperCase();
    const recentTranscript = messages
      .slice(-8)
      .map((m) => ({ speaker: m.speaker, text: m.text }));

    try {
      const { data, error } = await supabase.functions.invoke("mentor-response", {
        body: {
          mentor: edgeKey,
          message: text,
          mode: "direct",
          recentTranscript,
          isInterrupt: false,
          isOpenFloor: false,
          humorDial: 2,
          humorStyle: "dry",
        },
      });

      if (error || !data?.response) {
        addMessage({
          speaker: member.name,
          text: "Could not connect right now. Check System Health.",
        });
      } else {
        addMessage({ speaker: member.name, text: data.response as string });
      }
    } catch {
      addMessage({ speaker: member.name, text: "Connection lost. Try again." });
    } finally {
      setSending(false);
    }
  }

  function clearHistory() {
    localStorage.removeItem(STORAGE_KEY_PREFIX + member.name);
    setMessages([]);
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: "#08111F" }}>
      {/* Header */}
      <div
        className="flex items-center gap-4 px-5 py-4 border-b flex-shrink-0"
        style={{ borderColor: BORDER }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all hover:opacity-80"
          style={{ backgroundColor: CARD, color: MUTED, border: `1px solid ${BORDER}` }}
        >
          <ArrowLeft size={12} /> Team
        </button>
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
          style={{ backgroundColor: colors.avatar, color: colors.name, border: `2px solid ${colors.border}` }}
        >
          {member.name.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <div className="text-sm font-bold" style={{ color: colors.name }}>
            {member.name}
          </div>
          <div className="text-xs" style={{ color: DIM }}>
            {member.role}
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearHistory}
            className="ml-auto text-xs px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
            style={{ color: DIM, border: `1px solid ${BORDER}`, backgroundColor: "transparent" }}
          >
            Clear history
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold"
              style={{ backgroundColor: colors.avatar, color: colors.name, border: `2px solid ${colors.border}` }}
            >
              {member.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="text-sm font-bold" style={{ color: colors.name }}>
              {member.name}
            </div>
            <div
              className="text-xs text-center max-w-xs leading-relaxed"
              style={{ color: DIM }}
            >
              {member.role}
            </div>
            <div className="text-xs mt-2" style={{ color: DIM }}>
              Start the conversation below.
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        {sending && (
          <div className="flex gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: colors.avatar, border: `2px solid ${colors.border}` }}
            >
              <RefreshCw size={12} className="animate-spin" style={{ color: colors.name }} />
            </div>
            <div
              className="px-4 py-3 rounded-xl text-sm"
              style={{ backgroundColor: colors.bubble, color: DIM, border: `1px solid ${colors.border}` }}
            >
              ...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
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
            placeholder={`Message ${member.name}... (Enter to send, Shift+Enter for new line)`}
            rows={2}
            className="flex-1 px-4 py-3 rounded-xl text-sm outline-none resize-none"
            style={{
              backgroundColor: CARD,
              color: TEXT,
              border: `1px solid ${BORDER}`,
              lineHeight: "1.6",
            }}
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all hover:opacity-90 disabled:opacity-30"
            style={{ backgroundColor: GOLD }}
          >
            <Send size={18} style={{ color: NAVY }} />
          </button>
        </div>
        <p className="text-xs mt-2" style={{ color: DIM }}>
          Direct channel. {member.name} only. History saved locally.
        </p>
      </div>
    </div>
  );
}

export default function DirectChat() {
  const [selected, setSelected] = useState<typeof ALL_MEMBERS[0] | null>(null);

  if (selected) {
    return <DirectChatWindow member={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="h-full w-full p-6 overflow-y-auto" style={{ backgroundColor: "#08111F" }}>
      <div
        className="mb-1 text-xs font-bold tracking-[0.22em] uppercase"
        style={{ color: GOLD }}
      >
        Direct
      </div>
      <div className="mb-6 text-sm" style={{ color: DIM }}>
        One-on-one. No routing. Pick a team member and talk directly.
      </div>
      <div className="grid grid-cols-3 gap-3">
        {ALL_MEMBERS.map((m) => {
          const c = getColors(m.name);
          const history = loadHistory(m.name);
          const lastMsg = history.slice(-1)[0];
          return (
            <button
              key={m.name}
              onClick={() => setSelected(m)}
              className="flex flex-col gap-2 p-4 rounded-xl text-left transition-all hover:opacity-90"
              style={{ backgroundColor: c.bubble, border: `1px solid ${c.border}` }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: c.avatar, color: c.name, border: `2px solid ${c.border}` }}
                >
                  {m.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-bold" style={{ color: c.name }}>
                    {m.name}
                  </div>
                  <div
                    className="text-[10px] font-semibold tracking-widest uppercase"
                    style={{ color: DIM }}
                  >
                    {m.dept}
                  </div>
                </div>
              </div>
              <div className="text-xs leading-snug" style={{ color: TEXT }}>
                {m.role}
              </div>
              {lastMsg && (
                <div
                  className="text-xs truncate mt-1 pt-2"
                  style={{ color: DIM, borderTop: `1px solid ${BORDER}` }}
                >
                  {lastMsg.isFounder ? "You: " : `${m.name}: `}
                  {lastMsg.text.slice(0, 55)}
                  {lastMsg.text.length > 55 ? "..." : ""}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
