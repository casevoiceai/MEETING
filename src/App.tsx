import React, { useState } from "react";
import VaultView from "./screens/VaultView";
import SystemReportsModal from "./components/SystemReportsModal";

export default function App() {
  const [activeTab, setActiveTab] = useState<"meeting" | "vault">("meeting");
  const [showReports, setShowReports] = useState(false);

  return (
    <div style={{ background: "#0f172a", color: "white", minHeight: "100vh" }}>
      
      {/* 🔴 TOP NAV */}
      <div style={nav}>
        <button onClick={() => setActiveTab("meeting")} style={navBtn}>
          MEETING
        </button>

        <button onClick={() => setActiveTab("vault")} style={navBtn}>
          VAULT
        </button>

        <button onClick={() => setShowReports(true)} style={navBtn}>
          REPORTS
        </button>
      </div>

      {/* 🔴 MAIN CONTENT */}
      <div style={{ padding: "20px" }}>
        {activeTab === "meeting" && (
          <div style={{ opacity: 0.6 }}>
            Meeting screen (placeholder)
          </div>
        )}

        {activeTab === "vault" && <VaultView />}
      </div>

      {/* 🔴 REPORTS MODAL (ONLY ONE SOURCE) */}
      {showReports && (
        <SystemReportsModal onClose={() => setShowReports(false)} />
      )}
    </div>
  );
}

/* ---------- STYLES ---------- */

const nav = {
  display: "flex",
  gap: "10px",
  padding: "10px",
  background: "#020617",
  borderBottom: "1px solid #1f2937",
};

const navBtn = {
  background: "#1e293b",
  padding: "8px 14px",
  borderRadius: "8px",
  cursor: "pointer",
  color: "white",
  border: "none",
};
