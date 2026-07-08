"use client";

import type { HolidayDto, HolidayTypeKey } from "@repo/types";
import { useState } from "react";

import {
  inputClass,
  labelClass,
  Modal,
  outlineBtn,
  primaryBtn,
  smallDangerBtn,
  TableShell,
} from "@/src/components/academic/ui";
import { ConfirmAction } from "@/src/components/people/confirm";
import { trpc } from "@/src/trpc/react";

const HOLIDAY_TYPES: readonly HolidayTypeKey[] = [
  "NATIONAL",
  "SCHOOL",
  "FESTIVAL",
  "EMERGENCY_CLOSURE",
];

/**
 * Holiday calendar management (admin, ACADEMIC_MANAGE — ADR-011 §9). One holiday
 * per date per year; a session cannot be opened on a holiday, so this is where
 * the working-day calendar is curated.
 */
export default function HolidaysPage() {
  const years = trpc.academicYear.list.useQuery();
  const [academicYearId, setAcademicYearId] = useState("");
  const holidays = trpc.holiday.list.useQuery(
    { academicYearId },
    { enabled: academicYearId !== "" },
  );

  const utils = trpc.useUtils();
  const invalidate = () => void utils.holiday.list.invalidate({ academicYearId });
  const create = trpc.holiday.create.useMutation({ onSuccess: invalidate });
  const remove = trpc.holiday.delete.useMutation({ onSuccess: invalidate });

  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<HolidayDto | null>(null);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className={labelClass}>
          Academic year
          <select
            value={academicYearId}
            onChange={(e) => setAcademicYearId(e.target.value)}
            className={inputClass}
          >
            <option value="">Select a year…</option>
            {(years.data ?? []).map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </select>
        </label>
        {academicYearId !== "" ? (
          <button
            type="button"
            onClick={() => {
              create.reset();
              setCreating(true);
            }}
            className={primaryBtn}
          >
            New holiday
          </button>
        ) : null}
      </div>

      {academicYearId === "" ? (
        <p className="text-muted-foreground">Pick a year to manage its holidays.</p>
      ) : (
        <TableShell
          head={["Date", "Name", "Type", "Actions"]}
          isLoading={holidays.isLoading}
          isError={holidays.isError}
          isEmpty={(holidays.data ?? []).length === 0}
          emptyText="No holidays for this year."
        >
          {(holidays.data ?? []).map((h) => (
            <tr key={h.id} className="border-b border-border last:border-b-0">
              <td className="px-4 py-3 font-medium text-foreground">{h.date}</td>
              <td className="px-4 py-3 text-muted-foreground">{h.name}</td>
              <td className="px-4 py-3 text-muted-foreground">{h.type}</td>
              <td className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => {
                    remove.reset();
                    setDeleting(h);
                  }}
                  className={smallDangerBtn}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </TableShell>
      )}

      {creating ? (
        <HolidayModal
          busy={create.isPending}
          error={create.error?.message ?? null}
          onClose={() => setCreating(false)}
          onSubmit={(values) =>
            create.mutate(
              { academicYearId, ...values },
              { onSuccess: () => setCreating(false) },
            )
          }
        />
      ) : null}

      {deleting !== null ? (
        <ConfirmAction
          title="Delete holiday"
          message={`Delete “${deleting.name}” on ${deleting.date}? Attendance can then be recorded on that day.`}
          actionLabel="Delete"
          busyLabel="Deleting…"
          busy={remove.isPending}
          error={remove.error?.message ?? null}
          onCancel={() => setDeleting(null)}
          onConfirm={() => remove.mutate({ id: deleting.id }, { onSuccess: () => setDeleting(null) })}
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
    <Modal title="New holiday" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ name, date, type });
        }}
        className="flex flex-col gap-3"
      >
        <label className={labelClass}>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} required />
        </label>
        <label className={labelClass}>
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
            required
          />
        </label>
        <label className={labelClass}>
          Type
          <select
            value={type}
            onChange={(e) => setType(e.target.value as HolidayTypeKey)}
            className={inputClass}
          >
            {HOLIDAY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
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
