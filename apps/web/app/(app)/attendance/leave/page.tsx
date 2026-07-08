"use client";

import { smallDangerBtn, smallGhostBtn, TableShell } from "@/src/components/academic/ui";
import { trpc } from "@/src/trpc/react";

/**
 * Leave approval queue (admin). Pending requests school-wide, enriched with the
 * child's name; approve/reject stamps the decision. Approval writes no attendance
 * — approved leave only biases the marking default (ADR-011 §7).
 */
export default function LeaveApprovalPage() {
  const pending = trpc.leave.listPending.useQuery();
  const utils = trpc.useUtils();
  const decide = trpc.leave.decide.useMutation({
    onSuccess: () => void utils.leave.listPending.invalidate(),
  });

  const rows = pending.data ?? [];

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-foreground">Pending leave</h2>
      <TableShell
        head={["Student", "From", "To", "Reason", "Actions"]}
        isLoading={pending.isLoading}
        isError={pending.isError}
        isEmpty={rows.length === 0}
        emptyText="No pending leave requests."
      >
        {rows.map((leave) => (
          <tr key={leave.id} className="border-b border-border last:border-b-0">
            <td className="px-4 py-3 font-medium text-foreground">{leave.studentName}</td>
            <td className="px-4 py-3 text-muted-foreground">{leave.fromDate}</td>
            <td className="px-4 py-3 text-muted-foreground">{leave.toDate}</td>
            <td className="px-4 py-3 text-muted-foreground">{leave.reason}</td>
            <td className="px-4 py-3">
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ leaveId: leave.id, decision: "APPROVED" })}
                  className={smallGhostBtn}
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ leaveId: leave.id, decision: "REJECTED" })}
                  className={smallDangerBtn}
                >
                  Reject
                </button>
              </div>
            </td>
          </tr>
        ))}
      </TableShell>
      {decide.error ? <p className="text-sm text-destructive">{decide.error.message}</p> : null}
    </section>
  );
}
