"use client";

import type React from "react";

const SIZES = { sm: 36, md: 48, lg: 64, xl: 88 } as const;

interface AvatarProps {
  src?: string;
  alt?: string;
  name?: string;
  size?: keyof typeof SIZES | number;
  ring?: boolean;
  style?: React.CSSProperties;
}

/**
 * Avatar — circular portrait for faculty, principal, testimonials and alumni.
 * Falls back to initials on a maroon tint when no image is given.
 */
export function Avatar({
  src,
  alt = "",
  name = "",
  size = "md",
  ring = false,
  style,
}: AvatarProps) {
  const px = typeof size === "number" ? size : SIZES[size];
  const initials = name
    .split(" ")
    .map((w) => w.charAt(0))
    .filter((c) => c !== "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      style={{
        width: px,
        height: px,
        borderRadius: "50%",
        overflow: "hidden",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--maroon-100)",
        color: "var(--maroon-700)",
        fontFamily: "var(--font-display)",
        fontWeight: 600,
        fontSize: px * 0.38,
        flex: "none",
        boxShadow: ring
          ? "0 0 0 2px var(--surface-card), 0 0 0 4px var(--gold-400)"
          : "var(--shadow-inset-hairline)",
        ...style,
      }}
    >
      {src ? (
        <img
          src={src}
          alt={alt || name}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        initials
      )}
    </span>
  );
}
