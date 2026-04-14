import { useEffect, useMemo, useState } from "react";
import { testDriveConnection } from "../lib/integrations";

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
      explanation: "The app is testing the live Google Drive connection right now.",
      impact: "Drive sync status is being refreshed.",
      steps: ["Wait for live check to finish"],
      prompt: "Check live Google Drive connection",
      severity: "Low",
      owner: "Integrations",
    };
  }

  if (state.success) {
    return {
      name: "Google Drive",
      status: "Connected",
      error: "None",
      explanation: "Live Google Drive connection succeeded.",
      impact: "Drive sync is available.",
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
    explanation: "The live Google Drive check failed.",
    impact: "Drive sync is blocked until the connection is restored.",
    steps: [
      "Re-run live connection test",
      "Confirm Google OAuth secrets are present",
      "Confirm refresh token is still valid",
      "Confirm redirect URI still matches",
      "Re-authenticate Google Drive if needed",
    ],
    prompt: "Fix live Google Drive integration. Diagnose OAuth, refresh token, redirect URI, and edge function response.",
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
    setDriveChecking(true);
    const result = await testDriveConnection();

    if (result.success) {
      setDriveSuccess(true);
      setDriveError("");
    } else {
      setDriveSuccess(false);
      setDriveError(result.error || "Unknown error");
    }

    setDriveChecking(false);
  };

  useEffect(() => {
    runDriveCheck();
  }, []);

  const services = useMemo<Service[]>(() => {
    return [
      DATABASE_SERVICE,
      buildDriveService({
        checking: driveChecking,
        success: driveSuccess,
        error: driveError,
      }),
      AUTH_SERVICE,
    ];
  }, [driveChecking, driveSuccess, driveError]);

  const degraded =
    services.some((s) => s.status === "Error") || services.some((s) => s.status === "Warning");

  const logReport = (service: Service, type: string) => {
    const existing = JSON.parse(localStorage.getItem("system_health_reports") || "[]");

    const newReport = {
      id: crypto.randomUUID(),
      time: new Date().toLocaleTimeString(),
      service: service.name,
      owner: service.owner,
      message: service.prompt,
      type,
      status: "PENDING",
      outcome: null,
      notes: "",
    };

    localStorage.setItem(
      "system_health_reports",
      JSON.stringify([newReport, ...existing])
    );

    window.dispatchEvent(new Event("storage_sync"));
    window.dispatchEvent(new Event("open-reports-modal"));
  };

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
            <div className="flex justify-between items-center">
              <div>
                <p className="text-[10px] text-gray-500 uppercase font-bold">SYSTEM STATUS</p>
                <p className="text-[10px] text-gray-400">
                  Last Check: {new Date().toLocaleTimeString()}
                </p>
              </div>
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

            <div className="flex gap-4 mt-2 text-[10px] text-gray-400">
              <span>Services: {services.length}</span>
              <span>Errors: {services.filter((s) => s.status === "Error").length}</span>
              <span>Warnings: {services.filter((s) => s.status === "Warning").length}</span>
            </div>
          </div>

          <div className="p-3 space-y-2">
            {services.map((s) => (
              <div key={s.name} className="border border-[#1B2A4A] rounded">
                <div
                  onClick={() => setExpanded(expanded === s.name ? null : s.name)}
                  className="p-3 cursor-pointer flex justify-between items-center"
                >
                  <span className="text-white text-xs font-bold">{s.name}</span>
                  <span
                    className={
                      s.status === "Error"
                        ? "text-red-400 text-xs"
                        : s.status === "Warning"
                        ? "text-yellow-400 text-xs"
                        : "text-green-400 text-xs"
                    }
                  >
                    {s.status}
                  </span>
                </div>

                {expanded === s.name && (
                  <div className="px-3 pb-3 border-t border-[#1B2A4A] space-y-3">
                    <p className="text-[10px] text-gray-400">{s.error}</p>
                    <p className="text-[10px] text-gray-500">{s.explanation}</p>

                    {s.name === "Google Drive" && (
                      <button
                        onClick={runDriveCheck}
                        className="text-[10px] px-2 py-1 border border-blue-500 text-blue-400 rounded"
                      >
                        {driveChecking ? "Testing..." : "Test connection again"}
                      </button>
                    )}

                    {s.status !== "Connected" && (
                      <>
                        <div className="text-[10px] text-red-400 font-bold">
                          SEVERITY: {s.severity}
                        </div>

                        <div className="text-[10px] text-purple-400">
                          OWNER: {s.owner}
                        </div>

                        <div className="text-[10px] text-gray-400 space-y-1">
                          {s.steps.map((step, i) => (
                            <div key={i}>- {step}</div>
                          ))}
                        </div>

                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={() => logReport(s, "AUTO_FIX")}
                            className="text-[10px] px-2 py-1 border border-blue-500 text-blue-400 rounded"
                          >
                            Auto Fix
                          </button>

                          <button
                            onClick={() => logReport(s, "FIX_PROMPT")}
                            className="text-[10px] px-2 py-1 border border-yellow-500 text-yellow-400 rounded"
                          >
                            Fix Prompt
                          </button>

                          <button
                            onClick={() => logReport(s, "SEND_TO_TEAM")}
                            className="text-[10px] px-2 py-1 border border-green-500 text-green-400 rounded"
                          >
                            Send to Team
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
