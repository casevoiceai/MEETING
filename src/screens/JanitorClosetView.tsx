export default function JanitorClosetView() {
  const recoveryCards = [
    {
      title: "Rollback Rule",
      detail: "If a white screen appears, stop immediately. Restore the most recent stable backup before making another change.",
    },
    {
      title: "No Regex Surgery",
      detail: "Do not use regex to extract or remove large JSX panels. Use full-file replacement for large UI moves.",
    },
    {
      title: "Port Cleanup",
      detail: "If local app state is confusing, clear duplicate Node processes before restarting the hidden launcher.",
    },
    {
      title: "Protected Files",
      detail: "HealthView is protected. Do not edit it casually. Utility Closet must stay system truth only.",
    },
  ];

  return (
    <div className="h-full w-full overflow-y-auto" style={{ backgroundColor: "#08111F", color: "#E8F0FA" }}>
      <div className="mx-auto max-w-5xl px-8 py-8">
        <div className="mb-6 rounded-2xl p-5" style={{ background: "#0F1E33", border: "1px solid #1B2A4A" }}>
          <div className="mb-2 text-[11px] font-bold tracking-[0.22em] uppercase" style={{ color: "#C9A84C" }}>
            Janitor Closet
          </div>
          <p className="max-w-3xl text-base leading-7" style={{ color: "#D0DFEE" }}>
            Cleanup, rollback, and recovery rules live here. This keeps safety notes out of Utility Closet, Back Office, Break Room, and Store Room.
          </p>
        </div>

        <section className="rounded-2xl p-6" style={{ background: "#0F1E33", border: "1px solid #1B2A4A" }}>
          <div className="text-[11px] font-bold tracking-[0.18em] uppercase mb-3" style={{ color: "#C9A84C" }}>
            Recovery Rules
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recoveryCards.map((card) => (
              <div key={card.title} className="rounded-xl p-4" style={{ background: "#0B1626", border: "1px solid #1B2A4A" }}>
                <div className="text-base font-black mb-2" style={{ color: "#F8FAFC" }}>{card.title}</div>
                <div className="text-sm leading-7" style={{ color: "#D0DFEE" }}>{card.detail}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
