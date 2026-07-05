"use client";

import { PERMISSIONS } from "@repo/constants";
import { can } from "@repo/core";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { trpc } from "@/src/trpc/react";

const TABS = [
  { href: "/people/students", label: "Students", permission: PERMISSIONS.STUDENT_READ },
  { href: "/people/parents", label: "Parents", permission: PERMISSIONS.PARENT_READ },
  {
    href: "/people/teacher-profiles",
    label: "Teacher profiles",
    permission: PERMISSIONS.STAFF_READ,
  },
] as const;

/**
 * People-management section shell (M3). Requires an ACTIVE profile holding
 * STUDENT_READ (every people role); tabs are filtered per permission so a
 * teacher never sees Parents and a parent never sees Teacher profiles.
 * Authorization is still enforced in the business layer — this is UX.
 */
export default function PeopleLayout({ children }: { children: ReactNode }) {
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
    !can(role, PERMISSIONS.STUDENT_READ)
  ) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
        <p className="text-center text-muted-foreground">
          You don’t have access to people management. Please contact the school office.
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
          <h1 className="text-2xl font-semibold text-foreground">People</h1>
        </div>
        <nav aria-label="People sections" className="flex flex-wrap gap-2">
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
