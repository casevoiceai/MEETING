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
      action: "Refresh session token and re-test integration",
      owner: "Auth",
      updatedAt: now,
    },
    {
      name: "Environment",
      status: "Warning",
      error: "Possible missing or mismatched env values",
      cause: "Config mismatch between client and server",
      action: "Verify all required environment variables",
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

Likely Cause:
${service.cause}

Suggested Action:
${service.action}

Owner:
${service.owner}

Your task:
1. Identify exact failure point
2. Provide exact file to edit
3. Provide exact code fix
4. List env variables to verify
5. Explain how to test fix`;
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
    const text = generatePrompt(service);
    try {
      await navigator.clipboard.writeText(text);
      alert("Fix prompt copied");
    } catch {
      alert(text);
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
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-widest text-gray-400">
                System Status
              </div>
              <div className="mt-1 text-sm font-semibold text-white">
                Last Check: {lastCheck}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                className="px-2 py-1 rounded text-xs font-bold"
                style={{
                  backgroundColor: "#1B2A4A",
                  color: "#C9A84C",
                }}
              >
                Refresh
              </button>

              <div
                className="px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-widest"
                style={{
                  backgroundColor: "rgba(255,255,255,0.04)",
                  border: `1px solid ${panelStateColor}55`,
                  color: panelStateColor,
                }}
              >
                {panelState}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div
              className="rounded-lg p-2"
              style={{
                backgroundColor: "rgba(255,255,255,0.03)",
                border: "1px solid #1B2A4A",
              }}
            >
              <div className="text-[10px] uppercase tracking-widest text-gray-400">
                Services
              </div>
              <div className="mt-1 text-sm font-semibold text-white">
                {services.length}
              </div>
            </div>

            <div
              className="rounded-lg p-2"
              style={{
                backgroundColor: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.25)",
              }}
            >
              <div className="text-[10px] uppercase tracking-widest text-red-300">
                Errors
              </div>
              <div className="mt-1 text-sm font-semibold text-red-200">
                {errorCount}
              </div>
            </div>

            <div
              className="rounded-lg p-2"
              style={{
                backgroundColor: "rgba(245,158,11,0.08)",
                border: "1px solid rgba(245,158,11,0.25)",
              }}
            >
              <div className="text-[10px] uppercase tracking-widest text-amber-300">
                Warnings
              </div>
              <div className="mt-1 text-sm font-semibold text-amber-200">
                {warningCount}
              </div>
            </div>
          </div>

          {services.map((service) => (
            <div
              key={service.name}
              className="border rounded-lg p-3"
              style={{ borderColor: "#1B2A4A" }}
            >
              <button
                type="button"
                className="w-full flex justify-between items-start text-left"
                onClick={() =>
                  setExpanded((current) =>
                    current === service.name ? null : service.name
                  )
                }
              >
                <div>
                  <div className="font-bold text-sm text-white">
                    {service.name}
                  </div>
                  <div
                    className="text-xs mt-1"
                    style={{ color: getStatusColor(service.status) }}
                  >
                    {service.status}
                  </div>
                  <div className="text-[11px] mt-1 text-gray-400">
                    {service.error}
                  </div>
                </div>

                <div className="text-xs text-gray-400">
                  {expanded === service.name ? "▲" : "▼"}
                </div>
              </button>

              {expanded === service.name && (
                <div className="mt-3 text-xs space-y-2 text-gray-300">
                  <div>
                    <b className="text-white">Exact Error:</b>{" "}
                    {service.error}
                  </div>
                  <div>
                    <b className="text-white">Likely Cause:</b>{" "}
                    {service.cause}
                  </div>
                  <div>
                    <b className="text-white">Suggested Action:</b>{" "}
                    {service.action}
                  </div>
                  <div>
                    <b className="text-white">Assigned Owner:</b>{" "}
                    {service.owner}
                  </div>
                  <div>
                    <b className="text-white">Last Updated:</b>{" "}
                    {service.updatedAt}
                  </div>

                  <button
                    onClick={() => handleCopy(service)}
                    className="mt-2 px-2 py-1 text-xs rounded"
                    style={{
                      backgroundColor: "#1B2A4A",
                      color: "#C9A84C",
                    }}
                  >
                    Copy Fix Prompt
                  </button>
                </div>
              )}
            </div>
          ))}

          <div
            className="border-t pt-3 mt-3 text-xs text-gray-400"
            style={{ borderColor: "#1B2A4A" }}
          >
            <div className="text-white font-semibold mb-1">
              Recent Errors
            </div>
            <div>10:14 — Google Drive failed</div>
            <div>10:12 — Retry success</div>
            <div>10:09 — Notion OK</div>
          </div>
        </div>
      )}
    </div>
  );
}
