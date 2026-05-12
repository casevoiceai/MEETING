import { useState } from "react";

type FreddyStatusPanelProps = {
  summary: string;
  why: string;
  action: string;
};

export default function FreddyStatusPanel({ summary, why, action }: FreddyStatusPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <section
      style={{
        marginBottom: 18,
        padding: 16,
        borderRadius: 18,
        background: "#0B1626",
        border: "1px solid #C9A84C55",
        color: "#D0DFEE",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <strong style={{ color: "#C9A84C" }}>Freddy:</strong>{" "}
          <span>{summary}</span>
        </div>

        <button
          onClick={() => setOpen(!open)}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #C9A84C66",
            background: "#0F1E33",
            color: "#C9A84C",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          {open ? "Hide" : "Why?"}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: "#8BA4C2", fontWeight: 800, marginBottom: 4 }}>WHY</div>
            <div>{why}</div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: "#8BA4C2", fontWeight: 800, marginBottom: 4 }}>WHAT SHOULD I DO?</div>
            <div>{action}</div>
          </div>
        </div>
      )}
    </section>
  );
}

