"use client";

import {
  AirplaneTilt,
  Check,
  Checks,
  Clock,
  DownloadSimple,
  SunHorizon,
  Users,
  X,
} from "@phosphor-icons/react";
import type { AttendanceStatusKey } from "@repo/types";
import { cn } from "@repo/ui";
import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  ATTENDANCE_STATUSES,
  downloadCsv,
  STATUS_LABEL,
  STATUS_PILL_ON,
  STATUS_SHORT,
} from "@/src/components/attendance/ui";
import {
  Avatar,
  Button,
  EmptyState,
  Select,
  Skeleton,
  StatusChip,
  useToast,
} from "@/src/components/ui";
import { trpc } from "@/src/trpc/react";

const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

/**
 * Marking register (M4, ADR-011; design handoff §7). Pick a section + date, then
 * tap a status pill (P/A/L/H/LV) per student — each change autosaves (debounced
 * idempotent upsert) with an "All changes saved" indicator, live count cards
 * update, and "Mark all present" bulk-fills. Submit walks DRAFT→SUBMITTED→LOCKED.
 * All rules/scope are enforced by the service.
 */
export default function MarkAttendancePage() {
  const { show } = useToast();
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [date, setDate] = useState(todayIso);
  const [edits, setEdits] = useState<Record<string, AttendanceStatusKey>>({});
  const [dirty, setDirty] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const utils = trpc.useUtils();
  const classes = trpc.class.list.useQuery();
  const sections = trpc.section.list.useQuery({ classId }, { enabled: classId !== "" });
  const years = trpc.academicYear.list.useQuery();
  const activeYearId = (years.data ?? []).find((y) => y.status === "ACTIVE")?.id;

  const className = (classes.data ?? []).find((c) => c.id === classId)?.name ?? "";
  const sectionName = (sections.data ?? []).find((s) => s.id === sectionId)?.name ?? "";
  const fullSection = `${className} ${sectionName}`.trim();

  const ready = sectionId !== "" && date !== "" && activeYearId !== undefined;
  const sessionQuery = trpc.attendance.findSession.useQuery(
    { sectionId, sessionType: "DAILY", date },
    { enabled: ready },
  );
  const session = sessionQuery.data ?? null;

  const roster = trpc.attendance.roster.useQuery(
    { sessionId: session?.id ?? "" },
    { enabled: session !== null },
  );
  const students = trpc.student.list.useQuery();
  const studentName = new Map(
    (students.data ?? []).map((s) => [s.id, `${s.firstName} ${s.lastName}`]),
  );

  const invalidateSession = () => void utils.attendance.findSession.invalidate();
  const openSession = trpc.attendance.openSession.useMutation({
    onSuccess: () => {
      show("success", "Register opened");
      invalidateSession();
    },
    onError: (e) => show("error", e.message),
  });
  const mark = trpc.attendance.mark.useMutation({
    onSuccess: () => {
      setDirty(false);
      void utils.attendance.roster.invalidate();
    },
    onError: (e) => show("error", e.message),
  });
  const submit = trpc.attendance.submit.useMutation({
    onSuccess: () => {
      show("success", `Register submitted for ${fullSection}`);
      invalidateSession();
    },
    onError: (e) => show("error", e.message),
  });
  const lock = trpc.attendance.lock.useMutation({
    onSuccess: () => {
      show("success", "Register locked");
      invalidateSession();
    },
    onError: (e) => show("error", e.message),
  });

  const rows = roster.data ?? [];
  type Row = (typeof rows)[number];
  const isDraft = session?.status === "DRAFT";
  const effective = (r: Row): AttendanceStatusKey =>
    edits[r.enrollmentId] ?? r.currentStatus ?? r.suggestedStatus;
  const onLeave = (r: Row) => r.suggestedStatus === "LEAVE";

  // Debounced autosave: send all effective marks ~800ms after the last tap.
  const scheduleSave = (next: Record<string, AttendanceStatusKey>) => {
    if (!session) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      mark.mutate({
        sessionId: session.id,
        marks: rows.map((r) => ({
          enrollmentId: r.enrollmentId,
          status: next[r.enrollmentId] ?? r.currentStatus ?? r.suggestedStatus,
        })),
      });
    }, 800);
  };
  useEffect(() => () => (saveTimer.current ? clearTimeout(saveTimer.current) : undefined), []);

  const pick = (r: Row, status: AttendanceStatusKey) => {
    setEdits((prev) => {
      const next = { ...prev, [r.enrollmentId]: status };
      setDirty(true);
      scheduleSave(next);
      return next;
    });
  };
  const markAllPresent = () => {
    const next: Record<string, AttendanceStatusKey> = {};
    rows.forEach((r) => (next[r.enrollmentId] = onLeave(r) ? "LEAVE" : "PRESENT"));
    setEdits(next);
    setDirty(true);
    scheduleSave(next);
  };

  const count = (k: AttendanceStatusKey) => rows.filter((r) => effective(r) === k).length;
  const unmarked = rows.filter((r) => !edits[r.enrollmentId] && r.currentStatus == null).length;
  const saving = dirty || mark.isPending;

  const resetForSection = (nextClass?: string, nextSection?: string) => {
    if (nextClass !== undefined) setClassId(nextClass);
    if (nextSection !== undefined) setSectionId(nextSection);
    setEdits({});
    setDirty(false);
  };

  return (
    <section className="flex flex-col gap-3.5">
      {/* Filters + autosave indicator */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[120px]">
          <Select
            label="Class"
            value={classId}
            onChange={(e) => resetForSection(e.target.value, "")}
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
            value={sectionId}
            onChange={(e) => resetForSection(undefined, e.target.value)}
            disabled={classId === ""}
          >
            <option value="">Select…</option>
            {(sections.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-[150px]">
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink-900">
            Date
            <input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setEdits({});
                setDirty(false);
              }}
              className="h-11 rounded-[10px] border border-subtle bg-white px-3 text-sm text-ink-900 outline-none focus:border-gold-500 focus:ring-[3px] focus:ring-gold-100"
            />
          </label>
        </div>
        <div className="flex-1" />
        {session && isDraft ? (
          <div className="flex items-center gap-2 pb-2.5 text-[12.5px] text-ink-500">
            <span className={cn("size-2 rounded-full", saving ? "bg-gold-500" : "bg-green-600")} />
            {saving ? "Saving…" : "All changes saved"}
          </div>
        ) : null}
      </div>

      {!ready ? (
        <div className="rounded-card border border-subtle bg-white shadow-sm">
          <EmptyState
            icon={Users}
            title="Pick a section and date"
            message="Choose a class, section and date to open the daily register."
          />
        </div>
      ) : sessionQuery.isLoading ? (
        <Skeleton className="h-96 rounded-card" />
      ) : session === null ? (
        <div className="rounded-card border border-subtle bg-white p-6 shadow-sm">
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-ink-700">No register for this date yet.</p>
            {openSession.error ? (
              <p className="text-sm text-red-600">{openSession.error.message}</p>
            ) : null}
            <Button
              loading={openSession.isPending}
              onClick={() => {
                if (activeYearId === undefined) return;
                openSession.mutate({
                  academicYearId: activeYearId,
                  sectionId,
                  sessionType: "DAILY",
                  date,
                });
              }}
            >
              Open register
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Count cards */}
          <div className="flex flex-wrap gap-3">
            <CountCard
              value={count("PRESENT")}
              label="Present"
              icon={<Check size={18} weight="bold" aria-hidden />}
              tint="bg-green-100 text-green-600"
            />
            <CountCard
              value={count("ABSENT")}
              label="Absent"
              icon={<X size={18} weight="bold" aria-hidden />}
              tint="bg-red-100 text-red-600"
            />
            <CountCard
              value={count("LATE")}
              label="Late"
              icon={<Clock size={18} weight="bold" aria-hidden />}
              tint="bg-gold-100 text-gold-700"
            />
            <CountCard
              value={count("HALF_DAY")}
              label="Half day"
              icon={<SunHorizon size={18} aria-hidden />}
              tint="bg-cream-100 text-ink-500"
            />
          </div>

          {/* Register */}
          <div className="overflow-hidden rounded-card border border-subtle bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cream-100 px-5 py-3.5">
              <span className="flex flex-col gap-px">
                <span className="font-display text-[17px] font-semibold text-ink-900">
                  {fullSection} — daily register
                </span>
                <span className="text-[12.5px] text-ink-500">
                  {isDraft
                    ? "Tap a status for each student; changes save automatically"
                    : "This register is closed — changes go through a correction"}
                </span>
              </span>
              {isDraft ? (
                <button
                  type="button"
                  onClick={markAllPresent}
                  disabled={rows.length === 0}
                  className="flex cursor-pointer items-center gap-1.5 rounded-full border border-green-600 bg-green-100 px-4 py-2 text-[12.5px] font-semibold text-green-600 transition-colors duration-fast hover:bg-green-600 hover:text-white disabled:opacity-50"
                >
                  <Checks aria-hidden size={15} weight="bold" />
                  Mark all present
                </button>
              ) : (
                <StatusChip status={session.status} />
              )}
            </div>

            {roster.isLoading ? (
              <div className="flex flex-col gap-3 p-5">
                <Skeleton className="h-11" />
                <Skeleton className="h-11" />
                <Skeleton className="h-11" />
              </div>
            ) : rows.length === 0 ? (
              <EmptyState icon={Users} title="No active students in this section." />
            ) : (
              rows.map((r) => {
                const cur = effective(r);
                return (
                  <div
                    key={r.enrollmentId}
                    className="flex items-center gap-3.5 border-b border-cream-100 px-5 py-[11px] transition-colors duration-fast last:border-0 hover:bg-cream-50"
                  >
                    <span className="w-6 text-xs font-semibold text-ink-400">
                      {r.rollNo ?? "—"}
                    </span>
                    <Avatar name={studentName.get(r.studentId) ?? r.studentId} size="sm" />
                    <span className="flex min-w-0 flex-1 flex-col gap-px">
                      <span className="truncate text-sm font-semibold text-ink-900">
                        {studentName.get(r.studentId) ?? r.studentId}
                      </span>
                      {onLeave(r) ? (
                        <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-gold-700">
                          <AirplaneTilt aria-hidden size={13} />
                          Approved leave today
                        </span>
                      ) : null}
                    </span>
                    <div className="flex gap-1.5">
                      {ATTENDANCE_STATUSES.map((s) => {
                        const selected = cur === s;
                        return (
                          <button
                            key={s}
                            type="button"
                            title={STATUS_LABEL[s]}
                            aria-label={`${STATUS_LABEL[s]} for ${studentName.get(r.studentId) ?? r.studentId}`}
                            aria-pressed={selected}
                            disabled={!isDraft}
                            onClick={() => pick(r, s)}
                            className={cn(
                              "h-8 min-w-11 rounded-full border px-3 text-xs font-bold transition-colors duration-fast",
                              isDraft ? "cursor-pointer" : "cursor-default",
                              selected
                                ? STATUS_PILL_ON[s]
                                : "border-subtle bg-white text-ink-400 hover:border-strong",
                            )}
                          >
                            {STATUS_SHORT[s]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}

            {/* Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-cream-50 px-5 py-3.5">
              <span className="flex items-center gap-3 text-[12.5px] text-ink-500">
                {isDraft ? (
                  unmarked > 0 ? (
                    `${unmarked} student${unmarked === 1 ? "" : "s"} unmarked — they will be flagged on submit`
                  ) : (
                    `All ${rows.length} students marked`
                  )
                ) : (
                  <>
                    {session.status === "LOCKED"
                      ? "Locked — changes now go through a correction."
                      : "Submitted — lock it to finalise."}
                  </>
                )}
                <button
                  type="button"
                  onClick={() =>
                    downloadCsv(`attendance-${fullSection || sectionId}-${date}.csv`, [
                      ["Student", "Roll no", "Status"],
                      ...rows.map((r) => [
                        studentName.get(r.studentId) ?? r.studentId,
                        r.rollNo == null ? "" : String(r.rollNo),
                        STATUS_LABEL[effective(r)],
                      ]),
                    ])
                  }
                  className="flex items-center gap-1.5 rounded-full border border-subtle bg-white px-3 py-1.5 text-[12px] font-semibold text-maroon-700 transition-colors duration-fast hover:border-maroon-200 hover:bg-maroon-50"
                >
                  <DownloadSimple aria-hidden size={14} />
                  Export CSV
                </button>
              </span>
              {isDraft ? (
                <Button
                  loading={submit.isPending}
                  disabled={rows.length === 0 || saving}
                  onClick={() => submit.mutate({ sessionId: session.id })}
                >
                  Submit register
                </Button>
              ) : session.status === "SUBMITTED" ? (
                <Button
                  variant="secondary"
                  loading={lock.isPending}
                  onClick={() => lock.mutate({ sessionId: session.id })}
                >
                  Lock register
                </Button>
              ) : null}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function CountCard({
  value,
  label,
  icon,
  tint,
}: {
  value: number;
  label: string;
  icon: ReactNode;
  tint: string;
}) {
  return (
    <div className="flex min-w-[150px] flex-1 items-center gap-3 rounded-[14px] border border-subtle bg-white px-[18px] py-3.5">
      <span className={cn("flex size-9 items-center justify-center rounded-[11px]", tint)}>
        {icon}
      </span>
      <span className="flex flex-col">
        <span className="font-display text-[22px] font-semibold leading-none text-ink-900">
          {value}
        </span>
        <span className="text-xs text-ink-500">{label}</span>
      </span>
    </div>
  );
}
