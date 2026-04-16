import { useEffect, useState } from "react";
import StaffMeetingRoom from "./screens/StaffMeetingRoom";
import VaultView from "./screens/VaultView";
import BoysQueuePanel from "./components/BoysQueuePanel";
import SystemHealthPanel from "./components/SystemHealthPanel";
import SystemReportsModal from "./components/SystemReportsModal";

type MainTab =
  | "MEETING"
  | "PROJECTS"
  | "QUEUE"
  | "VAULT"
  | "EMAIL"
  | "HEALTH"
  | "OFFICE SUPPLIES";

const MAIN_TABS: MainTab[] = [
  "MEETING",
  "PROJECTS",
  "QUEUE",
  "VAULT",
  "EMAIL",
  "HEALTH",
  "OFFICE SUPPLIES",
];

function PlaceholderScreen({ title, description }: { title: string; description: string }) {
  return (
    <div className="h-full w-full p-8" style={{ backgroundColor: "#08111F" }}>
      <div
        className="rounded-xl border p-8 max-w-lg"
        style={{ backgroundColor: "#0D1B2E", borderColor: "#1B2A4A", color: "#8A9BB5" }}
      >
        <div
          className="text-[11px] font-bold tracking-[0.22em] uppercase mb-3"
          style={{ color: "#C9A84C" }}
        >
          {title}
        </div>
        <div className="text-sm leading-relaxed">{description}</div>
        <div
          className="mt-4 text-[10px] font-bold tracking-widest uppercase"
          style={{ color: "#3A4F6A" }}
        >
          Standing by. Not yet built.
        </div>
      </div>
    </div>
  );
}

function OfficeSuppliesScreen() {
  const tools = [
    { name: "INTEGRATIONS", desc: "Slack, Google Workspace, and external app connectors." },
    { name: "RECOVERY", desc: "Session recovery and conversation restore tools." },
    { name: "BACKUP", desc: "Supabase and Drive backup management." },
    { name: "SOURCE OF TRUTH", desc: "Canonical project and decision log." },
    { name: "SESSIONS", desc: "Historical session browser and archive." },
    { name: "TAGS", desc: "Global tag registry and cleanup tools." },
    { name: "AUDIT TOOLS", desc: "Legal-Sigma compliance audit utilities." },
    { name: "ANALYTICS", desc: "MyStatement.ai usage patterns and improvement signals." },
    { name: "EXPERIMENTS", desc: "Prototype tools and exploratory builds." },
  ];
  return (
    <div className="h-full w-full p-8 overflow-y-auto" style={{ backgroundColor: "#08111F" }}>
      <div
        className="mb-2 text-[11px] font-bold tracking-[0.22em] uppercase"
        style={{ color: "#C9A84C" }}
      >
        Office Supplies
      </div>
      <div className="mb-6 text-sm" style={{ color: "#3A4F6A" }}>
        Parked tools and future utilities. Nothing urgent lives here.
      </div>
      <div className="grid grid-cols-3 gap-4">
        {tools.map((t) => (
          <div
            key={t.name}
            className="rounded-xl border p-5"
            style={{ backgroundColor: "#0D1B2E", borderColor: "#1B2A4A", opacity: 0.65 }}
          >
            <div
              className="text-[10px] font-bold tracking-[0.18em] uppercase mb-2"
              style={{ color: "#8A9BB5" }}
            >
              {t.name}
            </div>
            <div className="text-xs leading-relaxed mb-3" style={{ color: "#3A4F6A" }}>
              {t.desc}
            </div>
            <div
              className="text-[9px] font-bold tracking-widest uppercase px-2 py-1 rounded inline-block"
              style={{ color: "#3A4F6A", border: "1px solid #1B2A4A" }}
            >
              NOT BUILT YET
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HealthScreen() {
  return (
    <div className="h-full w-full p-8 overflow-y-auto" style={{ backgroundColor: "#08111F" }}>
      <div
        className="mb-2 text-[11px] font-bold tracking-[0.22em] uppercase"
        style={{ color: "#C9A84C" }}
      >
        System Health
      </div>
      <div className="mb-6 text-sm" style={{ color: "#3A4F6A" }}>
        Open this when something smells wrong. Not a daily screen.
      </div>
      <SystemHealthPanel />
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

  const mainOverflowClass = activeTab === "MEETING" ? "overflow-hidden" : "overflow-y-auto";

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
            <nav className="flex items-center gap-1 min-w-0 overflow-x-auto pb-1">
              {MAIN_TABS.map((tab) => {
                const active = activeTab === tab;
                const isQueue = tab === "QUEUE";
                const isDim = tab === "HEALTH" || tab === "OFFICE SUPPLIES";
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className="px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 flex items-center gap-2"
                    style={
                      active
                        ? {
                            backgroundColor: "#132845",
                            color: "#F8FAFC",
                            border: "1px solid rgba(201,168,76,0.25)",
                          }
                        : isDim
                        ? {
                            backgroundColor: "transparent",
                            color: "#3A4F6A",
                            border: "1px solid transparent",
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
              onClick={() => setReportsOpen(true)}
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-wide"
              style={{
                color: "#8A9BB5",
                backgroundColor: "#0D1B2E",
                border: "1px solid #1B2A4A",
              }}
            >
              REPORTS
            </button>
          </div>
        </div>
      </header>

      <main className={`flex-1 ${mainOverflowClass}`}>
        {activeTab === "MEETING" && <StaffMeetingRoom />}
        {activeTab === "QUEUE" && (
          <BoysQueuePanel onPendingCountChange={setPendingCount} />
        )}
        {activeTab === "VAULT" && <VaultView />}
        {activeTab === "HEALTH" && <HealthScreen />}
        {activeTab === "OFFICE SUPPLIES" && <OfficeSuppliesScreen />}
        {activeTab === "PROJECTS" && (
          <PlaceholderScreen
            title="Projects"
            description="Active workbench. Drop a file, image, or note into the preview zone. Teammates light up based on what you dropped. One speaker at a time in the text window below. Full conversation saves to Vault. Not yet built."
          />
        )}
        {activeTab === "EMAIL" && (
          <PlaceholderScreen
            title="Email"
            description="Correspondence desk. Draft outreach, follow-ups, and partner emails. AI-assisted drafting via any team member. Templates and sent archive. Not yet built."
          />
        )}
      </main>

      <SystemReportsModal isOpen={reportsOpen} onClose={() => setReportsOpen(false)} />
    </div>
  );
}
