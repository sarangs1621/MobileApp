"use client";

import type React from "react";

interface SectionHeadingProps {
  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  lead?: React.ReactNode;
  align?: "left" | "center";
  tone?: "default" | "inverse";
  maxWidth?: string;
  style?: React.CSSProperties;
}

/**
 * SectionHeading — eyebrow + display title + optional lead, used to open every section.
 */
export function SectionHeading({
  eyebrow,
  title,
  lead,
  align = "left",
  tone = "default",
  maxWidth = "52ch",
  style,
}: SectionHeadingProps) {
  const onDark = tone === "inverse";
  return (
    <header
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.85rem",
        alignItems: align === "center" ? "center" : "flex-start",
        textAlign: align,
        ...style,
      }}
    >
      {eyebrow && (
        <span className="eyebrow" style={onDark ? { color: "var(--gold-400)" } : undefined}>
          <span
            style={{ width: 20, height: 1.5, background: "currentColor", display: "inline-block" }}
          />
          {eyebrow}
        </span>
      )}
      {title && (
        <h2
          style={{
            fontSize: "var(--text-section)",
            fontWeight: 500,
            lineHeight: 1.08,
            letterSpacing: "-0.02em",
            maxWidth,
            color: onDark ? "var(--cream-50)" : "var(--text-primary)",
          }}
        >
          {title}
        </h2>
      )}
      {lead && (
        <p
          style={{
            fontSize: "var(--text-lead)",
            lineHeight: 1.55,
            maxWidth,
            fontFamily: "var(--font-sans)",
            color: onDark ? "var(--cream-100)" : "var(--text-secondary)",
          }}
        >
          {lead}
        </p>
      )}
    </header>
  );
}
