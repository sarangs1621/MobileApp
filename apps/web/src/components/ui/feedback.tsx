"use client";

import { cn } from "@repo/ui";
import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import { Button } from "./button";

/**
 * Status + feedback primitives (ADR-UX1). StatusChip renders EVERY enum in the
 * app through one semantic tone map — always color + Title-Case label, never
 * color alone (a11y `color-not-only`).
 */
export type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "brand" | "gold";

/** Handoff badge tones — soft tint fill + strong text, no border (DS Badge). */
const TONE: Record<Tone, string> = {
  success: "bg-green-100 text-green-600",
  warning: "bg-amber-100 text-amber-600",
  danger: "bg-red-100 text-red-600",
  info: "bg-blue-100 text-blue-600",
  neutral: "bg-cream-200 text-ink-700",
  brand: "bg-maroon-100 text-maroon-800",
  gold: "bg-gold-100 text-gold-800",
};

/**
 * Map a raw enum value → semantic tone. Extend as screens adopt it (Step 4).
 * Unknown values fall back to `neutral` — safe, never color-only.
 */
const STATUS_TONE: Record<string, Tone> = {
  // attendance
  PRESENT: "success",
  ABSENT: "danger",
  LATE: "warning",
  LEAVE: "info",
  HALF_DAY: "warning",
  // academic year lifecycle
  ACTIVE: "success",
  PLANNED: "info",
  // lifecycle (homework / report card / announcement / document / exam register)
  PUBLISHED: "success",
  APPROVED: "success",
  LOCKED: "success",
  DRAFT: "info",
  SUBMITTED: "info",
  GENERATED: "info",
  UPLOADED: "info",
  OPEN: "info",
  PENDING: "warning",
  IN_PROGRESS: "warning",
  RETURNED: "warning",
  PARTIAL: "warning",
  CLOSED: "neutral",
  ARCHIVED: "neutral",
  SUPERSEDED: "neutral",
  CANCELLED: "neutral",
  REVOKED: "danger",
  // fees
  PAID: "success",
  ISSUED: "info",
  OVERDUE: "danger",
  // leave / corrections
  RESOLVED: "success",
  REJECTED: "danger",
};

export function statusTone(status: string): Tone {
  return STATUS_TONE[status.toUpperCase()] ?? "neutral";
}

/** Title-case a raw ENUM_VALUE for display. */
export function titleCase(raw: string): string {
  return raw
    .toLowerCase()
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function StatusChip({
  status,
  tone,
  label,
  dot,
  className,
}: {
  /** Raw enum value — tone + label are derived unless overridden. */
  status?: string | undefined;
  tone?: Tone | undefined;
  label?: string | undefined;
  /** Leading currentColor dot (handoff "Action needed" style). */
  dot?: boolean | undefined;
  className?: string | undefined;
}) {
  const resolvedTone = tone ?? (status ? statusTone(status) : "neutral");
  const text = label ?? (status ? titleCase(status) : "");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-caption font-semibold tracking-[0.02em]",
        TONE[resolvedTone],
        className,
      )}
    >
      {dot ? <span aria-hidden className="size-1.5 rounded-full bg-current" /> : null}
      {text}
    </span>
  );
}

/** Small count/label badge (e.g. notification counts). */
export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-caption font-semibold",
        TONE[tone],
      )}
    >
      {children}
    </span>
  );
}

/** Accepts both Phosphor and legacy lucide icon components. */
type IconComponent = ComponentType<{
  className?: string | undefined;
  "aria-hidden"?: boolean | undefined;
}>;

/** Inline contextual banner (e.g. "3 sections not marked today"). */
export function Banner({
  tone = "warning",
  icon: Icon = AlertTriangle,
  children,
}: {
  tone?: Tone;
  icon?: IconComponent;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex items-start gap-2 rounded-lg p-3 text-sm", TONE[tone])}>
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

/** Empty state — icon, message, optional primary action. Every list uses one. */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  message,
  action,
}: {
  icon?: IconComponent | undefined;
  title: string;
  message?: string | undefined;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-[14px] bg-cream-100">
        <Icon aria-hidden className="size-6 text-ink-400" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="font-display text-title text-ink-800">{title}</p>
        {message && <p className="text-sm text-ink-500">{message}</p>}
      </div>
      {action}
    </div>
  );
}

/** Error state — friendly message + Retry. */
export function ErrorState({
  message = "Something went wrong loading this. You may not have access, or the server is unreachable.",
  onRetry,
}: {
  message?: string | undefined;
  onRetry?: (() => void) | undefined;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-danger-50">
        <AlertTriangle aria-hidden strokeWidth={1.5} className="size-6 text-danger-600" />
      </span>
      <p className="max-w-sm text-sm text-neutral-600">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" icon={RefreshCw} onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

/** Skeleton — loading mirrors the final layout (never a lone spinner). */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-cream-200", className)} />;
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-4", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}
