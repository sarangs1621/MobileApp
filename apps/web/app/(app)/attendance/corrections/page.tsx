"use client";

import { smallDangerBtn, smallGhostBtn, TableShell } from "@/src/components/academic/ui";
import { STATUS_LABEL } from "@/src/components/attendance/ui";
import { trpc } from "@/src/trpc/react";

/**
 * Correction approval queue (admin). Pending requests enriched with student name
 * + the record's date. Approve applies `requestedStatus` to the record in one
 * audited transaction (optimistic-guarded); reject leaves it untouched. The
 * record is never overwritten silently (ADR-011 §8).
 */
export default function CorrectionApprovalPage() {
  const pending = trpc.attendanceCorrection.listPending.useQuery();
  const utils = trpc.useUtils();
  const decide = trpc.attendanceCorrection.decide.useMutation({
    onSuccess: () => void utils.attendanceCorrection.listPending.invalidate(),
  });

  const rows = pending.data ?? [];

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-foreground">Pending corrections</h2>
      <TableShell
        head={["Student", "Date", "Change", "Reason", "Actions"]}
        isLoading={pending.isLoading}
        isError={pending.isError}
        isEmpty={rows.length === 0}
        emptyText="No pending corrections."
      >
        {rows.map((c) => (
          <tr key={c.id} className="border-b border-border last:border-b-0">
            <td className="px-4 py-3 font-medium text-foreground">{c.studentName}</td>
            <td className="px-4 py-3 text-muted-foreground">{c.date}</td>
            <td className="px-4 py-3 text-muted-foreground">
              {STATUS_LABEL[c.previousStatus]} → {STATUS_LABEL[c.requestedStatus]}
            </td>
            <td className="px-4 py-3 text-muted-foreground">{c.reason}</td>
            <td className="px-4 py-3">
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ correctionId: c.id, decision: "APPROVED" })}
                  className={smallGhostBtn}
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ correctionId: c.id, decision: "REJECTED" })}
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
