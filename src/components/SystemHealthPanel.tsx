import { useEffect, useMemo, useState } from "react";

type TeamMember =
  | "Tech-9"
  | "Jack"
  | "Max"
  | "Doc"
  | "Flatfoot"
  | "Prez"
  | "Sam"
  | "Attack Lawyer"
  | "Defense Lawyer"
  | "Jamison"
  | "Jerry"
  | "Watcher"
  | "Karen"
  | "Mailman"
  | "Scout"
  | "CIPHER"
  | "That Guy";

type FeedMessage = {
  id: string;
  speaker: string;
  text: string;
  time: string;
  tone?: "system" | "team" | "user";
};

const TEAM_MEMBERS: TeamMember[] = [
  "Tech-9",
  "Jack",
  "Max",
  "Doc",
  "Flatfoot",
  "Prez",
  "Sam",
  "Attack Lawyer",
  "Defense Lawyer",
  "Jamison",
  "Jerry",
  "Watcher",
  "Karen",
  "Mailman",
  "Scout",
  "CIPHER",
  "That Guy",
];

function formatNow() {
  return new Date().toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function safeText(value: unknown) {
  if (typeof value === "string" && value.trim()) return value.trim();

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    const candidates = [
      record.output,
      record.response,
      record.message,
      record.text,
      record.content,
      record.reply,
      record.result,
    ];

    for (const item of candidates) {
      if (typeof item === "string" && item.trim()) return item.trim();
    }
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "No readable response returned.";
  }
}

