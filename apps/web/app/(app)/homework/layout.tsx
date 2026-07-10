"use client";

import { PERMISSIONS } from "@repo/constants";
import { can } from "@repo/core";
import Link from "next/link";
import type { ReactNode } from "react";

import { trpc } from "@/src/trpc/react";

/**
 * Homework console shell (M6, ADR-013). Reachable by anyone who can read homework —
 * admins (school-wide), teachers (own subject×section), and parents (own children).
 * Authorization is enforced in the business layer; this is UX gating only.
 */
export default function HomeworkLayout({ children }: { children: ReactNode }) {
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
    !can(role, PERMISSIONS.HOMEWORK_READ)
  ) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
        <p className="text-center text-muted-foreground">
          You don’t have access to homework. Please contact the school office.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 p-6">
      <header>
        <Link href="/dashboard" className="text-sm text-primary">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-semibold text-foreground">Homework</h1>
      </header>
      {children}
    </main>
  );
}
