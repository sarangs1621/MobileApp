"use client";

import { PERMISSIONS } from "@repo/constants";
import { can } from "@repo/core";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { trpc } from "@/src/trpc/react";

const TABS = [
  { href: "/timetable/schedule", label: "Bell schedule & periods" },
  { href: "/timetable/grid", label: "Section timetable" },
  { href: "/timetable/teachers", label: "Teacher timetable" },
] as const;

/**
 * Timetable-management section shell (M9). Admin-only console (management needs
 * TIMETABLE_MANAGE); teachers/parents read their timetable on mobile. Authorization
 * is still enforced in the business layer — this gate is UX, not security.
 */
export default function TimetableLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const me = trpc.auth.me.useQuery();

  if (me.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <p className="text-muted-foreground">Loading…</p>
      </main>
    );
  }

  const role = me.data?.role;
  if (
    me.isError ||
    me.data?.status !== "ACTIVE" ||
    role === undefined ||
    !can(role, PERMISSIONS.TIMETABLE_MANAGE)
  ) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
        <p className="text-center text-muted-foreground">
          You don’t have access to timetable management. Please contact the school office.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/dashboard" className="text-sm text-primary">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-semibold text-foreground">Timetable</h1>
        </div>
        <nav aria-label="Timetable sections" className="flex flex-wrap gap-2">
          {TABS.map((tab) => {
            const active = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-md border px-3 py-2 text-sm font-medium ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-foreground hover:bg-accent"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </header>
      {children}
    </main>
  );
}
