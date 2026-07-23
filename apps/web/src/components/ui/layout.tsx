"use client";

import { cn } from "@repo/ui";
import type { ReactNode } from "react";

/**
 * Layout primitives (design handoff): PageHeader (gold eyebrow + serif H1 +
 * subtitle), Tabs (pill group in a cream container), Avatar.
 */

export function PageHeader({
  title,
  eyebrow,
  subtitle,
  breadcrumb,
  action,
}: {
  title: string;
  /** Gold uppercase kicker above the H1 (with the 28px gold rule). */
  eyebrow?: string | undefined;
  /** One-line grey subtitle under the H1. */
  subtitle?: string | undefined;
  breadcrumb?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        {breadcrumb && <div className="text-caption text-ink-500">{breadcrumb}</div>}
        {eyebrow && (
          <div className="flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-eyebrow text-gold-700">
            <span aria-hidden className="h-0.5 w-7 bg-gold-500" />
            {eyebrow}
          </div>
        )}
        <h1 className="font-display text-[34px] font-medium leading-tight text-ink-900">{title}</h1>
        {subtitle && <p className="text-sm text-ink-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export interface Tab {
  key: string;
  label: string;
  /** Optional count rendered as a small badge in the pill. */
  count?: number | undefined;
}

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: readonly Tab[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div
      role="tablist"
      className="inline-flex max-w-full flex-wrap items-center gap-1 self-start rounded-[24px] bg-cream-100 p-[5px]"
    >
      {tabs.map((tab) => {
        const selected = tab.key === active;
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.key)}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-fast",
              selected
                ? "bg-maroon-700 text-cream-50 shadow-sm"
                : "text-ink-500 hover:text-ink-800",
            )}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 ? (
              <span
                className={cn(
                  "inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 py-px text-caption font-bold",
                  selected ? "bg-cream-50/20 text-cream-50" : "bg-cream-200 text-ink-700",
                )}
              >
                {tab.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

// Deterministic heritage accent per person.
const AVATAR_BG = [
  "bg-maroon-700",
  "bg-gold-600",
  "bg-green-600",
  "bg-blue-600",
  "bg-maroon-500",
  "bg-amber-600",
] as const;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0]![0]! + (parts.length > 1 ? parts[parts.length - 1]![0]! : "")).toUpperCase();
}

function hashIndex(name: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % mod;
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const dim = { sm: "size-8 text-caption", md: "size-10 text-sm", lg: "size-12 text-body" }[size];
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-cream-50",
        AVATAR_BG[hashIndex(name, AVATAR_BG.length)],
        dim,
      )}
    >
      {initials(name)}
    </span>
  );
}
