import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Shield, Download } from "lucide-react";
import StaffMeetingRoom from "./screens/StaffMeetingRoom";
import SessionsView from "./screens/SessionsView";
import VaultView from "./screens/VaultView";
import TagsView from "./screens/TagsView";
import ProjectsView from "./screens/ProjectsView";
import GlobalSearch from "./screens/GlobalSearch";
import EmailView from "./screens/EmailView";
import IntegrationsView from "./screens/IntegrationsView";
import SourceOfTruthPanel from "./components/SourceOfTruthPanel";
import CriticalPathPanel from "./components/CriticalPathPanel";
import {
  getOrCreateSession,
  loadSession,
  type Session,
  type SearchResult,
  type LinkableType,
} from "./lib/db";
import { getPendingCount } from "./lib/approval";
import { getLastBackupLog, isBackupOverdue } from "./lib/criticalPath";
import OfflineStatusBar from "./components/OfflineStatusBar";
import SystemHealthPanel from "./components/SystemHealthPanel";
import BackupExportModal from "./components/BackupExportModal";
import { ensureSupabaseSession } from "./lib/supabase";
import SystemReportsModal from "./components/SystemReportsModal";

type View =
  | "meeting"
  | "sessions"
  | "vault"
  | "tags"
  | "projects"
  | "email"
  | "integrations"
  | "source-of-truth"
  | "recovery";

const NAV_ITEMS: { id: View; label: string }[] = [
  { id: "meeting", label: "Meeting" },
  { id: "sessions", label: "Sessions" },
  { id: "email", label: "Email" },
  { id: "vault", label: "Vault" },
  { id: "tags", label: "Tags" },
  { id: "projects", label: "Projects" },
  { id: "integrations", label: "Integrations" },
  { id: "source-of-truth", label: "Source of Truth" },
  { id: "recovery", label: "Recovery" },
];

