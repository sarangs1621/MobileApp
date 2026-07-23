"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";
import type { RoleKey } from "@repo/constants";
import { cn } from "@repo/ui";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { visibleNavGroups } from "./nav-config";

/**
 * Ctrl+K command palette (design handoff top-bar search, frontend-only scope).
 * Navigates to the modules this role can see — no search API involved. Opens
 * from the top-bar search box or Ctrl/Cmd+K; arrows + Enter to pick, Esc closes.
 */
export function CommandPalette({
  role,
  open,
  onClose,
}: {
  role: RoleKey;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = useMemo(() => {
    const all = visibleNavGroups(role).flatMap((g) =>
      g.items.map((i) => ({ ...i, group: g.label || "General" })),
    );
    const q = query.trim().toLowerCase();
    return q ? all.filter((i) => i.label.toLowerCase().includes(q)) : all;
  }, [role, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
      // Focus after the panel mounts.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  if (!open) return null;

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Go to page"
      className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[18vh]"
    >
      <div aria-hidden onClick={onClose} className="absolute inset-0 bg-[rgba(36,26,17,0.55)]" />
      <div className="relative w-full max-w-[540px] animate-pop-in overflow-hidden rounded-modal border border-subtle bg-white shadow-modal">
        <div className="flex items-center gap-2.5 border-b border-subtle px-4 py-3.5">
          <MagnifyingGlass aria-hidden size={18} className="shrink-0 text-ink-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            placeholder="Jump to a page…"
            aria-label="Jump to a page"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => Math.min(c + 1, items.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => Math.max(c - 1, 0));
              }
              if (e.key === "Enter" && items[cursor]) go(items[cursor].href);
            }}
            className="flex-1 border-none bg-transparent text-sm text-ink-900 outline-none placeholder:text-ink-400"
          />
          <span className="rounded-md border border-subtle bg-cream-100 px-1.5 py-0.5 text-[11px] text-ink-400">
            Esc
          </span>
        </div>
        <div className="max-h-[320px] overflow-y-auto p-2">
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-ink-500">No matching pages.</p>
          ) : (
            items.map((item, i) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => go(item.href)}
                  onMouseEnter={() => setCursor(i)}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-sm",
                    i === cursor ? "bg-maroon-50 text-maroon-800" : "text-ink-700",
                  )}
                >
                  <Icon
                    aria-hidden
                    size={17}
                    className={i === cursor ? "text-maroon-700" : "text-ink-400"}
                  />
                  <span className="flex-1 font-medium">{item.label}</span>
                  <span className="text-[11px] uppercase tracking-[0.08em] text-ink-400">
                    {item.group}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
