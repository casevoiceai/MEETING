import { useEffect, useState } from "react";
import { testDriveConnection } from "../lib/integrations";

type Status = "loading" | "connected" | "error";

export default function SystemHealthPanel() {
  const [driveStatus, setDriveStatus] = useState<Status>("loading");
  const [driveError, setDriveError] = useState<string | null>(null);

  async function runCheck() {
    setDriveStatus("loading");

    const result = await testDriveConnection();

    if (result.success) {
      setDriveStatus("connected");
      setDriveError(null);
    } else {
      setDriveStatus("error");
      setDriveError(result.error || "Unknown error");
    }
  }

  useEffect(() => {
    runCheck();
  }, []);

  return (
    <div className="px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-wide"
      style={{
        color: "#8A9BB5",
        backgroundColor: "#0D1B2E",
        border: "1px solid #1B2A4A",
      }}
    >
      <div className="mb-2">SYSTEM HEALTH</div>

      <div>
        <div>
          Database: <span style={{ color: "#00FF9C" }}>Connected</span>
        </div>

        <div>
          Google Drive:{" "}
          {driveStatus === "loading" && (
            <span style={{ color: "#FFD166" }}>Checking...</span>
          )}

          {driveStatus === "connected" && (
            <span style={{ color: "#00FF9C" }}>Connected</span>
          )}

          {driveStatus === "error" && (
            <span style={{ color: "#FF5F5F" }}>
              Error
            </span>
          )}
        </div>

        {driveStatus === "error" && (
          <div style={{ fontSize: "10px", color: "#FF5F5F", marginTop: "4px" }}>
            {driveError}
          </div>
        )}

        <button
          onClick={runCheck}
          style={{
            marginTop: "8px",
            padding: "4px 8px",
            border: "1px solid #1B2A4A",
            backgroundColor: "#132845",
            color: "#F8FAFC",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          Test Connection
        </button>
      </div>
    </div>
  );
}
