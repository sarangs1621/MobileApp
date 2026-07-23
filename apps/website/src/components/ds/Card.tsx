"use client";

import React from "react";

type CardVariant = "elevated" | "outline" | "soft";

const VARIANTS: Record<CardVariant, React.CSSProperties> = {
  elevated: {
    background: "var(--surface-card)",
    boxShadow: "var(--shadow-md)",
    border: "1px solid transparent",
  },
  outline: {
    background: "var(--surface-card)",
    boxShadow: "none",
    border: "1px solid var(--border-subtle)",
  },
  soft: {
    background: "var(--surface-raised)",
    boxShadow: "none",
    border: "1px solid var(--border-subtle)",
  },
};

interface CardProps {
  children?: React.ReactNode;
  image?: string;
  imageAlt?: string;
  imageHeight?: number;
  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  meta?: React.ReactNode;
  footer?: React.ReactNode;
  variant?: CardVariant;
  interactive?: boolean;
  padding?: string;
  style?: React.CSSProperties;
}

/**
 * Card — flexible content surface used for facilities, programmes, news, faculty, etc.
 * Pass `image` (url) for a media card; `interactive` adds hover lift.
 */
export function Card({
  children,
  image,
  imageAlt = "",
  imageHeight = 200,
  eyebrow,
  title,
  meta,
  footer,
  variant = "elevated",
  interactive = false,
  padding = "1.5rem",
  style,
}: CardProps) {
  const v = VARIANTS[variant];
  const [hover, setHover] = React.useState(false);

  return (
    <article
      onMouseEnter={() => interactive && setHover(true)}
      onMouseLeave={() => interactive && setHover(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        borderRadius: "var(--radius-lg)",
        transform: hover ? "translateY(-4px)" : "translateY(0)",
        transition: "transform var(--dur) var(--ease-out), box-shadow var(--dur) var(--ease-out)",
        ...v,
        boxShadow: hover ? "var(--shadow-lg)" : v.boxShadow,
        ...style,
      }}
    >
      {image && (
        <div style={{ height: imageHeight, overflow: "hidden", flex: "none" }}>
          <img
            src={image}
            alt={imageAlt}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: hover ? "scale(1.05)" : "scale(1)",
              transition: "transform var(--dur-slow) var(--ease-out)",
            }}
          />
        </div>
      )}
      <div style={{ padding, display: "flex", flexDirection: "column", gap: "0.6rem", flex: 1 }}>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        {title && <h3 style={{ fontSize: "var(--text-xl)", fontWeight: 600 }}>{title}</h3>}
        {meta && (
          <div
            style={{
              fontSize: "0.8125rem",
              color: "var(--text-muted)",
              fontFamily: "var(--font-sans)",
            }}
          >
            {meta}
          </div>
        )}
        {children && (
          <div
            style={{
              fontSize: "0.9375rem",
              color: "var(--text-secondary)",
              lineHeight: 1.6,
              fontFamily: "var(--font-sans)",
            }}
          >
            {children}
          </div>
        )}
        {footer && <div style={{ marginTop: "auto", paddingTop: "0.75rem" }}>{footer}</div>}
      </div>
    </article>
  );
}
