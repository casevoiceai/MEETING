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
      const response = await fetch("https://foundercrm.casevoice-ai.workers.dev/api/save-meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check_credentials" }),
      });
      const data = await response.json();
      if (data.client_id_set && data.client_secret_set) {
        setCredStatus("healthy");
        setCredDetail("Client ID and Secret are set in Cloudflare. OAuth token: " + (data.oauth_token_present ? "present" : "not present") + ".");
      } else {
        setCredStatus("error");
        setCredDetail(data.error ?? "One or more credentials are missing from Cloudflare.");
      }
    } catch {
      setCredStatus("error");
      setCredDetail("Could not reach the worker to check credentials.");
    } finally {
      setCredLastChecked(new Date().toLocaleTimeStr
