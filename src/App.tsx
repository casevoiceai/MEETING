import { useEffect, useState } from "react";
import StaffMeetingRoom from "./screens/StaffMeetingRoom";
import VaultView from "./screens/VaultView";
import BoysQueuePanel from "./components/BoysQueuePanel";
import SystemHealthPanel from "./components/SystemHealthPanel";
import SystemReportsModal from "./components/SystemReportsModal";

type MainTab =
  | "MEETING"
  | "QUEUE"
  | "SESSIONS"
  | "EMAIL"
  | "VAULT"
  | "TAGS"
  | "PROJECTS"
  | "INTEGRATIONS"
  | "SOURCE OF TRUTH"
  | "RECOVERY";

const MAIN_TABS: MainTab[] = [
  "MEETING",
  "QUEUE",
  "SESSIONS",
  "EMAIL",
  "VAULT",
  "TAGS",
  "PROJECTS",
  "INTEGRATIONS",
  "SOURCE OF TRUTH",
  "RECOVERY",
];

function PlaceholderScreen({ title }: { title: string }) {
  return (
    <div className="h-full w-full p-8" style={{ backgroundColor: "#08111F" }}>
      <div
        className="rounded-xl border p-8"
        style={{
          backgroundColor: "#0D1B2E",
          borderColor: "#1B2A4A",
          color: "#8A9BB5",
        }}
      >
        <div className="text-[11px] font-bold tracking-[0.22em] uppercase mb-3">
          {title}
        </div>
        <div className="text-sm">This section is standing by.</div>
      </div>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<MainTab>("MEETING");
  const [reportsOpen, setReportsOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const openReports = () => setReportsOpen(true);
    window.addEventListener("open-reports-modal", openReports);
    return () => window.removeEventListener("open-reports-modal", openReports);
  }, []);

  const mainOverflowClass =
    activeTab === "MEETING" ? "overflow-hidden" : "overflow-y-auto";

  return (
    <div
      className="h-screen flex flex-col"
      style={{
        backgroundColor: "#08111F",
        color: "#FFFFFF",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <header
        className="relative z-[200] flex-shrink-0 border-b"
        style={{ borderColor: "#1B2A4A", backgroundColor: "#08111F" }}
      >
        <div className="px-5 h-[58px] flex items-center justify-between gap-4">
          <div className="flex items-center gap-6 min-w-0 flex-1 overflow-hidden">
            <div
              className="text-sm font-bold tracking-wide whitespace-nowrap flex-shrink-0"
              style={{ color: "#C9A84C" }}
            >
             FOUNDER CRM
            </div>
            <nav className="flex items-center gap-2 min-w-0 overflow-x-auto pb-1">
              {MAIN_TABS.map((tab) => {
                const active = activeTab === tab;
                const isQueue = tab === "QUEUE";
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className="px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all flex-shrink-0 flex items-center gap-2"
                    style={
                      active
                        ? {
                            backgroundColor: "#132845",
                            color: "#F8FAFC",
                            border: "1px solid rgba(201,168,76,0.25)",
                          }
                        : {
                            backgroundColor: "transparent",
                            color: "#8A9BB5",
                            border: "1px solid transparent",
                          }
                    }
                  >
                    {tab}
                    {isQueue && pendingCount > 0 && (
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{
                          backgroundColor: "rgba(245,158,11,0.25)",
                          color: "#F59E0B",
                        }}
                      >
                        {pendingCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-wide"
              style={{
                color: "#C9A84C",
                backgroundColor: "rgba(201,168,76,0.06)",
                border: "1px solid rgba(201,168,76,0.22)",
              }}
            >
              APPROVAL REQUIRED
            </button>
            <button
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-wide"
              style={{
                color: "#C9A84C",
                backgroundColor: "#0D1B2E",
                border: "1px solid #1B2A4A",
              }}
            >
              BACKUP
            </button>
            <button
              onClick={() => setReportsOpen(true)}
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-wide"
              style={{
                color: "#FF5F5F",
                backgroundColor: "#0D1B2E",
                border: "1px solid rgba(255,95,95,0.28)",
              }}
            >
              REPORTS
            </button>
            <SystemHealthPanel />
          </div>
        </div>
      </header>
      <main className={`flex-1 ${mainOverflowClass}`}>
        {activeTab === "MEETING" && (
          <StaffMeetingRoom sessionId={null} sessionKey={null} />
        )}
        {activeTab === "QUEUE" && (
          <BoysQueuePanel onPendingCountChange={setPendingCount} />
        )}
        {activeTab === "VAULT" && <VaultView />}
        {!["MEETING", "QUEUE", "VAULT"].includes(activeTab) && (
          <PlaceholderScreen title={activeTab} />
        )}
      </main>
      <SystemReportsModal
        isOpen={reportsOpen}
        onClose={() => setReportsOpen(false)}
      />
    </div>
  );
}
