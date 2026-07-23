"use client";

import { DownloadSimple, Info } from "@phosphor-icons/react";
import type { PeriodDto, TimetableEntryDto, WeekdayKey } from "@repo/types";
import { useMemo, useState } from "react";

import {
  downloadCsv,
  entriesToCsv,
  TimetableGrid,
  WEEKDAYS,
  YearSelect,
} from "@/src/components/timetable/ui";
import { Button, Dialog, EmptyState, Input, Select, useToast } from "@/src/components/ui";
import { trpc } from "@/src/trpc/react";

/** Section weekly grid (design handoff §5) — click a cell to add/edit a lesson. */
export default function GridPage() {
  const { show } = useToast();
  const [yearId, setYearId] = useState<string>();
  const [classId, setClassId] = useState<string>();
  const [sectionId, setSectionId] = useState<string>();

  const classes = trpc.class.list.useQuery();
  const sections = trpc.section.list.useQuery({ classId: classId! }, { enabled: !!classId });
  const schedule = trpc.bellSchedule.getForYear.useQuery(
    { academicYearId: yearId! },
    { enabled: !!yearId },
  );
  const periods = trpc.period.list.useQuery(
    { bellScheduleId: schedule.data?.id ?? "" },
    { enabled: !!schedule.data?.id },
  );
  const entries = trpc.timetable.bySection.useQuery(
    { academicYearId: yearId!, sectionId: sectionId! },
    { enabled: !!yearId && !!sectionId },
  );

  const className = (classes.data ?? []).find((c) => c.id === classId)?.name ?? "";
  const sectionLabel = (sections.data ?? []).find((s) => s.id === sectionId)?.name ?? "";
  const fullSection = `${className} ${sectionLabel}`.trim();

  const utils = trpc.useUtils();
  const invalidate = () => utils.timetable.bySection.invalidate();
  const createEntry = trpc.timetable.createEntry.useMutation({
    onSuccess: () => {
      show("success", "Lesson saved");
      return invalidate();
    },
    onError: (e) => show("error", e.message),
  });
  const updateEntry = trpc.timetable.updateEntry.useMutation({
    onSuccess: () => {
      show("success", "Lesson saved");
      return invalidate();
    },
    onError: (e) => show("error", e.message),
  });
  const removeEntry = trpc.timetable.deleteEntry.useMutation({
    onSuccess: () => {
      show("success", "Lesson removed");
      return invalidate();
    },
    onError: (e) => show("error", e.message),
  });

  const [cell, setCell] = useState<{ weekday: WeekdayKey; period: PeriodDto } | null>(null);

  const rows = periods.data ?? [];
  const entryRows = entries.data ?? [];
  const ready = !!yearId && !!sectionId && !!schedule.data;

  return (
    <section className="flex flex-col gap-3.5">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <YearSelect value={yearId} onChange={setYearId} />
        <div className="min-w-[120px]">
          <Select
            label="Class"
            value={classId ?? ""}
            onChange={(e) => {
              setClassId(e.target.value || undefined);
              setSectionId(undefined);
            }}
          >
            <option value="">Select…</option>
            {(classes.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-[90px]">
          <Select
            label="Section"
            value={sectionId ?? ""}
            onChange={(e) => setSectionId(e.target.value || undefined)}
            disabled={!classId}
          >
            <option value="">Select…</option>
            {(sections.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex-1" />
        {ready && entryRows.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              const { headers, rows: r } = entriesToCsv(entryRows);
              downloadCsv(`timetable-${fullSection || sectionId}.csv`, headers, r);
            }}
            className="flex cursor-pointer items-center gap-1.5 rounded-full border border-subtle bg-white px-4 py-2.5 text-[12.5px] font-semibold text-maroon-700 transition-colors duration-fast hover:border-maroon-200 hover:bg-maroon-50"
          >
            <DownloadSimple aria-hidden size={15} />
            Export CSV
          </button>
        ) : null}
      </div>

      {!yearId || !sectionId ? (
        <div className="rounded-card border border-subtle bg-white shadow-sm">
          <EmptyState
            title="Pick a section"
            message="Choose a year, class, and section to view and edit its weekly timetable."
          />
        </div>
      ) : !schedule.data ? (
        <div className="rounded-card border border-subtle bg-white shadow-sm">
          <EmptyState
            title="No bell schedule yet"
            message="Set up the bell schedule and periods first, under “Bell schedule & periods”."
          />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-card border border-subtle bg-white shadow-sm">
          <EmptyState
            title="No periods yet"
            message="Add periods to the bell schedule first — they form the rows of every timetable."
          />
        </div>
      ) : (
        <>
          <TimetableGrid
            periods={rows}
            entries={entryRows}
            secondary="teacher"
            onCell={(weekday, period) => setCell({ weekday, period })}
          />
          <p className="flex items-center gap-1.5 text-[12.5px] text-ink-400">
            <Info aria-hidden size={15} />
            Click any cell to add or change the lesson — only teachers assigned to {
              fullSection
            }{" "}
            appear.
          </p>
        </>
      )}

      {cell && yearId && sectionId ? (
        <EntryModal
          sectionId={sectionId}
          sectionLabel={fullSection}
          weekday={cell.weekday}
          period={cell.period}
          existing={entryRows.find(
            (e) => e.weekday === cell.weekday && e.periodId === cell.period.id,
          )}
          busy={createEntry.isPending || updateEntry.isPending || removeEntry.isPending}
          error={
            createEntry.error?.message ??
            updateEntry.error?.message ??
            removeEntry.error?.message ??
            null
          }
          onClose={() => setCell(null)}
          onCreate={(v) =>
            createEntry.mutate(
              {
                academicYearId: yearId,
                sectionId,
                periodId: cell.period.id,
                weekday: cell.weekday,
                ...v,
              },
              { onSuccess: () => setCell(null) },
            )
          }
          onUpdate={(id, v) => updateEntry.mutate({ id, ...v }, { onSuccess: () => setCell(null) })}
          onDelete={(id) => removeEntry.mutate({ id }, { onSuccess: () => setCell(null) })}
        />
      ) : null}
    </section>
  );
}

interface EntryValues {
  subjectId: string;
  teacherId: string;
  room: string | null;
}

function EntryModal({
  sectionId,
  sectionLabel,
  weekday,
  period,
  existing,
  busy,
  error,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: {
  sectionId: string;
  sectionLabel: string;
  weekday: WeekdayKey;
  period: PeriodDto;
  existing?: TimetableEntryDto | undefined;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onCreate: (v: EntryValues) => void;
  onUpdate: (id: string, v: EntryValues) => void;
  onDelete: (id: string) => void;
}) {
  // Valid (subject, teacher) pairs for this section = its TeacherAssignments (ownership rule).
  const assignments = trpc.teacherAssignment.list.useQuery({ sectionId });
  const subjects = trpc.subject.list.useQuery();
  const teachers = trpc.teacherProfile.list.useQuery();

  const subjectName = useMemo(
    () => new Map((subjects.data ?? []).map((s) => [s.id, s.name])),
    [subjects.data],
  );
  const teacherName = useMemo(
    () => new Map((teachers.data ?? []).map((t) => [t.userId, t.name])),
    [teachers.data],
  );

  const options = (assignments.data ?? []).map((a) => ({
    value: `${a.subjectId}|${a.teacherId}`,
    label: `${subjectName.get(a.subjectId) ?? "Subject"} — ${teacherName.get(a.teacherId) ?? "Teacher"}`,
  }));

  const [pair, setPair] = useState(existing ? `${existing.subjectId}|${existing.teacherId}` : "");
  const [room, setRoom] = useState(existing?.room ?? "");
  const dayLabel = WEEKDAYS.find((d) => d.key === weekday)?.label ?? weekday;

  const submit = () => {
    const [subjectId, teacherId] = pair.split("|");
    if (!subjectId || !teacherId) return;
    const values: EntryValues = { subjectId, teacherId, room: room.trim() || null };
    if (existing) onUpdate(existing.id, values);
    else onCreate(values);
  };

  return (
    <Dialog
      title={existing ? `Edit lesson — ${dayLabel}` : `Add lesson — ${dayLabel}`}
      description={`${period.name} · ${period.startTime} – ${period.endTime}${sectionLabel ? ` · ${sectionLabel}` : ""}`}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-[18px]"
      >
        <Select
          label="Subject — Teacher"
          value={pair}
          onChange={(e) => setPair(e.target.value)}
          helper={
            options.length === 0
              ? "No teacher assignments in this section yet — add one under Academic → Teacher assignments."
              : "Only assignments for this section are listed; clashes with the teacher’s other lessons are flagged on save."
          }
          required
        >
          <option value="" disabled>
            Select an assignment…
          </option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Input
          label="Room (optional)"
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          placeholder="Room 12"
        />

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="mt-1 flex items-center justify-between gap-2.5">
          <div>
            {existing ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => onDelete(existing.id)}
                className="cursor-pointer px-1 py-2 text-[13px] font-semibold text-red-600 transition-colors duration-fast hover:text-maroon-900 disabled:opacity-50"
              >
                Remove lesson
              </button>
            ) : null}
          </div>
          <div className="flex gap-2.5">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={busy} disabled={busy || !pair}>
              Save lesson
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
