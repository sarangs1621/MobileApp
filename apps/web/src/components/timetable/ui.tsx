"use client";

import { Plus } from "@phosphor-icons/react";
import type { PeriodDto, TimetableEntryDto, WeekdayKey } from "@repo/types";
import { cn } from "@repo/ui";

import { Select } from "@/src/components/ui";
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

/** Index (0..5) of today in the Mon–Sat grid, in school time; −1 on Sunday. */
export function todayWeekdayIndex(): number {
  const dow = new Date().toLocaleDateString("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
  });
  return WEEKDAYS.findIndex((d) => d.short === dow);
}

/** Periods sorted for display — by start time (the design's "order follows start time"). */
export function periodsByTime(periods: PeriodDto[]): PeriodDto[] {
  return [...periods].sort((a, b) => a.startTime.localeCompare(b.startTime) || a.order - b.order);
}

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
    <div className="min-w-[170px]">
      <Select label="Academic year" value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
        <option value="" disabled>
          Select a year…
        </option>
        {(years.data ?? []).map((y) => (
          <option key={y.id} value={y.id}>
            {y.name}
            {y.status === "ACTIVE" ? " (active)" : ""}
          </option>
        ))}
      </Select>
    </div>
  );
}

/**
 * Weekly grid (design handoff §5): periods (rows) × Mon–Sat (columns), today's
 * column highlighted in gold. Rows follow start time so empty and break slots
 * render (break rows span, non-editable). `onCell` (admin editor) makes empty
 * teaching cells clickable "add" targets and filled cells clickable to edit;
 * omit it for the read-only teacher grid, which shows "Free" for empty slots.
 * `secondary` picks the sub-line: the section grid shows the teacher, the
 * teacher grid shows the section.
 */
export function TimetableGrid({
  periods,
  entries,
  onCell,
  secondary = "teacher",
}: {
  periods: PeriodDto[];
  entries: TimetableEntryDto[];
  onCell?: (weekday: WeekdayKey, period: PeriodDto) => void;
  secondary?: "teacher" | "section";
}) {
  const byCell = new Map(entries.map((e) => [`${e.weekday}:${e.periodId}`, e]));
  const rows = periodsByTime(periods);
  const today = todayWeekdayIndex();
  const editable = onCell !== undefined;

  return (
    <div className="overflow-x-auto rounded-card border border-subtle bg-white shadow-sm">
      <div className="min-w-[760px]">
        {/* Header */}
        <div className="grid grid-cols-[1.1fr_repeat(6,1fr)] border-b border-cream-100">
          <span className="px-4 py-[11px] text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">
            Period
          </span>
          {WEEKDAYS.map((d, i) => (
            <span
              key={d.key}
              className={cn(
                "border-l border-cream-100 px-3 py-[11px] text-[11px] font-bold uppercase tracking-[0.1em]",
                i === today ? "bg-gold-100 text-gold-700" : "text-ink-400",
              )}
            >
              {d.short}
            </span>
          ))}
        </div>

        {/* Rows */}
        {rows.map((p) => (
          <div
            key={p.id}
            className="grid grid-cols-[1.1fr_repeat(6,1fr)] items-stretch border-b border-cream-100 last:border-0"
          >
            <span className="flex flex-col gap-0.5 bg-cream-50 px-4 py-3.5">
              <span className="text-[13.5px] font-semibold text-ink-900">{p.name}</span>
              <span className="text-xs text-ink-400">
                {p.startTime} – {p.endTime}
              </span>
            </span>

            {p.isBreak ? (
              <span className="col-span-6 flex items-center justify-center border-l border-cream-100 bg-cream-50/60 px-3 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-ink-400">
                {p.name}
              </span>
            ) : (
              WEEKDAYS.map((d, i) => {
                const entry = byCell.get(`${d.key}:${p.id}`);
                if (entry) {
                  const sub = secondary === "teacher" ? entry.teacherName : entry.sectionName;
                  const content = (
                    <>
                      <span className="truncate text-[13px] font-semibold text-maroon-800">
                        {entry.subjectName}
                      </span>
                      <span className="truncate text-[11.5px] text-ink-500">
                        {sub}
                        {entry.room ? ` · ${entry.room}` : ""}
                      </span>
                    </>
                  );
                  return editable ? (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => onCell(d.key, p)}
                      className={cn(
                        "flex min-h-16 flex-col gap-0.5 border-l border-cream-100 p-3 text-left transition-colors duration-fast hover:bg-maroon-100",
                        i === today ? "bg-maroon-100/60" : "bg-maroon-50",
                      )}
                    >
                      {content}
                    </button>
                  ) : (
                    <span
                      key={d.key}
                      className={cn(
                        "flex min-h-16 flex-col gap-0.5 border-l border-cream-100 p-3",
                        i === today ? "bg-maroon-100/60" : "bg-maroon-50",
                      )}
                    >
                      {content}
                    </span>
                  );
                }
                // Empty slot
                return editable ? (
                  <button
                    key={d.key}
                    type="button"
                    title="Add lesson"
                    onClick={() => onCell(d.key, p)}
                    className={cn(
                      "flex min-h-16 items-center justify-center border-l border-cream-100 text-ink-300 transition-colors duration-fast hover:bg-gold-100 hover:text-gold-700",
                      i === today ? "bg-gold-100/40" : "bg-white",
                    )}
                  >
                    <Plus aria-hidden size={16} />
                  </button>
                ) : (
                  <span
                    key={d.key}
                    className={cn(
                      "flex min-h-16 items-center justify-center border-l border-cream-100 text-xs text-sand-300",
                      i === today ? "bg-gold-100/40" : "bg-white",
                    )}
                  >
                    Free
                  </span>
                );
              })
            )}
          </div>
        ))}
      </div>
    </div>
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
