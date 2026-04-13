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
    },
    {
      name: "Google Drive",
      status: "Error",
      error: "Failed to fetch",
      cause: "Auth token issue or broken integration route",
      action: "Check Google token, route, and environment values",
      owner: "Integrations",
      updatedAt: now,
    },
    {
      name: "Notion",
      status: "Connected",
      error: "None",
      cause: "Healthy connection",
      action: "No action needed",
      owner: "Docs",
      updatedAt: now,
    },
    {
      name: "Sync Queue",
      status: "Connected",
      error: "Empty",
      cause: "No jobs waiting",
      action: "No action needed",
      owner: "Ops",
      updatedAt: now,
    },
    {
      name: "Auth",
      status: "Warning",
      error: "Token may expire soon",
      cause: "Session aging",
      action: "Refresh session token",
      owner: "Auth",
      updatedAt: now,
    },
    {
      name: "Environment",
      status: "Warning",
      error: "Possible missing env values",
      cause: "Config mismatch",
      action: "Verify .env variables",
      owner: "DevOps",
      updatedAt: now,
    },
  ];
}

function getStatusColor(status: ServiceStatus) {
  if (status === "Error") return "#EF4444";
  if (status === "Warning") return "#F59E0B";
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

function generatePrompt(service: Service) {
  return `System Issue: ${service.name}

Status: ${service.status}
Error: ${service.error}
Cause: ${service.cause}
Action: ${service.action}

Return:
1. Root cause
2. File to edit
3. Code fix
4. Env checks
5. Test steps`;
}

export default function SystemHealthPanel() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [services, setServices] = useState<Service[]>(buildServices());

  const panelState = getPanelState(services);
  const panelStateColor = getPanelStateColor(panelState);
  const errorCount = services.filter((s) => s.status === "Error").length;
  const warningCount = services.filter((s) => s.status === "Warning").length;
  const lastCheck = services[0]?.updatedAt ?? getNowLabel();

  const handleRefresh = () => {
    setServices(buildServices());
  };

  const handleCopy = async (service: Service) => {
    try {
      await navigator.clipboard.writeText(generatePrompt(service));
    } catch {
      alert(generatePrompt(service));
    }
  };

  return (
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
                <div className="mt-2 text-xs text-gray-300 space-y-1">
                  <div>{s.error}</div>
                  <div>{s.cause}</div>
                  <button onClick={() => handleCopy(s)}>Copy Fix</button>
                </div>
              )}
            </div>
          ))}

          <div className="border-t pt-3 text-xs text-gray-400" style={{ borderColor: "#1B2A4A" }}>
            <div className="text-white">Recent Errors</div>
            <div>10:14 — Google Drive failed</div>
            <div>10:12 — Retry success</div>
          </div>
        </div>
      )}
    </div>
  );
}
