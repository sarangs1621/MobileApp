"use client";

import { AirplaneTilt, Check, Info } from "@phosphor-icons/react";

import { Avatar, EmptyState, ErrorState, Skeleton, useToast } from "@/src/components/ui";
import { trpc } from "@/src/trpc/react";

const fmt = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

/** Inclusive day span between two calendar-date strings. */
function daySpan(from: string, to: string): number {
  const d = Math.round(
    (new Date(to + "T00:00:00").getTime() - new Date(from + "T00:00:00").getTime()) / 86_400_000,
  );
  return Math.max(1, d + 1);
}

/**
 * Leave approval queue (M4, ADR-011 §7; design handoff §7). Pending requests
 * school-wide, enriched with the child's name; approve/reject stamps the
 * decision. Approval writes no attendance — approved leave only biases the
 * marking default. Office staff can't create leave (LEAVE_APPLY is a parent
 * permission), so this tab is approval-only.
 */
export default function LeaveApprovalPage() {
  const { show } = useToast();
  const pending = trpc.leave.listPending.useQuery();
  const utils = trpc.useUtils();
  const decide = trpc.leave.decide.useMutation({
    onSuccess: (_data, variables) => {
      show(
        "success",
        variables.decision === "APPROVED"
          ? "Leave approved — register updated"
          : "Leave request rejected",
      );
      return utils.leave.listPending.invalidate();
    },
    onError: (e) => show("error", e.message),
  });

  const rows = pending.data ?? [];

  return (
    <section className="flex flex-col gap-3.5">
      <div className="overflow-hidden rounded-card border border-subtle bg-white shadow-sm">
        <div className="grid grid-cols-[1.5fr_1fr_1.3fr_1.4fr_auto] items-center gap-3 border-b border-cream-100 px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">
          <span>Student</span>
          <span>From</span>
          <span>To</span>
          <span>Reason</span>
          <span className="w-[180px] text-right">Actions</span>
        </div>

        {pending.isLoading ? (
          <div className="flex flex-col gap-3 p-5">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : pending.isError ? (
          <ErrorState onRetry={() => pending.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={AirplaneTilt}
            title="No pending leave requests."
            message="Leave applied by parents on the app appears here for approval."
          />
        ) : (
          rows.map((l) => (
            <div
              key={l.id}
              className="grid grid-cols-[1.5fr_1fr_1.3fr_1.4fr_auto] items-center gap-3 border-b border-cream-100 px-5 py-3.5 transition-colors duration-fast last:border-0 hover:bg-cream-50"
            >
              <span className="flex items-center gap-2.5">
                <Avatar name={l.studentName} size="sm" />
                <span className="truncate text-sm font-semibold text-ink-900">{l.studentName}</span>
              </span>
              <span className="text-[13.5px] text-ink-500">{fmt(l.fromDate)}</span>
              <span className="text-[13.5px] text-ink-500">
                {fmt(l.toDate)}{" "}
                <span className="text-ink-400">· {daySpan(l.fromDate, l.toDate)} days</span>
              </span>
              <span className="truncate text-[13.5px] text-ink-700">{l.reason}</span>
              <span className="flex w-[180px] justify-end gap-1.5">
                <button
                  type="button"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ leaveId: l.id, decision: "APPROVED" })}
                  className="flex cursor-pointer items-center gap-1.5 rounded-full bg-green-600 px-3.5 py-[7px] text-[12.5px] font-semibold text-white transition-[filter] duration-fast hover:brightness-95 disabled:opacity-50"
                >
                  <Check aria-hidden size={13} weight="bold" />
                  Approve
                </button>
                <button
                  type="button"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ leaveId: l.id, decision: "REJECTED" })}
                  className="cursor-pointer rounded-full border border-subtle bg-white px-3.5 py-[7px] text-[12.5px] font-semibold text-red-600 transition-colors duration-fast hover:border-red-600 hover:bg-red-100 disabled:opacity-50"
                >
                  Reject
                </button>
              </span>
            </div>
          ))
        )}
      </div>

      <p className="flex items-center gap-1.5 text-[12.5px] text-ink-400">
        <Info aria-hidden size={15} />
        Approved leave marks the student as “On leave” in the register automatically — no double
        entry.
      </p>
    </section>
  );
}
