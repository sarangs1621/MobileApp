"use client";

import Link from "next/link";
import { useState } from "react";

import { trpc } from "@/src/trpc/react";

import { INVOICE_STATUS_LABEL } from "../fees/ui";

import { downloadCsv } from "./csv";
import { AreaTrend, BarSeries, Kpi, LineTrend, Panel, StatusPie, formatPaise } from "./ui";


const pct = (v: number | null): string => (v === null ? "—" : `${v}%`);

function RecentAnnouncements() {
  const rows = trpc.announcement.list.useQuery({ limit: 5 });
  return (
    <Panel title="Recent announcements">
      {rows.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (rows.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing new.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {(rows.data ?? []).slice(0, 4).map((a) => (
            <li key={a.id}>
              <Link
                href={`/announcements/${a.id}`}
                className="text-sm font-medium text-foreground hover:underline"
              >
                {a.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/* ───────────────────────────────────── admin ──────────────────────────────────── */

export function AdminDashboard() {
  const school = trpc.analytics.schoolSummary.useQuery();
  const collection = trpc.analytics.feeCollection.useQuery({});

  const s = school.data;
  const monthly = (collection.data?.monthly ?? []).map((m) => ({
    label: m.month,
    value: m.collected,
  }));
  const statusData = Object.entries(s?.fees.byStatus ?? {}).map(([k, v]) => ({
    name: INVOICE_STATUS_LABEL[k as keyof typeof INVOICE_STATUS_LABEL] ?? k,
    value: v,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Students" value={s ? String(s.headcount) : "—"} />
        <Kpi label="Attendance" value={s ? pct(s.attendancePercentage) : "—"} />
        <Kpi label="Collected today" value={s ? formatPaise(s.collectionToday) : "—"} />
        <Kpi label="Outstanding" value={s ? formatPaise(s.fees.totalOutstanding) : "—"} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Fee collection (monthly)"
          onExport={() =>
            downloadCsv(
              "fee-collection.csv",
              ["Month", "Collected (INR)"],
              monthly.map((m) => [m.label, m.value / 100]),
            )
          }
        >
          <BarSeries data={monthly} moneyPaise />
        </Panel>
        <Panel
          title="Invoices by status"
          onExport={() =>
            downloadCsv(
              "invoices-by-status.csv",
              ["Status", "Count"],
              statusData.map((d) => [d.name, d.value]),
            )
          }
        >
          <StatusPie data={statusData} />
        </Panel>
      </div>
      <RecentAnnouncements />
    </div>
  );
}

/* ──────────────────────────────────── teacher ─────────────────────────────────── */

export function TeacherDashboard() {
  const dash = trpc.analytics.dashboard.useQuery();
  const targets = trpc.homework.targets.useQuery();
  const sectionName = new Map((targets.data ?? []).map((t) => [t.sectionId, t.sectionName]));

  const teacher = dash.data?.role === "TEACHER" ? dash.data.teacher : undefined;
  const sections = (teacher?.sections ?? []).map((x) => ({
    label: sectionName.get(x.sectionId) ?? "Section",
    value: x.attendancePercentage,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="My sections" value={String(sections.length)} />
        <Kpi label="Referrals" value={teacher ? String(teacher.behaviourReferralCount) : "—"} />
      </div>
      <Panel
        title="Attendance by section"
        onExport={() =>
          downloadCsv(
            "attendance-by-section.csv",
            ["Section", "Attendance %"],
            sections.map((s) => [s.label, s.value ?? ""]),
          )
        }
      >
        <BarSeries data={sections} unit="%" />
      </Panel>
      <RecentAnnouncements />
    </div>
  );
}

/* ──────────────────────────────────── parent ──────────────────────────────────── */

export function ParentDashboard() {
  const dash = trpc.analytics.dashboard.useQuery();
  const students = trpc.student.list.useQuery();
  const [sel, setSel] = useState<string | undefined>();

  const children = dash.data?.role === "PARENT" ? dash.data.children : [];
  const name = new Map((students.data ?? []).map((c) => [c.id, `${c.firstName} ${c.lastName}`]));
  const selected = sel ?? children[0]?.studentId;

  const attendance = trpc.analytics.attendanceTrend.useQuery(
    { studentId: selected ?? "" },
    { enabled: !!selected },
  );
  const exam = trpc.analytics.examTrend.useQuery(
    { studentId: selected ?? "" },
    { enabled: !!selected },
  );

  const attData = (attendance.data ?? []).map((p) => ({ label: p.month, value: p.percentage }));
  const examData = (exam.data ?? []).map((p) => ({ label: p.kind, value: p.gpa }));

  return (
    <div className="flex flex-col gap-4">
      {children.map((c) => (
        <Panel
          key={c.studentId}
          title={name.get(c.studentId) ?? "Your child"}
          onExport={() =>
            downloadCsv(
              `${name.get(c.studentId) ?? "child"}-summary.csv`,
              ["Metric", "Value"],
              [
                ["Attendance %", c.attendancePercentage ?? ""],
                ["GPA", c.gpa ?? ""],
                [
                  "Homework %",
                  c.homeworkCompletionRate === null
                    ? ""
                    : Math.round(c.homeworkCompletionRate * 100),
                ],
                ["Dues (INR)", c.dues / 100],
                ["Behaviour open", c.openBehaviourCount],
                ["Behaviour total", c.behaviourCount],
              ],
            )
          }
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Kpi label="Attendance" value={pct(c.attendancePercentage)} />
            <Kpi label="GPA" value={c.gpa === null ? "—" : c.gpa.toFixed(1)} />
            <Kpi
              label="Homework"
              value={
                c.homeworkCompletionRate === null
                  ? "—"
                  : `${Math.round(c.homeworkCompletionRate * 100)}%`
              }
            />
            <Kpi label="Dues" value={formatPaise(c.dues)} />
            <Kpi label="Behaviour" value={`${c.openBehaviourCount}/${c.behaviourCount}`} />
          </div>
        </Panel>
      ))}

      {children.length > 0 ? (
        <div className="flex items-center gap-2">
          <label htmlFor="child" className="text-sm text-muted-foreground">
            Trends for
          </label>
          <select
            id="child"
            value={selected}
            onChange={(e) => setSel(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
          >
            {children.map((c) => (
              <option key={c.studentId} value={c.studentId}>
                {name.get(c.studentId) ?? "Child"}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Attendance trend"
          onExport={() =>
            downloadCsv(
              "attendance-trend.csv",
              ["Month", "Attendance %"],
              attData.map((p) => [p.label, p.value ?? ""]),
            )
          }
        >
          <AreaTrend data={attData} unit="%" />
        </Panel>
        <Panel
          title="Report-card GPA trend"
          onExport={() =>
            downloadCsv(
              "gpa-trend.csv",
              ["Report card", "GPA"],
              examData.map((p) => [p.label, p.value ?? ""]),
            )
          }
        >
          <LineTrend data={examData} />
        </Panel>
      </div>

      <RecentAnnouncements />
    </div>
  );
}
