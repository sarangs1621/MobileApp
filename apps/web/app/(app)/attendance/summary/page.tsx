"use client";

import { DownloadSimple, Info, Users } from "@phosphor-icons/react";
import { cn } from "@repo/ui";
import { useState } from "react";

import { downloadCsv } from "@/src/components/attendance/ui";
import { Avatar, EmptyState, ErrorState, Select, Skeleton } from "@/src/components/ui";
import { trpc } from "@/src/trpc/react";

const TZ = "Asia/Kolkata";
const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });
const monthStart = () => `${todayIso().slice(0, 8)}01`;

/** Bar + text colour from a percentage (sub-75 red, sub-90 gold, else green). */
function pctTone(pct: number): { bar: string; text: string } {
  if (pct < 75) return { bar: "bg-red-600", text: "text-red-600" };
  if (pct < 90) return { bar: "bg-gold-500", text: "text-ink-900" };
  return { bar: "bg-green-600", text: "text-ink-900" };
}

/**
 * Section attendance summary (M4, ADR-011 §10; design handoff §7). Each active
 * student's % over a range — a progress bar tinted by the 75% board threshold,
 * with sub-75% students flagged and heavy absentees bolded. Exports to CSV.
 * Percentages are computed on read per enrollment (no summary table, no cron).
 */
export default function AttendanceSummaryPage() {
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(todayIso);

  const classes = trpc.class.list.useQuery();
  const sections = trpc.section.list.useQuery({ classId }, { enabled: classId !== "" });
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
    id: e.id,
    name: studentName.get(e.studentId) ?? e.studentId,
    summary: summaries[i]?.data,
    loading: summaries[i]?.isLoading ?? true,
  }));
  const loadingAny = roster.isLoading || table.some((r) => r.loading);

  return (
    <section className="flex flex-col gap-3.5">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[120px]">
          <Select
            label="Class"
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setSectionId("");
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
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
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
        <DateFilter label="From" value={from} onChange={setFrom} />
        <DateFilter label="To" value={to} onChange={setTo} />
        <div className="flex-1" />
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
            className="flex cursor-pointer items-center gap-1.5 rounded-full border border-subtle bg-white px-4 py-2.5 text-[12.5px] font-semibold text-maroon-700 transition-colors duration-fast hover:border-maroon-200 hover:bg-maroon-50"
          >
            <DownloadSimple aria-hidden size={15} />
            Export CSV
          </button>
        ) : null}
      </div>

      {sectionId === "" ? (
        <div className="rounded-card border border-subtle bg-white shadow-sm">
          <EmptyState
            icon={Users}
            title="Pick a section"
            message="Choose a class and section to see each student’s attendance percentage."
          />
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-card border border-subtle bg-white shadow-sm">
            <div className="grid grid-cols-[1.6fr_1.2fr_0.7fr_0.7fr_0.7fr_0.8fr_0.7fr] items-center gap-2.5 border-b border-cream-100 px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">
              <span>Student</span>
              <span>Attendance</span>
              <span className="text-right">Present</span>
              <span className="text-right">Absent</span>
              <span className="text-right">Late</span>
              <span className="text-right">Half day</span>
              <span className="text-right">Leave</span>
            </div>

            {roster.isError ? (
              <ErrorState onRetry={() => roster.refetch()} />
            ) : loadingAny && table.length === 0 ? (
              <div className="flex flex-col gap-3 p-5">
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
              </div>
            ) : table.length === 0 ? (
              <EmptyState icon={Users} title="No active students in this section." />
            ) : (
              table.map((r) => {
                const pct = r.summary?.percentage ?? null;
                const tone =
                  pct !== null ? pctTone(pct) : { bar: "bg-cream-200", text: "text-ink-400" };
                const heavyAbsent = (r.summary?.absent ?? 0) >= 3;
                return (
                  <div
                    key={r.id}
                    className="grid grid-cols-[1.6fr_1.2fr_0.7fr_0.7fr_0.7fr_0.8fr_0.7fr] items-center gap-2.5 border-b border-cream-100 px-5 py-3 transition-colors duration-fast last:border-0 hover:bg-cream-50"
                  >
                    <span className="flex items-center gap-2.5">
                      <Avatar name={r.name} size="sm" />
                      <span className="truncate text-[13.5px] font-semibold text-ink-900">
                        {r.name}
                      </span>
                    </span>
                    <span className="flex items-center gap-2.5">
                      <span className="h-[7px] min-w-[50px] flex-1 overflow-hidden rounded-[4px] bg-cream-100">
                        <span
                          className={cn("block h-full rounded-[4px]", tone.bar)}
                          style={{ width: pct !== null ? `${pct}%` : "0%" }}
                        />
                      </span>
                      <span
                        className={cn("min-w-[38px] text-right text-[12.5px] font-bold", tone.text)}
                      >
                        {r.loading ? "…" : pct === null ? "—" : `${pct}%`}
                      </span>
                    </span>
                    <span className="text-right text-[13px] text-ink-700">
                      {r.summary?.present ?? "…"}
                    </span>
                    <span
                      className={cn(
                        "text-right text-[13px]",
                        heavyAbsent ? "font-bold text-red-600" : "text-ink-700",
                      )}
                    >
                      {r.summary?.absent ?? "…"}
                    </span>
                    <span className="text-right text-[13px] text-ink-700">
                      {r.summary?.late ?? "…"}
                    </span>
                    <span className="text-right text-[13px] text-ink-700">
                      {r.summary?.halfDay ?? "…"}
                    </span>
                    <span className="text-right text-[13px] text-ink-700">
                      {r.summary?.leave ?? "…"}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          <p className="flex items-center gap-1.5 text-[12.5px] text-ink-400">
            <Info aria-hidden size={15} />
            Students below 75% are flagged — Kerala board requires 75% attendance for exam
            eligibility.
          </p>
        </>
      )}
    </section>
  );
}

function DateFilter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex min-w-[130px] flex-col gap-1.5 text-[13px] font-semibold text-ink-900">
      {label}
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-[10px] border border-subtle bg-white px-3 text-sm text-ink-900 outline-none focus:border-gold-500 focus:ring-[3px] focus:ring-gold-100"
      />
    </label>
  );
}
