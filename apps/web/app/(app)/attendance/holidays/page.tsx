"use client";

import {
  Buildings,
  CalendarX,
  CloudRain,
  Confetti,
  Flag,
  Info,
  Plus,
  Trash,
  type Icon,
} from "@phosphor-icons/react";
import type { HolidayDto, HolidayTypeKey } from "@repo/types";
import { cn } from "@repo/ui";
import { useState } from "react";

import {
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  Select,
  Skeleton,
  StatusChip,
  useToast,
  type Tone,
} from "@/src/components/ui";
import { trpc } from "@/src/trpc/react";

const HOLIDAY_TYPES: { key: HolidayTypeKey; label: string; icon: Icon; tone: Tone }[] = [
  { key: "NATIONAL", label: "National", icon: Flag, tone: "brand" },
  { key: "SCHOOL", label: "School", icon: Buildings, tone: "neutral" },
  { key: "FESTIVAL", label: "Festival", icon: Confetti, tone: "gold" },
  { key: "EMERGENCY_CLOSURE", label: "Emergency closure", icon: CloudRain, tone: "danger" },
];
const TYPE_META = new Map(HOLIDAY_TYPES.map((t) => [t.key, t]));

/** Parse a YYYY-MM-DD into day / month / weekday parts for the date tile. */
function dateParts(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return {
    day: String(d.getDate()),
    mon: d.toLocaleDateString("en-IN", { month: "short" }),
    dow: d.toLocaleDateString("en-IN", { weekday: "long" }),
  };
}

/**
 * Holiday calendar management (M4, ADR-011 §9; design handoff §7). One holiday
 * per date per year; a session cannot be opened on a holiday, so this is where
 * the working-day calendar is curated. The modal uses the handoff's type tiles.
 */
