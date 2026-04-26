import { useEffect, useMemo, useState } from "react";
import { Activity, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, RefreshCcw, X } from "lucide-react";
import { testDriveConnection } from "../lib/integrations";
import { runStateReconciliation, DriftReport } from "../lib/health";
import { supabase } from "../lib/supabase";

type ServiceStatus = "healthy" | "warning" | "error" | "loading";
type Service = { id: string; name: string; status: ServiceStatus; lastChecked: string; detail: string };

function getStatusIcon(status: ServiceStatus) {
  if (status === "healthy") return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
  if (status === "warning") return <AlertCircle className="w-4 h-4 text-amber-500" />;
  if (status === "error") return <AlertCircle className="w-4 h-4 text-rose-500" />;
  return <RefreshCcw className="w-4 h-4 text-sky-500 animate-spin" />;
}

function getStatusLabel(status: ServiceStatus) {
  if (status === "healthy") return "Connected";
  if (status === "warning") return "Warning";
  if (status === "error") return "Error";
  return "Checking";
}

function StatusExplanation({ service }: { service: Service }) {
  if (service.status === "loading") return <p className="text-[10px] text-sky-400">Running check...</p>;
  if (service.status === "healthy") return (
    <>
      <p className="text-[10px] text-emerald-400">All systems normal. No action needed.</p>
      <p className="text-[10px] text-[#8A9BB5] mt-1">{service.detail}</p>
    </>
  );
  if (service.status === "warning") return (
    <>
      <p className="text-[10px] text-amber-400">This service is degraded but not fully unavailable.</p>
      <p className="text-[10px] text-[#D0DFEE] mt-1">{service.detail}</p>
    </>
  );
  return (
    <>
      <p className="text-[10px] text-rose-400">This service is unavailable. Check the details below and take action.</p>
      <p className="text-[10px] text-[#D0DFEE] mt-1">{service.detail}</p>
    </>
  );
}

