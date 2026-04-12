import { useState, useEffect } from "react";
import StaffMeetingRoom from "./screens/StaffMeetingRoom";
import SessionsView from "./screens/SessionsView";
import VaultView from "./screens/VaultView";
import TagsView from "./screens/TagsView";
import ProjectsView from "./screens/ProjectsView";
import { getOrCreateSession, type Session } from "./lib/db";

type View = "meeting" | "sessions" | "vault" | "tags" | "projects";

const NAV_ITEMS: { id: View; label: string }[] = [
  { id: "meeting", label: "Meeting" },
  { id: "sessions", label: "Sessions" },
  { id: "vault", label: "Vault" },
  { id: "tags", label: "Tags" },
  { id: "projects", label: "Projects" },
];

function NavButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="px-4 py-2 text-sm font-bold tracking-wider uppercase rounded-lg transition-all"
      style={
        active
          ? { backgroundColor: "#1B2A4A", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.3)" }
          : hovered
          ? { color: "#C9A84C", border: "1px solid rgba(201,168,76,0.15)", backgroundColor: "rgba(201,168,76,0.04)" }
          : { color: "#8A9BB5", border: "1px solid transparent" }
      }
    >
      {children}
    </button>
  );
}

export default function App() {
  const [view, setView] = useState<View>("meeting");
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    getOrCreateSession().then(setSession).catch(() => {});
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: "#0D1B2E", color: "#FFFFFF", fontFamily: "'Inter', sans-serif", fontSize: "15px" }}
    >
      <div
        className="flex items-center gap-1.5 px-6 py-3 border-b flex-shrink-0"
        style={{ borderColor: "#1B2A4A" }}
      >
        <span className="text-sm font-bold tracking-widest uppercase mr-5" style={{ color: "#C9A84C" }}>
          MyStatement_AI
        </span>
        {NAV_ITEMS.map((item) => (
          <NavButton
            key={item.id}
            active={view === item.id}
            onClick={() => setView(item.id)}
          >
            {item.label}
          </NavButton>
        ))}
        <div className="ml-auto">
          {session && (
            <span className="text-xs tracking-widest uppercase" style={{ color: "#3A4F6A" }}>
              {session.session_key}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        {view === "meeting" && <StaffMeetingRoom sessionId={session?.id ?? null} />}
        {view === "sessions" && <SessionsView onOpenSession={() => setView("meeting")} />}
        {view === "vault" && <VaultView />}
        {view === "tags" && <TagsView />}
        {view === "projects" && <ProjectsView />}
      </div>
    </div>
  );
}
