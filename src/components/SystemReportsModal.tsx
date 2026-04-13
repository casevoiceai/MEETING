import React, { useState } from "react";

type Report = {
  id: string;
  title: string;
  service: string;
  status: string;
  time: string;
  summary: string;
  tags: string[];
};

export default function SystemReportsModal() {
  const [selectedId, setSelectedId] = useState<string | null>("1");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const reports: Report[] = [
    {
      id: "1",
      title: "Fix Google Drive integration",
      service: "Google Drive",
      status: "Pending",
      time: "7:51 PM",
      summary:
        "Diagnose auth, route, env variables.",
      tags: ["SYSTEM_REPORT", "OWNER_INTEGRATIONS", "STATUS_PENDING"],
    },
  ];

  const selected = reports.find((r) => r.id === selectedId);

  return (
    <div style={container}>
      {/* HEADER */}
      <div style={header}>
        <div>
          <div style={title}>System Reports</div>
          <div style={subtitle}>
            Big picture left. Clean working detail right.
          </div>
        </div>
        <button style={closeBtn}>Close</button>
      </div>

      <div style={body}>
        {/* LEFT SIDE */}
        <div style={left}>
          <div style={sectionTitle}>Active reports</div>

          {reports.map((r) => (
            <div
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              style={{
                ...card,
                border:
                  selectedId === r.id
                    ? "2px solid #3b82f6"
                    : "1px solid #1f2937",
              }}
            >
              <div style={cardTitle}>{r.service}</div>

              <div style={badgeRow}>
                <span style={badge}>{r.status}</span>
                <span style={badgePurple}>INTEGRATIONS</span>
              </div>

              <div style={cardSummary}>{r.summary}</div>

              <div style={cardFooter}>
                <span>{r.time}</span>
                <button style={openBtn}>Open</button>
              </div>
            </div>
          ))}
        </div>

        {/* RIGHT SIDE */}
        <div style={right}>
          {selected && (
            <div style={detailCard}>
              <div style={detailHeader}>
                <div style={detailTitle}>{selected.service}</div>
                <button style={deleteBtn}>Delete</button>
              </div>

              {/* SUMMARY */}
              <div style={label}>Summary</div>
              <div style={summaryBox}>{selected.summary}</div>

              {/* STATUS */}
              <div style={buttonRow}>
                <button style={statusBtn}>Pending</button>
                <button style={statusBtnActive}>In Progress</button>
                <button style={statusBtnSuccess}>Fixed</button>
              </div>

              {/* ACTIONS */}
              <div style={buttonRow}>
                <button style={primaryBtn}>Save to Vault</button>
                <button style={greenBtn}>Archive Fixed</button>
                <button style={yellowBtn}>Archive Abandoned</button>
                <button style={redBtn}>Archive Failed</button>
              </div>

              {/* NOTES */}
              <div style={label}>Notes</div>
              <textarea style={textarea} placeholder="Add notes..." />

              {/* ADVANCED */}
              <div
                style={advancedHeader}
                onClick={() => setAdvancedOpen(!advancedOpen)}
              >
                <span>Advanced</span>
                <span>{advancedOpen ? "–" : "+"}</span>
              </div>

              {advancedOpen && (
                <div style={advancedBox}>
                  <div style={label}>Tags</div>
                  <div>
                    {selected.tags.map((t) => (
                      <span key={t} style={tag}>
                        {t}
                      </span>
                    ))}
                  </div>

                  <div style={{ marginTop: "12px" }}>
                    <div style={label}>Chain of custody</div>
                    <div style={custodyBox}>
                      Report created → System Reports / Active
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- STYLES ---------- */

const container = {
  background: "#0f172a",
  padding: "20px",
  borderRadius: "12px",
  color: "white",
};

const header = {
  display: "flex",
  justifyContent: "space-between",
  marginBottom: "20px",
};

const title = { fontSize: "22px", fontWeight: "bold" };
const subtitle = { fontSize: "13px", opacity: 0.6 };

const body = { display: "flex", gap: "20px" };

const left = { flex: 1 };
const right = { flex: 1 };

const sectionTitle = {
  fontSize: "16px",
  marginBottom: "10px",
};

const card = {
  padding: "16px",
  borderRadius: "10px",
  marginBottom: "12px",
  background: "#1e293b",
  cursor: "pointer",
};

const cardTitle = { fontSize: "16px", fontWeight: "bold" };

const badgeRow = {
  display: "flex",
  gap: "8px",
  marginTop: "6px",
};

const badge = {
  background: "#374151",
  padding: "4px 8px",
  borderRadius: "6px",
  fontSize: "12px",
};

const badgePurple = {
  background: "#6d28d9",
  padding: "4px 8px",
  borderRadius: "6px",
  fontSize: "12px",
};

const cardSummary = {
  marginTop: "10px",
  fontSize: "14px",
  opacity: 0.8,
};

const cardFooter = {
  display: "flex",
  justifyContent: "space-between",
  marginTop: "12px",
};

const openBtn = {
  background: "#111827",
  padding: "6px 10px",
  borderRadius: "6px",
};

const detailCard = {
  background: "#1e293b",
  padding: "20px",
  borderRadius: "12px",
};

const detailHeader = {
  display: "flex",
  justifyContent: "space-between",
  marginBottom: "10px",
};

const detailTitle = { fontSize: "20px", fontWeight: "bold" };

const deleteBtn = {
  background: "#ef4444",
  padding: "6px 12px",
  borderRadius: "6px",
};

const label = {
  marginTop: "12px",
  fontSize: "12px",
  opacity: 0.7,
};

const summaryBox = {
  background: "#0f172a",
  padding: "12px",
  borderRadius: "8px",
  marginTop: "6px",
};

const buttonRow = {
  display: "flex",
  gap: "10px",
  marginTop: "12px",
  flexWrap: "wrap",
};

const statusBtn = {
  background: "#374151",
  padding: "8px 12px",
  borderRadius: "8px",
};

const statusBtnActive = {
  background: "#f59e0b",
  padding: "8px 12px",
  borderRadius: "8px",
};

const statusBtnSuccess = {
  background: "#10b981",
  padding: "8px 12px",
  borderRadius: "8px",
};

const primaryBtn = {
  background: "#3b82f6",
  padding: "8px 12px",
  borderRadius: "8px",
};

const greenBtn = {
  background: "#10b981",
  padding: "8px 12px",
  borderRadius: "8px",
};

const yellowBtn = {
  background: "#f59e0b",
  padding: "8px 12px",
  borderRadius: "8px",
};

const redBtn = {
  background: "#ef4444",
  padding: "8px 12px",
  borderRadius: "8px",
};

const textarea = {
  width: "100%",
  height: "80px",
  marginTop: "6px",
  padding: "10px",
  borderRadius: "8px",
  background: "#0f172a",
  color: "white",
};

const advancedHeader = {
  marginTop: "16px",
  padding: "10px",
  background: "#111827",
  borderRadius: "8px",
  display: "flex",
  justifyContent: "space-between",
  cursor: "pointer",
};

const advancedBox = {
  marginTop: "10px",
  padding: "12px",
  background: "#0f172a",
  borderRadius: "8px",
};

const tag = {
  background: "#334155",
  padding: "4px 8px",
  borderRadius: "6px",
  marginRight: "6px",
};

const custodyBox = {
  marginTop: "6px",
  padding: "10px",
  background: "#020617",
  borderRadius: "6px",
};

const closeBtn = {
  background: "#1f2937",
  padding: "6px 12px",
  borderRadius: "6px",
};
