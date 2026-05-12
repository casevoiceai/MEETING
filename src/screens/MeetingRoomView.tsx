import { useState } from "react";
import { GitBranch, X, Plus, CheckCircle } from "lucide-react";

const GOLD = "#C9A84C";
const BORDER = "#1B2A4A";
const DIM = "#3A4F6A";
const TEXT = "#D0DFEE";
const MUTED = "#8A9BB5";
const CARD = "#0A1628";

type JuliePayload = {
  founder_intent: string;
  context: string;
  request: string;
  unknown_risk: string;
};

type MeetingRoomViewProps = {
  onSendToDirect?: () => void;
};

const ALL_TMS = [
  { name: "Tech",          role: "Build strategist. Owns what gets built and when.",           dept: "BUILD",       bubble: "#0F1E35", border: "#60A5FA", nameColor: "#60A5FA", avatar: "#152540" },
  { name: "Jack",          role: "Brand and UI designer. Flags visual drift before it ships.", dept: "DESIGN",      bubble: "#1A1535", border: "#A78BFA", nameColor: "#A78BFA", avatar: "#221A40" },
  { name: "Scout",         role: "Market intelligence. Competitor signals, funding leads.",    dept: "RESEARCH",    bubble: "#0F2820", border: "#34D399", nameColor: "#34D399", avatar: "#133322" },
  { name: "Jerry",         role: "Research and evidence. Challenges unsupported claims.",      dept: "RESEARCH",    bubble: "#0F2820", border: "#34D399", nameColor: "#6EE7B7", avatar: "#133322" },
  { name: "Doc",           role: "User safety and harm prevention.",                           dept: "SAFETY",      bubble: "#2A1A0F", border: "#FB923C", nameColor: "#FB923C", avatar: "#332210" },
  { name: "Max",           role: "Accessibility. Finds barriers before real users do.",        dept: "SAFETY",      bubble: "#2A1A0F", border: "#FB923C", nameColor: "#FDB877", avatar: "#332210" },
  { name: "CIPHER",        role: "Data privacy and trust. Flags consent gaps.",                dept: "SAFETY",      bubble: "#2A1A0F", border: "#FB923C", nameColor: "#FD9A50", avatar: "#332210" },
  { name: "Attack Lawyer", role: "Legal offense. IP protection, contract leverage.",           dept: "LEGAL",       bubble: "#2A0F0F", border: "#F87171", nameColor: "#F87171", avatar: "#381212" },
  { name: "Defense Lawyer",role: "Legal defense. Liability, compliance, regulatory exposure.", dept: "LEGAL",       bubble: "#201010", border: "#FCA5A5", nameColor: "#FCA5A5", avatar: "#2A1515" },
  { name: "Prez",          role: "Sales strategy. Makes you the most prepared in the room.",   dept: "SALES & OPS", bubble: "#1C1A10", border: "#C9A84C", nameColor: "#C9A84C", avatar: "#252215" },
  { name: "Sam",           role: "Execution and process. Owns tasks and follow-through.",      dept: "SALES & OPS", bubble: "#1C1A10", border: "#C9A84C", nameColor: "#E6C76A", avatar: "#252215" },
  { name: "Karen",         role: "Admin and logistics. Tracks action items.",                  dept: "SALES & OPS", bubble: "#1C1A10", border: "#C9A84C", nameColor: "#D4B55A", avatar: "#252215" },
  { name: "Jamison",       role: "Copy and messaging. Rewrites what is not landing.",          dept: "COMMS",       bubble: "#0E1E2A", border: "#38BDF8", nameColor: "#38BDF8", avatar: "#122434" },
  { name: "Mailman",       role: "Outbound email and delivery. Subject lines that get opened.",dept: "COMMS",       bubble: "#0E1E2A", border: "#38BDF8", nameColor: "#7DD3FC", avatar: "#122434" },
  { name: "Flatfoot",      role: "Law enforcement credibility. Flags what kills a PD pitch.",  dept: "CREDIBILITY", bubble: "#131C2A", border: "#8BA4C2", nameColor: "#8BA4C2", avatar: "#162030" },
  { name: "Watcher",       role: "Silent observer. Speaks rarely. When it does, it matters.",  dept: "OBSERVATION", bubble: "#0D1520", border: "#94A3B8", nameColor: "#94A3B8", avatar: "#111C28" },
  { name: "That Guy",      role: "Wild card. Asks the question nobody else will.",             dept: "OBSERVATION", bubble: "#131820", border: "#94A3B8", nameColor: "#CBD5E1", avatar: "#171E28" },
];

