import { useState } from "react";
import { supabase } from "../lib/supabase";
import { CORE_5_MEMBERS, type Core5Key } from "../utils/core5SystemPrompts";

interface MemberResponse {
  key: Core5Key;
  name: string;
  department: string;
  response: string;
  loading: boolean;
  error: boolean;
}

interface FollowUpMessage {
  sender: string;
  text: string;
  timestamp: string;
}

interface SavedSession {
  topic: string;
  responses: MemberResponse[];
  followUps: FollowUpMessage[];
  savedAt: string;
}

function timestamp(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

async function callMember(memberKey: Core5Key, message: string): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke("mentor-response", {
    body: {
      mentor: memberKey,
      message,
      mode: "meeting",
      recentTranscript: [],
      isInterrupt: false,
      isOpenFloor: false,
      humorDial: 1,
      humorStyle: "dry",
    },
  });
  if (error || !data?.response) return null;
  return data.response as string;
}

export default function HAVENProjectRoom() {
  const [topic, setTopic] = useState("");
  const [sessionActive, setSessionActive] = useState(false);
  const [responses, setResponses] = useState<MemberResponse[]>([]);
  const [followUpText, setFollowUpText] = useState("");
  const [followUpTarget, setFollowUpTarget] = useState<Core5Key | "ALL">("ALL");
  const [followUps, setFollowUps] = useState<FollowUpMessage[]>([]);
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  async function convene() {
    if (!topic.trim()) return;
    setSessionActive(true);
    setSaved(false);
    setFollowUps([]);

    const initial: MemberResponse[] = CORE_5_MEMBERS.map((m) => ({
      key: m.key,
      name: m.name,
      department: m.department,
      response: "",
      loading: true,
      error: false,
    }));
    setResponses(initial);

    for (let i = 0; i < CORE_5_MEMBERS.length; i++) {
      const member = CORE_5_MEMBERS[i];
      try {
        const text = await callMember(member.key, topic);
        setResponses((prev) =>
          prev.map((r, idx) =>
            idx === i
              ? { ...r, loading: false, response: text ?? "No response received.", error: !text }
              : r
          )
        );
      } catch {
        setResponses((prev) =>
          prev.map((r, idx) =>
            idx === i
              ? { ...r, loading: false, response: "Connection error.", error: true }
              : r
          )
        );
      }
    }
  }

  async function sendFollowUp() {
    if (!followUpText.trim()) return;
    setFollowUpLoading(true);

    const targets =
      followUpTarget === "ALL"
        ? CORE_5_MEMBERS
        : CORE_5_MEMBERS.filter((m) => m.key === followUpTarget);

    for (const member of targets) {
      try {
        const text = await callMember(member.key, followUpText);
        const msg: FollowUpMessage = {
          sender: member.name,
          text: text ?? "No response received.",
          timestamp: timestamp(),
        };
        setFollowUps((prev) => [...prev, msg]);
      } catch {
        setFollowUps((prev) => [
          ...prev,
          { sender: member.name, text: "Connection error.", timestamp: timestamp() },
        ]);
      }
    }

    setFollowUpText("");
    setFollowUpLoading(false);
  }

  function saveToVault() {
    const session: SavedSession = {
      topic,
      responses,
      followUps,
      savedAt: new Date().toISOString(),
    };
    const existing = JSON.parse(
      localStorage.getItem("casevoice_haven_sessions") || "[]"
    ) as SavedSession[];
    existing.push(session);
    localStorage.setItem("casevoice_haven_sessions", JSON.stringify(existing));
    setSaved(true);
  }

  function reset() {
    setTopic("");
    setSessionActive(false);
    setResponses([]);
    setFollowUps([]);
    setFollowUpText("");
    setSaved(false);
  }

  const allDone = responses.length > 0 && responses.every((r) => !r.loading);

  return (
    <div
      className="h-full w-full overflow-y-auto p-8"
      style={{ backgroundColor: "#08111F", color: "#FFFFFF", fontFamily: "'Inter', sans-serif" }}
    >
      <div className="mb-1">
        <div
          className="text-[11px] font-bold tracking-[0.22em] uppercase"
          style={{ color: "#C9A84C" }}
        >
          HAVEN PROJECT ROOM
        </div>
        <div className="text-xs mt-1" style={{ color: "#3A4F6A" }}>
          Core 5 active. One topic at a time.
        </div>
      </div>

      {!sessionActive && (
        <div className="mt-6 max-w-2xl">
          <label
            className="block text-[10px] font-bold tracking-[0.18em] uppercase mb-2"
            style={{ color: "#8A9BB5" }}
          >
            What do we need to discuss about HAVEN today?
          </label>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            rows={3}
            placeholder="Describe the issue, decision, or question..."
            className="w-full rounded-lg border px-4 py-3 text-sm resize-none outline-none"
            style={{ backgroundColor: "#0D1B2E", borderColor: "#1B2A4A", color: "#FFFFFF" }}
          />
          <button
            onClick={convene}
            disabled={!topic.trim()}
            className="mt-3 px-6 py-2 rounded-lg text-xs font-bold tracking-[0.14em] uppercase transition-all"
            style={{
              backgroundColor: topic.trim() ? "#C9A84C" : "#1B2A4A",
              color: topic.trim() ? "#08111F" : "#3A4F6A",
              cursor: topic.trim() ? "pointer" : "not-allowed",
            }}
          >
            CONVENE
          </button>
        </div>
      )}

      {sessionActive && (
        <div className="mt-6 max-w-3xl">
          <div
            className="mb-5 px-4 py-3 rounded-lg border text-sm"
            style={{ backgroundColor: "#0D1B2E", borderColor: "#1B2A4A", color: "#8A9BB5" }}
          >
            <span
              className="text-[10px] font-bold tracking-widest uppercase mr-2"
              style={{ color: "#C9A84C" }}
            >
              TOPIC
            </span>
            {topic}
          </div>

          <div className="flex flex-col gap-4 mb-6">
            {responses.map((r) => {
              const colors = CORE_5_MEMBERS.find((m) => m.key === r.key)!.colors;
              return (
                <div
                  key={r.key}
                  className="rounded-xl border p-5"
                  style={{ backgroundColor: colors.bubble, borderColor: colors.border }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold tracking-wide" style={{ color: colors.name }}>
                      {r.name}
                    </span>
                    <span
                      className="text-[9px] font-bold tracking-widest uppercase"
                      style={{ color: "#3A4F6A" }}
                    >
                      {r.department}
                    </span>
                  </div>
                  {r.loading ? (
                    <div className="flex items-center gap-2" style={{ color: "#3A4F6A" }}>
                      <div
                        className="w-3 h-3 rounded-full border-2 animate-spin"
                        style={{ borderColor: colors.border, borderTopColor: "transparent" }}
                      />
                      <span className="text-xs">Thinking...</span>
                    </div>
                  ) : (
                    <p className="text-sm leading-relaxed" style={{ color: "#C8D8E8" }}>
                      {r.response}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {allDone && (
            <>
              <div
                className="mb-4 text-xs font-bold tracking-[0.14em] uppercase"
                style={{ color: "#C9A84C" }}
              >
                What do you want to focus on?
              </div>

              {followUps.length > 0 && (
                <div className="flex flex-col gap-3 mb-4">
                  {followUps.map((f, i) => {
                    const member = CORE_5_MEMBERS.find((m) => m.name === f.sender);
                    const col = member ? member.colors.name : "#8A9BB5";
                    return (
                      <div
                        key={i}
                        className="rounded-lg border px-4 py-3"
                        style={{ backgroundColor: "#0D1B2E", borderColor: "#1B2A4A" }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold tracking-wide" style={{ color: col }}>
                            {f.sender}
                          </span>
                          <span className="text-[9px]" style={{ color: "#3A4F6A" }}>
                            {f.timestamp}
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed" style={{ color: "#C8D8E8" }}>
                          {f.text}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex flex-col gap-2 mb-4">
                <div className="flex gap-2">
                  <select
                    value={followUpTarget}
                    onChange={(e) => setFollowUpTarget(e.target.value as Core5Key | "ALL")}
                    className="rounded-lg border px-3 py-2 text-xs outline-none"
                    style={{ backgroundColor: "#0D1B2E", borderColor: "#1B2A4A", color: "#8A9BB5" }}
                  >
                    <option value="ALL">All members</option>
                    {CORE_5_MEMBERS.map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={followUpText}
                    onChange={(e) => setFollowUpText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendFollowUp();
                      }
                    }}
                    placeholder="Ask the team anything else about this topic..."
                    className="flex-1 rounded-lg border px-4 py-2 text-sm outline-none"
                    style={{ backgroundColor: "#0D1B2E", borderColor: "#1B2A4A", color: "#FFFFFF" }}
                    disabled={followUpLoading}
                  />
                  <button
                    onClick={sendFollowUp}
                    disabled={!followUpText.trim() || followUpLoading}
                    className="px-4 py-2 rounded-lg text-xs font-bold tracking-wide uppercase transition-all"
                    style={{
                      backgroundColor:
                        followUpText.trim() && !followUpLoading ? "#C9A84C" : "#1B2A4A",
                      color:
                        followUpText.trim() && !followUpLoading ? "#08111F" : "#3A4F6A",
                      cursor:
                        followUpText.trim() && !followUpLoading ? "pointer" : "not-allowed",
                    }}
                  >
                    SEND
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={saveToVault}
                  disabled={saved}
                  className="px-5 py-2 rounded-lg text-xs font-bold tracking-wide uppercase transition-all border"
                  style={{
                    backgroundColor: "transparent",
                    borderColor: saved ? "#3A4F6A" : "#C9A84C",
                    color: saved ? "#3A4F6A" : "#C9A84C",
                    cursor: saved ? "default" : "pointer",
                  }}
                >
                  {saved ? "SAVED TO VAULT" : "SAVE TO VAULT"}
                </button>
                <button
                  onClick={reset}
                  className="px-5 py-2 rounded-lg text-xs font-bold tracking-wide uppercase"
                  style={{ backgroundColor: "transparent", color: "#3A4F6A", cursor: "pointer" }}
                >
                  NEW TOPIC
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
