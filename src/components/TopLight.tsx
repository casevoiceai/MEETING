type Status = "ok" | "warn" | "down" | "checking" | "info";

const COLORS = {
  box: "#0B1626",
  muted: "#8A9BB5",
};

function statusColor(status: Status) {
  if (status === "ok") return "#22c55e";
  if (status === "warn") return "#f59e0b";
  if (status === "down") return "#ef4444";
  return "#38bdf8";
}

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function TopLight({ label, status, target }: { label: string; status: Status; target: string }) {
  return (
    <button
      onClick={() => scrollToSection(target)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        borderRadius: 12,
        background: COLORS.box,
        border: `1px solid ${statusColor(status)}55`,
        color: COLORS.muted,
        cursor: "pointer",
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: "0.08em",
      }}
    >
      <span
        style={{
          width: 9,
          height: 9,
          borderRadius: 999,
          background: statusColor(status),
          boxShadow: `0 0 10px ${statusColor(status)}66`,
        }}
      />
      {label}
    </button>
  );
}
