"use client";

import { CircleNotch } from "@phosphor-icons/react";
import { cn } from "@repo/ui";
import { forwardRef, type ButtonHTMLAttributes, type ComponentType } from "react";

/**
 * Button (design handoff DS). Pill radius, semibold label, subtle hover lift.
 * Variants map to the DS bundle: primary (maroon), secondary (outline on
 * parchment), ghost, destructive. Loading keeps the button width (spinner
 * replaces the icon in place). Every clickable gets cursor-pointer + a visible
 * gold focus ring.
 */
type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary:
    "border border-maroon-700 bg-maroon-700 text-cream-50 shadow-sm hover:bg-maroon-800 hover:border-maroon-800",
  secondary:
    "border border-strong bg-transparent text-maroon-700 hover:bg-maroon-50 hover:border-maroon-300",
  ghost: "border border-transparent text-maroon-700 hover:bg-maroon-50",
  destructive: "border border-red-600 bg-red-600 text-white shadow-sm hover:bg-danger-700",
};

const SIZE: Record<Size, string> = {
  sm: "h-[38px] px-3.5 text-[13px] gap-1.5",
  md: "h-[46px] px-5 text-[15px] gap-2",
  lg: "h-14 px-6 text-[17px] gap-2.5",
};

/** Accepts both Phosphor and legacy lucide icon components. */
type IconComponent = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant | undefined;
  size?: Size | undefined;
  loading?: boolean | undefined;
  icon?: IconComponent | undefined;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    icon: Icon,
    className,
    children,
    disabled,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center whitespace-nowrap rounded-full font-semibold tracking-[0.01em]",
        "transition-[background-color,border-color,box-shadow,transform] duration-fast",
        "hover:-translate-y-0.5 active:translate-y-px",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0",
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <CircleNotch aria-hidden className="size-4 animate-spin" />
      ) : (
        Icon && <Icon aria-hidden className="size-4" />
      )}
      {children}
    </button>
  );
});

/**
 * Square icon-only action button (design handoff table rows) — 32px, 9px radius,
 * hairline border; brand (maroon) or danger (red) hover tint. `label` doubles as
 * the accessible name and the tooltip.
 */
export function IconButton({
  label,
  tone = "brand",
  icon: Icon,
  className,
  ...props
}: {
  label: string;
  tone?: "brand" | "danger" | undefined;
  icon: IconComponent;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "flex size-8 cursor-pointer items-center justify-center rounded-[9px] border border-subtle bg-white transition-colors duration-fast",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        tone === "brand"
          ? "text-maroon-700 hover:border-maroon-200 hover:bg-maroon-50"
          : "text-red-600 hover:border-red-600 hover:bg-red-100",
        className,
      )}
      {...props}
    >
      <Icon aria-hidden className="size-[15px]" />
    </button>
  );
}
