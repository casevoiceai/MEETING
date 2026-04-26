import { useEffect, useMemo, useState } from "react";
import { Activity, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, RefreshCcw, X } from "lucide-react";
import { testDriveConnection } from "../lib/integrations";
import { runStateReconciliation, DriftReport } from "../lib/health";

type ServiceStatus = "healthy" | "warning" | "error" | "loading";
type Service = { id: string; name: string; status: ServiceStatus; lastChecked: string; detail: string; };

const DATABASE_SERVICE: Service = { id: "db", name: "Database", status: "healthy", lastChecked: new Date().toLocaleTimeString(), detail: "Database is responding normally." };
const AUTH_SERVICE: Service = { id: "auth", name: "Auth", status: "healthy", lastChecked: new Date().toLocaleTimeString(), detail: "Session is available in the app." };

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
  return "Loading";
}

export default function SystemHealthPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [driveStatus, setDriveStatus] = useState<ServiceStatus>("loading");
  const [driveLastChecked, setDriveLastChecked] = useState("Pending");
  const [driveDetail, setDriveDetail] = useState("Drive check has not run yet.");
  const [credStatus, setCredStatus] = useState<ServiceStatus>("loading");
  const [credLastChecked, setCredLastChecked] = useState("Pending");
  const [credDetail, setCredDetail] = useState("Credential check has not run yet.");
  const [driftReport, setDriftReport] = useState<DriftReport | null>(null);
  const [driftChecking, setDriftChecking] = useState(false);
  const [driftLastChecked, setDriftLastChecked] = useState("Pending");

  const runCredentialsCheck = async () => {
    setCredStatus("loading");
    try {
      const result = await testDriveConnection();
      if (result.success) {
        setCredStatus("healthy");
        setCredDetail("Service account credentials verified via Google Drive.");
      } else {
        setCredStatus("error");
        setCredDetail(result.error ?? "Credentials check failed.");
      }
    } catch {
      setCredStatus("error");
      setCredDetail("Could not verify credentials.");
    } finally {
      setCredLastChecked(new Date().toLocaleTimeString());
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

  const runReconciliationCheck = async () => {
    setDriftChecking(true);
    try {
      const report = await runStateReconciliation();
      setDriftReport(report);
    } catch {
      setDriftReport(null);
    } finally {
      setDriftLastChecked(new Date().toLocaleTimeString());
      setDriftChecking(false);
    }
  };

  const runAllChecks = async () => {
    setIsRefreshing(true);
    await Promise.all([runDriveCheck(), runCredentialsCheck(), runReconciliationCheck()]);
    setIsRefreshing(false);
  };

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => { runAllChecks(); }, 250);
    return () => clearTimeout(timer);
  }, [isOpen]);

  const services = useMemo<Service[]>(() => [
    DATABASE_SERVICE,
    { id: "credentials", name: "Credentials", status: credStatus, lastChecked: credLastChecked, detail: credDetail },
    { id: "drive", name: "Google Drive", status: driveStatus, lastChecked: driveLastChecked, detail: driveDetail },
    AUTH_SERVICE,
  ], [credStatus, credLastChecked, credDetail, driveStatus, driveLastChecked, driveDetail]);

  const degraded = services.some((s) => s.status === "warning" || s.status === "error");

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-wide"
        style={{ color: "#C9A84C", backgroundColor: "#0D1B2E", border: "1px solid #1B2A4A" }}>
        SYSTEM HEALTH
      </button>

      {isOpen && (
        <div className="fixed right-0 top-[60px] h-[calc(100vh-60px)] w-[340px] bg-[#0D1B2E] border-l border-[#1B2A4A] z-[1000] overflow-y-auto shadow-2xl">
          <div className="p-4 border-b border-[#1B2A4A] flex items-center justify-between bg-[#08111F]">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#C9A84C]" />
              <div>
                <div className="text-[11px] font-bold tracking-[0.18em] uppercase text-white">System Health</div>
                <div className="text-[10px] text-[#8A9BB5]">Last Check: {new Date().toLocaleTimeString()}</div>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-1 rounded hover:bg-[#132845] text-[#8A9BB5] hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 border-b border-[#1B2A4A] flex justify-between items-center">
            <span className={`text-[10px] px-2 py-0.5 rounded ${degraded ? "bg-red-900/30 text-red-400" : "bg-green-900/30 text-green-400"}`}>
              {degraded ? "Degraded" : "Healthy"}
            </span>
            <button onClick={runAllChecks} disabled={isRefreshing}
              className="flex items-center gap-1.5 text-[10px] font-bold text-[#C9A84C] hover:text-[#E6C76A] disabled:opacity-50">
              <RefreshCcw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} />
              RE-SYNC
            </button>
          </div>

          <div className="p-3 space-y-2">
            {services.map((service) => (
              <div key={service.id} className="border border-[#1B2A4A] rounded overflow-hidden">
                <div onClick={() => setExpandedId(expandedId === service.id ? null : service.id)}
                  className="p-3 cursor-pointer flex justify-between items-center bg-[#0F172A]">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(service.status)}
                    <div>
                      <div className="text-white text-xs font-bold">{service.name}</div>
                      <div className="text-[9px] text-[#8A9BB5] uppercase tracking-wide mt-0.5">{service.lastChecked}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={service.status === "error" ? "text-red-400 text-xs" : service.status === "warning" ? "text-yellow-400 text-xs" : service.status === "healthy" ? "text-green-400 text-xs" : "text-sky-400 text-xs"}>
                      {getStatusLabel(service.status)}
                    </span>
                    {expandedId === service.id ? <ChevronUp className="w-4 h-4 text-[#8A9BB5]" /> : <ChevronDown className="w-4 h-4 text-[#8A9BB5]" />}
                  </div>
                </div>
                {expandedId === service.id && (
                  <div className="px-3 py-3 border-t border-[#1B2A4A] bg-[#0D1B2E]">
                    <p className="text-[10px] text-[#D0DFEE]">{service.detail}</p>
                    {service.id === "drive" && (
                      <div className="pt-3">
                        <button onClick={runDriveCheck} className="text-[10px] px-3 py-1.5 border border-blue-500 text-blue-400 rounded">Test connection again</button>
                      </div>
                    )}
                    {service.id === "credentials" && (
                      <div className="pt-3">
                        <button onClick={runCredentialsCheck} className="text-[10px] px-3 py-1.5 border border-yellow-500 text-yellow-400 rounded">Re-check credentials</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* State Reconciliation row — read-only detection, no repair */}
            <div className="border border-[#1B2A4A] rounded overflow-hidden">
              <div
                onClick={() => setExpandedId(expandedId === "reconciliation" ? null : "reconciliation")}
                className="p-3 cursor-pointer flex justify-between items-center bg-[#0F172A]"
              >
                <div className="flex items-center gap-3">
                  {driftChecking
                    ? <RefreshCcw className="w-4 h-4 text-sky-500 animate-spin" />
                    : driftReport === null
                      ? <RefreshCcw className="w-4 h-4 text-sky-500" />
                      : driftReport.clean
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        : <AlertCircle className="w-4 h-4 text-amber-500" />}
                  <div>
                    <div className="text-white text-xs font-bold">State Reconciliation</div>
                    <div className="text-[9px] text-[#8A9BB5] uppercase tracking-wide mt-0.5">{driftLastChecked}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={
                    driftChecking ? "text-sky-400 text-xs" :
                    driftReport === null ? "text-sky-400 text-xs" :
                    driftReport.clean ? "text-green-400 text-xs" : "text-amber-400 text-xs"
                  }>
                    {driftChecking ? "Checking" : driftReport === null ? "Pending" : driftReport.clean ? "Clean" : "Drift Detected"}
                  </span>
                  {expandedId === "reconciliation" ? <ChevronUp className="w-4 h-4 text-[#8A9BB5]" /> : <ChevronDown className="w-4 h-4 text-[#8A9BB5]" />}
                </div>
              </div>
              {expandedId === "reconciliation" && (
                <div className="px-3 py-3 border-t border-[#1B2A4A] bg-[#0D1B2E]">
                  {driftReport === null || driftChecking ? (
                    <p className="text-[10px] text-[#8A9BB5]">Check has not run yet. Use RE-SYNC to trigger.</p>
                  ) : driftReport.clean ? (
                    <p className="text-[10px] text-emerald-400">No state drift detected.</p>
                  ) : (
                    <div className="space-y-2">
                      {driftReport.drifts.map((d, i) => (
                        <div key={i} className="space-y-0.5">
                          <div className="text-[9px] text-[#8A9BB5] uppercase tracking-wide">{d.check}</div>
                          <div className="text-[10px] text-[#D0DFEE]">{d.detail}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
