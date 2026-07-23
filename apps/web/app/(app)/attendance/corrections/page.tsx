"use client";

import { ArrowRight, Check, Info, PencilLine } from "@phosphor-icons/react";

import { STATUS_LABEL } from "@/src/components/attendance/ui";
import {
  Avatar,
  EmptyState,
  ErrorState,
  Skeleton,
  StatusChip,
  useToast,
} from "@/src/components/ui";
import { trpc } from "@/src/trpc/react";

const fmt = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

/**
 * Correction approval queue (M4, ADR-011 §8; design handoff §7). Pending requests
 * enriched with the student's name + the record's date. Approve applies
 * `requestedStatus` to the record in one audited transaction (optimistic-guarded);
 * reject leaves it untouched. Teachers request corrections from the register.
 */
export default function CorrectionApprovalPage() {
  const { show } = useToast();
  const pending = trpc.attendanceCorrection.listPending.useQuery();
  const utils = trpc.useUtils();
  const decide = trpc.attendanceCorrection.decide.useMutation({
    onSuccess: (_data, variables) => {
      show(
        "success",
        variables.decision === "APPROVED"
          ? "Correction approved — record updated"
          : "Correction rejected",
      );
      return utils.attendanceCorrection.listPending.invalidate();
    },
    onError: (e) => show("error", e.message),
  });

  const rows = pending.data ?? [];

  return (
    <section className="flex flex-col gap-3.5">
      <div className="overflow-hidden rounded-card border border-subtle bg-white shadow-sm">
        <div className="grid grid-cols-[1.5fr_1fr_1.3fr_1.3fr_auto] items-center gap-3 border-b border-cream-100 px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">
          <span>Student</span>
          <span>Date</span>
          <span>Change</span>
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
            icon={PencilLine}
            title="No pending corrections."
            message="When a teacher requests a change to a locked register, it appears here."
          />
        ) : (
          rows.map((c) => (
            <div
              key={c.id}
              className="grid grid-cols-[1.5fr_1fr_1.3fr_1.3fr_auto] items-center gap-3 border-b border-cream-100 px-5 py-3.5 transition-colors duration-fast last:border-0 hover:bg-cream-50"
            >
              <span className="flex items-center gap-2.5">
                <Avatar name={c.studentName} size="sm" />
                <span className="truncate text-sm font-semibold text-ink-900">{c.studentName}</span>
              </span>
              <span className="text-[13.5px] text-ink-500">{fmt(c.date)}</span>
              <span className="flex items-center gap-2">
                <StatusChip status={c.previousStatus} label={STATUS_LABEL[c.previousStatus]} />
                <ArrowRight aria-hidden size={13} className="text-ink-400" />
                <StatusChip status={c.requestedStatus} label={STATUS_LABEL[c.requestedStatus]} />
              </span>
              <span className="truncate text-[13.5px] text-ink-700">{c.reason}</span>
              <span className="flex w-[180px] justify-end gap-1.5">
                <button
                  type="button"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ correctionId: c.id, decision: "APPROVED" })}
                  className="flex cursor-pointer items-center gap-1.5 rounded-full bg-green-600 px-3.5 py-[7px] text-[12.5px] font-semibold text-white transition-[filter] duration-fast hover:brightness-95 disabled:opacity-50"
                >
                  <Check aria-hidden size={13} weight="bold" />
                  Approve
                </button>
                <button
                  type="button"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ correctionId: c.id, decision: "REJECTED" })}
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
        Teachers request corrections from the register; approving updates the record and the summary
        instantly.
      </p>
    </section>
  );
}