const ROUTE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  "ROUTE: LEGAL REVIEW":   { bg: "#2A0F0F", border: "#F87171", text: "#F87171" },
  "ROUTE: BUILD REVIEW":   { bg: "#0F1E35", border: "#60A5FA", text: "#60A5FA" },
  "ROUTE: SAFETY REVIEW":  { bg: "#2A1A0F", border: "#FB923C", text: "#FB923C" },
  "ROUTE: SALES REVIEW":   { bg: "#1C1A10", border: "#C9A84C", text: "#C9A84C" },
  "ROUTE: COMMS REVIEW":   { bg: "#0E1E2A", border: "#38BDF8", text: "#38BDF8" },
  "ROUTE: GENERAL REVIEW": { bg: "#0D1520", border: "#94A3B8", text: "#94A3B8" },
};

function getRouteLabel(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("legal") || lower.includes("liability") || lower.includes("contract") || lower.includes("law")) return "ROUTE: LEGAL REVIEW";
  if (lower.includes("build") || lower.includes("code") || lower.includes("bug") || lower.includes("feature") || lower.includes("tech")) return "ROUTE: BUILD REVIEW";
  if (lower.includes("risk") || lower.includes("safety") || lower.includes("harm") || lower.includes("privacy") || lower.includes("data")) return "ROUTE: SAFETY REVIEW";
  if (lower.includes("sales") || lower.includes("pitch") || lower.includes("client") || lower.includes("partner") || lower.includes("money")) return "ROUTE: SALES REVIEW";
  if (lower.includes("email") || lower.includes("message") || lower.includes("copy") || lower.includes("outreach") || lower.includes("comms")) return "ROUTE: COMMS REVIEW";
  return "ROUTE: GENERAL REVIEW";
}

function recommendTMs(text: string): string[] {
  const lower = text.toLowerCase();
  const recs: string[] = [];

  if (lower.includes("legal") || lower.includes("liability") || lower.includes("contract") || lower.includes("law") || lower.includes("ip")) {
    recs.push("Attack Lawyer", "Defense Lawyer");
  }
  if (lower.includes("build") || lower.includes("code") || lower.includes("bug") || lower.includes("feature") || lower.includes("tech") || lower.includes("deploy")) {
    recs.push("Tech");
  }
  if (lower.includes("design") || lower.includes("ui") || lower.includes("brand") || lower.includes("visual")) {
    recs.push("Jack");
  }
  if (lower.includes("risk") || lower.includes("harm") || lower.includes("safety") || lower.includes("user protection")) {
    recs.push("Doc");
  }
  if (lower.includes("privacy") || lower.includes("data") || lower.includes("consent") || lower.includes("trust")) {
    recs.push("CIPHER");
  }
  if (lower.includes("accessibility") || lower.includes("barrier") || lower.includes("access")) {
    recs.push("Max");
  }
  if (lower.includes("sales") || lower.includes("pitch") || lower.includes("client") || lower.includes("demo") || lower.includes("partner")) {
    recs.push("Prez");
  }
  if (lower.includes("email") || lower.includes("outreach") || lower.includes("copy") || lower.includes("message") || lower.includes("comms")) {
    recs.push("Jamison", "Mailman");
  }
  if (lower.includes("police") || lower.includes("law enforcement") || lower.includes("credibility") || lower.includes("department")) {
    recs.push("Flatfoot");
  }
  if (lower.includes("market") || lower.includes("competitor") || lower.includes("research") || lower.includes("intel")) {
    recs.push("Scout");
  }
  if (lower.includes("task") || lower.includes("plan") || lower.includes("execute") || lower.includes("deadline") || lower.includes("action")) {
    recs.push("Sam");
  }
  if (recs.length === 0) {
    recs.push("Prez", "Jerry", "Watcher");
  }

  return [...new Set(recs)];
}

