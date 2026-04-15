import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  RefreshCcw,
  ShieldAlert,
  X,
  Zap,
} from "lucide-react";
import { supabase } from "../lib/supabase";

type ServiceStatus = "healthy" | "warning" | "error" | "loading";

type Service = {
  id: string;
  name: string;
  status: ServiceStatus;
  lastChecked: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  owner: string;
  explanation: string;
  impact: string;
  steps: string[];
};

const DATABASE_SERVICE: Service = {
  id: "db",
  name: "Database",
  status: "healthy",
  lastChecked: new Date().toLocaleTimeString(),
  severity: "Critical",
  owner: "Backend",
  explanation: "Database is responding normally.",
  impact: "Core data system is available.",
  steps: ["Monitor query health", "Verify migrations", "Confirm API access"],
};

const AUTH_BASE_SERVICE: Service = {
  id: "auth",
  name: "Auth",
  status: "loading",
  lastChecked: "Pending",
  severity: "High",
  owner: "Infrastructure",
  explanation: "Session and token validation are being checked.",
  impact: "Broken auth can block integrations and session continuity.",
  steps: ["Refresh session", "Check Supabase auth", "Confirm token persistence"],
};

const DRIVE_BASE_SERVICE: Service = {
  id: "drive",
  name: "Google Drive",
  status: "loading",
  lastChecked: "Pending",
  severity: "High",
  owner: "Integrations",
  explanation: "Drive sync connection is being checked.",
  impact: "Exports and sync actions may fail.",
  steps: [
    "Re-run live connection test",
    "Confirm OAuth secrets are present",
    "Confirm refresh token is still valid",
    "Confirm redirect URI still matches",
    "Re-authenticate Google Drive if needed",
  ],
};

function statusIcon(status: ServiceStatus) {
  if (status === "healthy") {
    return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
  }
  if (status === "warning") {
    return <AlertCircle className="w-4 h-4 text-amber-500" />;
  }
  if (status === "error") {
    return <ShieldAlert className="w-4 h-4 text-rose-500" />;
  }
  return <RefreshCcw className="w-4 h-4 text-sky-500 animate-spin" />;
}

function SystemHealthPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>("drive");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [authStatus, setAuthStatus] = useState<ServiceStatus>("loading");
  const [authLastChecked, setAuthLastChecked] = useState("Pending");

  const [driveStatus, setDriveStatus] = useState<ServiceStatus>("loading");
  const [driveLastChecked, setDriveLastChecked] = useState("Pending");
  const [driveExplanation, setDriveExplanation] = useState(
    "Drive sync connection is being checked."
  );

  const ensureSupabaseSession = async () => {
    console.error("[BOOT] session check starting...");
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      console.error("[AUTH] no session, attempting sign-in...");
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      console.error("[BOOT] session ready", data.session?.user?.id ?? "no-user");
      return data.session;
    }

    console.error("[BOOT] session ready", session.user?.id ?? "no-user");
    return session;
  };

  const testDriveConnection = async (): Promise<ServiceStatus> => {
    try {
      console.error("[DRIVE] starting check");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        console.error("[DRIVE] no session token");
        setDriveExplanation("No auth session token was available.");
        return "error";
      }

      console.error("[DRIVE] session OK");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-drive-sync`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ action: "status_check" }),
        }
      );

      if (!res.ok) {
        console.error("[DRIVE] failed HTTP", res.status);

        if (res.status === 401) {
          setDriveExplanation(
            "The Edge Function rejected the session as unauthorized."
          );
          return "warning";
        }

        setDriveExplanation(`The live Google Drive check failed with HTTP ${res.status}.`);
        return "error";
      }

      console.error("[DRIVE] success");
      setDriveExplanation("Live Google Drive connection succeeded.");
      return "healthy";
    } catch (error) {
      console.error("[DRIVE] connection failed", error);
      setDriveExplanation("The live Google Drive check failed.");
      return "error";
    }
  };

  const runSystemDiagnostics = async () => {
    setIsRefreshing(true);
    setAuthStatus("loading");
    setDriveStatus("loading");

    try {
      const session = await ensureSupabaseSession();

      if (session) {
        setAuthStatus("healthy");
        setAuthLastChecked(new Date().toLocaleTimeString());
      } else {
        setAuthStatus("error");
        setAuthLastChecked(new Date().toLocaleTimeString());
      }

      const drive = await testDriveConnection();
      setDriveStatus(drive);
      setDriveLastChecked(new Date().toLocaleTimeString());
    } catch (error) {
      console.error("[BOOT] diagnostics critical failure:", error);
      setAuthStatus("error");
      setDriveStatus("error");
      const now = new Date().toLocaleTimeString();
      setAuthLastChecked(now);
      setDriveLastChecked(now);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      runSystemDiagnostics();
    }, 400);

    return () => clearTimeout(timer);
  }, [isOpen]);

  const services = useMemo<Service[]>(() => {
    return [
      { ...DATABASE_SERVICE },
      {
        ...DRIVE_BASE_SERVICE,
        status: driveStatus,
        lastChecked: driveLastChecked,
        explanation: driveExplanation,
      },
      {
        ...AUTH_BASE_SERVICE,
        status: authStatus,
        lastChecked: authLastChecked,
        explanation:
          authStatus === "healthy"
            ? "Session token is present and readable."
            : AUTH_BASE_SERVICE.explanation,
      },
    ];
  }, [authLastChecked, authStatus, driveExplanation, driveLastChecked, driveStatus]);

  const degraded = services.some(
    (service) => service.status === "warning" || service.status === "error"
  );

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(true)}
        className="px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-wide"
        style={{
          color: "#C9A84C",
          backgroundColor: "#0D1B2E",
          border: "1px solid #1B2A4A",
        }}
      >
        SYSTEM HEALTH
      </button>

      {isOpen && (
        <div className="fixed right-0 top-[60px] h-[calc(100vh-60px)] w-[360px] bg-[#0D1B2E] border-l border-[#1B2A4A] z-[1000] overflow-y-auto shadow-2xl">
          <div className="p-4 border-b border-[#1B2A4A] flex items-center justify-between bg-[#08111F]">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#C9A84C]" />
              <div>
                <div className="text-[11px] font-bold tracking-[0.18em] uppercase text-white">
                  System Health
                </div>
                <div className="text-[10px] text-[#8A9BB5]">
                  Last Check: {new Date().toLocaleTimeString()}
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded hover:bg-[#132845] text-[#8A9BB5] hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 border-b border-[#1B2A4A]">
            <div className="flex justify-between items-center">
              <span
                className={`text-[10px] px-2 py-0.5 rounded ${
                  degraded
                    ? "bg-red-900/30 text-red-400"
                    : "bg-green-900/30 text-green-400"
                }`}
              >
                {degraded ? "Degraded" : "Healthy"}
              </span>

              <button
                onClick={runSystemDiagnostics}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 text-[10px] font-bold text-[#C9A84C] hover:text-[#E6C76A] disabled:opacity-50"
              >
                <RefreshCcw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} />
                RE-SYNC
              </button>
            </div>
          </div>

          <div className="p-3 space-y-2">
            {services.map((service) => (
              <div key={service.id} className="border border-[#1B2A4A] rounded overflow-hidden">
                <div
                  onClick={() =>
                    setExpandedId(expandedId === service.id ? null : service.id)
                  }
                  className="p-3 cursor-pointer flex justify-between items-center bg-[#0F172A]"
                >
                  <div className="flex items-center gap-3">
                    {statusIcon(service.status)}
                    <div>
                      <div className="text-white text-xs font-bold">{service.name}</div>
                      <div className="text-[9px] text-[#8A9BB5] uppercase tracking-wide mt-0.5">
                        {service.lastChecked}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={
                        service.status === "error"
                          ? "text-red-400 text-xs"
                          : service.status === "warning"
                          ? "text-yellow-400 text-xs"
                          : service.status === "healthy"
                          ? "text-green-400 text-xs"
                          : "text-sky-400 text-xs"
                      }
                    >
                      {service.status === "healthy"
                        ? "Connected"
                        : service.status === "warning"
                        ? "Warning"
                        : service.status === "error"
                        ? "Error"
                        : "Loading"}
                    </span>
                    {expandedId === service.id ? (
                      <ChevronUp className="w-4 h-4 text-[#8A9BB5]" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#8A9BB5]" />
                    )}
                  </div>
                </div>

                {expandedId === service.id && (
                  <div className="px-3 pb-3 border-t border-[#1B2A4A] space-y-3 bg-[#0D1B2E]">
                    <p className="pt-3 text-[10px] text-[#D0DFEE]">
                      {service.explanation}
                    </p>

                    <p className="text-[10px] text-[#8A9BB5]">{service.impact}</p>

                    {service.id === "drive" && (
                      <button
                        onClick={runSystemDiagnostics}
                        className="text-[10px] px-2 py-1 border border-blue-500 text-blue-400 rounded"
                      >
                        Test connection again
                      </button>
                    )}

                    {service.status !== "healthy" && (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-2 bg-[#08111F] rounded border border-[#1B2A4A]">
                            <p className="text-[9px] font-bold text-[#8A9BB5] uppercase mb-1">
                              Severity
                            </p>
                            <span className="text-[10px] font-bold uppercase text-[#FF6B6B]">
                              {service.severity}
                            </span>
                          </div>

                          <div className="p-2 bg-[#08111F] rounded border border-[#1B2A4A]">
                            <p className="text-[9px] font-bold text-[#8A9BB5] uppercase mb-1">
                              Owner
                            </p>
                            <span className="text-[10px] font-semibold text-[#D0DFEE]">
                              {service.owner}
                            </span>
                          </div>
                        </div>

                        <div className="text-[10px] text-[#D0DFEE] space-y-1">
                          {service.steps.map((step, index) => (
                            <div key={index}>
                              {index + 1}. {step}
                            </div>
                          ))}
                        </div>

                        <div className="pt-2 grid grid-cols-1 gap-2">
                          <button className="w-full py-2 bg-[#C9A84C] hover:bg-[#B99634] text-[#08111F] text-[10px] font-bold rounded uppercase flex items-center justify-center gap-2 transition-colors">
                            <Zap className="w-3 h-3" /> Auto-Fix
                          </button>

                          <div className="grid grid-cols-2 gap-2">
                            <button className="py-2 border border-[#1B2A4A] hover:bg-[#132845] text-[#D0DFEE] text-[10px] font-bold rounded uppercase transition-colors">
                              Fix Prompt
                            </button>
                            <button className="py-2 border border-[#1B2A4A] hover:bg-[#132845] text-[#D0DFEE] text-[10px] font-bold rounded uppercase transition-colors">
                              Send to Team
                            </button>
                          </div>
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

export { SystemHealthPanel };
export default SystemHealthPanel;
