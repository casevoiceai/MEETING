import { useEffect, useState } from "react";

type Status = "checking" | "ok" | "fail";

export default function SystemHealthPanel() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    const runCheck = async () => {
      try {
        const res = await fetch("/api/save-meeting", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "health_check" }),
        });

        if (res.ok) {
          setStatus("ok");
        } else {
          setStatus("fail");
        }
      } catch {
        setStatus("fail");
      }
    };

    runCheck();
  }, []);

  const color =
    status === "ok" ? "#22C55E" :
    status === "fail" ? "#EF4444" :
    "#F59E0B";

  const label =
    status === "ok" ? "CONNECTED" :
    status === "fail" ? "FAILED" :
    "CHECKING";

  return (
    <div
      className="px-3 py-2 rounded-lg text-[12px] font-bold uppercase"
      style={{
        color: "#F8FAFC",
        backgroundColor: "#0D1B2E",
        border: `1px solid ${color}`,
      }}
    >
      <span style={{ color }}>{`●`}</span> Credentials: {label}
    </div>
  );
}