export default function HolidaysPage() {
  const { show } = useToast();
  const years = trpc.academicYear.list.useQuery();
  const activeYear = years.data?.find((y) => y.status === "ACTIVE");
  const [pickedYearId, setPickedYearId] = useState("");
  const academicYearId = pickedYearId || activeYear?.id || "";

  const holidays = trpc.holiday.list.useQuery(
    { academicYearId },
    { enabled: academicYearId !== "" },
  );

  const utils = trpc.useUtils();
  const invalidate = () => void utils.holiday.list.invalidate({ academicYearId });
  const create = trpc.holiday.create.useMutation({
    onSuccess: () => {
      show("success", "Holiday saved");
      return invalidate();
    },
    onError: (e) => show("error", e.message),
  });
  const remove = trpc.holiday.delete.useMutation({
    onSuccess: () => {
      show("success", "Holiday removed");
      return invalidate();
    },
    onError: (e) => show("error", e.message),
  });

  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<HolidayDto | null>(null);

  const rows = [...(holidays.data ?? [])].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <section className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[150px]">
          <Select
            label="Academic year"
            value={academicYearId}
            onChange={(e) => setPickedYearId(e.target.value)}
          >
            {(years.data ?? []).map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
                {y.status === "ACTIVE" ? " (active)" : ""}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex-1" />
        {academicYearId !== "" ? (
          <Button
            size="sm"
            icon={Plus}
            onClick={() => {
              create.reset();
              setCreating(true);
            }}
          >
            New holiday
          </Button>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-card border border-subtle bg-white shadow-sm">
        <div className="grid grid-cols-[1.2fr_1.6fr_1fr_auto] items-center gap-3 border-b border-cream-100 px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">
          <span>Date</span>
          <span>Name</span>
          <span>Type</span>
          <span className="w-11 text-right" />
        </div>

        {academicYearId === "" ? (
          <EmptyState icon={CalendarX} title="Pick a year to manage its holidays." />
        ) : holidays.isLoading ? (
          <div className="flex flex-col gap-3 p-5">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : holidays.isError ? (
          <ErrorState onRetry={() => holidays.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={CalendarX}
            title="No holidays for this year."
            message="Add public holidays and closures — they block marking and are excluded from percentages."
            action={
              <Button size="sm" icon={Plus} onClick={() => setCreating(true)}>
                New holiday
              </Button>
            }
          />
        ) : (
          rows.map((h) => {
            const p = dateParts(h.date);
            const meta = TYPE_META.get(h.type);
            return (
              <div
                key={h.id}
                className="grid grid-cols-[1.2fr_1.6fr_1fr_auto] items-center gap-3 border-b border-cream-100 px-5 py-3 transition-colors duration-fast last:border-0 hover:bg-cream-50"
              >
                <span className="flex items-center gap-2.5">
                  <span className="flex size-[38px] flex-col items-center justify-center rounded-[11px] bg-cream-100 leading-none">
                    <span className="text-sm font-bold text-maroon-800">{p.day}</span>
                    <span className="text-[9px] uppercase tracking-[0.08em] text-ink-400">
                      {p.mon}
                    </span>
                  </span>
                  <span className="text-[13px] text-ink-500">{p.dow}</span>
                </span>
                <span className="truncate text-sm font-semibold text-ink-900">{h.name}</span>
                <span>
                  <StatusChip tone={meta?.tone ?? "neutral"} label={meta?.label ?? h.type} />
                </span>
                <span className="flex w-11 justify-end">
                  <IconButton
                    label="Delete"
                    tone="danger"
                    icon={Trash}
                    onClick={() => {
                      remove.reset();
                      setDeleting(h);
                    }}
                  />
                </span>
              </div>
            );
          })
        )}
      </div>

      <p className="flex items-center gap-1.5 text-[12.5px] text-ink-400">
        <Info aria-hidden size={15} />
        Holidays block attendance marking and are excluded from percentage calculations.
      </p>

      {creating ? (
        <HolidayModal
          busy={create.isPending}
          error={create.error?.message ?? null}
          onClose={() => setCreating(false)}
          onSubmit={(values) =>
            create.mutate({ academicYearId, ...values }, { onSuccess: () => setCreating(false) })
          }
        />
      ) : null}

      {deleting !== null ? (
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          message={`Remove this holiday on ${dateParts(deleting.date).day} ${dateParts(deleting.date).mon}? Attendance can then be recorded on that day.`}
          confirmLabel="Delete holiday"
          busy={remove.isPending}
          error={remove.error?.message ?? null}
          onCancel={() => setDeleting(null)}
          onConfirm={() =>
            remove.mutate({ id: deleting.id }, { onSuccess: () => setDeleting(null) })
          }
        />
      ) : null}
    </section>
  );
}

function HolidayModal({
  busy,
  error,
  onClose,
  onSubmit,
}: {
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: { name: string; date: string; type: HolidayTypeKey }) => void;
}) {
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [type, setType] = useState<HolidayTypeKey>("SCHOOL");

  return (
    <Dialog title="New holiday" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ name: name.trim(), date, type });
        }}
        className="flex flex-col gap-[18px]"
      >
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Onam"
          required
        />
        <Input
          label="Date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />

        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink-900">Type</span>
          <div className="grid grid-cols-2 gap-2">
            {HOLIDAY_TYPES.map((t) => {
              const selected = type === t.key;
              const TileIcon = t.icon;
              return (
                <button
                  key={t.key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setType(t.key)}
                  className={cn(
                    "flex cursor-pointer items-center justify-center gap-1.5 rounded-[11px] border px-2 py-[11px] text-[12.5px] font-semibold transition-colors duration-fast",
                    selected
                      ? "border-maroon-700 bg-maroon-50 text-maroon-800"
                      : "border-subtle bg-white text-ink-500 hover:border-strong",
                  )}
                >
                  <TileIcon aria-hidden size={16} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="mt-1 flex justify-end gap-2.5">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Save holiday
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
