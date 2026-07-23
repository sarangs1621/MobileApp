"use client";

import {
  BellRinging,
  ChalkboardSimple,
  Clock,
  Coffee,
  Info,
  PencilSimple,
  Plus,
  Trash,
} from "@phosphor-icons/react";
import type { PeriodDto } from "@repo/types";
import { cn } from "@repo/ui";
import { useState } from "react";

import { periodsByTime, YearSelect } from "@/src/components/timetable/ui";
import {
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  Skeleton,
  StatusChip,
  useToast,
} from "@/src/components/ui";
import { trpc } from "@/src/trpc/react";

/** Minutes between two HH:MM clock strings (for the period duration chip). */
function durationMin(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return eh! * 60 + em! - (sh! * 60 + sm!);
}

/**
 * Bell schedule (one per year) + its period CRUD (design handoff §5). Periods are
 * ordered by start time — the design drops the manual "order" field, so new
 * periods append internally (order = max + 1) while the table + grids display by
 * time. Overlap/order conflicts still surface on save.
 */
export default function SchedulePage() {
  const { show } = useToast();
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
    onSuccess: () => {
      show("success", "Bell schedule created");
      return utils.bellSchedule.getForYear.invalidate();
    },
    onError: (e) => show("error", e.message),
  });
  const invalidatePeriods = () => utils.period.list.invalidate();
  const createPeriod = trpc.period.create.useMutation({
    onSuccess: () => {
      show("success", "Period saved");
      return invalidatePeriods();
    },
    onError: (e) => show("error", e.message),
  });
  const updatePeriod = trpc.period.update.useMutation({
    onSuccess: () => {
      show("success", "Period saved");
      return invalidatePeriods();
    },
    onError: (e) => show("error", e.message),
  });
  const removePeriod = trpc.period.delete.useMutation({
    onSuccess: () => {
      show("success", "Period deleted");
      return invalidatePeriods();
    },
    onError: (e) => show("error", e.message),
  });

  const [editing, setEditing] = useState<PeriodDto | "new" | null>(null);
  const [deleting, setDeleting] = useState<PeriodDto | null>(null);

  const rows = periodsByTime(periods.data ?? []);
  // New periods append at the end of the internal order sequence (display is by time).
  const nextOrder = rows.length > 0 ? Math.max(...rows.map((p) => p.order)) + 1 : 1;

  return (
    <section className="flex flex-col gap-3.5">
      {/* Filter row */}
      <div className="flex flex-wrap items-end gap-3">
        <YearSelect value={yearId} onChange={setYearId} />
        <div className="flex-1" />
        {yearId && schedule.data ? (
          <Button
            size="sm"
            icon={Plus}
            onClick={() => {
              createPeriod.reset();
              updatePeriod.reset();
              setEditing("new");
            }}
          >
            New period
          </Button>
        ) : null}
      </div>

      {!yearId ? (
        <div className="rounded-card border border-subtle bg-white shadow-sm">
          <EmptyState
            icon={BellRinging}
            title="Select an academic year"
            message="Pick a year above to manage its bell schedule and periods."
          />
        </div>
      ) : schedule.isLoading ? (
        <Skeleton className="h-64 rounded-card" />
      ) : !schedule.data ? (
        <div className="rounded-card border border-subtle bg-white p-6 shadow-sm">
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-ink-700">This year has no bell schedule yet.</p>
            {createSchedule.error ? (
              <p className="text-sm text-red-600">{createSchedule.error.message}</p>
            ) : null}
            <Button
              loading={createSchedule.isPending}
              onClick={() => createSchedule.mutate({ academicYearId: yearId, name: "Regular Day" })}
            >
              Create bell schedule
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-card border border-subtle bg-white shadow-sm">
            {/* Schedule header */}
            <div className="flex items-center gap-3 border-b border-cream-100 px-5 py-4">
              <span className="flex size-[38px] shrink-0 items-center justify-center rounded-xl bg-gold-100 text-gold-700">
                <BellRinging aria-hidden size={19} weight="bold" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-px">
                <span className="font-display text-[17px] font-semibold text-ink-900">
                  {schedule.data.name}
                </span>
                <span className="text-[12.5px] text-ink-500">
                  {rows.length} period{rows.length === 1 ? "" : "s"} · order follows start time
                  automatically
                </span>
              </span>
            </div>

            {periods.isLoading ? (
              <div className="flex flex-col gap-3 p-5">
                <Skeleton className="h-11" />
                <Skeleton className="h-11" />
              </div>
            ) : periods.isError ? (
              <ErrorState onRetry={() => periods.refetch()} />
            ) : rows.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="No periods yet."
                message="Add the first period to start the day — every timetable uses these slots."
                action={
                  <Button size="sm" icon={Plus} onClick={() => setEditing("new")}>
                    New period
                  </Button>
                }
              />
            ) : (
              <div>
                <div className="grid grid-cols-[1.4fr_1.2fr_0.9fr_auto] items-center gap-3 border-b border-cream-100 px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">
                  <span>Period</span>
                  <span>Time</span>
                  <span>Type</span>
                  <span className="w-[76px] text-right">Actions</span>
                </div>
                {rows.map((p, i) => (
                  <div
                    key={p.id}
                    className="grid grid-cols-[1.4fr_1.2fr_0.9fr_auto] items-center gap-3 border-b border-cream-100 px-5 py-3.5 transition-colors duration-fast last:border-0 hover:bg-cream-50"
                  >
                    <span className="flex items-center gap-2.5 text-[14.5px] font-semibold text-ink-900">
                      <span className="flex size-[30px] shrink-0 items-center justify-center rounded-[9px] bg-maroon-50 text-[13px] font-bold text-maroon-800">
                        {i + 1}
                      </span>
                      {p.name}
                    </span>
                    <span className="flex items-center gap-2 text-[13.5px] text-ink-500">
                      <Clock aria-hidden size={15} />
                      {p.startTime} – {p.endTime}
                      <span className="text-ink-300">·</span>
                      {durationMin(p.startTime, p.endTime)} min
                    </span>
                    <span>
                      {p.isBreak ? (
                        <StatusChip tone="neutral" label="Break" />
                      ) : (
                        <StatusChip tone="brand" label="Class" />
                      )}
                    </span>
                    <span className="flex w-[76px] justify-end gap-1.5">
                      <IconButton
                        label="Edit"
                        icon={PencilSimple}
                        onClick={() => {
                          createPeriod.reset();
                          updatePeriod.reset();
                          setEditing(p);
                        }}
                      />
                      <IconButton
                        label="Delete"
                        tone="danger"
                        icon={Trash}
                        onClick={() => {
                          removePeriod.reset();
                          setDeleting(p);
                        }}
                      />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="flex items-center gap-1.5 text-[12.5px] text-ink-400">
            <Info aria-hidden size={15} />
            Most schools run 6–8 periods with a morning break — add them once and every timetable
            uses them.
          </p>
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
            if (editing === "new") {
              createPeriod.mutate({ bellScheduleId, order: nextOrder, ...values }, done);
            } else {
              updatePeriod.mutate({ id: editing.id, ...values }, done);
            }
          }}
        />
      ) : null}

      {deleting !== null ? (
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          message="Delete this period? Periods used by timetable entries cannot be deleted —"
          confirmLabel="Delete period"
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
  const [startTime, setStartTime] = useState(period?.startTime ?? "09:00");
  const [endTime, setEndTime] = useState(period?.endTime ?? "09:45");
  const [isBreak, setIsBreak] = useState(period?.isBreak ?? false);

  const tiles: { break: boolean; label: string; icon: typeof ChalkboardSimple }[] = [
    { break: false, label: "Class", icon: ChalkboardSimple },
    { break: true, label: "Break", icon: Coffee },
  ];

  return (
    <Dialog title={period ? "Edit period" : "New period"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ name: name.trim(), startTime, endTime, isBreak });
        }}
        className="flex flex-col gap-[18px]"
      >
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Period 2"
          helper="Periods are ordered by start time — no sort number needed."
          required
        />
        <div className="grid grid-cols-2 gap-3.5">
          <Input
            label="Start"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
          />
          <Input
            label="End"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink-900">Type</span>
          <div className="flex gap-2">
            {tiles.map((tile) => {
              const selected = isBreak === tile.break;
              const TileIcon = tile.icon;
              return (
                <button
                  key={tile.label}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setIsBreak(tile.break)}
                  className={cn(
                    "flex flex-1 cursor-pointer flex-col items-center gap-1 rounded-xl border px-2 py-[11px] text-[13px] font-semibold transition-colors duration-fast",
                    selected
                      ? "border-maroon-700 bg-maroon-50 text-maroon-800"
                      : "border-subtle bg-white text-ink-500 hover:border-strong",
                  )}
                >
                  <TileIcon aria-hidden size={18} />
                  {tile.label}
                </button>
              );
            })}
          </div>
          <span className="text-caption text-ink-400">
            Breaks appear on timetables but can’t have lessons scheduled.
          </span>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="mt-1 flex justify-end gap-2.5">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Save period
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
