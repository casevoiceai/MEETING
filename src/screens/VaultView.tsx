import React, { useState } from "react";

type RecordItem = {
  id: string;
  title: string;
  service: string;
  status: string;
  time: string;
  summary: string;
  tags: string[];
  notes?: string;
};

const mockData: RecordItem[] = [
  {
    id: "1",
    title: "Fix Google Drive integration",
    service: "Google Drive",
    status: "Pending",
    time: "6:30 PM",
    summary: "Diagnose auth, route, env variables.",
    tags: ["Integration", "Pending"],
  },
  {
    id: "2",
    title: "Auth warning investigation",
    service: "Auth",
    status: "Warning",
    time: "6:20 PM",
    summary: "Token refresh issue.",
    tags: ["Auth", "Warning"],
  },
];

export default function VaultView() {
  const [selected, setSelected] = useState<RecordItem | null>(null);
  const [advanced, setAdvanced] = useState(false);

  return (
    <div style={{ padding: "20px", color: "white" }}>
      {/* HEADER */}
      <h1 style={{ fontSize: "28px", marginBottom: "10px" }}>
        Vault (Simple View)
      </h1>

      {/* TOGGLE */}
      <button
        onClick={() => setAdvanced(!advanced)}
        style={{
          marginBottom: "20px",
          padding: "10px 16px",
          background: advanced ? "#9333ea" : "#2563eb",
          borderRadius: "8px",
          border: "none",
          color: "white",
          fontWeight: "bold",
        }}
      >
        {advanced ? "Advanced Mode ON" : "Advanced Mode OFF"}
      </button>

      {/* TABLE */}
      <div style={{ display: "flex", gap: "20px" }}>
        <div style={{ flex: 1 }}>
          {mockData.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelected(item)}
              style={{
                padding: "16px",
                marginBottom: "12px",
                background: "#1e293b",
                borderRadius: "10px",
                cursor: "pointer",
              }}
            >
              <div style={{ fontSize: "18px", fontWeight: "bold" }}>
                {item.title}
              </div>

              <div style={{ fontSize: "14px", opacity: 0.7 }}>
                {item.service} • {item.time}
              </div>

              <div
                style={{
                  marginTop: "6px",
                  fontWeight: "bold",
                  color:
                    item.status === "Pending"
                      ? "orange"
                      : item.status === "Warning"
                      ? "yellow"
                      : "green",
                }}
              >
                {item.status}
              </div>
            </div>
          ))}
        </div>

        {/* DETAIL PANEL */}
        <div style={{ flex: 1 }}>
          {selected && (
            <div
              style={{
                background: "#1e293b",
                padding: "20px",
                borderRadius: "10px",
              }}
            >
              <h2 style={{ fontSize: "22px" }}>{selected.title}</h2>

              <p style={{ marginTop: "10px", fontSize: "16px" }}>
                {selected.summary}
              </p>

              {/* SIMPLE MODE */}
              {!advanced && (
                <>
                  <div style={{ marginTop: "20px" }}>
                    <button style={btn}>Fix</button>
                    <button style={btn}>Archive</button>
                  </div>
                </>
              )}

              {/* ADVANCED MODE */}
              {advanced && (
                <>
                  <div style={{ marginTop: "20px" }}>
                    <strong>Tags:</strong>
                    <div style={{ marginTop: "5px" }}>
                      {selected.tags.map((t) => (
                        <span key={t} style={tag}>
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginTop: "20px" }}>
                    <strong>Notes</strong>
                    <textarea
                      style={{
                        width: "100%",
                        marginTop: "8px",
                        padding: "10px",
                        borderRadius: "8px",
                        background: "#0f172a",
                        color: "white",
                      }}
                      placeholder="Add notes..."
                    />
                  </div>

                  <div style={{ marginTop: "20px" }}>
                    <strong>Chain of Custody</strong>
                    <p style={{ fontSize: "14px", opacity: 0.7 }}>
                      Record created → System Health
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const btn: React.CSSProperties = {
  marginRight: "10px",
  padding: "10px 14px",
  borderRadius: "8px",
  border: "none",
  background: "#2563eb",
  color: "white",
  fontWeight: "bold",
};

const tag: React.CSSProperties = {
  display: "inline-block",
  marginRight: "6px",
  padding: "4px 8px",
  background: "#334155",
  borderRadius: "6px",
  fontSize: "12px",
};
