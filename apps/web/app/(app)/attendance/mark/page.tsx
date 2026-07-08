"use client";

import type { AttendanceStatusKey } from "@repo/types";
import { useState } from "react";

import { inputClass, labelClass, outlineBtn, primaryBtn, TableShell } from "@/src/components/academic/ui";
import {
  ATTENDANCE_STATUSES,
  downloadCsv,
  SectionPicker,
  STATUS_LABEL,
} from "@/src/components/attendance/ui";
import { trpc } from "@/src/trpc/react";

/**
 * Marking dashboard: pick a section + date, open (or resume) the daily register,
 * bulk-mark all present then flip absentees, save (idempotent upsert), and walk
 * the DRAFT→SUBMITTED→LOCKED machine (ADR-011 §5). Export the roster to CSV. All
 * rules/scope are enforced by the service — a section a teacher doesn't teach
 * errors cleanly.
 */
export default function MarkAttendancePage() {
  const [sectionId, setSectionId] = useState("");
  const [date, setDate] = useState(() => new Date().toLocaleDateString("en-CA"));
  const [edits, setEdits] = useState<Record<string, AttendanceStatusKey>>({});

  const utils = trpc.useUtils();
  const years = trpc.academicYear.list.useQuery();
  const activeYearId = (years.data ?? []).find((y) => y.status === "ACTIVE")?.id;

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
  const openSession = trpc.attendance.openSession.useMutation({ onSuccess: invalidateSession });
  const mark = trpc.attendance.mark.useMutation({
    onSuccess: () => {
      setEdits({});
      void utils.attendance.roster.invalidate();
    },
  });
  const submit = trpc.attendance.submit.useMutation({ onSuccess: invalidateSession });
  const lock = trpc.attendance.lock.useMutation({ onSuccess: invalidateSession });

  const rows = roster.data ?? [];
  const isDraft = session?.status === "DRAFT";
  const effective = (r: (typeof rows)[number]) =>
    edits[r.enrollmentId] ?? r.currentStatus ?? r.suggestedStatus;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <SectionPicker
          onSection={(id) => {
            setSectionId(id);
            setEdits({});
          }}
        />
        <label className={labelClass}>
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>

      {!ready ? (
        <p className="text-muted-foreground">Pick a section and date to load its register.</p>
      ) : sessionQuery.isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : session === null ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-muted-foreground">No register for {date} yet.</p>
          <button
            type="button"
            disabled={openSession.isPending}
            onClick={() => {
              if (activeYearId === undefined) return;
              openSession.mutate({
                academicYearId: activeYearId,
                sectionId,
                sessionType: "DAILY",
                date,
              });
            }}
            className={primaryBtn}
          >
            {openSession.isPending ? "Opening…" : "Open register"}
          </button>
          {openSession.error ? (
            <p className="text-sm text-destructive">{openSession.error.message}</p>
          ) : null}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">
              {date} · <span className="font-medium text-foreground">{session.status}</span>
            </span>
            <div className="flex flex-wrap gap-2">
              {isDraft ? (
                <button
                  type="button"
                  onClick={() =>
                    setEdits(Object.fromEntries(rows.map((r) => [r.enrollmentId, "PRESENT"])))
                  }
                  className={outlineBtn}
                >
                  Mark all present
                </button>
              ) : null}
              <button
                type="button"
                onClick={() =>
                  downloadCsv(`attendance-${date}.csv`, [
                    ["Student", "Roll no", "Status"],
                    ...rows.map((r) => [
                      studentName.get(r.studentId) ?? r.studentId,
                      r.rollNo == null ? "" : String(r.rollNo),
                      STATUS_LABEL[effective(r)],
                    ]),
                  ])
                }
                className={outlineBtn}
              >
                Export CSV
              </button>
            </div>
          </div>

          <TableShell
            head={["Student", "Roll no", "Status"]}
            isLoading={roster.isLoading}
            isError={roster.isError}
            isEmpty={rows.length === 0}
            emptyText="No active students in this section."
          >
            {rows.map((r) => (
              <tr key={r.enrollmentId} className="border-b border-border last:border-b-0">
                <td className="px-4 py-3 font-medium text-foreground">
                  {studentName.get(r.studentId) ?? r.studentId}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{r.rollNo ?? "—"}</td>
                <td className="px-4 py-3">
                  {isDraft ? (
                    <select
                      value={effective(r)}
                      onChange={(e) =>
                        setEdits((prev) => ({
                          ...prev,
                          [r.enrollmentId]: e.target.value as AttendanceStatusKey,
                        }))
                      }
                      className={inputClass}
                    >
                      {ATTENDANCE_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-muted-foreground">{STATUS_LABEL[effective(r)]}</span>
                  )}
                </td>
              </tr>
            ))}
          </TableShell>

          {isDraft ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={mark.isPending || rows.length === 0}
                onClick={() =>
                  mark.mutate({
                    sessionId: session.id,
                    marks: rows.map((r) => ({ enrollmentId: r.enrollmentId, status: effective(r) })),
                  })
                }
                className={primaryBtn}
              >
                {mark.isPending ? "Saving…" : "Save marks"}
              </button>
              <button
                type="button"
                disabled={submit.isPending}
                onClick={() => submit.mutate({ sessionId: session.id })}
                className={outlineBtn}
              >
                Submit register
              </button>
            </div>
          ) : session.status === "SUBMITTED" ? (
            <button
              type="button"
              disabled={lock.isPending}
              onClick={() => lock.mutate({ sessionId: session.id })}
              className={outlineBtn}
            >
              Lock register
            </button>
          ) : (
            <p className="text-sm text-muted-foreground">
              Locked — changes now go through a correction.
            </p>
          )}
          {mark.error ? <p className="text-sm text-destructive">{mark.error.message}</p> : null}
        </>
      )}
    </section>
  );
}
