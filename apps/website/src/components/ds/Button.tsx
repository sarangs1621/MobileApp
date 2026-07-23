"use client";

import Link from "next/link";
import type React from "react";

type ButtonVariant = "primary" | "accent" | "secondary" | "ghost" | "inverse";
type ButtonSize = "sm" | "md" | "lg";

const SIZES: Record<
  ButtonSize,
  { fontSize: string; padding: string; height: number; gap: string }
> = {
  sm: { fontSize: "0.8125rem", padding: "0.5rem 0.9rem", height: 38, gap: "0.4rem" },
  md: { fontSize: "0.9375rem", padding: "0.7rem 1.25rem", height: 46, gap: "0.5rem" },
  lg: { fontSize: "1.0625rem", padding: "0.9rem 1.6rem", height: 56, gap: "0.6rem" },
};

interface VariantStyle {
  background: string;
  color: string;
  border: string;
  boxShadow?: string;
  hoverBg?: string;
  hoverShadow?: string;
  hoverBorder?: string;
}

const VARIANTS: Record<ButtonVariant, VariantStyle> = {
  primary: {
    background: "var(--brand)",
    color: "var(--text-on-brand)",
    border: "1px solid var(--brand)",
    boxShadow: "var(--shadow-sm)",
    hoverBg: "var(--brand-hover)",
    hoverShadow: "var(--shadow-brand)",
  },
  accent: {
    background: "var(--gold-500)",
    color: "var(--ink-900)",
    border: "1px solid var(--gold-500)",
    boxShadow: "var(--shadow-sm)",
    hoverBg: "var(--gold-400)",
    hoverShadow: "var(--shadow-md)",
  },
  secondary: {
    background: "transparent",
    color: "var(--text-brand)",
    border: "1px solid var(--border-strong)",
    hoverBg: "var(--maroon-50)",
    hoverBorder: "var(--maroon-300)",
  },
  ghost: {
    background: "transparent",
    color: "var(--text-brand)",
    border: "1px solid transparent",
    hoverBg: "var(--maroon-50)",
  },
  inverse: {
    background: "var(--cream-50)",
    color: "var(--maroon-900)",
    border: "1px solid var(--cream-50)",
    boxShadow: "var(--shadow-md)",
    hoverBg: "var(--white)",
    hoverShadow: "var(--shadow-lg)",
  },
};

interface ButtonProps {
  children?: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
  disabled?: boolean;
  /** Internal path ("/admissions") renders a Next <Link>; any other href a plain <a>. */
  href?: string;
  target?: string;
  rel?: string;
  type?: "button" | "submit";
  title?: string;
  "aria-label"?: string;
  onClick?: React.MouseEventHandler<HTMLElement>;
  style?: React.CSSProperties;
}

/**
 * Button — primary call-to-action across the site (Apply Now, Enquire, Book a Visit).
 */
export function Button({
  children,
  variant = "primary",
  size = "md",
  iconLeft,
  iconRight,
  fullWidth = false,
  disabled = false,
  href,
  target,
  rel,
  type = "button",
  title,
  "aria-label": ariaLabel,
  onClick,
  style,
}: ButtonProps) {
  const s = SIZES[size];
  const v = VARIANTS[variant];

  const base: React.CSSProperties = {
    display: fullWidth ? "flex" : "inline-flex",
    width: fullWidth ? "100%" : undefined,
    alignItems: "center",
    justifyContent: "center",
    gap: s.gap,
    fontFamily: "var(--font-sans)",
    fontWeight: 600,
    fontSize: s.fontSize,
    lineHeight: 1,
    letterSpacing: "0.01em",
    padding: s.padding,
    minHeight: s.height,
    borderRadius: "var(--radius-pill)",
    cursor: disabled ? "not-allowed" : "pointer",
    textDecoration: "none",
    whiteSpace: "nowrap",
    opacity: disabled ? 0.5 : 1,
    transition:
      "transform var(--dur-fast) var(--ease-out), background var(--dur) var(--ease-out), box-shadow var(--dur) var(--ease-out), border-color var(--dur) var(--ease-out)",
    background: v.background,
    color: v.color,
    border: v.border,
    boxShadow: v.boxShadow,
    ...style,
  };

  const enter = (e: React.MouseEvent<HTMLElement>) => {
    if (disabled) return;
    const el = e.currentTarget;
    el.style.transform = "translateY(-2px)";
    if (v.hoverBg) el.style.background = v.hoverBg;
    if (v.hoverShadow) el.style.boxShadow = v.hoverShadow;
    if (v.hoverBorder) el.style.borderColor = v.hoverBorder;
  };
  const press = (e: React.MouseEvent<HTMLElement>) => {
    if (!disabled) e.currentTarget.style.transform = "translateY(1px)";
  };
  const reset = (e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget;
    el.style.transform = "translateY(0)";
    el.style.background = v.background;
    el.style.boxShadow = v.boxShadow ?? "";
    el.style.border = v.border;
  };

  // Conditional spreads keep explicitly-undefined props out of the JSX —
  // required by exactOptionalPropertyTypes for Link/anchor/button props.
  const shared = {
    style: base,
    onMouseEnter: enter,
    onMouseDown: press,
    onMouseUp: enter,
    onMouseLeave: reset,
    ...(title !== undefined && { title }),
    ...(ariaLabel !== undefined && { "aria-label": ariaLabel }),
    ...(onClick !== undefined && { onClick }),
  };
  const linkTarget = {
    ...(target !== undefined && { target }),
    ...(rel !== undefined && { rel }),
  };

  const content = (
    <>
      {iconLeft}
      {children}
      {iconRight}
    </>
  );

  if (href && href.startsWith("/")) {
    return (
      <Link href={href} {...linkTarget} {...shared}>
        {content}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} {...linkTarget} {...shared}>
        {content}
      </a>
    );
  }
  return (
    <button type={type} disabled={disabled} {...shared}>
      {content}
    </button>
  );
}
