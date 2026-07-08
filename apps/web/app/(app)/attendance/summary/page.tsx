"use client";

import { useState } from "react";

import { inputClass, labelClass, outlineBtn, TableShell } from "@/src/components/academic/ui";
import { downloadCsv, SectionPicker } from "@/src/components/attendance/ui";
import { trpc } from "@/src/trpc/react";

const monthStart = () => `${new Date().toLocaleDateString("en-CA").slice(0, 8)}01`;

/**
 * Section attendance summary over a date range: each active student's % (ADR-011
 * §10 weighting — PRESENT/LATE 1, HALF_DAY 0.5, LEAVE excluded), computed on read
 * per enrollment. Exportable to CSV. No summary table, no cron.
 */
export default function AttendanceSummaryPage() {
  const [sectionId, setSectionId] = useState("");
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(() => new Date().toLocaleDateString("en-CA"));

  const years = trpc.academicYear.list.useQuery();
  const activeYearId = (years.data ?? []).find((y) => y.status === "ACTIVE")?.id;

  const roster = trpc.enrollment.sectionRoster.useQuery(
    { academicYearId: activeYearId ?? "", sectionId },
    { enabled: sectionId !== "" && activeYearId !== undefined },
  );
  const active = (roster.data ?? []).filter((e) => e.status === "ACTIVE");

  const students = trpc.student.list.useQuery();
  const studentName = new Map(
    (students.data ?? []).map((s) => [s.id, `${s.firstName} ${s.lastName}`]),
  );

  const summaries = trpc.useQueries((t) =>
    active.map((e) => t.attendance.summary({ enrollmentId: e.id, from, to })),
  );

  const table = active.map((e, i) => ({
    name: studentName.get(e.studentId) ?? e.studentId,
    summary: summaries[i]?.data,
  }));

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <SectionPicker onSection={setSectionId} />
        <label className={labelClass}>
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
        </label>
        <label className={labelClass}>
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />
        </label>
        {table.length > 0 ? (
          <button
            type="button"
            onClick={() =>
              downloadCsv(`attendance-summary-${from}_${to}.csv`, [
                ["Student", "%", "Present", "Absent", "Late", "Half day", "Leave"],
                ...table.map((r) => [
                  r.name,
                  r.summary?.percentage == null ? "" : String(r.summary.percentage),
                  String(r.summary?.present ?? ""),
                  String(r.summary?.absent ?? ""),
                  String(r.summary?.late ?? ""),
                  String(r.summary?.halfDay ?? ""),
                  String(r.summary?.leave ?? ""),
                ]),
              ])
            }
            className={outlineBtn}
          >
            Export CSV
          </button>
        ) : null}
      </div>

      {sectionId === "" ? (
        <p className="text-muted-foreground">Pick a section to summarise.</p>
      ) : (
        <TableShell
          head={["Student", "%", "Present", "Absent", "Late", "Half day", "Leave"]}
          isLoading={roster.isLoading}
          isError={roster.isError}
          isEmpty={active.length === 0}
          emptyText="No active students in this section."
        >
          {table.map((r, i) => (
            <tr key={active[i]?.id ?? r.name} className="border-b border-border last:border-b-0">
              <td className="px-4 py-3 font-medium text-foreground">{r.name}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {r.summary ? (r.summary.percentage == null ? "—" : `${r.summary.percentage}%`) : "…"}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{r.summary?.present ?? "…"}</td>
              <td className="px-4 py-3 text-muted-foreground">{r.summary?.absent ?? "…"}</td>
              <td className="px-4 py-3 text-muted-foreground">{r.summary?.late ?? "…"}</td>
              <td className="px-4 py-3 text-muted-foreground">{r.summary?.halfDay ?? "…"}</td>
              <td className="px-4 py-3 text-muted-foreground">{r.summary?.leave ?? "…"}</td>
            </tr>
          ))}
        </TableShell>
      )}
    </section>
  );
}
