"use client";

import type React from "react";

type BadgeTone = "brand" | "gold" | "neutral" | "success" | "info" | "outline";

const TONES: Record<BadgeTone, React.CSSProperties> = {
  brand: { background: "var(--maroon-100)", color: "var(--maroon-800)" },
  gold: { background: "var(--gold-100)", color: "var(--gold-800)" },
  neutral: { background: "var(--cream-200)", color: "var(--ink-700)" },
  success: { background: "var(--green-100)", color: "var(--green-600)" },
  info: { background: "var(--blue-100)", color: "var(--blue-600)" },
  outline: {
    background: "transparent",
    color: "var(--text-brand)",
    border: "1px solid var(--border-strong)",
  },
};

interface BadgeProps {
  children?: React.ReactNode;
  tone?: BadgeTone;
  dot?: boolean;
  style?: React.CSSProperties;
}

/**
 * Badge — small status / category label (e.g. "Est. 1869", "Admissions Open", "CBSE").
 */
export function Badge({ children, tone = "brand", dot = false, style }: BadgeProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.4rem",
        fontFamily: "var(--font-sans)",
        fontSize: "0.75rem",
        fontWeight: 600,
        letterSpacing: "0.02em",
        padding: "0.3rem 0.65rem",
        borderRadius: "var(--radius-pill)",
        lineHeight: 1.1,
        whiteSpace: "nowrap",
        ...TONES[tone],
        ...style,
      }}
    >
      {dot && (
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />
      )}
      {children}
    </span>
  );
}
