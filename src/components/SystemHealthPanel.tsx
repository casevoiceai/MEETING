import { useState, useEffect } from "react";

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
  autoFix: string[];
  owner: string;
};

type ActiveModal = "prompt" | "autofix" | "team" | null;

function getNowLabel() {
  return new Date().toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildServices(): Service[] {
  return [
    {
      name: "Database",
      status: "Connected",
      error: "None",
      explanation: "Database is responding normally.",
      impact: "Core data system is working.",
      steps: ["No action needed"],
      prompt: "Database OK",
      severity: "Low",
      autoFix: [],
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
        "Test connection again",
      ],
      prompt: "Fix Google Drive integration. Diagnose auth, route, env variables.",
      severity: "High",
      autoFix: [
        "Reset cached auth state",
        "Retry integration route",
        "Revalidate environment variables",
      ],
      owner: "Integrations",
    },
    {
      name: "Notion",
      status: "Connected",
      error: "None",
      explanation: "Notion connection is working.",
      impact: "Docs sync is active.",
      steps: ["No action needed"],
      prompt: "Notion OK",
      severity: "Low",
      autoFix: [],
      owner: "Integrations",
    },
    {
      name: "Sync Queue",
      status: "Connected",
      error: "Empty",
      explanation: "No pending jobs.",
      impact: "System is idle.",
      steps: ["No action needed"],
      prompt: "Queue OK",
      severity: "Low",
      autoFix: [],
      owner: "Backend",
    },
    {
      name: "Auth",
      status: "Warning",
      error: "Token may expire soon",
      explanation: "Session aging.",
      impact: "May break integrations.",
      steps: ["Log out", "Log in again"],
      prompt: "Fix auth token aging issue",
      severity: "Medium",
      autoFix: ["Refresh session token"],
      owner: "Auth",
    },
    {
      name: "Environment",
      status: "Warning",
      error: "Env mismatch possible",
      explanation: "Env mismatch.",
      impact: "Hidden failures possible.",
      steps: ["Check env", "Redeploy"],
      prompt: "Fix environment mismatch",
      severity: "Medium",
      autoFix: ["Reload env config"],
      owner: "DevOps",
    },
  ];
}

function getStatusColor(status: ServiceStatus) {
  if (status === "Error") return "#EF4444";
  if (status === "Warning") return "#F59E0B";
  return "#10B981";
}

function getSeverityColor(severity: "Low" | "Medium" | "High") {
  if (severity === "High") return "#EF4444";
  if (severity === "Medium") return "#F59E0B";
  return "#10B981";
}

function getOwnerColor(owner: string) {
  const map: Record<string, string> = {
    Backend: "#60A5FA",
    Integrations: "#C084FC",
    Auth: "#F59E0B",
    DevOps: "#34D399",
  };
  return map[owner] || "#94A3B8";
}

function getPanelState(services: Service[]) {
  if (services.some((s) => s.status === "Error")) return "Degraded";
  if (services.some((s) => s.status === "Warning")) return "Warning";
  return "Healthy";
}

function getPanelStateColor(state: string) {
  if (state === "Degraded") return "#EF4444";
  if (state === "Warning") return "#F59E0B";
  return "#10B981";
}

