import { useState } from "react";

type ServiceStatus = "Connected" | "Error" | "Warning";

type Service = {
  name: string;
  status: ServiceStatus;
  error: string;
  cause: string;
  action: string;
  owner: string;
  updatedAt: string;
  explanation: string;
  impact: string;
  steps: string[];
  prompt: string;
  severity: "Low" | "Medium" | "High";
};

function getNowLabel() {
  return new Date().toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildServices(): Service[] {
  const now = getNowLabel();

  return [
    {
      name: "Database",
      status: "Connected",
      error: "None",
      cause: "Healthy connection",
      action: "No action needed",
      owner: "Backend",
      updatedAt: now,
      explanation: "Database is responding normally.",
      impact: "Core data system is working.",
      steps: ["No action needed"],
      prompt: "Database OK",
      severity: "Low",
    },
    {
      name: "Google Drive",
      status: "Error",
      error: "Failed to fetch",
      cause: "Auth token issue or broken integration route",
      action: "Fix integration",
      owner: "Integrations",
      updatedAt: now,
      explanation:
        "The app tried to reach Google Drive but did not get a usable response.",
      impact: "Drive sync is blocked.",
      steps: [
        "Open Vercel project settings",
        "Check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET",
        "Confirm redirect URI matches",
        "Re-authenticate Google Drive connection",
        "Test connection again",
      ],
      prompt: `Issue: Google Drive integration failed with "Failed to fetch".

Current state:
- Database connected
- Google Drive failing
- Notion connected
- Sync queue connected
- Auth warning present
- Environment warning present

Likely causes:
- Google auth token issue
- Broken integration route
- Missing or incorrect environment variables
- Redirect URI mismatch

Your task:
1. Identify the exact root cause
2. Name the exact file or files to edit
3. Provide the exact code fix
4. List the exact environment variables to verify
5. Explain exactly how to test the fix`,
      severity: "High",
    },
    {
      name: "Notion",
      status: "Connected",
      error: "None",
      cause: "Healthy",
      action: "None",
      owner: "Docs",
      updatedAt: now,
      explanation: "Notion connection is working.",
      impact: "Docs sync is active.",
      steps: ["No action needed"],
      prompt: "Notion OK",
      severity: "Low",
    },
    {
      name: "Sync Queue",
      status: "Connected",
      error: "Empty",
      cause: "No jobs",
      action: "None",
      owner: "Ops",
      updatedAt: now,
      explanation: "No pending jobs.",
      impact: "System is idle.",
      steps: ["No action needed"],
      prompt: "Queue OK",
      severity: "Low",
    },
    {
      name: "Auth",
      status: "Warning",
      error: "Token may expire soon",
      cause: "Session aging",
      action: "Refresh session",
      owner: "Auth",
      updatedAt: now,
      explanation: "Your session is getting old.",
      impact: "Integrations may break soon.",
      steps: ["Log out", "Log back in", "Re-test integrations"],
      prompt: `Issue: Auth token may expire soon.

Current state:
- Session aging warning
- Connected services may fail if token expires

Your task:
1. Explain the likely auth issue
2. List the file or config area involved
3. Explain what needs to be refreshed
4. Explain how to test after re-auth`,
      severity: "Medium",
    },
    {
      name: "Environment",
      status: "Warning",
      error: "Env mismatch possible",
      cause: "Missing values",
      action: "Verify env",
      owner: "DevOps",
      updatedAt: now,
      explanation: "Environment variables may not match.",
      impact: "Some services may fail silently.",
      steps: [
        "Open Vercel environment settings",
        "Compare with local .env",
        "Add missing values",
        "Redeploy app",
      ],
      prompt: `Issue: Environment mismatch possible.

Current state:
- Some required environment values may be missing or inconsistent

Your task:
1. Identify likely missing or mismatched env variables
2. Explain where to verify them
3. Explain how to confirm the correct values
4. Explain how to redeploy and test`,
      severity: "Medium",
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

export default function SystemHealthPanel() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [services, setServices] = useState<Service[]>(buildServices());
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);

  const panelState = getPanelState(services);
  const panelStateColor = getPanelStateColor(panelState);
  const errorCount = services.filter((s) => s.status === "Error").length;
  const warningCount = services.filter((s) => s.status === "Warning").length;
  const lastCheck = services[0]?.updatedAt ?? getNowLabel();

  const handleRefresh = () => {
    setServices(buildServices());
  };

  return (
    <>
      <div className="relative">
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

              <div className="flex gap-2">
                <button
                  onClick={handleRefresh}
                  className="px-2 py-1 text-xs rounded"
                  style={{
                    backgroundColor: "#1B2A4A",
                    color: "#C9A84C",
                  }}
                >
                  Refresh
                </button>

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
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>Services: {services.length}</div>
              <div>Errors: {errorCount}</div>
              <div>Warnings: {warningCount}</div>
            </div>

            {services.map((s) => (
              <div key={s.name} className="border p-3 rounded" style={{ borderColor: "#1B2A4A" }}>
                <div
                  className="flex justify-between cursor-pointer"
                  onClick={() => setExpanded(expanded === s.name ? null : s.name)}
                >
                  <div>
                    <div className="text-white">{s.name}</div>
                    <div style={{ color: getStatusColor(s.status) }}>{s.status}</div>
                  </div>
                  <div>{expanded === s.name ? "▲" : "▼"}</div>
                </div>

                {expanded === s.name && (
                  <div className="mt-2 text-xs text-gray-300 space-y-2">
                    <div>{s.error}</div>
                    <div>{s.explanation}</div>
                    <div>{s.impact}</div>

                    <div
                      className="inline-block px-2 py-1 rounded text-[10px] font-bold uppercase"
                      style={{
                        border: `1px solid ${getSeverityColor(s.severity)}`,
                        color: getSeverityColor(s.severity),
                      }}
                    >
                      Severity: {s.severity}
                    </div>

                    <div className="text-yellow-300 font-bold">FIX STEPS:</div>
                    {s.steps.map((step, i) => (
                      <div key={i}>• {step}</div>
                    ))}

                    <button
                      onClick={() => setSelectedPrompt(s.prompt)}
                      className="mt-2 px-2 py-1 text-xs rounded"
                      style={{
                        backgroundColor: "#1B2A4A",
                        color: "#C9A84C",
                      }}
                    >
                      Open Fix Prompt
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedPrompt && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.7)", zIndex: 2000 }}
        >
          <div
            className="w-[500px] p-4 rounded-lg"
            style={{ backgroundColor: "#0D1B2E", border: "1px solid #1B2A4A" }}
          >
            <div className="text-white mb-2">Fix Prompt</div>
            <div className="text-xs text-gray-300 whitespace-pre-wrap mb-3">
              {selectedPrompt}
            </div>
            <button
              onClick={() => setSelectedPrompt(null)}
              className="px-3 py-1 text-xs rounded"
              style={{ backgroundColor: "#1B2A4A", color: "#C9A84C" }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
