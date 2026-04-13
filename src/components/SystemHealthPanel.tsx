import { useEffect, useState } from "react";

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

function simulateHealthCheck(): Service[] {
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
      status: Math.random() > 0.5 ? "Error" : "Connected",
      error: Math.random() > 0.5 ? "Failed to fetch" : "OK",
      cause: "Auth token or API route issue",
      action: "Check Google token and integration route",
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
      action: "Refresh token",
      owner: "Auth",
      updatedAt: now,
    },
    {
      name: "Environment",
      status: "Warning",
      error: "Env mismatch possible",
      cause: "Config mismatch",
      action: "Verify environment variables",
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

function generatePrompt(service: Service) {
  return `System Issue: ${service.name}

Status: ${service.status}
Error: ${service.error}
Cause: ${service.cause}
Action: ${service.action}

Fix it.`;
}

export default function SystemHealthPanel() {
  const [open, setOpen] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setServices(simulateHealthCheck());
  }, []);

  const runCheck = () => {
    setServices(simulateHealthCheck());
  };

  const errorCount = services.filter((s) => s.status === "Error").length;
  const warningCount = services.filter((s) => s.status === "Warning").length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
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
            <div className="text-sm text-white">Live System Check</div>
            <button
              onClick={runCheck}
              className="px-2 py-1 text-xs rounded"
              style={{
                backgroundColor: "#1B2A4A",
                color: "#C9A84C",
              }}
            >
              Refresh
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>Services: {services.length}</div>
            <div>Errors: {errorCount}</div>
            <div>Warnings: {warningCount}</div>
          </div>

          {services.map((s) => (
            <div
              key={s.name}
              className="border rounded-lg p-3"
              style={{ borderColor: "#1B2A4A" }}
            >
              <div
                className="flex justify-between cursor-pointer"
                onClick={() =>
                  setExpanded(expanded === s.name ? null : s.name)
                }
              >
                <div>
                  <div className="text-white">{s.name}</div>
                  <div style={{ color: getStatusColor(s.status) }}>
                    {s.status}
                  </div>
                </div>
                <div>▼</div>
              </div>

              {expanded === s.name && (
                <div className="mt-2 text-xs text-gray-300">
                  <div>{s.error}</div>
                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(generatePrompt(s))
                    }
                  >
                    Copy Fix
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