export default function StaffMeetingRoom({
  sessionId,
  sessionKey,
}: {
  sessionId: string | null;
  sessionKey: string | null;
}) {
  const [feed, setFeed] = useState<FeedMessage[]>([
    {
      id: "julie-open",
      speaker: "JULIE",
      text: "Room is open. What are we working on?",
      time: formatNow(),
      tone: "team",
    },
  ]);

  const [draft, setDraft] = useState("");
  const [sideNotes, setSideNotes] = useState("");
  const [loadingMember, setLoadingMember] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent;
      const detail = custom.detail;
      const speaker =
        typeof detail?.member === "string" && detail.member.trim()
          ? detail.member.trim().toUpperCase()
          : "TEAM RESPONSE";

      setFeed((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          speaker,
          text: safeText(detail),
          time: formatNow(),
          tone: "team",
        },
      ]);

      setLoadingMember(null);
    };

    window.addEventListener("team-response", handler as EventListener);

    return () => {
      window.removeEventListener("team-response", handler as EventListener);
    };
  }, []);

  const transcriptText = useMemo(() => {
    return feed.map((item) => `${item.time} ${item.speaker}: ${item.text}`).join("\n\n");
  }, [feed]);

  const sendToMember = async (member: string, inputOverride?: string) => {
    const promptText =
      (inputOverride ?? draft).trim() || `User called ${member} from the meeting room.`;

    const userLine: FeedMessage = {
      id: crypto.randomUUID(),
      speaker: "YOU",
      text: promptText,
      time: formatNow(),
      tone: "user",
    };

    setFeed((prev) => [...prev, userLine]);
    setLoadingMember(member);

    try {
      const res = await fetch("/api/run-team-member", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          member,
          input: promptText,
          sessionId,
          sessionKey,
          sideNotes,
        }),
      });

      const data = await res.json();

      window.dispatchEvent(
        new CustomEvent("team-response", {
          detail: {
            ...data,
            member,
          },
        })
      );

      setDraft("");
    } catch (err) {
      console.error("TEAM CALL FAILED", err);

      setFeed((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          speaker: "SYSTEM",
          text: `Call failed for ${member}.`,
          time: formatNow(),
          tone: "system",
        },
      ]);

      setLoadingMember(null);
    }
  };

  const callTeam = async () => {
    await sendToMember("Julie", draft.trim() || "User initiated team call from meeting room.");
  };

  const saveSession = async () => {
    setSaveState("saving");

    try {
      const res = await fetch("/api/save-meeting", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "save_session",
          sessionId,
          sessionKey,
          transcript: transcriptText,
          sideNotes,
        }),
      });

      const data = await res.json();

      if (data?.success || data?.ok || data?.fileId || data?.saved) {
        setSaveState("saved");
        window.setTimeout(() => setSaveState("idle"), 1800);
        return;
      }

      setSaveState("error");
      window.setTimeout(() => setSaveState("idle"), 2200);
    } catch (err) {
      console.error("SAVE SESSION FAILED", err);
      setSaveState("error");
      window.setTimeout(() => setSaveState("idle"), 2200);
    }
  };

  return (
    <div className="h-full w-full flex flex-col" style={{ backgroundColor: "#08111F" }}>
      <div
        className="px-5 py-4 border-b flex items-center justify-between"
        style={{ borderColor: "#1B2A4A" }}
      >
        <div
          className="text-[14px] font-bold tracking-[0.08em] uppercase"
          style={{ color: "#C9A84C" }}
        >
          Staff Meeting Room
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={callTeam}
            disabled={loadingMember !== null}
            className="px-4 py-2 rounded-xl text-[12px] font-bold uppercase"
            style={{
              color: "#C9A84C",
              backgroundColor: "#0D1B2E",
              border: "1px solid #1B2A4A",
              opacity: loadingMember ? 0.7 : 1,
            }}
          >
            {loadingMember === "Julie" ? "Calling..." : "Call Team"}
          </button>

          <button
            onClick={saveSession}
            disabled={saveState === "saving"}
            className="px-4 py-2 rounded-xl text-[12px] font-bold uppercase"
            style={{
              color: "#D8E3F0",
              backgroundColor: "#0D1B2E",
              border: "1px solid #1B2A4A",
              opacity: saveState === "saving" ? 0.7 : 1,
            }}
          >
            {saveState === "saving"
              ? "Saving..."
              : saveState === "saved"
                ? "Saved"
                : saveState === "error"
                  ? "Save Failed"
                  : "Save Session"}
          </button>
        </div>
      </div>

      <div
        className="px-5 py-4 border-b"
        style={{ borderColor: "#1B2A4A", backgroundColor: "#0B1730" }}
      >
        <div
          className="text-[11px] font-bold uppercase tracking-[0.18em] mb-3"
          style={{ color: "#5E7A99" }}
        >
          Call a team member directly
        </div>

        <div className="grid grid-cols-4 gap-2">
          {TEAM_MEMBERS.map((member) => (
            <button
              key={member}
              onClick={() => sendToMember(member)}
              disabled={loadingMember !== null}
              className="text-left px-3 py-2 rounded-xl text-[13px] font-semibold"
              style={{
                color: "#F8FAFC",
                backgroundColor: "#0D1B2E",
                border: "1px solid #1B2A4A",
                opacity: loadingMember ? 0.7 : 1,
              }}
            >
              {loadingMember === member ? "Calling..." : member}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 px-5 py-4">
        <div
          className="h-full rounded-2xl border overflow-hidden flex flex-col"
          style={{
            backgroundColor: "#071427",
            borderColor: "#1B2A4A",
          }}
        >
          <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
            {feed.map((item) => (
              <div key={item.id} className="flex items-start gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0"
                  style={{
                    backgroundColor:
                      item.speaker === "JULIE"
                        ? "#0D2142"
                        : item.speaker === "YOU"
                          ? "#1D2432"
                          : "#101D34",
                    color: item.speaker === "JULIE" ? "#C9A84C" : "#D8E3F0",
                    border: "1px solid #1B2A4A",
                  }}
                >
                  {item.speaker === "JULIE"
                    ? "JU"
                    : item.speaker === "YOU"
                      ? "YO"
                      : item.speaker.slice(0, 2)}
                </div>

                <div className="min-w-0">
                  <div
                    className="text-[12px] font-bold uppercase mb-2"
                    style={{ color: item.speaker === "JULIE" ? "#C9A84C" : "#8A9BB5" }}
                  >
                    {item.speaker}
                  </div>

                  <div
                    className="max-w-[900px] rounded-2xl px-4 py-3 text-[14px] leading-6"
                    style={{
                      backgroundColor: "#0B1730",
                      border: "1px solid #1B2A4A",
                      color: "#F8FAFC",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {item.text}
                  </div>

                  <div className="mt-2 text-[11px]" style={{ color: "#617892" }}>
                    {item.time}
                  </div>
                </div>
              </div>
            ))}

            {loadingMember && (
              <div className="text-[14px]" style={{ color: "#C9A84C" }}>
                {loadingMember} is responding...
              </div>
            )}
          </div>

          <div
            className="border-t px-4 py-4 space-y-3"
            style={{ borderColor: "#1B2A4A", backgroundColor: "#08111F" }}
          >
            <div>
              <div
                className="text-[11px] font-bold uppercase tracking-[0.18em] mb-2"
                style={{ color: "#5E7A99" }}
              >
                Side Notes
              </div>
              <textarea
                value={sideNotes}
                onChange={(e) => setSideNotes(e.target.value)}
                placeholder="Drop side notes here while the room is running."
                className="w-full min-h-[88px] rounded-xl px-4 py-3 resize-y outline-none text-[14px]"
                style={{
                  backgroundColor: "#0D1B2E",
                  border: "1px solid #1B2A4A",
                  color: "#F8FAFC",
                }}
              />
            </div>

            <div className="flex items-end gap-3">
              <div className="flex-1">
                <div
                  className="text-[11px] font-bold uppercase tracking-[0.18em] mb-2"
                  style={{ color: "#5E7A99" }}
                >
                  Prompt
                </div>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Type what you want Julie or a team member to work on."
                  className="w-full min-h-[76px] rounded-xl px-4 py-3 resize-y outline-none text-[14px]"
                  style={{
                    backgroundColor: "#0D1B2E",
                    border: "1px solid #1B2A4A",
                    color: "#F8FAFC",
                  }}
                />
              </div>

              <button
                onClick={callTeam}
                disabled={loadingMember !== null}
                className="px-5 py-3 rounded-xl text-[13px] font-bold uppercase shrink-0"
                style={{
                  color: "#0D1B2E",
                  backgroundColor: "#C9A84C",
                  border: "1px solid rgba(201,168,76,0.45)",
                  opacity: loadingMember ? 0.7 : 1,
                }}
              >
                Send to Julie
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