function logToVault(service: Service, type: "TEAM" | "PROMPT" | "AUTO_FIX") {
  const existing = localStorage.getItem("system_health_reports");
  const parsed = existing ? JSON.parse(existing) : [];

  const newReport = {
    id: `${service.name}-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    service: service.name,
    owner: service.owner,
    message: service.prompt,
    fixStatus: "Pending",
    notes: "",
    type,
  };

  const updated = [newReport, ...parsed];
  localStorage.setItem("system_health_reports", JSON.stringify(updated));
  // Dispatch event so other components know storage changed
  window.dispatchEvent(new Event("storage_update"));
}

export default function SystemHealthPanel() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [services] = useState<Service[]>(buildServices());
  const [modalType, setModalType] = useState<ActiveModal>(null);
  const [activeService, setActiveService] = useState<Service | null>(null);

  const panelState = getPanelState(services);
  const panelStateColor = getPanelStateColor(panelState);
  const errorCount = services.filter((s) => s.status === "Error").length;
  const warningCount = services.filter((s) => s.status === "Warning").length;
  const [lastCheck] = useState(getNowLabel());

  function closeModal() {
    setModalType(null);
    setActiveService(null);
  }

  function openPrompt(service: Service, e: React.MouseEvent) {
    e.stopPropagation();
    setActiveService(service);
    setModalType("prompt");
    logToVault(service, "PROMPT");
  }

  function openAutoFix(service: Service, e: React.MouseEvent) {
    e.stopPropagation();
    setActiveService(service);
    setModalType("autofix");
    logToVault(service, "AUTO_FIX");
  }

  function openTeam(service: Service, e: React.MouseEvent) {
    e.stopPropagation();
    setActiveService(service);
    setModalType("team");
    logToVault(service, "TEAM");
  }

  return (
    <>
      <div className="relative inline-block">
        <button
          onClick={() => setOpen((v) => !v)}
          className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest"
          style={{
            backgroundColor: "#111D30",
            border: "1px solid #1B2A4A",
            color: "#C9A84C",
          }}
        >
          System Health
        </button>

        {open && (
          <div
            className="fixed top-[70px] right-6 w-[440px] max-h-[80vh] overflow-y-auto rounded-xl p-4 space-y-3"
            style={{
              backgroundColor: "#0D1B2E",
              border: "1px solid #1B2A4A",
              boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
              zIndex: 1000,
            }}
          >
            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs text-gray-400">SYSTEM STATUS</div>
                <div className="text-sm text-white">Last Check: {lastCheck}</div>
              </div>

              <div
                className="px-2 py-1 text-xs font-bold rounded"
                style={{
                  border: `1px solid ${panelStateColor}`,
                  color: panelStateColor,
                }}
              >
                {panelState}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs text-gray-400">
              <div>Services: {services.length}</div>
              <div>Errors: {errorCount}</div>
              <div>Warnings: {warningCount}</div>
            </div>

            {services.map((s) => (
              <div
                key={s.name}
                className="border p-3 rounded"
                style={{ borderColor: "#1B2A4A" }}
              >
                <div
                  className="flex justify-between cursor-pointer"
                  onClick={() => setExpanded(expanded === s.name ? null : s.name)}
                >
                  <div>
                    <div className="text-white font-medium">{s.name}</div>
                    <div style={{ color: getStatusColor(s.status) }}>{s.status}</div>
                  </div>
                  <div className="text-gray-500">{expanded === s.name ? "▲" : "▼"}</div>
                </div>

                {expanded === s.name && (
                  <div className="mt-2 text-xs text-gray-300 space-y-2">
                    <div className="text-red-400">{s.error}</div>
                    <div>{s.explanation}</div>
                    <div className="italic">{s.impact}</div>

                    <div className="flex gap-2 flex-wrap">
                      <div
                        className="px-2 py-1 rounded text-[10px] font-bold uppercase"
                        style={{
                          border: `1px solid ${getSeverityColor(s.severity)}`,
                          color: getSeverityColor(s.severity),
                        }}
                      >
                        {s.severity}
                      </div>

                      <div
                        className="px-2 py-1 rounded text-[10px] font-bold uppercase"
                        style={{
                          border: `1px solid ${getOwnerColor(s.owner)}`,
                          color: getOwnerColor(s.owner),
                        }}
                      >
                        {s.owner}
                      </div>
                    </div>

                    <div className="text-yellow-300 font-bold pt-1">FIX STEPS:</div>
                    {s.steps.map((step, i) => (
                      <div key={i} className="pl-2">• {step}</div>
                    ))}

                    <div className="flex gap-2 mt-3">
                      {s.autoFix.length > 0 && (
                        <button
                          onClick={(e) => openAutoFix(s, e)}
                          className="px-2 py-1 text-xs rounded border border-[#60A5FA] bg-[#1B2A4A] text-[#60A5FA]"
                        >
                          Auto Fix
                        </button>
                      )}
                      <button
                        onClick={(e) => openPrompt(s, e)}
                        className="px-2 py-1 text-xs rounded border border-[#C9A84C] bg-[#1B2A4A] text-[#C9A84C]"
                      >
                        Fix Prompt
                      </button>
                      <button
                        onClick={(e) => openTeam(s, e)}
                        className="px-2 py-1 text-xs rounded border border-[#34D399] bg-[#1B2A4A] text-[#34D399]"
                      >
                        Send to Team
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {modalType && activeService && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.85)", zIndex: 9999 }}
          onClick={closeModal}
        >
          <div
            className="w-[520px] p-6 rounded-lg shadow-2xl"
            style={{ backgroundColor: "#0D1B2E", border: "1px solid #1B2A4A" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xl text-white mb-4 font-bold border-b border-[#1B2A4A] pb-2">
              {modalType === "prompt" ? "Fix Prompt" : modalType === "autofix" ? "Auto Fix Attempt" : "Team Message"}
            </div>
            
            <div className="text-sm text-gray-300 leading-relaxed">
              {modalType === "prompt" && activeService.prompt}
              {modalType === "autofix" && (
                <div className="space-y-2">
                  <div className="text-white font-bold">{activeService.name}</div>
                  {activeService.autoFix.map((step, i) => <div key={i}>• {step}</div>)}
                </div>
              )}
              {modalType === "team" && `@${activeService.owner} FIX NEEDED:\n\n${activeService.prompt}`}
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm font-bold rounded bg-[#1B2A4A] text-[#C9A84C]"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
