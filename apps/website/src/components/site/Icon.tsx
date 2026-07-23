import type React from "react";

interface IconProps {
  /** Phosphor icon name, e.g. "arrow-right" (see phosphoricons.com). */
  name: string;
  weight?: "regular" | "bold" | "fill";
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

/** Phosphor line icon, rendered via the @phosphor-icons/web webfont. */
export function Icon({ name, weight = "regular", size = 20, className, style }: IconProps) {
  const cls = weight === "fill" ? "ph-fill" : weight === "bold" ? "ph-bold" : "ph";
  return (
    <i
      className={`${cls} ph-${name}${className ? ` ${className}` : ""}`}
      style={{ fontSize: size, lineHeight: 1, ...style }}
      aria-hidden="true"
    />
  );
}
