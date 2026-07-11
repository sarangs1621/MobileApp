"use client";

import type { PeriodDto, TimetableEntryDto, WeekdayKey } from "@repo/types";
import { useMemo, useState } from "react";

import {
  inputClass,
  labelClass,
  Modal,
  outlineBtn,
  primaryBtn,
  smallDangerBtn,
} from "@/src/components/academic/ui";
import {
  downloadCsv,
  entriesToCsv,
  TimetableGrid,
  WEEKDAYS,
  YearSelect,
} from "@/src/components/timetable/ui";
import { trpc } from "@/src/trpc/react";

/** Section weekly grid — click a cell to add/edit an entry. Conflicts surface on save. */
export default function GridPage() {
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

  const utils = trpc.useUtils();
  const invalidate = () => utils.timetable.bySection.invalidate();
  const createEntry = trpc.timetable.createEntry.useMutation({ onSuccess: invalidate });
  const updateEntry = trpc.timetable.updateEntry.useMutation({ onSuccess: invalidate });
  const removeEntry = trpc.timetable.deleteEntry.useMutation({ onSuccess: invalidate });

  const [cell, setCell] = useState<{ weekday: WeekdayKey; period: PeriodDto } | null>(null);

  const rows = periods.data ?? [];
  const entryRows = entries.data ?? [];
  const ready = !!yearId && !!sectionId && !!schedule.data;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <YearSelect value={yearId} onChange={setYearId} />
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          Class
          <select
            value={classId ?? ""}
            onChange={(e) => {
              setClassId(e.target.value || undefined);
              setSectionId(undefined);
            }}
            className={inputClass}
          >
            <option value="">Select…</option>
            {(classes.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          Section
          <select
            value={sectionId ?? ""}
            onChange={(e) => setSectionId(e.target.value || undefined)}
            className={inputClass}
            disabled={!classId}
          >
            <option value="">Select…</option>
            {(sections.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        {ready && entryRows.length > 0 ? (
          <button
            type="button"
            className={outlineBtn}
            onClick={() => {
              const { headers, rows: r } = entriesToCsv(entryRows);
              downloadCsv(`timetable-${sectionId}.csv`, headers, r);
            }}
          >
            Export CSV
          </button>
        ) : null}
      </div>

      {!yearId || !sectionId ? (
        <p className="text-muted-foreground">
          Pick a year, class, and section to view the timetable.
        </p>
      ) : !schedule.data ? (
        <p className="text-muted-foreground">
          This year has no bell schedule yet. Set it up under “Bell schedule &amp; periods” first.
        </p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground">
          The bell schedule has no periods yet. Add periods first.
        </p>
      ) : (
        <TimetableGrid
          periods={rows}
          entries={entryRows}
          onCell={(weekday, period) => setCell({ weekday, period })}
        />
      )}

      {cell && yearId && sectionId ? (
        <EntryModal
          sectionId={sectionId}
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
    <Modal
      title={`${dayLabel} · ${period.name} (${period.startTime}–${period.endTime})`}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-3"
      >
        <label className={labelClass}>
          Subject — Teacher
          <select
            value={pair}
            onChange={(e) => setPair(e.target.value)}
            className={inputClass}
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
          </select>
        </label>
        {options.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No teacher assignments in this section yet — add one under Academic → Teacher
            assignments.
          </p>
        ) : null}
        <label className={labelClass}>
          Room (optional)
          <input
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            className={inputClass}
            placeholder="Room 12"
          />
        </label>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="mt-2 flex justify-between gap-2">
          <div>
            {existing ? (
              <button
                type="button"
                disabled={busy}
                className={smallDangerBtn}
                onClick={() => onDelete(existing.id)}
              >
                Delete
              </button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={outlineBtn}>
              Cancel
            </button>
            <button type="submit" disabled={busy || !pair} className={primaryBtn}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
