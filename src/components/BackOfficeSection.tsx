import type { ReactNode } from "react";

type BackOfficeSectionProps = {
  eyebrow: string;
  children: ReactNode;
  borderColor?: string;
  background?: string;
};

export default function BackOfficeSection({
  eyebrow,
  children,
  borderColor = "#1B2A4A",
  background = "#0F1E33",
}: BackOfficeSectionProps) {
  return (
    <section
      className="mb-5 rounded-2xl p-6"
      style={{
        background,
        border: `1px solid ${borderColor}`,
      }}
    >
      <div
        className="text-[11px] font-bold tracking-[0.18em] uppercase mb-3"
        style={{ color: "#C9A84C" }}
      >
        {eyebrow}
      </div>

      {children}
    </section>
  );
}