function NavButton({
  active,
  onClick,
  children,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  badge?: number;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative px-5 py-2.5 text-sm font-bold tracking-wider uppercase rounded-lg transition-all"
      style={
        active
          ? {
              backgroundColor: "#1B2A4A",
              color: "#C9A84C",
              border: "1px solid rgba(201,168,76,0.3)",
            }
          : hovered
            ? {
                color: "#C9A84C",
                border: "1px solid rgba(201,168,76,0.15)",
                backgroundColor: "rgba(201,168,76,0.04)",
              }
            : { color: "#8A9BB5", border: "1px solid transparent" }
      }
    >
      {children}
      {badge != null && badge > 0 && (
        <span
          className="absolute -top-1 -right-1 text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center"
          style={{ backgroundColor: "#F59E0B", color: "#0D1B2E" }}
        >
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </button>
  );
}

export default function App() {
  const [view, setView] = useState<View>("meeting");
  const [session, setSession] = useState<Session | null>(null);
  const [sessionKey, setSessionKey] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [linkedNavTarget, setLinkedNavTarget] = useState<{
    type: LinkableType;
    id: string;
  } | null>(null);
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
  const [backupOverdue, setBackupOverdue] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function boot() {
      try {
        await ensureSupabaseSession();
        const s = await getOrCreateSession();

        if (!isMounted) return;

        setSession(s);
        setSessionKey(s.session_key);
      } catch (error) {
        console.error("App bootstrap failed:", error);
      }
    }

    boot();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    getPendingCount().then(setPendingApprovalCount).catch(() => {});
    pollRef.current = setInterval(() => {
      getPendingCount().then(setPendingApprovalCount).catch(() => {});
    }, 15000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    getLastBackupLog()
      .then((log) => setBackupOverdue(isBackupOverdue(log)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    }

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  const handleOpenSession = useCallback(async (key: string) => {
    try {
      await ensureSupabaseSession();
      const result = await loadSession(key);

      if (result) {
        setSession(result.session);
        setSessionKey(key);
      }

      setView("meeting");
    } catch (error) {
      console.error("Failed to open session:", error);
    }
  }, []);

  const handleSearchNavigate = useCallback(
    (type: SearchResult["type"], _id: string) => {
      const viewMap: Record<SearchResult["type"], View> = {
        file: "vault",
        note: "vault",
        tag: "tags",
        session: "sessions",
        project: "projects",
      };

      setView(viewMap[type]);
      setSearchOpen(false);
    },
    []
  );

  const handleLinkedNavigation = useCallback((type: LinkableType, id: string) => {
    const viewMap: Record<LinkableType, View> = {
      file: "vault",
      note: "vault",
      tag: "tags",
      session: "sessions",
      project: "projects",
    };

    setLinkedNavTarget({ type, id });
    setView(viewMap[type]);
  }, []);

  const renderView = () => {
    if (view === "meeting") {
      return <StaffMeetingRoom sessionId={session?.id ?? null} sessionKey={sessionKey} />;
    }

    if (view === "sessions") {
      return (
        <SessionsView
          onOpenSession={handleOpenSession}
          onNavigateLinked={handleLinkedNavigation}
          linkedTarget={linkedNavTarget?.type === "session" ? linkedNavTarget.id : undefined}
        />
      );
    }

    if (view === "email") {
      return <EmailView onPendingChange={setPendingApprovalCount} />;
    }

    if (view === "vault") {
      return (
        <VaultView
          onNavigateLinked={handleLinkedNavigation}
          linkedTarget={
            linkedNavTarget?.type === "file" || linkedNavTarget?.type === "note"
              ? linkedNavTarget
              : undefined
          }
        />
      );
    }

    if (view === "tags") {
      return (
        <TagsView
          onNavigateLinked={handleLinkedNavigation}
          linkedTarget={linkedNavTarget?.type === "tag" ? linkedNavTarget.id : undefined}
        />
      );
    }

    if (view === "projects") {
      return (
        <ProjectsView
          onNavigateLinked={handleLinkedNavigation}
          linkedTarget={linkedNavTarget?.type === "project" ? linkedNavTarget.id : undefined}
        />
      );
    }

    if (view === "integrations") {
      return <IntegrationsView onPendingChange={setPendingApprovalCount} />;
    }

    if (view === "source-of-truth") {
      return <SourceOfTruthPanel sessionKey={sessionKey} />;
    }

    return <CriticalPathPanel />;
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: "#0D1B2E", color: "#FFFFFF" }}
    >
      <div
        className="sticky top-0 z-40 border-b"
        style={{
          backgroundColor: "rgba(13,27,46,0.95)",
          borderColor: "#1B2A4A",
          backdropFilter: "blur(8px)",
        }}
      >
        <div className="px-4 md:px-6 py-3 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="text-xs md:text-sm font-black tracking-[0.25em] uppercase whitespace-nowrap"
                style={{ color: "#C9A84C" }}
              >
                MyStatement_AI
              </div>

              <div className="hidden md:flex items-center gap-1.5 overflow-x-auto">
                {NAV_ITEMS.map((item) => (
                  <NavButton
                    key={item.id}
                    active={view === item.id}
                    onClick={() => setView(item.id)}
                    badge={item.id === "email" ? pendingApprovalCount : undefined}
                  >
                    {item.label}
                  </NavButton>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-3 flex-wrap justify-end">
              <button
                onClick={() => setBackupOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm transition-all hover:opacity-80"
                style={{
                  backgroundColor: backupOverdue ? "rgba(245,158,11,0.12)" : "#111D30",
                  color: backupOverdue ? "#F59E0B" : "#C9A84C",
                  border: backupOverdue
                    ? "1px solid rgba(245,158,11,0.35)"
                    : "1px solid rgba(201,168,76,0.22)",
                }}
                title="Backup"
              >
                <Download size={13} />
                <span className="text-[10px] md:text-xs font-bold tracking-widest uppercase">
                  Backup
                </span>
              </button>

              <button
                onClick={() => setReportsOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm transition-all hover:opacity-80"
                style={{
                  backgroundColor: "#111D30",
                  color: "#F87171",
                  border: "1px solid rgba(239,68,68,0.2)",
                }}
                title="System Reports"
              >
                <Shield size={13} />
                <span className="text-[10px] font-bold tracking-widest uppercase">Reports</span>
              </button>

              <SystemHealthPanel />
              <OfflineStatusBar />

              <button
                onClick={() => setSearchOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm transition-all hover:opacity-80"
                style={{
                  backgroundColor: "#111D30",
                  color: "#8A9BB5",
                  border: "1px solid #1B2A4A",
                }}
                title="Search (Ctrl+K)"
              >
                <Search size={13} />
                <span className="text-xs tracking-wider">Search</span>
                <kbd
                  className="text-[10px] px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: "#1B2A4A", color: "#3A4F6A" }}
                >
                  ⌘K
                </kbd>
              </button>

              {session && (
                <span className="hidden lg:inline text-xs tracking-widest uppercase" style={{ color: "#3A4F6A" }}>
                  {session.session_key}
                </span>
              )}
            </div>
          </div>

          <div className="md:hidden flex items-center gap-1.5 overflow-x-auto pb-1">
            {NAV_ITEMS.map((item) => (
              <NavButton
                key={item.id}
                active={view === item.id}
                onClick={() => setView(item.id)}
                badge={item.id === "email" ? pendingApprovalCount : undefined}
              >
                {item.label}
              </NavButton>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">{renderView()}</div>

      {searchOpen && (
        <GlobalSearch onNavigate={handleSearchNavigate} onClose={() => setSearchOpen(false)} />
      )}

      {backupOpen && <BackupExportModal onClose={() => setBackupOpen(false)} />}

      {reportsOpen && <SystemReportsModal onClose={() => setReportsOpen(false)} />}
    </div>
  );
}
