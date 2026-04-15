import { useEffect, useState } from "react";

export default function StaffMeetingRoom({
  sessionId,
  sessionKey,
}: {
  sessionId: string | null;
  sessionKey: string | null;
}) {
  const [responses, setResponses] = useState<any[]>([]);

  useEffect(() => {
    const handler = (e: any) => {
      setResponses((prev) => [...prev, e.detail]);
    };

    window.addEventListener("team-response", handler);

    return () => {
      window.removeEventListener("team-response", handler);
    };
  }, []);

  return (
    <div className="h-full w-full p-6" style={{ backgroundColor: "#08111F" }}>
      <div className="flex flex-col h-full gap-4">

        {/* TOP BAR */}
        <div className="flex items-center justify-between">
          <div className="text-lg font-bold" style={{ color: "#C9A84C" }}>
            STAFF MEETING ROOM
          </div>

          <button
            onClick={async () => {
              try {
                const res = await fetch("/api/run-team-member", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    member: "Julie",
                    input: "User initiated team call from meeting room",
                  }),
                });

                const data = await res.json();

                window.dispatchEvent(
                  new CustomEvent("team-response", { detail: data })
                );
              } catch (err) {
                console.error("CALL TEAM FAILED", err);
              }
            }}
            className="px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-wide"
            style={{
              color: "#C9A84C",
              backgroundColor: "#0D1B2E",
              border: "1px solid #1B2A4A",
            }}
          >
            CALL TEAM
          </button>
        </div>

        {/* RESPONSE FEED */}
        <div
          className="flex-1 overflow-y-auto rounded-xl border p-4 space-y-3"
          style={{
            backgroundColor: "#0D1B2E",
            borderColor: "#1B2A4A",
          }}
        >
          {responses.length === 0 && (
            <div style={{ color: "#8A9BB5" }}>
              No team responses yet.
            </div>
          )}

          {responses.map((r, i) => (
            <div
              key={i}
              className="p-3 rounded-lg"
              style={{
                backgroundColor: "#08111F",
                border: "1px solid #1B2A4A",
              }}
            >
              <div
                className="text-[10px] font-bold uppercase mb-1"
                style={{ color: "#C9A84C" }}
              >
                TEAM RESPONSE
              </div>
              <div style={{ color: "#F8FAFC", fontSize: "14px" }}>
                {JSON.stringify(r)}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
