import { useEffect, useMemo, useState } from "react";
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

function StandbyScreen({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: { label: string; value: string }[];
}) {
  return (
    <div className="h-full w-full p-6 md:p-8" style={{ backgroundColor: "#08111F" }}>
      <div
        className="rounded-2xl border p-6 md:p-8"
        style={{
          backgroundColor: "#0D1B2E",
          borderColor: "#1B2A4A",
          color: "#F8FAFC",
        }}
      >
        <div className="mb-6">
          <div
            className="text-[12px] font-bold tracking-[0.22em] uppercase mb-3"
            style={{ color: "#C9A84C" }}
          >
            {title}
          </div>
          <div className="text-base md:text-lg font-semibold mb-2">
            {subtitle}
          </div>
          <div className="text-sm md:text-base" style={{ color: "#8BA4C2" }}>
            This section is now wired into the app shell and ready for real content.
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border p-4"
              style={{
                backgroundColor: "#08111F",
                borderColor: "#1B2A4A",
              }}
            >
              <div
                className="text-[11px] font-bold tracking-[0.18em] uppercase mb-2"
                style={{ color: "#C9A84C" }}
              >
                {item.label}
              </div>
              <div className="text-sm md:text-base" style={{ color: "#F8FAFC" }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SessionsScreen() {
  return (
    <StandbyScreen
      title="SESSIONS"
      subtitle="Session history and saved meeting records"
      items={[
        { label: "Status", value: "Shell is active" },
        { label: "Purpose", value: "View past meetings and saved session files" },
        { label: "Next Build", value: "Show real saved meetings from storage" },
        { label: "Current State", value: "No longer blank" },
      ]}
    />
  );
}

function EmailScreen() {
  return (
    <StandbyScreen
      title="EMAIL"
      subtitle="Outbound email workspace"
      items={[
        { label: "Status", value: "Shell is active" },
        { label: "Purpose", value: "Draft, review, and send team-driven email" },
        { label: "Next Build", value: "Wire Mailman output and send actions" },
        { label: "Current State", value: "No longer blank" },
      ]}
    />
  );
}

function TagsScreen() {
  return (
    <StandbyScreen
      title="TAGS"
      subtitle="Tag system for sorting work"
      items={[
        { label: "Status", value: "Shell is active" },
        { label: "Purpose", value: "Group items by topic, urgency, and owner" },
        { label: "Next Build", value: "Show tag filters tied to queue and sessions" },
        { label: "Current State", value: "No longer blank" },
      ]}
    />
  );
}

function ProjectsScreen() {
  return (
    <StandbyScreen
      title="PROJECTS"
      subtitle="Project tracking workspace"
      items={[
        { label: "Status", value: "Shell is active" },
        { label: "Purpose", value: "Track major company initiatives and workstreams" },
        { label: "Next Build", value: "Show project cards and linked queue items" },
        { label: "Current State", value: "No longer blank" },
      ]}
    />
  );
}

function IntegrationsScreen() {
  return (
    <StandbyScreen
      title="INTEGRATIONS"
      subtitle="Connected systems and service status"
      items={[
        { label: "Status", value: "Shell is active" },
        { label: "Purpose", value: "Show Supabase, Google Drive, and API connections" },
        { label: "Next Build", value: "Display live connection checks and repair tools" },
        { label: "Current State", value: "No longer blank" },
      ]}
    />
  );
}

function SourceOfTruthScreen() {
  return (
    <StandbyScreen
      title="SOURCE OF TRUTH"
      subtitle="Primary records and trusted operating data"
      items={[
        { label: "Status", value: "Shell is active" },
        { label: "Purpose", value: "Store the approved version of key facts and assets" },
        { label: "Next Build", value: "Link approved files, notes, and final decisions" },
        { label: "Current State", value: "No longer blank" },
      ]}
    />
  );
}

function RecoveryScreen() {
  return (
    <StandbyScreen
      title="RECOVERY"
      subtitle="Restore and fallback workspace"
      items={[
        { label: "Status", value: "Shell is active" },
        { label: "Purpose", value: "Hold rollback paths, backups, and emergency recovery steps" },
        { label: "Next Build", value: "Show restore actions and known safe baselines" },
        { label: "Current State", value: "No longer blank" },
      ]}
    />
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

  const mainOverflowClass = useMemo(() => {
    if (activeTab === "MEETING") return "overflow-hidden";
    if (activeTab === "QUEUE") return "overflow-y-auto";
    if (activeTab === "VAULT") return "overflow-y-auto";
    return "overflow-y-auto";
  }, [activeTab]);

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
              onClick={() => setActiveTab("QUEUE")}
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-wide"
              style={{
                color: "#C9A84C",
                backgroundColor:
                  activeTab === "QUEUE" ? "rgba(201,168,76,0.12)" : "rgba(201,168,76,0.06)",
                border: "1px solid rgba(201,168,76,0.22)",
              }}
            >
              APPROVAL REQUIRED
            </button>

            <button
              onClick={() => setActiveTab("RECOVERY")}
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-wide"
              style={{
                color: "#C9A84C",
                backgroundColor: activeTab === "RECOVERY" ? "#132845" : "#0D1B2E",
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

        {activeTab === "SESSIONS" && <SessionsScreen />}

        {activeTab === "EMAIL" && <EmailScreen />}

        {activeTab === "VAULT" && <VaultView />}

        {activeTab === "TAGS" && <TagsScreen />}

        {activeTab === "PROJECTS" && <ProjectsScreen />}

        {activeTab === "INTEGRATIONS" && <IntegrationsScreen />}

        {activeTab === "SOURCE OF TRUTH" && <SourceOfTruthScreen />}

        {activeTab === "RECOVERY" && <RecoveryScreen />}
      </main>

      <SystemReportsModal
        isOpen={reportsOpen}
        onClose={() => setReportsOpen(false)}
      />
    </div>
  );
}