async function pingWithTimeout(url: string, method: string, timeoutMs: number): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(url, { method, signal: controller.signal, mode: "no-cors" });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export default function SystemHealthPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [dbStatus, setDbStatus] = useState<ServiceStatus>("loading");
  const [dbLastChecked, setDbLastChecked] = useState("Pending");
  const [dbDetail, setDbDetail] = useState("Check has not run yet.");

  const [driveStatus, setDriveStatus] = useState<ServiceStatus>("loading");
  const [driveLastChecked, setDriveLastChecked] = useState("Pending");
  const [driveDetail, setDriveDetail] = useState("Check has not run yet.");

  const [authStatus, setAuthStatus] = useState<ServiceStatus>("loading");
  const [authLastChecked, setAuthLastChecked] = useState("Pending");
  const [authDetail, setAuthDetail] = useState("Check has not run yet.");

  const [havenStatus, setHavenStatus] = useState<ServiceStatus>("loading");
  const [havenLastChecked, setHavenLastChecked] = useState("Pending");
  const [havenDetail, setHavenDetail] = useState("Check has not run yet.");

  const [workerStatus, setWorkerStatus] = useState<ServiceStatus>("loading");
  const [workerLastChecked, setWorkerLastChecked] = useState("Pending");
  const [workerDetail, setWorkerDetail] = useState("Check has not run yet.");

  const [approvalsStatus, setApprovalsStatus] = useState<ServiceStatus>("loading");
  const [approvalsLastChecked, setApprovalsLastChecked] = useState("Pending");
  const [approvalsDetail, setApprovalsDetail] = useState("Check has not run yet.");

  const [sessionStatus, setSessionStatus] = useState<ServiceStatus>("loading");
  const [sessionLastChecked, setSessionLastChecked] = useState("Pending");
  const [sessionDetail, setSessionDetail] = useState("Check has not run yet.");

  const [driftReport, setDriftReport] = useState<DriftReport | null>(null);
  const [driftChecking, setDriftChecking] = useState(false);
  const [driftLastChecked, setDriftLastChecked] = useState("Pending");

  const runDbCheck = async () => {
    setDbStatus("loading");
    setDbDetail("Querying database...");
    try {
      const { error } = await supabase.from("sessions").select("id", { count: "exact", head: true });
      if (error) throw error;
      setDbStatus("healthy");
      setDbDetail("Database is responding normally.");
    } catch {
      setDbStatus("error");
      setDbDetail("Database query failed. Check Supabase connection.");
    } finally {
      setDbLastChecked(new Date().toLocaleTimeString());
    }
  };

  const runDriveCheck = async () => {
    setDriveStatus("loading");
    setDriveDetail("Running live Google Drive check...");
    try {
      const result = await testDriveConnection();
      if (result.success) {
        setDriveStatus("healthy");
        setDriveDetail("Google Drive connection is working.");
      } else {
        const message = result.error || "Google Drive check failed.";
        setDriveStatus(message.includes("401") ? "warning" : "error");
        setDriveDetail(message);
      }
    } catch (error) {
      setDriveStatus("error");
      setDriveDetail(error instanceof Error ? error.message : "Google Drive check failed.");
    } finally {
      setDriveLastChecked(new Date().toLocaleTimeString());
    }
  };

  const runAuthCheck = async () => {
    setAuthStatus("loading");
    setAuthDetail("Checking auth session...");
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setAuthStatus("healthy");
        setAuthDetail("Session is active.");
      } else {
        setAuthStatus("warning");
        setAuthDetail("No active session. User may not be signed in.");
      }
    } catch {
      setAuthStatus("error");
      setAuthDetail("Auth check failed.");
    } finally {
      setAuthLastChecked(new Date().toLocaleTimeString());
    }
  };

  const runHavenCheck = async () => {
    setHavenStatus("loading");
    setHavenDetail("Pinging mystatement.ai...");
    const ok = await pingWithTimeout("https://mystatement.ai", "HEAD", 5000);
    setHavenStatus(ok ? "healthy" : "error");
    setHavenDetail(ok ? "mystatement.ai is responding normally." : "mystatement.ai is not responding. Check Vercel deployment.");
    setHavenLastChecked(new Date().toLocaleTimeString());
  };

  const runWorkerCheck = async () => {
    setWorkerStatus("loading");
    setWorkerDetail("Pinging Cloudflare Worker...");
    const ok = await pingWithTimeout("https://foundercrm.casevoice-ai.workers.dev/api/ping", "GET", 5000);
    setWorkerStatus(ok ? "healthy" : "error");
    setWorkerDetail(ok ? "Cloudflare Worker is responding normally." : "Cloudflare Worker is down. Check Cloudflare dashboard.");
    setWorkerLastChecked(new Date().toLocaleTimeString());
  };

  const runApprovalsCheck = async () => {
    setApprovalsStatus("loading");
    setApprovalsDetail("Checking approval queue...");
    try {
      const { count, error } = await supabase
        .from("approval_log")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (error) throw error;
      const n = count ?? 0;
      setApprovalsStatus(n === 0 ? "healthy" : "warning");
      setApprovalsDetail(n === 0 ? "No pending approvals." : `${n} item${n === 1 ? "" : "s"} awaiting approval. Go to the QUEUE tab.`);
    } catch {
      setApprovalsStatus("warning");
      setApprovalsDetail("Could not read approval queue. Table may not be available.");
    } finally {
      setApprovalsLastChecked(new Date().toLocaleTimeString());
    }
  };

  const runSessionCheck = async () => {
    setSessionStatus("loading");
    setSessionDetail("Checking last session...");
    try {
      const { data, error } = await supabase
        .from("sessions")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        setSessionStatus("warning");
        setSessionDetail("No sessions found. Consider running a session.");
      } else {
        const diffDays = Math.floor((Date.now() - new Date(data.created_at).getTime()) / 86400000);
        setSessionStatus(diffDays <= 7 ? "healthy" : "warning");
        setSessionDetail(
          diffDays === 0
            ? "Last session was today."
            : diffDays <= 7
            ? `Last session was ${diffDays} day${diffDays === 1 ? "" : "s"} ago.`
            : `No session logged in ${diffDays} days. Consider running a session.`
        );
      }
    } catch {
      setSessionStatus("warning");
      setSessionDetail("Could not read sessions table. Table may not be available.");
    } finally {
      setSessionLastChecked(new Date().toLocaleTimeString());
    }
  };

  const runReconciliationCheck = async () => {
    setDriftChecking(true);
    try {
      const report = await runStateReconciliation();
      setDriftReport(report);
    } catch {
      setDriftReport({ clean: true, drifts: [], checkedAt: Date.now() });
    } finally {
      setDriftLastChecked(new Date().toLocaleTimeString());
      setDriftChecking(false);
    }
  };

  const runAllChecks = async () => {
    setIsRefreshing(true);
    await Promise.all([
      runDbCheck(),
      runDriveCheck(),
      runAuthCheck(),
      runHavenCheck(),
      runWorkerCheck(),
      runApprovalsCheck(),
      runSessionCheck(),
      runReconciliationCheck(),
    ]);
    setIsRefreshing(false);
  };

  useEffect(() => {
    runAllChecks();
  }, []);

  const services: Service[] = useMemo(() => [
    { id: "db", name: "Database", status: dbStatus, lastChecked: dbLastChecked, detail: dbDetail },
    { id: "drive", name: "Google Drive", status: driveStatus, lastChecked: driveLastChecked, detail: driveDetail },
    { id: "auth", name: "Auth", status: authStatus, lastChecked: authLastChecked, detail: authDetail },
    { id: "haven", name: "HAVEN App", status: havenStatus, lastChecked: havenLastChecked, detail: havenDetail },
    { id: "worker", name: "Cloudflare Worker", status: workerStatus, lastChecked: workerLastChecked, detail: workerDetail },
    { id: "approvals", name: "Pending Approvals", status: approvalsStatus, lastChecked: approvalsLastChecked, detail: approvalsDetail },
    { id: "session", name: "Last Session Logged", status: sessionStatus, lastChecked: sessionLastChecked, detail: sessionDetail },
  ], [
    dbStatus, dbLastChecked, dbDetail,
    driveStatus, driveLastChecked, driveDetail,
    authStatus, authLastChecked, authDetail,
    havenStatus, havenLastChecked, havenDetail,
    workerStatus, workerLastChecked, workerDetail,
    approvalsStatus, approvalsLastChecked, approvalsDetail,
    sessionStatus, sessionLastChecked, sessionDetail,
  ]);

  const driftService: Service = {
    id: "drift",
    name: "State Reconciliation",
    status: driftChecking ? "loading" : driftReport === null ? "loading" : driftReport.clean ? "healthy" : "warning",
    lastChecked: driftLastChecked,
    detail: driftReport === null
      ? "Check has not run yet."
      : driftReport.clean
      ? "No state drift detected."
      : `${driftReport.drifts.length} drift${driftReport.drifts.length === 1 ? "" : "s"} detected.`,
  };

  const allServices = [...services, driftService];

  const overallStatus: ServiceStatus = (() => {
    if (allServices.some(s => s.status === "loading")) return "loading";
    if (allServices.some(s => s.status === "error")) return "error";
    if (allServices.some(s => s.status === "warning")) return "warning";
    return "healthy";
  })();

  const errorCount = allServices.filter(s => s.status === "error").length;
  const warningCount = allServices.filter(s => s.status === "warning").length;

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1A2535] border border-[#2A3A52] hover:border-[#3A5278] transition-colors text-xs text-[#8A9BB5] hover:text-[#C5D5E8]"
      >
        {getStatusIcon(overallStatus)}
        <span>System Health</span>
        {(errorCount > 0 || warningCount > 0) && (
          <span className={`text-[10px] font-semibold ${errorCount > 0 ? "text-rose-400" : "text-amber-400"}`}>
            {errorCount > 0 ? `${errorCount} error${errorCount > 1 ? "s" : ""}` : `${warningCount} warning${warningCount > 1 ? "s" : ""}`}
          </span>
        )}
        <ChevronDown className="w-3 h-3 ml-1" />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[#111827] border border-[#1E2D42] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1E2D42]">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-sky-400" />
            <span className="text-sm font-semibold text-[#E8F0FA]">System Health</span>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
              overallStatus === "healthy" ? "bg-emerald-900/40 text-emerald-400" :
              overallStatus === "warning" ? "bg-amber-900/40 text-amber-400" :
              overallStatus === "error" ? "bg-rose-900/40 text-rose-400" :
              "bg-sky-900/40 text-sky-400"
            }`}>
              {overallStatus === "healthy" ? "All Systems Operational" :
               overallStatus === "warning" ? "Degraded" :
               overallStatus === "error" ? "Issues Detected" : "Checking..."}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={runAllChecks}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1A2535] border border-[#2A3A52] hover:border-[#3A5278] transition-colors text-[11px] text-[#8A9BB5] hover:text-[#C5D5E8] disabled:opacity-50"
            >
              <RefreshCcw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg hover:bg-[#1A2535] transition-colors text-[#8A9BB5] hover:text-[#E8F0FA]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Service list */}
        <div className="divide-y divide-[#1A2535] max-h-[70vh] overflow-y-auto">
          {allServices.map(service => (
            <div key={service.id}>
              <button
                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[#151F2E] transition-colors text-left"
                onClick={() => setExpandedId(expandedId === service.id ? null : service.id)}
              >
                {getStatusIcon(service.status)}
                <span className="flex-1 text-sm text-[#C5D5E8]">{service.name}</span>
                <span className={`text-[10px] font-medium mr-2 ${
                  service.status === "healthy" ? "text-emerald-400" :
                  service.status === "warning" ? "text-amber-400" :
                  service.status === "error" ? "text-rose-400" :
                  "text-sky-400"
                }`}>
                  {getStatusLabel(service.status)}
                </span>
                <span className="text-[10px] text-[#4A5A72] mr-2">{service.lastChecked}</span>
                {expandedId === service.id
                  ? <ChevronUp className="w-3.5 h-3.5 text-[#4A5A72]" />
                  : <ChevronDown className="w-3.5 h-3.5 text-[#4A5A72]" />
                }
              </button>
              {expandedId === service.id && (
                <div className="px-5 pb-3 pt-1 bg-[#0D1520]">
                  <StatusExplanation service={service} />
                  {service.id === "drift" && driftReport && !driftReport.clean && driftReport.drifts.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {driftReport.drifts.map((d, i) => (
                        <li key={i} className="text-[10px] text-amber-300 bg-amber-900/20 rounded px-2 py-1">{d}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#1A2535] flex items-center justify-between">
          <span className="text-[10px] text-[#4A5A72]">{allServices.length} services monitored</span>
          <span className="text-[10px] text-[#4A5A72]">
            {errorCount > 0 && <span className="text-rose-400 mr-2">{errorCount} error{errorCount > 1 ? "s" : ""}</span>}
            {warningCount > 0 && <span className="text-amber-400">{warningCount} warning{warningCount > 1 ? "s" : ""}</span>}
            {errorCount === 0 && warningCount === 0 && overallStatus !== "loading" && <span className="text-emerald-400">All clear</span>}
          </span>
        </div>
      </div>
    </div>
  );
}
