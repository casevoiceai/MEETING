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
import { getOrCreateSession, loadSession, type Session, type SearchResult, type LinkableType } from "./lib/db";
import { getPendingCount } from "./lib/approval";
import { getLastBackupLog, isBackupOverdue } from "./lib/cricalPath";
import OfflineStatusBar from "./components/OfflineStatusBar";
import SystemHealthPanel from "./components/SystemHealthPanel";
import BackupExportModal from "./components/BackupExportModal";
import { ensureSupabaseSession } from "./lib/supabase";

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
  const [linkedNavTarget, setLinkedNavTarget] = useState<{ type: LinkableType; id: string } | null>(null);
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

  const handleSearchNavigate = useCallback((type: SearchResult["type"], _id: string) => {
    const viewMap: Record<SearchResult["type"], View> = {
      file: "vault",
      note: "vault",
      tag: "tags",
      session: "sessions",
      project: "projects",
    };

    setView(viewMap[type]);
  }, []);

  const handleLinkedNavigation = useCallback((type: LinkableType, id: string) => {
    const viewMap: Record<LinkableType, View> = {
      file: "vault",
      note: "vault",
      tag: "tags",
      session: "sessions",
      project: "projects",
    };

    setView(viewMap[type]);
    setLinkedNavTarget({ type, id });
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        backgroundColor: "#0D1B2E",
        color: "#FFFFFF",
        fontFamily: "'Inter', sans-serif",
        fontSize: "16px",
      }}
    >
      <div
        className="flex items-center gap-1.5 px-6 py-3.5 border-b flex-shrink-0"
        style={{ borderColor: "#1B2A4A" }}
      >
        <span className="text-sm font-bold tracking-widest uppercase mr-6" style={{ color: "#C9A84C" }}>
          MyStatement_AI
        </span>

        {NAV_ITEMS.map((item) => (
          <NavButton
            key={item.id}
            active={view === item.id}
            onClick={() => setView(item.id)}
            badge={
              item.id === "integrations"
                ? pendingApprovalCount
                : item.id === "recovery" && backupOverdue
                  ? 1
                  : undefined
            }
          >
            {item.label}
          </NavButton>
        ))}

        <div className="ml-auto flex items-center gap-3">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
            style={{
              backgroundColor: "rgba(245,158,11,0.06)",
              border: "1px solid rgba(245,158,11,0.2)",
            }}
            title="User approval required for all final actions"
          >
            <Shield size={11} style={{ color: "#F59E0B" }} />
            <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "#F59E0B" }}>
              Approval Required
            </span>
            {pendingApprovalCount > 0 && (
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: "#F59E0B", color: "#0D1B2E" }}
              >
                {pendingApprovalCount}
              </span>
            )}
          </div>

          <button
            onClick={() => setBackupOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all hover:opacity-80"
            style={{
              backgroundColor: "rgba(201,168,76,0.06)",
              color: "#C9A84C",
              border: "1px solid rgba(201,168,76,0.2)",
            }}
            title="Export Backup"
          >
            <Download size={11} />
            <span className="text-[10px] font-bold tracking-widest uppercase">Backup</span>
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
            <span className="text-xs tracking-widest uppercase" style={{ color: "#3A4F6A" }}>
              {session.session_key}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        {view === "meeting" && <StaffMeetingRoom sessionId={session?.id ?? null} sessionKey={sessionKey} />}
        {view === "sessions" && (
          <SessionsView
            onOpenSession={handleOpenSession}
            onNavigateLinked={handleLinkedNavigation}
            linkedTarget={linkedNavTarget?.type === "session" ? linkedNavTarget.id : undefined}
          />
        )}
        {view === "email" && <EmailView onPendingChange={setPendingApprovalCount} />}
        {view === "vault" && (
          <VaultView
            onNavigateLinked={handleLinkedNavigation}
            linkedTarget={
              linkedNavTarget?.type === "file" || linkedNavTarget?.type === "note"
                ? linkedNavTarget
                : undefined
            }
          />
        )}
        {view === "tags" && (
          <TagsView
            onNavigateLinked={handleLinkedNavigation}
            linkedTarget={linkedNavTarget?.type === "tag" ? linkedNavTarget.id : undefined}
          />
        )}
        {view === "projects" && (
          <ProjectsView
            onNavigateLinked={handleLinkedNavigation}
            linkedTarget={linkedNavTarget?.type === "project" ? linkedNavTarget.id : undefined}
          />
        )}
        {view === "integrations" && <IntegrationsView onPendingChange={setPendingApprovalCount} />}
        {view === "source-of-truth" && <SourceOfTruthPanel sessionKey={sessionKey} />}
        {view === "recovery" && <CriticalPathPanel />}
      </div>

      {searchOpen && <GlobalSearch onNavigate={handleSearchNavigate} onClose={() => setSearchOpen(false)} />}

      {backupOpen && <BackupExportModal onClose={() => setBackupOpen(false)} />}
    </div>
  );
}
