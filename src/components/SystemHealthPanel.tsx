import { useState } from "react";
import { createPortal } from "react-dom";

type ServiceStatus = "Connected" | "Error" | "Warning";

type Service = {
  name: string;
  status: ServiceStatus;
  error: string;
  explanation: string;
  impact: string;
  steps: string[];
  prompt: string;
  severity: "Low" | "Medium" | "High";
  autoFix: string[];
  owner: string;
};

type ActiveModal = "prompt" | "autofix" | "team" | null;

const SERVICES: Service[] = [
  {
    name: "Database",
    status: "Connected",
    error: "None",
    explanation: "Database is responding normally.",
    impact: "Core data system is working.",
    steps: ["No action needed"],
    prompt: "Database OK",
    severity: "Low",
    autoFix: [],
    owner: "Backend",
  },
  {
    name: "Google Drive",
    status: "Error",
    error: "Failed to fetch",
    explanation: "The app tried to reach Google Drive but did not get a usable response.",
    impact: "Drive sync is blocked.",
    steps: ["Check GOOGLE_CLIENT_ID", "Re-authenticate connection"],
    prompt: "Fix Google Drive integration. Diagnose auth, route, env variables.",
    severity: "High",
    autoFix: ["Reset cached auth", "Retry integration route"],
    owner: "Integrations",
  },
  {
    name: "Auth",
    status: "Warning",
    error: "Token aging",
    explanation: "Session aging.",
    impact: "May break integrations.",
    steps: ["Log out", "Log in again"],
    prompt: "Fix auth token aging issue",
    severity: "Medium",
    autoFix: ["Refresh session token"],
    owner: "Auth",
  },
];

export default function SystemHealthPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [modalType, setModalType] = useState<ActiveModal>(null);
  const [activeService, setActiveService] = useState<Service | null>(null);

  const logToVault = (service: Service, type: string) => {
    const existing = JSON.parse(localStorage.getItem("system_health_reports") || "[]");
    const newReport = {
      id: crypto.randomUUID(),
      time: new Date().toLocaleTimeString(),
      service: service.name,
      owner: service.owner,
      message: service.prompt,
      type,
    };
    localStorage.setItem("system_health_reports", JSON.stringify([newReport, ...existing]));
    window.dispatchEvent(new Event("storage_sync"));
  };

  const handleAction = (e: React.MouseEvent, service: Service, type: ActiveModal) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveService(service);
    setModalType(type);
    logToVault(service, type?.toUpperCase() || "");
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#111D30] border border-[#1B2A4A] text-[#C9A84C]"
      >
        SYSTEM HEALTH
      </button>

      {isOpen && (
        <div 
          className="fixed top-[70px] right-6 w-[400px] bg-[#0D1B2E] border border-[#1B2A4A] rounded-xl p-4 shadow-2xl z-[1000] overflow-y-auto max-h-[70vh]"
        >
          <div className="flex justify-between items-center mb-4">
            <span className="text-[10px] text-gray-500 font-bold uppercase">Health Overview</span>
            <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-white">✕</button>
          </div>

          <div className="space-y-2">
            {SERVICES.map((s) => (
              <div key={s.name} className="border border-[#1B2A4A] rounded p-2 bg-[#0a1424]">
                <div 
                  className="flex justify-between items-center cursor-pointer"
                  onClick={() => setExpanded(expanded === s.name ? null : s.name)}
                >
                  <span className="text-white text-xs font-bold">{s.name}</span>
                  <span className={`text-[10px] ${s.status === 'Error' ? 'text-red-500' : 'text-green-500'}`}>{s.status}</span>
                </div>

                {expanded === s.name && (
                  <div className="mt-2 pt-2 border-t border-[#1B2A4A] space-y-3">
                    <p className="text-[10px] text-gray-400">{s.explanation}</p>
                    <div className="flex gap-2">
                      <button 
                        onClick={(e) => handleAction(e, s, "autofix")}
                        className="flex-1 py-1 text-[10px] bg-blue-900/30 border border-blue-500 text-blue-400 rounded"
                      >
                        Auto Fix
                      </button>
                      <button 
                        onClick={(e) => handleAction(e, s, "prompt")}
                        className="flex-1 py-1 text-[10px] bg-yellow-900/30 border border-yellow-500 text-yellow-400 rounded"
                      >
                        Fix Prompt
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {modalType && activeService && createPortal(
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999]">
          <div className="bg-[#0D1B2E] border border-[#1B2A4A] p-6 rounded-lg w-[450px]">
            <h3 className="text-white font-bold mb-4 uppercase tracking-widest text-sm border-b border-[#1B2A4A] pb-2">
              {modalType.replace('u', 'U')}
            </h3>
            <div className="text-xs text-gray-300 mb-6 leading-relaxed">
              {modalType === "prompt" ? activeService.prompt : `Initiating Auto-fix for ${activeService.name}...`}
            </div>
            <button 
              onClick={() => { setModalType(null); setActiveService(null); }}
              className="w-full py-2 bg-[#1B2A4A] text-[#C9A84C] text-xs font-bold rounded"
            >
              ACKNOWLEDGE
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
