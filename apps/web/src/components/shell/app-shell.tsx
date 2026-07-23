"use client";

import { CalendarBlank, MagnifyingGlass } from "@phosphor-icons/react";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { NotificationBell } from "@/src/components/notification/ui";
import { trpc } from "@/src/trpc/react";

import { ToastProvider } from "../ui";

import { CommandPalette } from "./command-palette";
import { pageLabelFor } from "./nav-config";
import { Sidebar } from "./sidebar";

/**
 * App shell (design handoff, global shell) — fixed maroon sidebar + sticky
 * translucent top bar (breadcrumb, Ctrl+K page search, date line, notification
 * bell) around every protected page. Resolves the role via `auth.me` (same query
 * the dashboard uses; tRPC dedupes) to build the gated nav. Mounts the
 * ToastProvider so any mutation can toast. Presentation only — route protection
 * stays in the server `(app)` layout.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const me = trpc.auth.me.useQuery();
  const role = me.data?.role;
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Ctrl/Cmd+K opens the page navigator.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const dateLine = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Kolkata",
  });

  return (
    <ToastProvider>
      <div className="flex min-h-dvh items-stretch bg-cream-50">
        {role ? (
          <Sidebar role={role} />
        ) : (
          <div className="w-16 shrink-0 bg-maroon-950 xl:w-[264px]" />
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center gap-5 border-b border-subtle bg-cream-50/85 px-6 py-3 backdrop-blur-[10px] lg:px-8">
            <div className="whitespace-nowrap text-[13px] text-ink-500">
              School portal <span className="px-1 text-ink-300">/</span>{" "}
              <span className="font-semibold text-ink-900">{pageLabelFor(pathname ?? "")}</span>
            </div>
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="hidden max-w-[440px] flex-1 cursor-pointer items-center gap-2.5 rounded-full border border-subtle bg-white px-3.5 py-2 text-left transition-colors duration-fast hover:border-strong md:flex"
            >
              <MagnifyingGlass aria-hidden size={16} className="shrink-0 text-ink-400" />
              <span className="flex-1 truncate text-[13.5px] text-ink-400">Search pages…</span>
              <span className="rounded-md border border-subtle bg-cream-100 px-1.5 py-0.5 text-[11px] text-ink-400">
                Ctrl K
              </span>
            </button>
            <div className="flex-1" />
            <div className="hidden items-center gap-2 whitespace-nowrap text-[13px] text-ink-500 lg:flex">
              <CalendarBlank aria-hidden size={16} />
              {dateLine}
            </div>
            <NotificationBell />
          </header>
          {/* Bare content slot — pages keep their own <main>/padding until they
              migrate onto the handoff page-header pattern. */}
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
      {role ? (
        <CommandPalette role={role} open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      ) : null}
    </ToastProvider>
  );
}
