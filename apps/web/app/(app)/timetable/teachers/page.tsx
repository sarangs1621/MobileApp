"use client";

import { DownloadSimple } from "@phosphor-icons/react";
import { useMemo, useState } from "react";

import {
  downloadCsv,
  entriesToCsv,
  TimetableGrid,
  WEEKDAYS,
  YearSelect,
} from "@/src/components/timetable/ui";
import { Avatar, EmptyState, Select } from "@/src/components/ui";
import { trpc } from "@/src/trpc/react";

/** Read-only teacher timetable (design handoff §5) — workload header card + weekly grid + CSV. */
export default function TeachersPage() {
  const [yearId, setYearId] = useState<string>();
  const [teacherId, setTeacherId] = useState<string>();

  const teachers = trpc.teacherProfile.list.useQuery();
  const subjects = trpc.subject.list.useQuery();
  const assignments = trpc.teacherAssignment.list.useQuery(
    { teacherId: teacherId! },
    { enabled: !!teacherId },
  );
  const schedule = trpc.bellSchedule.getForYear.useQuery(
    { academicYearId: yearId! },
    { enabled: !!yearId },
  );
  const periods = trpc.period.list.useQuery(
    { bellScheduleId: schedule.data?.id ?? "" },
    { enabled: !!schedule.data?.id },
  );
  const entries = trpc.timetable.byTeacher.useQuery(
    { academicYearId: yearId!, teacherId: teacherId! },
    { enabled: !!yearId && !!teacherId },
  );

  const rows = periods.data ?? [];
  const entryRows = entries.data ?? [];
  const teacher = (teachers.data ?? []).find((t) => t.userId === teacherId);

  // Workload: scheduled lessons out of teaching slots (teaching periods × 6 weekdays).
  const teachingPeriods = rows.filter((p) => !p.isBreak).length;
  const totalSlots = teachingPeriods * WEEKDAYS.length;

  // Subtitle: distinct subjects the teacher is assigned to teach.
  const subjectName = useMemo(
    () => new Map((subjects.data ?? []).map((s) => [s.id, s.name])),
    [subjects.data],
  );
  const taughtSubjects = useMemo(
    () =>
      [...new Set((assignments.data ?? []).map((a) => subjectName.get(a.subjectId) ?? ""))]
        .filter(Boolean)
        .join(" & "),
    [assignments.data, subjectName],
  );

  return (
    <section className="flex flex-col gap-3.5">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <YearSelect value={yearId} onChange={setYearId} />
        <div className="min-w-[180px]">
          <Select
            label="Teacher"
            value={teacherId ?? ""}
            onChange={(e) => setTeacherId(e.target.value || undefined)}
          >
            <option value="">Select…</option>
            {(teachers.data ?? []).map((t) => (
              <option key={t.userId} value={t.userId}>
                {t.name} · {t.employeeId}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex-1" />
        {yearId && teacherId && entryRows.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              const { headers, rows: r } = entriesToCsv(entryRows);
              downloadCsv(`teacher-timetable-${teacher?.name ?? teacherId}.csv`, headers, r);
            }}
            className="flex cursor-pointer items-center gap-1.5 rounded-full border border-subtle bg-white px-4 py-2.5 text-[12.5px] font-semibold text-maroon-700 transition-colors duration-fast hover:border-maroon-200 hover:bg-maroon-50"
          >
            <DownloadSimple aria-hidden size={15} />
            Export CSV
          </button>
        ) : null}
      </div>

      {/* Workload header card */}
      {teacher && yearId ? (
        <div className="flex items-center gap-3.5 rounded-card bg-maroon-900 px-5 py-4 text-cream-50">
          <Avatar name={teacher.name} size="lg" />
          <span className="flex min-w-0 flex-1 flex-col gap-px">
            <span className="font-display text-[17px] font-semibold">{teacher.name}</span>
            <span className="truncate text-[12.5px] text-cream-50/70">
              {teacher.employeeId}
              {taughtSubjects ? ` · ${taughtSubjects}` : ""}
            </span>
          </span>
          <span className="flex flex-col gap-px text-right">
            <span className="font-display text-xl font-semibold text-gold-300">
              {entryRows.length} / {totalSlots || "—"}
            </span>
            <span className="text-[11.5px] text-cream-50/70">periods scheduled this week</span>
          </span>
        </div>
      ) : null}

      {!yearId || !teacherId ? (
        <div className="rounded-card border border-subtle bg-white shadow-sm">
          <EmptyState
            title="Pick a teacher"
            message="Choose a year and a teacher to view their weekly timetable."
          />
        </div>
      ) : !schedule.data ? (
        <div className="rounded-card border border-subtle bg-white shadow-sm">
          <EmptyState title="No bell schedule yet" message="This year has no bell schedule." />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-card border border-subtle bg-white shadow-sm">
          <EmptyState title="No periods yet" message="The bell schedule has no periods." />
        </div>
      ) : (
        <TimetableGrid periods={rows} entries={entryRows} secondary="section" />
      )}
    </section>
  );
}
