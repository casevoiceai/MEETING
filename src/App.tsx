import { useState } from "react";
import SystemHealthPanel from "./components/SystemHealthPanel";
import SystemReportsModal from "./components/SystemReportsModal";

export default function App() {
  const [reportsOpen, setReportsOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#050B14] p-8 font-sans text-gray-200 overflow-x-hidden">
      <nav className="flex justify-between items-center mb-12 border-b border-[#1B2A4A] pb-6">
        <div>
          <h1 className="text-2xl font-black tracking-tighter text-white">CORE_SYSTEM_OS</h1>
          <p className="text-[10px] text-[#C9A84C] font-mono uppercase">Status: Operational</p>
        </div>
        
        <div className="flex gap-4">
          <button
            onClick={() => setReportsOpen(true)}
            className="px-4 py-1.5 rounded-lg text-xs font-bold border border-[#1B2A4A] hover:bg-[#1B2A4A] transition-colors"
          >
            VIEW REPORTS
          </button>
          <SystemHealthPanel />
        </div>
      </nav>

      <main className="grid grid-cols-12 gap-6">
        <section className="col-span-12 lg:col-span-8 bg-[#0D1B2E] border border-[#1B2A4A] rounded-xl p-8 min-h-[400px]">
          <h2 className="text-lg font-bold text-white mb-4">Main Dashboard</h2>
          <p className="text-sm text-gray-400 leading-relaxed max-w-2xl">
            Welcome to the central monitoring interface. Use the "System Health" utility 
            to diagnose integration failures or service degradation. Reports generated 
            will appear in the Incident Vault.
          </p>
        </section>

        <aside className="col-span-12 lg:col-span-4 space-y-6">
          <div className="bg-[#111D30] border border-[#1B2A4A] p-4 rounded-xl">
            <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">Quick Actions</h3>
            <div className="grid grid-cols-1 gap-2">
               <button className="text-left px-3 py-2 text-[10px] font-bold rounded bg-[#1B2A4A] text-white hover:bg-white hover:text-black transition-all">Flush Cache</button>
               <button className="text-left px-3 py-2 text-[10px] font-bold rounded bg-[#1B2A4A] text-white hover:bg-white hover:text-black transition-all">Restart API Node</button>
            </div>
          </div>
        </aside>
      </main>

      <SystemReportsModal 
        isOpen={reportsOpen} 
        onClose={() => setReportsOpen(false)} 
      />
    </div>
  );
}