export default function MeetingRoomView({ onSendToDirect }: MeetingRoomViewProps) {
  const [rawInput, setRawInput] = useState("");
  const [founderLanguage, setFounderLanguage] = useState("");
  const [companyTranslation, setCompanyTranslation] = useState("");
  const [payload, setPayload] = useState<JuliePayload | null>(null);
  const [activeTMs, setActiveTMs] = useState<string[]>([]);
  const [route, setRoute] = useState<string>("");
  const [showApproval, setShowApproval] = useState(false);
  const [showAddTM, setShowAddTM] = useState(false);
  const [gateError, setGateError] = useState("");

  function assistJulie() {
    const text = rawInput.toLowerCase();
    let intent = "";
    let request = "";

    if (text.includes("need") || text.includes("want")) {
      intent = rawInput;
    } else {
      intent = "Clarify goal: " + rawInput;
    }

    if (text.includes("information") || text.includes("details")) {
      request = "Provide detailed explanation and breakdown.";
    } else if (text.includes("fix") || text.includes("bug")) {
      request = "Identify issue and propose fix.";
    } else if (text.includes("build") || text.includes("create")) {
      request = "Outline steps to build solution.";
    } else {
      request = "Clarify desired outcome and next action.";
    }

    setFounderLanguage(intent);
    setCompanyTranslation(request);
    setGateError("");
  }

  function buildPayload() {
    const built: JuliePayload = {
      founder_intent: founderLanguage,
      context: rawInput,
      request: companyTranslation,
      unknown_risk: "",
    };
    const combined = `${rawInput} ${founderLanguage} ${companyTranslation}`;
    const detectedRoute = getRouteLabel(combined);
    const recs = recommendTMs(combined);
    setPayload(built);
    setRoute(detectedRoute);
    setActiveTMs(recs);
    setShowApproval(true);
    setShowAddTM(false);
    setGateError("");
    return built;
  }

  function passesMeaningGate(built: JuliePayload) {
    const combined = `${built.founder_intent} ${built.context} ${built.request}`.trim();
    const words = combined.split(/\s+/).filter(Boolean);
    return built.founder_intent.trim().length >= 8 && built.request.trim().length >= 8 && words.length >= 6;
  }

  function removeTM(name: string) {
    setActiveTMs((prev) => prev.filter((t) => t !== name));
  }

  function addTM(name: string) {
    setActiveTMs((prev) => prev.includes(name) ? prev : [...prev, name]);
    setShowAddTM(false);
  }

  function approveAndSend() {
    const built = payload ?? {
      founder_intent: founderLanguage,
      context: rawInput,
      request: companyTranslation,
      unknown_risk: "",
    };

    if (!passesMeaningGate(built)) {
      setGateError("MEANING GATE BLOCKED: intent or request is too unclear. Add more detail before sending.");
      return;
    }

    if (activeTMs.length === 0) {
      setGateError("Select at least one active TM before sending.");
      return;
    }

    // MEETINGROOM HANDOFF FOUNDER STATEMENT V1
    const founderStatement = rawInput.trim() || built.founder_intent || built.context || built.request || "";
    const handoffPayload = {
      ...built,
      founder_statement: founderStatement,
      front_desk_statement: founderStatement,
      original_message: founderStatement,
      raw_input: rawInput,
    };

        // EXPLICIT MEETING TITLE HANDOFF V1
    localStorage.setItem("casevoice_meeting_session_title_v1", founderStatement);
    localStorage.setItem("casevoice_julie_direct_payload", JSON.stringify(handoffPayload));
    localStorage.setItem("casevoice_julie_active_tms", JSON.stringify(activeTMs));
    localStorage.setItem("casevoice_julie_route", route);
    onSendToDirect?.();
  }

  const routeStyle = route ? ROUTE_COLORS[route] ?? ROUTE_COLORS["ROUTE: GENERAL REVIEW"] : null;
  const availableToAdd = ALL_TMS.filter((m) => !activeTMs.includes(m.name));

  return (
    <div className="h-full overflow-y-auto p-6" style={{ backgroundColor: "#08111F", color: "#FFFFFF" }}>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: GOLD }}>FRONT DESK</p>
        <h1 className="mt-2 text-2xl font-bold">Julie Translation Desk</h1>
        <p className="mt-2 max-w-3xl text-sm" style={{ color: MUTED }}>
          Founder language goes in. Company-ready meaning comes out. Julie recommends who should be in the room.
        </p>
      </div>

      <section className="rounded-2xl p-5" style={{ border: `1px solid ${BORDER}`, backgroundColor: "#0A1225" }}>
        <h2 className="text-lg font-semibold">Raw Founder Input</h2>
        <textarea
          className="mt-3 min-h-36 w-full rounded-xl p-4 text-sm outline-none"
          placeholder="Say it naturally. Rough notes, frustration, metaphors, fast thoughts are allowed."
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          style={{ backgroundColor: CARD, color: TEXT, border: `1px solid ${BORDER}` }}
        />
      </section>

      <section className="mt-5 rounded-2xl p-5" style={{ border: `1px solid ${BORDER}`, backgroundColor: "#0A1225" }}>
        <h2 className="text-lg font-semibold">Founder Translation</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold mb-2" style={{ color: GOLD }}>Founder Language</p>
            <textarea
              className="min-h-40 w-full rounded-xl p-4 text-sm outline-none"
              value={founderLanguage}
              onChange={(e) => setFounderLanguage(e.target.value)}
              placeholder="Plain founder intent."
              style={{ backgroundColor: CARD, color: TEXT, border: `1px solid ${BORDER}` }}
            />
          </div>
          <div>
            <p className="text-sm font-semibold mb-2" style={{ color: GOLD }}>Company Translation</p>
            <textarea
              className="min-h-40 w-full rounded-xl p-4 text-sm outline-none"
              value={companyTranslation}
              onChange={(e) => setCompanyTranslation(e.target.value)}
              placeholder="Company-ready meaning, action, and safety note."
              style={{ backgroundColor: CARD, color: TEXT, border: `1px solid ${BORDER}` }}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={assistJulie}
            className="rounded-xl px-4 py-2 text-sm font-semibold transition-all hover:opacity-80"
            style={{ border: `1px solid ${BORDER}`, color: MUTED, backgroundColor: "transparent" }}
          >
            Assist Julie
          </button>
          <button
            onClick={buildPayload}
            className="rounded-xl px-4 py-2 text-sm font-semibold transition-all hover:opacity-90"
            style={{ border: `1px solid ${GOLD}`, color: GOLD, backgroundColor: "transparent" }}
          >
            Build Handoff + Get TM Recommendations
          </button>
        </div>
      </section>

      {showApproval && payload && routeStyle && (
        <section className="mt-5 rounded-2xl p-5" style={{ border: `1px solid ${routeStyle.border}`, backgroundColor: routeStyle.bg }}>

          <div className="flex items-center gap-3 mb-5">
            <GitBranch size={16} style={{ color: routeStyle.text }} />
            <span className="text-xs font-bold tracking-widest uppercase" style={{ color: routeStyle.text }}>
              {route}
            </span>
          </div>

          <div className="mb-5 rounded-xl p-4" style={{ backgroundColor: "#08111F", border: `1px solid ${BORDER}` }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: MUTED }}>Handoff Summary</p>
            <div className="flex flex-col gap-2 text-sm" style={{ color: TEXT }}>
              <div><span style={{ color: GOLD }}>Intent: </span>{payload.founder_intent}</div>
              <div><span style={{ color: GOLD }}>Request: </span>{payload.request}</div>
              {payload.context && <div><span style={{ color: GOLD }}>Context: </span>{payload.context}</div>}
            </div>
          </div>

          <div className="mb-5">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: MUTED }}>
              Julie recommends these active TMs
            </p>

            {activeTMs.length === 0 && (
              <p className="text-sm mb-3" style={{ color: DIM }}>No TMs selected. Add at least one.</p>
            )}

            <div className="flex flex-wrap gap-2 mb-3">
              {activeTMs.map((name) => {
                const tm = ALL_TMS.find((t) => t.name === name);
                if (!tm) return null;
                return (
                  <div
                    key={name}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm"
                    style={{ backgroundColor: tm.bubble, border: `1px solid ${tm.border}` }}
                  >
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ backgroundColor: tm.avatar, color: tm.nameColor, border: `1px solid ${tm.border}` }}
                    >
                      {name.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="font-semibold" style={{ color: tm.nameColor }}>{name}</span>
                    <span className="text-xs" style={{ color: DIM }}>{tm.dept}</span>
                    <button onClick={() => removeTM(name)} className="ml-1 transition-all hover:opacity-70" style={{ color: DIM }}>
                      <X size={12} />
                    </button>
                  </div>
                );
              })}
            </div>

            {!showAddTM && (
              <button
                onClick={() => setShowAddTM(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
                style={{ border: `1px solid ${BORDER}`, color: MUTED, backgroundColor: "transparent" }}
              >
                <Plus size={12} /> Add TM
              </button>
            )}

            {showAddTM && (
              <div className="mt-3 rounded-xl p-3" style={{ backgroundColor: "#08111F", border: `1px solid ${BORDER}` }}>
                <p className="text-xs mb-2" style={{ color: DIM }}>Pick a TM to add:</p>
                <div className="flex flex-wrap gap-2">
                  {availableToAdd.map((tm) => (
                    <button
                      key={tm.name}
                      onClick={() => addTM(tm.name)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                      style={{ backgroundColor: tm.bubble, color: tm.nameColor, border: `1px solid ${tm.border}` }}
                    >
                      {tm.name}
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowAddTM(false)} className="mt-2 text-xs" style={{ color: DIM }}>Cancel</button>
              </div>
            )}
          </div>

          <div className="mb-5 rounded-xl px-4 py-3" style={{ backgroundColor: "#08111F", border: `1px solid ${BORDER}` }}>
            <p className="text-xs" style={{ color: DIM }}>
              All other TMs are passive listeners at all times. They hear everything and can surface a note if something triggers them. You do not need to invite them.
            </p>
          </div>

          {gateError && (
            <div className="mb-4 rounded-xl px-4 py-3" style={{ backgroundColor: "#2A0F0F", border: "1px solid #F87171" }}>
              <p className="text-xs font-semibold" style={{ color: "#F87171" }}>{gateError}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={approveAndSend}
              className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all hover:opacity-90"
              style={{ backgroundColor: GOLD, color: "#0D1B2E" }}
            >
              <CheckCircle size={16} />
              Approve and Send to Direct
            </button>
            <button
              onClick={() => { setShowApproval(false); setGateError(""); }}
              className="px-4 py-3 rounded-xl text-sm transition-all hover:opacity-70"
              style={{ border: `1px solid ${BORDER}`, color: MUTED, backgroundColor: "transparent" }}
            >
              Cancel
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

