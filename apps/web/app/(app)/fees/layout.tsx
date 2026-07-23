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
  { href: "/fees", label: "Invoices" },
  { href: "/fees/structures", label: "Fee structures" },
] as const;

/**
 * Fees console shell (M13, ADR-021; design handoff §9 — page header + pill tab
 * group). Admin-only (fee:manage); tabs are routes so they're links styled as
 * the handoff pills. Authorization is enforced in the business layer.
 */
export default function FeesLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // The printable receipt view is a standalone page (opens in its own tab) — no
  // console header/tabs around it.
  const isReceipt = pathname?.startsWith("/fees/receipt") ?? false;
  const me = trpc.auth.me.useQuery();
  const years = trpc.academicYear.list.useQuery(undefined, {
    enabled: me.data?.status === "ACTIVE",
  });
  const activeYear = years.data?.find((y) => y.status === "ACTIVE");

  if (isReceipt) return <>{children}</>;

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
    !can(role, PERMISSIONS.FEE_MANAGE)
  ) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center p-6">
        <p className="text-center text-sm text-ink-500">
          You don’t have access to the fees console. Please contact the school office.
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
            Operations
          </div>
          <h1 className="font-display text-[34px] font-medium leading-tight tracking-[-0.01em] text-ink-900">
            Fees &amp; payments
          </h1>
          <p className="text-sm text-ink-500">
            Invoices, receipts and fee structures
            {activeYear ? (
              <>
                {" "}
                — <strong className="font-semibold text-ink-900">{activeYear.name}</strong> session.
              </>
            ) : (
              "."
            )}
          </p>
        </div>
        <nav
          aria-label="Fees sections"
          className="flex max-w-full flex-wrap gap-1.5 self-start rounded-[24px] border border-subtle bg-cream-100 p-[5px]"
        >
          {TABS.map((tab) => {
            const active =
              tab.href === "/fees/structures"
                ? pathname.startsWith("/fees/structures")
                : pathname === "/fees";
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
