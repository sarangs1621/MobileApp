"use client";

import { PERMISSIONS } from "@repo/constants";
import { can } from "@repo/core";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { trpc } from "@/src/trpc/react";

const TABS = [
  { href: "/attendance/mark", label: "Mark", permission: PERMISSIONS.ATTENDANCE_MARK },
  { href: "/attendance/summary", label: "Summary", permission: PERMISSIONS.ATTENDANCE_READ },
  { href: "/attendance/leave", label: "Leave", permission: PERMISSIONS.LEAVE_DECIDE },
  {
    href: "/attendance/corrections",
    label: "Corrections",
    permission: PERMISSIONS.ATTENDANCE_CORRECT_DECIDE,
  },
  { href: "/attendance/holidays", label: "Holidays", permission: PERMISSIONS.ACADEMIC_MANAGE },
] as const;

/**
 * Attendance dashboard shell (M4). Requires an ACTIVE profile holding
 * ATTENDANCE_READ (admins + teachers); tabs are filtered per permission so a
 * teacher sees only Mark + Summary, admins see the approval + holiday tabs.
 * Authorization is still enforced in the business layer — this is UX.
 */
export default function AttendanceLayout({ children }: { children: ReactNode }) {
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
    !can(role, PERMISSIONS.ATTENDANCE_READ)
  ) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
        <p className="text-center text-muted-foreground">
          You don’t have access to attendance. Please contact the school office.
        </p>
      </main>
    );
  }

  const tabs = TABS.filter((tab) => can(role, tab.permission));

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/dashboard" className="text-sm text-primary">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-semibold text-foreground">Attendance</h1>
        </div>
        <nav aria-label="Attendance sections" className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
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
