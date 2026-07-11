"use client";

import { PERMISSIONS } from "@repo/constants";
import { can } from "@repo/core";
import type { BehaviourSeverityKey, BehaviourStatusKey } from "@repo/types";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  inputClass,
  labelClass,
  outlineBtn,
  smallDangerBtn,
  smallGhostBtn,
  TableShell,
} from "@/src/components/academic/ui";
import { downloadCsv } from "@/src/components/attendance/ui";
import { trpc } from "@/src/trpc/react";

const SEVERITIES: BehaviourSeverityKey[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const STATUSES: BehaviourStatusKey[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
const CATEGORY_LABEL: Record<string, string> = {
  DISCIPLINE: "Discipline",
  BULLYING: "Bullying",
  UNIFORM: "Uniform",
  HOMEWORK: "Homework",
  MISCONDUCT: "Misconduct",
  LATE: "Late",
  OTHER: "Other",
};
const STATUS_LABEL: Record<BehaviourStatusKey, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString();

/**
 * Behaviour console (M12, ADR-020 Step 7) — admin-only (behaviour:manage). School-wide
 * incidents filtered by student / teacher / severity / status, with resolve + close and
 * a CSV export of the current view. Thin client over the tRPC surface; the service gates.
 */
export default function BehaviourConsolePage() {
  const me = trpc.auth.me.useQuery();
  const role = me.data?.role;
  const canManage = role !== undefined && can(role, PERMISSIONS.BEHAVIOUR_MANAGE);

  const [studentId, setStudentId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [severity, setSeverity] = useState<BehaviourSeverityKey | "">("");
  const [status, setStatus] = useState<BehaviourStatusKey | "">("");

  const students = trpc.student.list.useQuery(undefined, { enabled: canManage });
  const teachers = trpc.teacherProfile.list.useQuery(undefined, { enabled: canManage });

  const studentName = useMemo(
    () => new Map((students.data ?? []).map((s) => [s.id, `${s.firstName} ${s.lastName}`])),
    [students.data],
  );
  // teacherId on an incident is a User id; StaffDto.userId maps it to a display name.
  const teacherName = useMemo(
    () => new Map((teachers.data ?? []).map((t) => [t.userId, t.name])),
    [teachers.data],
  );

  const utils = trpc.useUtils();
  const list = trpc.behaviour.list.useQuery(
    {
      ...(studentId ? { studentId } : {}),
      ...(teacherId ? { teacherId } : {}),
      ...(severity ? { severity } : {}),
      ...(status ? { status } : {}),
    },
    { enabled: canManage },
  );
  const rows = list.data ?? [];

  const refresh = () => void utils.behaviour.list.invalidate();
  const resolve = trpc.behaviour.resolve.useMutation({ onSuccess: refresh });
  const close = trpc.behaviour.close.useMutation({ onSuccess: refresh });
  const busy = resolve.isPending || close.isPending;

  const exportCsv = () => {
    const header = [
      "Date",
      "Student",
      "Teacher",
      "Category",
      "Severity",
      "Status",
      "Title",
      "Parent notified",
    ];
    const body = rows.map((b) => [
      fmtDate(b.createdAt),
      studentName.get(b.studentId) ?? b.studentId,
      teacherName.get(b.teacherId) ?? b.teacherId,
      CATEGORY_LABEL[b.category] ?? b.category,
      b.severity,
      STATUS_LABEL[b.status],
      b.title,
      b.parentNotified ? "Yes" : "No",
    ]);
    downloadCsv("behaviour-incidents.csv", [header, ...body]);
  };

  if (!me.isLoading && !canManage) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <p className="text-destructive">You don’t have access to the behaviour console.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/dashboard" className="text-sm text-primary">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-semibold text-foreground">Behaviour & discipline</h1>
        </div>
        <button
          type="button"
          className={outlineBtn}
          onClick={exportCsv}
          disabled={rows.length === 0}
        >
          Export CSV
        </button>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <label className={labelClass}>
          Student
          <select
            className={inputClass}
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
          >
            <option value="">All students</option>
            {(students.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.firstName} {s.lastName}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Teacher
          <select
            className={inputClass}
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
          >
            <option value="">All teachers</option>
            {(teachers.data ?? []).map((t) => (
              <option key={t.id} value={t.userId}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Severity
          <select
            className={inputClass}
            value={severity}
            onChange={(e) => setSeverity(e.target.value as BehaviourSeverityKey | "")}
          >
            <option value="">Any severity</option>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Status
          <select
            className={inputClass}
            value={status}
            onChange={(e) => setStatus(e.target.value as BehaviourStatusKey | "")}
          >
            <option value="">Any status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      </section>

      <TableShell
        head={["Date", "Student", "Teacher", "Category", "Severity", "Status", "Actions"]}
        isLoading={list.isLoading}
        isError={list.isError}
        isEmpty={rows.length === 0}
        emptyText="No incidents match these filters."
      >
        {rows.map((b) => (
          <tr key={b.id} className="border-b border-border last:border-b-0 align-top">
            <td className="px-4 py-3 text-muted-foreground">{fmtDate(b.createdAt)}</td>
            <td className="px-4 py-3 font-medium text-foreground">
              {studentName.get(b.studentId) ?? "—"}
              <div className="text-xs font-normal text-muted-foreground">{b.title}</div>
            </td>
            <td className="px-4 py-3 text-muted-foreground">
              {teacherName.get(b.teacherId) ?? "—"}
            </td>
            <td className="px-4 py-3 text-muted-foreground">
              {CATEGORY_LABEL[b.category] ?? b.category}
            </td>
            <td className="px-4 py-3 text-muted-foreground">{b.severity}</td>
            <td className="px-4 py-3 text-muted-foreground">{STATUS_LABEL[b.status]}</td>
            <td className="px-4 py-3">
              {b.status === "CLOSED" ? (
                <span className="text-xs text-muted-foreground">Closed</span>
              ) : (
                <div className="flex gap-1">
                  {b.status !== "RESOLVED" ? (
                    <button
                      type="button"
                      className={smallGhostBtn}
                      disabled={busy}
                      onClick={() => resolve.mutate({ id: b.id })}
                    >
                      Resolve
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={smallDangerBtn}
                    disabled={busy}
                    onClick={() => close.mutate({ id: b.id })}
                  >
                    Close
                  </button>
                </div>
              )}
            </td>
          </tr>
        ))}
      </TableShell>
    </main>
  );
}
