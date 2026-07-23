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
  { href: "/academic/years", label: "Academic years" },
  { href: "/academic/classes", label: "Classes" },
  { href: "/academic/subjects", label: "Subjects" },
  { href: "/academic/assignments", label: "Teacher assignments" },
  { href: "/academic/class-teachers", label: "Class teachers" },
] as const;

/**
 * Academic-structure section shell (design handoff §2 — page header pattern +
 * pill tab group; tabs are routes, so they're links styled as the handoff's
 * pills). The server (app) layout already requires a session; this gate
 * additionally requires an ACTIVE profile whose role holds ACADEMIC_READ
 * (admins + teachers). Authorization is still enforced in the business layer —
 * this is UX, not security.
 */
export default function AcademicLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const me = trpc.auth.me.useQuery();
  // Subtitle names the active session (e.g. "2026-27") when one exists.
  const years = trpc.academicYear.list.useQuery(undefined, {
    enabled: me.data?.status === "ACTIVE",
  });
  const activeYear = years.data?.find((y) => y.status === "ACTIVE");

  if (me.isLoading) {
    return (
      <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-6 pb-12 pt-7 lg:px-9">
        <Skeleton className="h-24 w-2/3" />
        <Skeleton className="h-96 rounded-card" />
      </main>
    );
  }

  const role = me.data?.role;
  if (
    me.isError ||
    me.data?.status !== "ACTIVE" ||
    role === undefined ||
    !can(role, PERMISSIONS.ACADEMIC_READ)
  ) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center p-6">
        <p className="text-center text-sm text-ink-500">
          You don’t have access to the academic structure. Please contact the school office.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-6 pb-12 pt-7 lg:px-9">
      <section className="flex animate-fade-up flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-eyebrow text-gold-700">
            <span aria-hidden className="h-0.5 w-7 bg-gold-500" />
            Academics
          </div>
          <h1 className="font-display text-[34px] font-medium leading-tight tracking-[-0.01em] text-ink-900">
            Academic structure
          </h1>
          <p className="text-sm text-ink-500">
            Years, classes, subjects and who teaches what
            {activeYear ? (
              <>
                {" "}
                — for the <strong className="font-semibold text-ink-900">
                  {activeYear.name}
                </strong>{" "}
                session.
              </>
            ) : (
              "."
            )}
          </p>
        </div>
        <nav
          aria-label="Academic sections"
          className="flex max-w-full flex-wrap gap-1.5 self-start rounded-[24px] border border-subtle bg-cream-100 p-[5px]"
        >
          {TABS.map((tab) => {
            const active = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "whitespace-nowrap rounded-full px-[18px] py-[9px] text-[13.5px] font-semibold transition-colors duration-fast",
                  active
                    ? "bg-maroon-700 text-cream-50 shadow-sm"
                    : "text-ink-700 hover:text-maroon-800",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </section>
      <div className="animate-fade-up [animation-delay:80ms]">{children}</div>
    </main>
  );
}
