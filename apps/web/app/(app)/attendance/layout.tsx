"use client";

import { PERMISSIONS } from "@repo/constants";
import { can } from "@repo/core";
import { cn } from "@repo/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Skeleton } from "@/src/components/ui";
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
 * Attendance dashboard shell (M4; restyled per the design handoff §7 — page
 * header pattern + pill tab group with pending-count badges on Leave/Corrections).
 * Requires an ACTIVE profile holding ATTENDANCE_READ (admins + teachers); tabs
 * are filtered per permission. Authorization is enforced in the business layer.
 */
export default function AttendanceLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const me = trpc.auth.me.useQuery();
  const role = me.data?.role;

  const canDecideLeave = role !== undefined && can(role, PERMISSIONS.LEAVE_DECIDE);
  const canDecideCorr = role !== undefined && can(role, PERMISSIONS.ATTENDANCE_CORRECT_DECIDE);
  const leavePending = trpc.leave.listPending.useQuery(undefined, {
    enabled: canDecideLeave,
    refetchInterval: 60_000,
  });
  const corrPending = trpc.attendanceCorrection.listPending.useQuery(undefined, {
    enabled: canDecideCorr,
    refetchInterval: 60_000,
  });
  const countFor = (href: string): number => {
    if (href === "/attendance/leave") return leavePending.data?.length ?? 0;
    if (href === "/attendance/corrections") return corrPending.data?.length ?? 0;
    return 0;
  };

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });

  if (me.isLoading) {
    return (
      <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-6 pb-12 pt-7 lg:px-9">
        <Skeleton className="h-24 w-2/3" />
        <Skeleton className="h-96 rounded-card" />
      </main>
    );
  }

  if (
    me.isError ||
    me.data?.status !== "ACTIVE" ||
    role === undefined ||
    !can(role, PERMISSIONS.ATTENDANCE_READ)
  ) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center p-6">
        <p className="text-center text-sm text-ink-500">
          You don’t have access to attendance. Please contact the school office.
        </p>
      </main>
    );
  }

  const tabs = TABS.filter((tab) => can(role, tab.permission));

  return (
    <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-6 pb-12 pt-7 lg:px-9">
      <section className="flex animate-fade-up flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-eyebrow text-gold-700">
            <span aria-hidden className="h-0.5 w-7 bg-gold-500" />
            Operations
          </div>
          <h1 className="font-display text-[34px] font-medium leading-tight tracking-[-0.01em] text-ink-900">
            Attendance
          </h1>
          <p className="text-sm text-ink-500">
            Daily registers, leave and corrections —{" "}
            <strong className="font-semibold text-ink-900">{today}</strong>.
          </p>
        </div>
        <nav
          aria-label="Attendance sections"
          className="flex max-w-full flex-wrap gap-1.5 self-start rounded-[24px] border border-subtle bg-cream-100 p-[5px]"
        >
          {tabs.map((tab) => {
            const active = pathname.startsWith(tab.href);
            const count = countFor(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap rounded-full px-[18px] py-[9px] text-[13.5px] font-semibold transition-colors duration-fast",
                  active
                    ? "bg-maroon-700 text-cream-50 shadow-sm"
                    : "text-ink-700 hover:text-maroon-800",
                )}
              >
                {tab.label}
                {count > 0 ? (
                  <span
                    className={cn(
                      "rounded-full px-[7px] py-px text-[11px] font-bold",
                      active ? "bg-gold-400 text-maroon-950" : "bg-maroon-700 text-cream-50",
                    )}
                  >
                    {count}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </section>
      <div className="animate-fade-up [animation-delay:80ms]">{children}</div>
    </main>
  );
}
