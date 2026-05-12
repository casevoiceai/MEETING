export default function FreddyDecisionPanel() {
  const freddyItems = [
    {
      label: "Status",
      value: "Stable enough to proceed.",
      detail: "Utility Closet is green. Back Office is active. Freddy is not connected to tools yet.",
    },
    {
      label: "Risk Read",
      value: "Do not overload Health.",
      detail: "HealthView stays diagnostics only. Decision logic belongs in Back Office.",
    },
    {
      label: "Next Action",
      value: "Build permission boundaries first.",
      detail: "Freddy should recommend before he drafts, and draft before he can apply anything.",
    },
    {
      label: "Permission Boundary",
      value: "No automatic fixes.",
      detail: "Freddy cannot change files, run actions, or direct the Boys without approval.",
    },
  ];

  return (
    <section className="mb-5 rounded-2xl p-6" style={{ background: "#0B1626", border: "1px solid rgba(201,168,76,0.45)" }}>
      <div className="text-[11px] font-bold tracking-[0.18em] uppercase mb-3" style={{ color: "#C9A84C" }}>
        Freddy Decision Panel
      </div>

      <div className="text-xl font-black mb-4" style={{ color: "#F8FAFC" }}>
        Interpret, recommend, ask permission.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {freddyItems.map((item) => (
          <div key={item.label} className="rounded-xl p-4" style={{ background: "#0F1E33", border: "1px solid #1B2A4A" }}>
            <div className="text-[10px] font-bold tracking-[0.16em] uppercase mb-2" style={{ color: "#C9A84C" }}>
              {item.label}
            </div>
            <div className="text-lg font-bold mb-2" style={{ color: "#F8FAFC" }}>
              {item.value}
            </div>
            <div className="text-sm leading-7" style={{ color: "#D0DFEE" }}>
              {item.detail}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
