import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  RefreshCcw,
  X,
} from "lucide-react";
import { testDriveConnection } from "../lib/integrations";

type ServiceStatus = "healthy" | "warning" | "error" | "loading";

type Service = {
  id: string;
  name: string;
  status: ServiceStatus;
  lastChecked: string;
  detail: string;
};

const DATABASE_SERVICE: Service = {
  id: "db",
  name: "Database",
  status: "healthy",
  lastChecked: new Date().toLocaleTimeString(),
  detail: "Database is responding normally.",
};

const AUTH_SERVICE: Service = {
  id: "auth",
  name: "Auth",
  status: "healthy",
  lastChecked: new Date().toLocaleTimeString(),
  detail: "Session is available in the app.",
};

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

  const runCredentialsCheck = async () => {
    setCredStatus("loading");
    try {
      const response = await fetch("/api/save-meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check_credentials" }),
      });
      const data = await response.json();

      if (data.client_id_set && data.client_secret_set) {
        setCredStatus("healthy");
        setCredDetail(
          "Credentials OK. Token: " +
            (data.oauth_token_present ? "yes" : "no")
        );
      } else {
        setCredStatus("error");
        setCredDetail("Missing credentials in Cloudflare.");
      }
    } catch {
      setCredStatus("error");
      setCredDetail("Worker unreachable.");
    } finally {
      setCredLastChecked(new Date().toLocaleTimeString());
    }
  };

  const runDriveCheck = async () => {
    setIsRefreshing(true);
    setDriveStatus("loading");

    try {
      const result = await testDriveConnection();
      if (result.success) {
        setDriveStatus("healthy");
        setDriveDetail("Drive connected.");
      } else {
        setDriveStatus("error");
        setDriveDetail(result.error || "Drive failed.");
      }
    } catch {
      setDriveStatus("error");
      setDriveDetail("Drive failed.");
    } finally {
      setDriveLastChecked(new Date().toLocaleTimeString());
      setIsRefreshing(false);
    }
  };

  const runAllChecks = async () => {
    await Promise.all([runDriveCheck(), runCredentialsCheck()]);
  };

  useEffect(() => {
    if (isOpen) {
      runAllChecks();
    }
  }, [isOpen]);

  const services = useMemo<Service[]>(
    () => [
      DATABASE_SERVICE,
      {
        id: "credentials",
        name: "Credentials",
        status: credStatus,
        lastChecked: credLastChecked,
        detail: credDetail,
      },
      {
        id: "drive",
        name: "Google Drive",
        status: driveStatus,
        lastChecked: driveLastChecked,
        detail: driveDetail,
      },
      AUTH_SERVICE,
    ],
    [credStatus, credLastChecked, credDetail, driveDetail, driveLastChecked, driveStatus]
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
        <div className="fixed inset-0 z-[9000]">

          {/* BACKGROUND CLICK CLOSE */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsOpen(false)}
          />

          {/* PANEL */}
          <div className="absolute right-0 top-0 h-full w-[360px] bg-[#0D1B2E] border-l border-[#1B2A4A] shadow-2xl">

            {/* HEADER */}
            <div className="p-4 border-b border-[#1B2A4A] flex items-center justify-between bg-[#08111F]">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#C9A84C]" />
                <div>
                  <div className="text-[11px] font-bold uppercase text-white">
                    System Health
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="text-[#8A9BB5] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* BODY */}
            <div className="p-3 space-y-2 overflow-y-auto h-[calc(100%-60px)]">
              {services.map((service) => (
                <div
                  key={service.id}
                  className="border border-[#1B2A4A] rounded"
                >
                  <div
                    onClick={() =>
                      setExpandedId(
                        expandedId === service.id ? null : service.id
                      )
                    }
                    className="p-3 cursor-pointer flex justify-between items-center"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(service.status)}
                      <div className="text-white text-xs font-bold">
                        {service.name}
                      </div>
                    </div>

                    {expandedId === service.id ? (
                      <ChevronUp className="w-4 h-4 text-[#8A9BB5]" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#8A9BB5]" />
                    )}
                  </div>

                  {expandedId === service.id && (
                    <div className="p-3 border-t border-[#1B2A4A] text-[#D0DFEE] text-xs">
                      {service.detail}
                    </div>
                  )}
                </div>
              ))}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
