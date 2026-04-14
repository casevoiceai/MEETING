import { useState } from "react";

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

const SERVICES: Service[] = [
  {
    name: "Database",
    status: "Connected",
    error: "None",
    explanation: "Database is responding normally.",
    impact: "Core data system is working.",
    steps: [],
    prompt: "",
    severity: "Low",
    owner: "Backend",
  },
  {
    name: "Google Drive",
    status: "Error",
    error: "Failed to fetch",
    explanation: "The app tried to reach Google Drive but did not get a usable response.",
    impact: "Drive sync is blocked.",
    steps: [
      "Open Vercel project settings",
      "Check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET",
      "Confirm redirect URI matches",
      "Re-authenticate Google Drive connection",
      "Test connection again"
    ],
    prompt: "Fix Google Drive integration. Diagnose auth, route, env variables.",
    severity: "High",
    owner: "Integrations",
  },
  {
    name: "Auth",
    status: "Warning",
    error: "Token aging",
    explanation: "Session token is aging.",
    impact: "May break integrations.",
    steps: ["Log out", "Log in again"],
    prompt: "Fix auth token aging issue",
    severity: "Medium",
    owner: "Auth",
  },
];

export default function SystemHealthPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>("Google Drive");

  const logToVault = (service: Service, type: string) => {
    const existing = JSON.parse(localStorage.getItem("system_health_reports") || "[]");

    const newReport = {
      id: crypto.randomUUID(),
      time: new Date().toLocaleTimeString(),
      service: service.name,
      owner: service.owner,
      message: service.prompt,
      type,
    };

    localStorage.setItem(
      "system_health_reports",
      JSON.stringify([newReport, ...existing])
    );

    window.dispatchEvent(new Event("storage_sync"));
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

          {/* HEADER */}
          <div className="p-4 border-b border-[#1B2A4A]">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-[10px] text-gray-500 uppercase font-bold">SYSTEM STATUS</p>
                <p className="text-[10px] text-gray-400">Last Check: 4:31 PM</p>
              </div>
              <span className="text-[10px] bg-red-900/30 text-red-400 px-2 py-0.5 rounded">
                Degraded
              </span>
            </div>

            <div className="flex gap-4 mt-2 text-[10px] text-gray-400">
              <span>Services: {SERVICES.length}</span>
              <span>Errors: {SERVICES.filter(s => s.status === "Error").length}</span>
              <span>Warnings: {SERVICES.filter(s => s.status === "Warning").length}</span>
            </div>
          </div>

          {/* SERVICES */}
          <div className="p-3 space-y-2">
            {SERVICES.map((s) => (
              <div key={s.name} className="border border-[#1B2A4A] rounded">

                {/* ROW */}
                <div
                  onClick={() => setExpanded(expanded === s.name ? null : s.name)}
                  className="p-3 cursor-pointer flex justify-between items-center"
                >
                  <span className="text-white text-xs font-bold">{s.name}</span>
                  <span className={
                    s.status === "Error"
                      ? "text-red-400 text-xs"
                      : s.status === "Warning"
                      ? "text-yellow-400 text-xs"
                      : "text-green-400 text-xs"
                  }>
                    {s.status}
                  </span>
                </div>

                {/* EXPANDED */}
                {expanded === s.name && (
                  <div className="px-3 pb-3 border-t border-[#1B2A4A] space-y-3">

                    <p className="text-[10px] text-gray-400">
                      {s.error}
                    </p>

                    <p className="text-[10px] text-gray-500">
                      {s.explanation}
                    </p>

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
                            onClick={() => logToVault(s, "AUTO_FIX")}
                            className="text-[10px] px-2 py-1 border border-blue-500 text-blue-400 rounded"
                          >
                            Auto Fix
                          </button>

                          <button
                            onClick={() => logToVault(s, "FIX_PROMPT")}
                            className="text-[10px] px-2 py-1 border border-yellow-500 text-yellow-400 rounded"
                          >
                            Fix Prompt
                          </button>

                          <button
                            onClick={() => logToVault(s, "SEND_TO_TEAM")}
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
