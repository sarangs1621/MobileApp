import type React from "react";

interface KickerProps {
  children?: React.ReactNode;
  tone?: "default" | "inverse";
}

/** Uppercase eyebrow with a gold rule — opens every section (dark-aware). */
export function Kicker({ children, tone }: KickerProps) {
  return (
    <span className="eyebrow" style={tone === "inverse" ? { color: "var(--gold-400)" } : undefined}>
      <span
        style={{ width: 22, height: 1.5, background: "currentColor", display: "inline-block" }}
      />
      {children}
    </span>
  );
}
