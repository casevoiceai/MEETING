import { useEffect, useMemo, useState } from "react";
import { testDriveConnection } from "../lib/integrations";
import { ensureSupabaseSession } from "../lib/supabase";

type ServiceStatus = "Connected" | "Error" | "Warning";

type Service = {
  name: string;
  status: ServiceStatus;
  error: string;
  explanation: string;
  impact: string;
  steps: string[];
  prompt: string;
  severity: "Low" | "Medium" | "High";
  owner: string;
};

const DATABASE_SERVICE: Service = {
  name: "Database",
  status: "Connected",
  error: "None",
  explanation: "Database is responding normally.",
  impact: "Core data system is working.",
  steps: [],
  prompt: "",
  severity: "Low",
  owner: "Backend",
};

const AUTH_SERVICE: Service = {
  name: "Auth",
  status: "Warning",
  error: "Token aging",
  explanation: "Session token is aging.",
  impact: "May break integrations.",
  steps: ["Log out", "Log in again"],
  prompt: "Fix auth token aging issue",
  severity: "Medium",
  owner: "Auth",
};

function buildDriveService(state: {
  checking: boolean;
  success: boolean;
  error: string;
}): Service {
  if (state.checking) {
    return {
      name: "Google Drive",
      status: "Warning",
      error: "Checking connection...",
      explanation: "Testing Google Drive connection.",
      impact: "Refreshing status.",
      steps: [],
      prompt: "",
      severity: "Low",
      owner: "Integrations",
    };
  }

  if (state.success) {
    return {
      name: "Google Drive",
      status: "Connected",
      error: "None",
      explanation: "Connection succeeded.",
      impact: "Drive sync available.",
      steps: [],
      prompt: "",
      severity: "Low",
      owner: "Integrations",
    };
  }

  return {
    name: "Google Drive",
    status: "Error",
    error: state.error || "Connection failed",
    explanation: "Drive check failed.",
    impact: "Drive sync blocked.",
    steps: ["Re-run test"],
    prompt: "Fix Google Drive integration",
    severity: "High",
    owner: "Integrations",
  };
}

export default function SystemHealthPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>("Google Drive");

  const [driveChecking, setDriveChecking] = useState(false);
  const [driveSuccess, setDriveSuccess] = useState(false);
  const [driveError, setDriveError] = useState("Not checked yet");

  const runDriveCheck = async () => {
    console.error("[DRIVE] starting check");

    setDriveChecking(true);

    const session = await ensureSupabaseSession();

    if (!session?.access_token) {
      console.error("[DRIVE] no session, aborting");
      setDriveError("No auth session");
      setDriveChecking(false);
      return;
    }

    console.error("[DRIVE] session OK");

    const result = await testDriveConnection();

    if (result.success) {
      console.error("[DRIVE] success");
      setDriveSuccess(true);
      setDriveError("");
    } else {
      console.error("[DRIVE] failed", result.error);
      setDriveSuccess(false);
      setDriveError(result.error || "Unknown error");
    }

    setDriveChecking(false);
  };

  useEffect(() => {
    // DELAYED START instead of immediate fire
    const timer = setTimeout(() => {
      runDriveCheck();
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  const services = useMemo<Service[]>((() => {
    return [
      DATABASE_SERVICE,
      buildDriveService({
        checking: driveChecking,
        success: driveSuccess,
        error: driveError,
      }),
      AUTH_SERVICE,
    ];
  }), [driveChecking, driveSuccess, driveError]);

  const degraded =
    services.some((s) => s.status === "Error") ||
    services.some((s) => s.status === "Warning");

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#111D30] border border-[#1B2A4A] text-[#C9A84C]"
      >
        SYSTEM HEALTH
      </button>

      {isOpen && (
        <div className="fixed right-0 top-[60px] h-[calc(100vh-60px)] w-[360px] bg-[#0D1B2E] border-l border-[#1B2A4A] z-[1000] overflow-y-auto">
          <div className="p-4 border-b border-[#1B2A4A]">
            <span
              className={`text-[10px] px-2 py-0.5 rounded ${
                degraded
                  ? "bg-red-900/30 text-red-400"
                  : "bg-green-900/30 text-green-400"
              }`}
            >
              {degraded ? "Degraded" : "Healthy"}
            </span>
          </div>

          <div className="p-3">
            {services.map((s) => (
              <div key={s.name} className="border border-[#1B2A4A] rounded p-2 mb-2">
                <div className="flex justify-between">
                  <span>{s.name}</span>
                  <span>{s.status}</span>
                </div>

                {s.name === "Google Drive" && (
                  <button
                    onClick={runDriveCheck}
                    className="mt-2 text-xs border px-2 py-1"
                  >
                    Test connection again
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
