import { useState } from "react";
import { saveMeetingToDrive } from "../lib/integrations";
import { ensureSupabaseSession } from "../lib/supabase";

export default function StaffMeetingRoom() {
  const [status, setStatus] = useState<string>("Idle");

  return (
    <div
      style={{
        padding: "20px",
        background: "#0f172a",
        color: "white",
        height: "100vh",
      }}
    >
      <h1 style={{ fontSize: "24px", marginBottom: "20px" }}>
        Staff Meeting Room (TEST MODE)
      </h1>

      <div
        style={{
          padding: "15px",
          background: "#1e293b",
          borderRadius: "8px",
          marginBottom: "20px",
        }}
      >
        <p>Status: {status}</p>

        <button
          onClick={async () => {
            console.log("[Meeting] Save clicked");

            setStatus("Authenticating...");

            const session = await ensureSupabaseSession();

            if (!session?.access_token) {
              console.error("[Meeting] No Supabase session");
              setStatus("Auth failed");
              return;
            }

            console.log("[Meeting] Session OK:", session.user?.id);

            setStatus("Saving...");

            try {
              console.log("[Meeting] Calling Drive save");

              const result = await saveMeetingToDrive();

              console.log("[Meeting] Result:", result);

              if (result?.success) {
                setStatus("Saved successfully");
              } else {
                setStatus("Failed to save");
              }
            } catch (err) {
              console.error("[Meeting] Save failed:", err);
              setStatus("Save failed");
            }
          }}
          style={{
            padding: "12px 16px",
            background: "#2563eb",
            border: "none",
            borderRadius: "6px",
            color: "white",
            cursor: "pointer",
            marginTop: "10px",
          }}
        >
          Save Meeting → Google Drive
        </button>
      </div>

      <div
        style={{
          padding: "15px",
          background: "#020617",
          borderRadius: "8px",
        }}
      >
        <h2 style={{ marginBottom: "10px" }}>Fake Meeting Data</h2>

        <p>Julie: What are we building?</p>
        <p>Founder: A founder operating system.</p>
        <p>Scout: What competitors exist?</p>
        <p>(no answer yet)</p>
      </div>
    </div>
  );
}
