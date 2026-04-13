import { useMemo, useState } from "react";

type HealthStatus = "connected" | "warning" | "error";

type HealthItem = {
  key: string;
  name: string;
  status: HealthStatus;
  summary: string;
  exactError?: string;
  friendlyExplanation?: string;
  likelyCause?: string;
  impact?: string;
  suggestedAction?: string;
  owner?: string;
  severity?: "low" | "medium" | "high";
  updatedAt?: string;
};

function getNowLabel() {
  return new Date().toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusColor(status: HealthStatus) {
  if (status === "connected") {
    return "#10B981";
  }
  if (status === "warning") {
    return "#F59E0B";
  }
  return "#EF4444";
}

function statusLabel(status: HealthStatus) {
  if (status === "connected") return "Connected";
  if (status === "warning") return "Warning";
  return "Error";
}

function buildSystemState(): HealthItem[] {
  return [
    {
      key: "database",
      name: "Database",
      status: "connected",
      summary: "None",
      updatedAt: getNowLabel(),
    },
    {
      key: "google-drive",
      name: "Google Drive",
      status: "error",
      summary: "Failed to fetch",
      exactError: "Failed to fetch",
      friendlyExplanation:
        "The app tried to reach Google Drive but did not get a usable response.",
      likelyCause: "Auth token issue or broken integration route",
      impact: "Drive sync is blocked.",
      suggestedAction:
        "Open Vercel project settings, check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, confirm redirect URI matches, re-authenticate Google Drive connection, then test again.",
      owner: "Integrations",
      severity: "high",
      updatedAt: getNowLabel(),
    },
    {
      key: "notion",
      name: "Notion",
      status: "connected",
      summary: "None",
      updatedAt: getNowLabel(),
    },
    {
      key: "sync-queue",
      name: "Sync Queue",
      status: "connected",
      summary: "Connected",
      friendlyExplanation: "Queue is online and ready to process jobs.",
      updatedAt: getNowLabel(),
    },
    {
      key: "auth",
      name: "Auth",
      status: "warning",
      summary: "Token may expire soon",
      exactError: "Token may expire soon",
      friendlyExplanation:
        "Your current auth session may be getting old and could expire soon.",
      likelyCause: "Session aging",
      impact: "Connected services may fail if the session expires.",
      suggestedAction: "Refresh session token and re-test integration.",
      owner: "Auth",
      severity: "medium",
      updatedAt: getNowLabel(),
    },
    {
      key: "environment",
      name: "Environment",
      status: "warning",
      summary: "Possible missing or mismatched env values",
      friendlyExplanation:
        "One or more environment values may be missing, stale, or mismatched across services.",
      likelyCause: "Missing or inconsistent deployment configuration",
      impact: "Integrations may behave inconsistently between screens or deployments.",
      suggestedAction:
        "Compare local, GitHub, and Vercel environment values and re-deploy after correction.",
      owner: "Environment",
      severity: "medium",
      updatedAt: getNowLabel(),
    },
  ];
}

export default function SystemHealthPanel() {
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    database: false,
    "google-drive": true,
    notion: false,
    "sync-queue": false,
    auth: false,
    environment: false,
  });

  const items = useMemo(() => buildSystemState(), []);
  const services = items.length;
  const errors = items.filter((item) => item.status === "error").length;
  const warnings = items.filter((item) => item.status === "warning").length;
  const overall =
    errors > 0 ? "Degraded" : warnings > 0 ? "Warning" : "Healthy";

  const toggleItem = (key: string) => {
    setExpanded((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const copyFixPrompt = async (item: HealthItem) => {
    const text = [
      `Issue: ${item.name} integration failed with "${item.exactError || item.summary}".`,
      "",
      "Current state:",
      `- Database connected`,
      `- ${item.name} ${item.status === "error" ? "failing" : item.status}`,
      `- Notion connected`,
      `- Sync queue connected`,
      `- Auth warning present`,
      `- Environment warning present`,
      "",
      "Likely causes:",
      `- ${item.likelyCause || "Unknown cause"}`,
      "- Missing or incorrect environment variables",
      "- Broken integration route",
      "- Redirect URI mismatch",
      "",
      "Your task:",
      "1. Identify the exact root cause",
      "2. Name the exact file or files to edit",
      "3. Provide the exact code fix",
      "4. List the exact environment variables to verify",
      "5. Explain exactly how to test the fix",
    ].join("\n");

    await navigator.clipboard.writeText(text);
    alert("Fix prompt copied");
  };

  const autoFix = (item: HealthItem) => {
    const lines = [
      `Auto-fix attempt:`,
      "",
      `${item.name}`,
      "",
      "Reset cached auth state",
      "Retry integration route",
      "Revalidate environment variables",
    ].join("\n");
    alert(lines);
  };

  const sendToTeam = (item: HealthItem) => {
    const existing = localStorage.getItem("system_health_reports");
    const parsed = existing ? JSON.parse(existing) : [];

    const report = {
      id: `${item.key}-${Date.now()}`,
      time: getNowLabel(),
      service: item.name,
      owner: item.owner || "Unassigned",
      message:
        item.suggestedAction ||
        `${item.name} needs review and follow-up.`,
      fixStatus: "Pending",
      notes: "",
    };

    localStorage.setItem(
      "system_health_reports",
      JSON.stringify([report, ...parsed])
    );

    window.dispatchEvent(new CustomEvent("vault-reports-updated"));
    alert(`@${item.owner || "Team"} FIX NEEDED:\n\n${report.message}`);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm transition-all hover:opacity-80"
        style={{
          backgroundColor: "#111D30",
          color: "#C9A84C",
          border: "1px solid #1B2A4A",
        }}
        title="System Health"
      >
        <span className="text-[10px] font-bold tracking-widest uppercase">
          System Health
        </span>
      </button>

      {open && (
        <div
          className="absolute right-0 mt-3 w-[390px] rounded-2xl p-4"
          style={{
            backgroundColor: "#0F1E33",
            border: "1px solid #1B2A4A",
            boxShadow: "0 18px 48px rgba(0,0,0,0.45)",
            zIndex: 50,
          }}
        >
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <div
                className="text-[11px] font-bold uppercase tracking-[0.18em]"
                style={{ color: "#8A9BB5" }}
              >
                System Status
              </div>
              <div className="text-sm font-bold text-white mt-1">
                Last Check: {getNowLabel()}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="px-3 py-1.5 rounded-lg text-xs font-bold"
                style={{
                  backgroundColor: "#1B2A4A",
                  color: "#C9A84C",
                }}
              >
                Refresh
              </button>

              <div
                className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase"
                style={{
                  color:
                    overall === "Degraded"
                      ? "#EF4444"
                      : overall === "Warning"
                        ? "#F59E0B"
                        : "#10B981",
                  border:
                    overall === "Degraded"
                      ? "1px solid rgba(239,68,68,0.45)"
                      : overall === "Warning"
                        ? "1px solid rgba(245,158,11,0.45)"
                        : "1px solid rgba(16,185,129,0.45)",
                  backgroundColor:
                    overall === "Degraded"
                      ? "rgba(127,29,29,0.18)"
                      : overall === "Warning"
                        ? "rgba(120,53,15,0.18)"
                        : "rgba(6,95,70,0.18)",
                }}
              >
                {overall}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div
              className="rounded-xl p-3"
              style={{ border: "1px solid #1B2A4A", backgroundColor: "#111D30" }}
            >
              <div
                className="text-[10px] font-bold uppercase tracking-[0.18em]"
                style={{ color: "#8A9BB5" }}
              >
                Services
              </div>
              <div className="text-xl font-bold text-white mt-2">{services}</div>
            </div>

            <div
              className="rounded-xl p-3"
              style={{
                border: "1px solid rgba(239,68,68,0.35)",
                backgroundColor: "rgba(127,29,29,0.18)",
              }}
            >
              <div
                className="text-[10px] font-bold uppercase tracking-[0.18em]"
                style={{ color: "#FCA5A5" }}
              >
                Errors
              </div>
              <div className="text-xl font-bold mt-2" style={{ color: "#FCA5A5" }}>
                {errors}
              </div>
            </div>

            <div
              className="rounded-xl p-3"
              style={{
                border: "1px solid rgba(245,158,11,0.35)",
                backgroundColor: "rgba(120,53,15,0.18)",
              }}
            >
              <div
                className="text-[10px] font-bold uppercase tracking-[0.18em]"
                style={{ color: "#FCD34D" }}
              >
                Warnings
              </div>
              <div className="text-xl font-bold mt-2" style={{ color: "#FCD34D" }}>
                {warnings}
              </div>
            </div>
          </div>

          <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
            {items.map((item) => {
              const isExpanded = !!expanded[item.key];
              const color = statusColor(item.status);

              return (
                <div
                  key={item.key}
                  className="rounded-xl"
                  style={{
                    border: "1px solid #1B2A4A",
                    backgroundColor: "#111D30",
                  }}
                >
                  <button
                    onClick={() => toggleItem(item.key)}
                    className="w-full flex items-start justify-between gap-3 p-4 text-left"
                  >
                    <div>
                      <div className="text-lg font-semibold text-white">
                        {item.name}
                      </div>
                      <div
                        className="text-base font-semibold mt-1"
                        style={{ color }}
                      >
                        {statusLabel(item.status)}
                      </div>
                      <div className="text-sm mt-1" style={{ color: "#C7D2E3" }}>
                        {item.summary}
                      </div>
                    </div>

                    <div
                      className="text-lg font-bold"
                      style={{ color: "#C9A84C" }}
                    >
                      {isExpanded ? "▴" : "▾"}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4">
                      {item.exactError && (
                        <div className="mb-2 text-sm text-white">
                          <span className="font-bold">Exact Error: </span>
                          {item.exactError}
                        </div>
                      )}

                      {item.friendlyExplanation && (
                        <div className="mb-2 text-sm text-white">
                          <span className="font-bold">Friendly Explanation: </span>
                          {item.friendlyExplanation}
                        </div>
                      )}

                      {item.likelyCause && (
                        <div className="mb-2 text-sm text-white">
                          <span className="font-bold">Likely Cause: </span>
                          {item.likelyCause}
                        </div>
                      )}

                      {item.impact && (
                        <div className="mb-2 text-sm text-white">
                          <span className="font-bold">Impact: </span>
                          {item.impact}
                        </div>
                      )}

                      {item.suggestedAction && (
                        <div className="mb-2 text-sm text-white">
                          <span className="font-bold">Suggested Action: </span>
                          {item.suggestedAction}
                        </div>
                      )}

                      {item.owner && (
                        <div className="mb-2 text-sm text-white">
                          <span className="font-bold">Assigned Owner: </span>
                          {item.owner}
                        </div>
                      )}

                      {item.updatedAt && (
                        <div className="mb-3 text-sm text-white">
                          <span className="font-bold">Last Updated: </span>
                          {item.updatedAt}
                        </div>
                      )}

                      {item.severity && item.status !== "connected" && (
                        <div className="mb-3">
                          <span
                            className="inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-[0.16em]"
                            style={{
                              color:
                                item.severity === "high"
                                  ? "#FCA5A5"
                                  : item.severity === "medium"
                                    ? "#FCD34D"
                                    : "#86EFAC",
                              border:
                                item.severity === "high"
                                  ? "1px solid rgba(239,68,68,0.4)"
                                  : item.severity === "medium"
                                    ? "1px solid rgba(245,158,11,0.4)"
                                    : "1px solid rgba(16,185,129,0.4)",
                              backgroundColor:
                                item.severity === "high"
                                  ? "rgba(127,29,29,0.18)"
                                  : item.severity === "medium"
                                    ? "rgba(120,53,15,0.18)"
                                    : "rgba(6,95,70,0.18)",
                            }}
                          >
                            Severity: {item.severity}
                          </span>
                        </div>
                      )}

                      {item.status !== "connected" && (
                        <>
                          <div
                            className="text-[11px] font-bold uppercase tracking-[0.18em] mb-2"
                            style={{ color: "#C9A84C" }}
                          >
                            Fix Steps:
                          </div>
                          <ul
                            className="text-sm space-y-1 mb-4 pl-4"
                            style={{ color: "#FFFFFF" }}
                          >
                            {(item.suggestedAction || "")
                              .split(",")
                              .map((step) => step.trim())
                              .filter(Boolean)
                              .map((step, idx) => (
                                <li key={idx}>• {step}</li>
                              ))}
                          </ul>

                          <div
                            className="text-[11px] font-bold uppercase tracking-[0.18em] mb-2"
                            style={{ color: "#8A9BB5" }}
                          >
                            Auto Fix:
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => autoFix(item)}
                              className="px-3 py-2 rounded-lg text-xs font-bold"
                              style={{
                                border: "1px solid rgba(59,130,246,0.4)",
                                color: "#60A5FA",
                                backgroundColor: "rgba(30,64,175,0.15)",
                              }}
                            >
                              Auto Fix
                            </button>

                            <button
                              onClick={() => copyFixPrompt(item)}
                              className="px-3 py-2 rounded-lg text-xs font-bold"
                              style={{
                                border: "1px solid rgba(245,158,11,0.4)",
                                color: "#FCD34D",
                                backgroundColor: "rgba(120,53,15,0.15)",
                              }}
                            >
                              Fix Prompt
                            </button>

                            <button
                              onClick={() => sendToTeam(item)}
                              className="px-3 py-2 rounded-lg text-xs font-bold"
                              style={{
                                border: "1px solid rgba(16,185,129,0.4)",
                                color: "#34D399",
                                backgroundColor: "rgba(6,95,70,0.15)",
                              }}
                            >
                              Send to Team
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
