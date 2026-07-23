"use client";

import { PERMISSIONS } from "@repo/constants";
import { can } from "@repo/core";
import type { ReactNode } from "react";

import { Skeleton } from "@/src/components/ui";
import { trpc } from "@/src/trpc/react";

/**
 * Homework console shell (M6, ADR-013; restyled per the design handoff §4).
 * Reachable by anyone who can read homework — admins (school-wide), teachers
 * (own subject×section), and parents (own children). The page owns its own
 * header/subtitle so the copy can flex per role; this is the access gate only.
 * Authorization is enforced in the business layer — this is UX gating.
 */
export default function HomeworkLayout({ children }: { children: ReactNode }) {
  const me = trpc.auth.me.useQuery();

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
    !can(role, PERMISSIONS.HOMEWORK_READ)
  ) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center p-6">
        <p className="text-center text-sm text-ink-500">
          You don’t have access to homework. Please contact the school office.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-6 pb-12 pt-7 lg:px-9">
      {children}
    </main>
  );
}
