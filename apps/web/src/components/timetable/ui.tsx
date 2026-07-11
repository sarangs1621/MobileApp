"use client";

import type { PeriodDto, TimetableEntryDto, WeekdayKey } from "@repo/types";

import { inputClass } from "@/src/components/academic/ui";
import { trpc } from "@/src/trpc/react";

/** Grid columns: Mon–Sat (Indian school norm; no working-days config in M9). */
export const WEEKDAYS: readonly { key: WeekdayKey; label: string; short: string }[] = [
  { key: "MON", label: "Monday", short: "Mon" },
  { key: "TUE", label: "Tuesday", short: "Tue" },
  { key: "WED", label: "Wednesday", short: "Wed" },
  { key: "THU", label: "Thursday", short: "Thu" },
  { key: "FRI", label: "Friday", short: "Fri" },
  { key: "SAT", label: "Saturday", short: "Sat" },
];

/** Year picker (admin builds any year — PLANNED/ACTIVE/CLOSED — so an explicit year is required). */
export function YearSelect({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (id: string) => void;
}) {
  const years = trpc.academicYear.list.useQuery();
  return (
    <label className="flex items-center gap-2 text-sm font-medium text-foreground">
      Academic year
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
        aria-label="Academic year"
      >
        <option value="" disabled>
          Select a year…
        </option>
        {(years.data ?? []).map((y) => (
          <option key={y.id} value={y.id}>
            {y.name}
            {y.status === "ACTIVE" ? " (active)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Weekly grid: periods (rows) × Mon–Sat (columns). Rows come from the bell
 * schedule's periods so empty and break slots render (break rows span, non-editable).
 * `onCell` (admin editor) makes empty teaching cells clickable "add" targets and
 * filled cells clickable to edit; omit it for a read-only grid.
 */
export function TimetableGrid({
  periods,
  entries,
  onCell,
}: {
  periods: PeriodDto[];
  entries: TimetableEntryDto[];
  onCell?: (weekday: WeekdayKey, period: PeriodDto) => void;
}) {
  const byCell = new Map(entries.map((e) => [`${e.weekday}:${e.periodId}`, e]));

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-border bg-muted px-3 py-2 text-left font-medium">
              Period
            </th>
            {WEEKDAYS.map((d) => (
              <th
                key={d.key}
                className="border border-border bg-muted px-3 py-2 text-left font-medium"
              >
                {d.short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periods.map((p) => (
            <tr key={p.id}>
              <th className="border border-border bg-muted/50 px-3 py-2 text-left font-medium">
                <div className="text-foreground">{p.name}</div>
                <div className="text-xs text-muted-foreground">
                  {p.startTime}–{p.endTime}
                </div>
              </th>
              {p.isBreak ? (
                <td
                  colSpan={WEEKDAYS.length}
                  className="border border-border bg-muted/30 px-3 py-2 text-center text-muted-foreground"
                >
                  {p.name}
                </td>
              ) : (
                WEEKDAYS.map((d) => {
                  const entry = byCell.get(`${d.key}:${p.id}`);
                  return (
                    <td key={d.key} className="border border-border p-0 align-top">
                      <Cell entry={entry} onClick={onCell ? () => onCell(d.key, p) : undefined} />
                    </td>
                  );
                })
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Cell({
  entry,
  onClick,
}: {
  entry?: TimetableEntryDto | undefined;
  onClick?: (() => void) | undefined;
}) {
  const content = entry ? (
    <>
      <div className="font-medium text-foreground">{entry.subjectName}</div>
      <div className="text-xs text-muted-foreground">{entry.teacherName}</div>
      {entry.room ? <div className="text-xs text-muted-foreground">{entry.room}</div> : null}
    </>
  ) : (
    <span className="text-muted-foreground">+</span>
  );

  if (!onClick) {
    return <div className="min-h-14 px-3 py-2">{entry ? content : null}</div>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-14 w-full px-3 py-2 text-left hover:bg-accent"
    >
      {content}
    </button>
  );
}

/** Trigger a browser download of CSV rows. Every field is quoted + internal quotes doubled. */
export function downloadCsv(filename: string, headers: string[], rows: string[][]): void {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Timetable entries → CSV rows (Weekday, Period, Time, Subject, Teacher, Section, Room). */
export function entriesToCsv(entries: TimetableEntryDto[]): {
  headers: string[];
  rows: string[][];
} {
  const labelOf = (k: WeekdayKey) => WEEKDAYS.find((d) => d.key === k)?.label ?? k;
  return {
    headers: ["Weekday", "Period", "Time", "Subject", "Teacher", "Section", "Room"],
    rows: entries.map((e) => [
      labelOf(e.weekday),
      e.periodName,
      `${e.startTime}-${e.endTime}`,
      e.subjectName,
      e.teacherName,
      e.sectionName,
      e.room ?? "",
    ]),
  };
}
