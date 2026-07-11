"use client";

import type { PeriodDto } from "@repo/types";
import { useState } from "react";

import {
  ConfirmDelete,
  inputClass,
  labelClass,
  Modal,
  outlineBtn,
  primaryBtn,
  smallDangerBtn,
  smallGhostBtn,
  TableShell,
} from "@/src/components/academic/ui";
import { YearSelect } from "@/src/components/timetable/ui";
import { trpc } from "@/src/trpc/react";

/** Bell schedule (one per year) + its period CRUD. Overlap/order conflicts surface on save. */
export default function SchedulePage() {
  const [yearId, setYearId] = useState<string>();
  const utils = trpc.useUtils();

  const schedule = trpc.bellSchedule.getForYear.useQuery(
    { academicYearId: yearId! },
    { enabled: !!yearId },
  );
  const bellScheduleId = schedule.data?.id;
  const periods = trpc.period.list.useQuery(
    { bellScheduleId: bellScheduleId! },
    { enabled: !!bellScheduleId },
  );

  const createSchedule = trpc.bellSchedule.create.useMutation({
    onSuccess: () => utils.bellSchedule.getForYear.invalidate(),
  });
  const invalidatePeriods = () => utils.period.list.invalidate();
  const createPeriod = trpc.period.create.useMutation({ onSuccess: invalidatePeriods });
  const updatePeriod = trpc.period.update.useMutation({ onSuccess: invalidatePeriods });
  const removePeriod = trpc.period.delete.useMutation({ onSuccess: invalidatePeriods });

  const [editing, setEditing] = useState<PeriodDto | "new" | null>(null);
  const [deleting, setDeleting] = useState<PeriodDto | null>(null);

  return (
    <section className="flex flex-col gap-4">
      <YearSelect value={yearId} onChange={setYearId} />

      {!yearId ? (
        <p className="text-muted-foreground">
          Select an academic year to manage its bell schedule.
        </p>
      ) : schedule.isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : !schedule.data ? (
        <div className="flex flex-col items-start gap-3 rounded-md border border-border bg-card p-6">
          <p className="text-foreground">This year has no bell schedule yet.</p>
          {createSchedule.error ? (
            <p className="text-sm text-destructive">{createSchedule.error.message}</p>
          ) : null}
          <button
            type="button"
            disabled={createSchedule.isPending}
            className={primaryBtn}
            onClick={() => createSchedule.mutate({ academicYearId: yearId, name: "Regular Day" })}
          >
            {createSchedule.isPending ? "Creating…" : "Create bell schedule"}
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between rounded-md border border-border bg-card px-4 py-3">
            <div>
              <div className="text-sm text-muted-foreground">Bell schedule</div>
              <div className="font-medium text-foreground">{schedule.data.name}</div>
            </div>
            <button
              type="button"
              className={primaryBtn}
              onClick={() => {
                createPeriod.reset();
                updatePeriod.reset();
                setEditing("new");
              }}
            >
              New period
            </button>
          </div>

          <TableShell
            head={["#", "Name", "Time", "Type", "Actions"]}
            isLoading={periods.isLoading}
            isError={periods.isError}
            isEmpty={(periods.data ?? []).length === 0}
            emptyText="No periods yet. Add the first period to start the day."
          >
            {(periods.data ?? []).map((p) => (
              <tr key={p.id} className="border-b border-border last:border-b-0">
                <td className="px-4 py-3 text-muted-foreground">{p.order}</td>
                <td className="px-4 py-3 font-medium text-foreground">{p.name}</td>
                <td className="px-4 py-3 text-foreground">
                  {p.startTime}–{p.endTime}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{p.isBreak ? "Break" : "Class"}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className={smallGhostBtn}
                      onClick={() => {
                        createPeriod.reset();
                        updatePeriod.reset();
                        setEditing(p);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className={smallDangerBtn}
                      onClick={() => {
                        removePeriod.reset();
                        setDeleting(p);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </TableShell>
        </>
      )}

      {editing !== null && bellScheduleId ? (
        <PeriodFormModal
          period={editing === "new" ? null : editing}
          busy={createPeriod.isPending || updatePeriod.isPending}
          error={createPeriod.error?.message ?? updatePeriod.error?.message ?? null}
          onClose={() => setEditing(null)}
          onSubmit={(values) => {
            const done = { onSuccess: () => setEditing(null) };
            if (editing === "new") createPeriod.mutate({ bellScheduleId, ...values }, done);
            else updatePeriod.mutate({ id: editing.id, ...values }, done);
          }}
        />
      ) : null}

      {deleting !== null ? (
        <ConfirmDelete
          title="Delete period"
          message={`Delete “${deleting.name}”? Periods used by timetable entries cannot be deleted.`}
          busy={removePeriod.isPending}
          error={removePeriod.error?.message ?? null}
          onCancel={() => setDeleting(null)}
          onConfirm={() =>
            removePeriod.mutate({ id: deleting.id }, { onSuccess: () => setDeleting(null) })
          }
        />
      ) : null}
    </section>
  );
}

interface PeriodValues {
  name: string;
  order: number;
  startTime: string;
  endTime: string;
  isBreak: boolean;
}

function PeriodFormModal({
  period,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  period: PeriodDto | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: PeriodValues) => void;
}) {
  const [name, setName] = useState(period?.name ?? "");
  const [order, setOrder] = useState(String(period?.order ?? ""));
  const [startTime, setStartTime] = useState(period?.startTime ?? "09:00");
  const [endTime, setEndTime] = useState(period?.endTime ?? "09:45");
  const [isBreak, setIsBreak] = useState(period?.isBreak ?? false);

  return (
    <Modal title={period ? "Edit period" : "New period"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ name: name.trim(), order: Number(order), startTime, endTime, isBreak });
        }}
        className="flex flex-col gap-3"
      >
        <label className={labelClass}>
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="Period 1"
            required
          />
        </label>
        <label className={labelClass}>
          Order
          <input
            type="number"
            min={1}
            value={order}
            onChange={(e) => setOrder(e.target.value)}
            className={inputClass}
            required
          />
        </label>
        <div className="flex gap-3">
          <label className={labelClass}>
            Start
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className={inputClass}
              required
            />
          </label>
          <label className={labelClass}>
            End
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className={inputClass}
              required
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <input type="checkbox" checked={isBreak} onChange={(e) => setIsBreak(e.target.checked)} />
          This is a break (no class scheduled)
        </label>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={outlineBtn}>
            Cancel
          </button>
          <button type="submit" disabled={busy} className={primaryBtn}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
