import { useState } from "react";
import SystemHealthPanel from "./components/SystemHealthPanel";
import SystemReportsModal from "./components/SystemReportsModal";

type Page =
  | "MEETING"
  | "SESSIONS"
  | "EMAIL"
  | "VAULT"
  | "TAGS"
  | "PROJECTS"
  | "INTEGRATIONS"
  | "SOURCE";

export default function App() {
  const [reportsOpen, setReportsOpen] = useState(false);
  const [page, setPage] = useState<Page>("MEETING");

  const NavButton = ({ label }: { label: Page }) => (
    <button
      onClick={() => setPage(label)}
      className={`px-3 py-1 text-xs font-bold rounded transition ${
        page === label
          ? "bg-[#1B2A4A] text-white"
          : "text-gray-400 hover:text-white"
      }`}
    >
      {label}
    </button>
  );

  const renderPage = () => {
    switch (page) {
      case "MEETING":
        return <div className="p-6">Staff Meeting Room Active</div>;
      case "SESSIONS":
        return <div className="p-6">Sessions coming online</div>;
      case "EMAIL":
        return <div className="p-6">Email system placeholder</div>;
      case "VAULT":
        return <div className="p-6">Vault connected (existing system)</div>;
      case "TAGS":
        return <div className="p-6">Tags system placeholder</div>;
      case "PROJECTS":
        return <div className="p-6">Projects system placeholder</div>;
      case "INTEGRATIONS":
        return <div className="p-6">Integrations panel placeholder</div>;
      case "SOURCE":
        return <div className="p-6">Source of Truth placeholder</div>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#050B14] p-6 text-gray-200">
      
      {/* TOP BAR */}
      <nav className="flex justify-between items-center mb-6 border-b border-[#1B2A4A] pb-4">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-black text-white">MYSTATEMENT_AI</h1>

          <div className="flex gap-2 overflow-x-auto">
            <NavButton label="MEETING" />
            <NavButton label="SESSIONS" />
            <NavButton label="EMAIL" />
            <NavButton label="VAULT" />
            <NavButton label="TAGS" />
            <NavButton label="PROJECTS" />
            <NavButton label="INTEGRATIONS" />
            <NavButton label="SOURCE" />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setReportsOpen(true)}
            className="px-3 py-1 text-xs border border-[#1B2A4A] rounded hover:bg-[#1B2A4A]"
          >
            REPORTS
          </button>

          <SystemHealthPanel />
        </div>
      </nav>

      {/* PAGE CONTENT */}
      <main className="bg-[#0D1B2E] border border-[#1B2A4A] rounded-xl min-h-[500px]">
        {renderPage()}
      </main>

      <SystemReportsModal
        isOpen={reportsOpen}
        onClose={() => setReportsOpen(false)}
      />
    </div>
  );
}
