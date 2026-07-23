"use client";

import { cn } from "@repo/ui";
import type { ComponentType, ReactNode } from "react";

/**
 * Card (design handoff) — white surface on the parchment page, 1px sand hairline,
 * 16px radius, soft warm shadow. `interactive` adds the handoff's hover lift.
 * The optional `accent` domain colour renders as a left border so modules scan
 * fast (legacy screens; the handoff look mostly drops it).
 */
type Accent = "attendance" | "exams" | "homework" | "fees" | "calendar" | "messages";

const ACCENT_BORDER: Record<Accent, string> = {
  attendance: "border-l-4 border-l-attendance",
  exams: "border-l-4 border-l-exams",
  homework: "border-l-4 border-l-homework",
  fees: "border-l-4 border-l-fees",
  calendar: "border-l-4 border-l-calendar",
  messages: "border-l-4 border-l-messages",
};

export function Card({
  children,
  className,
  interactive,
  accent,
  ...props
}: {
  children: ReactNode;
  className?: string | undefined;
  interactive?: boolean | undefined;
  accent?: Accent | undefined;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-card border border-subtle bg-white p-5 shadow-sm",
        accent && ACCENT_BORDER[accent],
        interactive &&
          "cursor-pointer transition-[transform,box-shadow] duration-base hover:-translate-y-1 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** Stat card — uppercase label + serif value (+ optional delta + icon tile). */
export function StatCard({
  label,
  value,
  delta,
  icon: Icon,
  accent,
}: {
  label: string;
  value: ReactNode;
  delta?: { value: string; positive?: boolean } | undefined;
  icon?: ComponentType<{ className?: string; "aria-hidden"?: boolean }> | undefined;
  accent?: Accent | undefined;
}) {
  return (
    <Card accent={accent} className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-ink-500">
          {label}
        </p>
        {Icon && (
          <span className="flex size-[34px] items-center justify-center rounded-[10px] bg-maroon-50 text-maroon-700">
            <Icon aria-hidden className="size-[18px]" />
          </span>
        )}
      </div>
      <p className="font-display text-[34px] font-medium leading-none tabular-nums text-ink-900">
        {value}
      </p>
      {delta && (
        <p
          className={cn(
            "text-caption font-medium",
            delta.positive ? "text-green-600" : "text-red-600",
          )}
        >
          {delta.value}
        </p>
      )}
    </Card>
  );
}
