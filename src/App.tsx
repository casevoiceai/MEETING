import { useState } from "react";
import SystemHealthPanel from "./components/SystemHealthPanel";
import SystemReportsModal from "./components/SystemReportsModal";

export default function App() {
  const [reportsOpen, setReportsOpen] = useState(false);

  return (
    <div>
      {/* TOP BAR */}
      <div className="flex gap-2 p-4">
        <SystemHealthPanel />

        <button
          onClick={() => setReportsOpen(true)}
          className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase"
          style={{
            backgroundColor: "#111D30",
            border: "1px solid #EF4444",
            color: "#EF4444",
          }}
        >
          🚨 Reports
        </button>
      </div>

      <SystemReportsModal
        open={reportsOpen}
        onClose={() => setReportsOpen(false)}
      />
    </div>
  );
}
