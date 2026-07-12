import { PERMISSIONS } from "@repo/constants";
import { ForbiddenError } from "@repo/core";

import { assertCan } from "../../authorization";
import type { ServiceContext } from "../../context";
import { attendanceSummary } from "../attendance";
import { gpaForEnrollment } from "../exam";

import {
  activeYearId,
  assertStudentInScope,
  currentEnrollment,
  isFullAccess,
  loadStudentInSchool,
  parentChildIds,
  teacherSectionIds,
} from "./scope";

/* ─────────────────────────── shared derivation helpers ─────────────────────────── */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // Asia/Kolkata, no DST (fee/homework precedent)
const AT_RISK_ATTENDANCE = 75; // ponytail: threshold flagged for approval (ADR-022 §6)
const AT_RISK_GPA = 4; // ponytail: proxy for "failing" on the grade-point scale — flagged (ADR §6)

/** Midnight-IST as a Date, for `@db.Date` comparisons (dueDate / paymentDate / today ranges). */
function istToday(): Date {
  const nowIst = new Date(Date.now() + IST_OFFSET_MS);
  return new Date(Date.UTC(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate()));
}
function daysAgo(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() - n);
  return x;
}
function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7); // YYYY-MM
}

/**
 * Weighted attendance % from a status→count map — identical weighting to
 * `attendanceSummary` (PRESENT/LATE = 1, HALF_DAY = 0.5, ABSENT = 0; LEAVE excluded).
 * Null when there are no countable days.
 */
function attendancePct(c: Record<string, number>): number | null {
  const present = c.PRESENT ?? 0;
  const absent = c.ABSENT ?? 0;
  const late = c.LATE ?? 0;
  const half = c.HALF_DAY ?? 0;
  const countable = present + absent + late + half;
  const attended = present + late + half * 0.5;
  return countable === 0 ? null : Math.round((attended / countable) * 1000) / 10;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/* ───────────────────────────────── return shapes ──────────────────────────────── */

export interface StudentSummary {
  studentId: string;
  enrollmentId: string | null;
  attendancePercentage: number | null;
  gpa: number | null;
  homeworkAssigned: number;
  homeworkCompleted: number;
  homeworkCompletionRate: number | null; // 0..1
  dues: number; // paise outstanding on ISSUED/PARTIAL (incl. displayed-OVERDUE)
  overdueCount: number;
  behaviourCount: number;
  openBehaviourCount: number;
}

export interface ExamTrendPoint {
  kind: string;
  examId: string | null;
  termId: string | null;
  gpa: number | null;
  cgpa: number | null;
  date: string; // ISO
}

export interface AttendanceTrendPoint {
  month: string; // YYYY-MM
  percentage: number | null;
}

export interface TeacherSectionStat {
  sectionId: string;
  enrollmentCount: number;
  attendancePercentage: number | null;
}
export interface TeacherSummary {
  sections: TeacherSectionStat[];
  behaviourReferralCount: number;
}

export interface ClassPerformance {
  sectionId: string;
  enrollmentCount: number;
  averageGpa: number | null;
  attendancePercentage: number | null;
}

export interface SchoolSummary {
  headcount: number;
  attendancePercentage: number | null;
  collectionToday: number; // paise
  fees: {
    totalBilled: number;
    totalCollected: number;
    totalOutstanding: number;
    count: number;
    byStatus: Record<string, number>;
  };
  studentGrowth: { academicYearId: string; count: number }[];
}

export interface FeeCollection {
  totalBilled: number;
  totalCollected: number;
  totalOutstanding: number;
  byStatus: Record<string, number>;
  monthly: { month: string; collected: number }[];
}

export interface StudentRankRow {
  studentId: string;
  enrollmentId: string;
  gpa: number | null;
  attendancePercentage: number | null;
}

export type Dashboard =
  | { role: "ADMIN"; school: SchoolSummary }
  | { role: "TEACHER"; teacher: TeacherSummary }
  | { role: "PARENT"; children: StudentSummary[] };

/* ─────────────────────────────── student analytics ────────────────────────────── */

/**
 * Headline cards for one student (parent own-child / admin any). Each metric reuses
 * the existing domain read + scope: `attendanceSummary` and `gpaForEnrollment`
 * self-gate; fee/homework/behaviour reads are gated here (permission + the shared
 * student scope). No new permission (ADR-022 §1).
 */
export async function studentSummary(
  ctx: ServiceContext,
  input: { studentId: string },
): Promise<StudentSummary> {
  const student = await loadStudentInSchool(ctx, input.studentId);
  await assertStudentInScope(ctx, student);
  const enrollment = await currentEnrollment(ctx, student.id);

  const to = istToday();
  const from = daysAgo(to, 365);

  let attendancePercentage: number | null = null;
  let gpa: number | null = null;
  let homeworkAssigned = 0;
  let homeworkCompleted = 0;

  if (enrollment) {
    attendancePercentage = (await attendanceSummary(ctx, { enrollmentId: enrollment.id, from, to }))
      .percentage;
    gpa = await gpaForEnrollment(ctx, enrollment.id);

    if (enrollment.sectionId) {
      assertCan(ctx.user, PERMISSIONS.HOMEWORK_READ);
      const hw = await ctx.repositories.homework.listBySection(
        ctx.user.schoolId,
        enrollment.sectionId,
        ["PUBLISHED", "CLOSED"],
      );
      homeworkAssigned = hw.length;
      // ponytail: any submission row = "attempted"; per-round status refinement is Step-8 territory.
      const subs = await ctx.repositories.homeworkSubmissions.listByEnrollment(enrollment.id);
      homeworkCompleted = Math.min(subs.length, homeworkAssigned);
    }
  }

  assertCan(ctx.user, PERMISSIONS.FEE_READ);
  const invoices = await ctx.repositories.invoices.list(ctx.user.schoolId, {
    studentId: student.id,
    limit: 1000,
  });
  let dues = 0;
  let overdueCount = 0;
  for (const inv of invoices) {
    if (inv.status === "ISSUED" || inv.status === "PARTIAL") {
      dues += inv.balanceAmount;
      if (inv.dueDate < to) {
        overdueCount++; // displayed-OVERDUE (ADR-021 §3 compute-on-read)
      }
    }
  }

  assertCan(ctx.user, PERMISSIONS.BEHAVIOUR_READ);
  const incidents = await ctx.repositories.behaviourIncidents.list(ctx.user.schoolId, {
    studentId: student.id,
    limit: 1000,
  });
  const openBehaviourCount = incidents.filter(
    (i) => i.status === "OPEN" || i.status === "IN_PROGRESS",
  ).length;

  return {
    studentId: student.id,
    enrollmentId: enrollment?.id ?? null,
    attendancePercentage,
    gpa,
    homeworkAssigned,
    homeworkCompleted,
    homeworkCompletionRate:
      homeworkAssigned === 0 ? null : round2(homeworkCompleted / homeworkAssigned),
    dues,
    overdueCount,
    behaviourCount: incidents.length,
    openBehaviourCount,
  };
}

/**
 * GPA trend from PUBLISHED report-card snapshots (ADR-022 §5). ponytail: report cards
 * already store `gpaSnapshot`/`cgpaSnapshot` at APPROVE — no raw per-exam mark join.
 */
export async function examTrend(
  ctx: ServiceContext,
  input: { studentId: string },
): Promise<ExamTrendPoint[]> {
  const student = await loadStudentInSchool(ctx, input.studentId);
  await assertStudentInScope(ctx, student);
  assertCan(ctx.user, PERMISSIONS.REPORT_CARD_READ);
  const enrollment = await currentEnrollment(ctx, student.id);
  if (!enrollment) {
    return [];
  }
  const cards = await ctx.repositories.reportCards.listPublishedByEnrollment(enrollment.id);
  return cards
    .map((c) => ({
      kind: c.kind,
      examId: c.examId,
      termId: c.termId,
      gpa: c.gpaSnapshot,
      cgpa: c.cgpaSnapshot,
      date: c.createdAt.toISOString(),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Monthly attendance % for one student over the last year (chart series). */
export async function attendanceTrend(
  ctx: ServiceContext,
  input: { studentId: string },
): Promise<AttendanceTrendPoint[]> {
  const student = await loadStudentInSchool(ctx, input.studentId);
  await assertStudentInScope(ctx, student);
  assertCan(ctx.user, PERMISSIONS.ATTENDANCE_READ);
  const enrollment = await currentEnrollment(ctx, student.id);
  if (!enrollment) {
    return [];
  }
  const to = istToday();
  const from = daysAgo(to, 365);
  const rows = await ctx.repositories.attendanceRecords.listByEnrollmentInRange(
    enrollment.id,
    from,
    to,
  );
  const buckets = new Map<string, Record<string, number>>();
  for (const r of rows) {
    const key = monthKey(r.session.date);
    const b = buckets.get(key) ?? {};
    b[r.status] = (b[r.status] ?? 0) + 1;
    buckets.set(key, b);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, c]) => ({ month, percentage: attendancePct(c) }));
}

/* ─────────────────────────────── teacher analytics ────────────────────────────── */

/** The acting teacher's own-section headline: per-section attendance % + referral count. */
export async function teacherSummary(ctx: ServiceContext): Promise<TeacherSummary> {
  assertCan(ctx.user, PERMISSIONS.ATTENDANCE_READ);
  const sectionIds = await teacherSectionIds(ctx);
  const yearId = await activeYearId(ctx);
  const to = istToday();
  const from = daysAgo(to, 365);

  const sections: TeacherSectionStat[] = [];
  for (const sectionId of sectionIds) {
    const enrollments = yearId
      ? await ctx.repositories.enrollments.listBySection(yearId, sectionId)
      : [];
    const counts = await ctx.repositories.attendanceRecords.statusCounts({
      schoolId: ctx.user.schoolId,
      sectionIds: [sectionId],
      from,
      to,
    });
    const cmap: Record<string, number> = {};
    for (const c of counts) {
      cmap[c.status] = c.count;
    }
    sections.push({
      sectionId,
      enrollmentCount: enrollments.length,
      attendancePercentage: attendancePct(cmap),
    });
  }

  assertCan(ctx.user, PERMISSIONS.BEHAVIOUR_READ);
  const referrals = await ctx.repositories.behaviourIncidents.list(ctx.user.schoolId, {
    teacherId: ctx.user.userId,
    limit: 1000,
  });

  return { sections, behaviourReferralCount: referrals.length };
}

/**
 * A section's average GPA + attendance % (teacher own-section / admin any). ponytail:
 * class performance v1 = mean GPA + attendance across the section (O(section) GPA
 * recompute — the `snapshot.ts` cohort precedent); per-exam distribution deferred.
 */
export async function classPerformance(
  ctx: ServiceContext,
  input: { sectionId: string },
): Promise<ClassPerformance> {
  assertCan(ctx.user, PERMISSIONS.MARK_READ);
  if (!isFullAccess(ctx)) {
    const mine = await teacherSectionIds(ctx);
    if (!mine.includes(input.sectionId)) {
      throw new ForbiddenError("Out of scope for this section");
    }
  }
  const yearId = await activeYearId(ctx);
  const enrollments = yearId
    ? await ctx.repositories.enrollments.listBySection(yearId, input.sectionId)
    : [];

  const gpas: number[] = [];
  for (const e of enrollments) {
    const g = await gpaForEnrollment(ctx, e.id);
    if (g !== null) {
      gpas.push(g);
    }
  }
  const averageGpa =
    gpas.length === 0 ? null : round2(gpas.reduce((a, b) => a + b, 0) / gpas.length);

  const to = istToday();
  const from = daysAgo(to, 365);
  const counts = await ctx.repositories.attendanceRecords.statusCounts({
    schoolId: ctx.user.schoolId,
    sectionIds: [input.sectionId],
    from,
    to,
  });
  const cmap: Record<string, number> = {};
  for (const c of counts) {
    cmap[c.status] = c.count;
  }

  return {
    sectionId: input.sectionId,
    enrollmentCount: enrollments.length,
    averageGpa,
    attendancePercentage: attendancePct(cmap),
  };
}

/* ──────────────────────────────── admin analytics ─────────────────────────────── */

/** Admin-only guard: school analytics span every cohort. */
function assertAdmin(ctx: ServiceContext): void {
  if (!isFullAccess(ctx)) {
    throw new ForbiddenError("School analytics are administrator-only");
  }
}

export async function schoolSummary(ctx: ServiceContext): Promise<SchoolSummary> {
  assertCan(ctx.user, PERMISSIONS.STUDENT_READ);
  assertAdmin(ctx);
  const yearId = await activeYearId(ctx);
  const to = istToday();
  const from = daysAgo(to, 365);

  const growth = await ctx.repositories.enrollments.countByYear(ctx.user.schoolId);
  const headcount = yearId
    ? (growth.find((g) => g.academicYearId === yearId)?.count ?? 0)
    : growth.reduce((a, g) => a + g.count, 0);

  const attCounts = await ctx.repositories.attendanceRecords.statusCounts({
    schoolId: ctx.user.schoolId,
    from,
    to,
  });
  const cmap: Record<string, number> = {};
  for (const c of attCounts) {
    cmap[c.status] = c.count;
  }

  const fees = await ctx.repositories.invoices.aggregateForSchool(
    ctx.user.schoolId,
    yearId ? { academicYearId: yearId } : undefined,
  );

  const today = istToday();
  const todays = await ctx.repositories.payments.list(ctx.user.schoolId, {
    from: today,
    to: today,
    limit: 10000,
  });
  const collectionToday = todays.reduce((a, p) => a + p.amount, 0);

  return {
    headcount,
    attendancePercentage: attendancePct(cmap),
    collectionToday,
    fees,
    studentGrowth: growth,
  };
}

export async function feeCollection(
  ctx: ServiceContext,
  input: { academicYearId?: string | undefined },
): Promise<FeeCollection> {
  assertCan(ctx.user, PERMISSIONS.FEE_READ);
  assertAdmin(ctx);
  const yearId = input.academicYearId ?? (await activeYearId(ctx)) ?? undefined;
  const agg = await ctx.repositories.invoices.aggregateForSchool(
    ctx.user.schoolId,
    yearId ? { academicYearId: yearId } : undefined,
  );

  // ponytail: monthly collected is over the last 365 days (payments carry no year); the
  // year filter narrows the billed/outstanding totals, not the collection series.
  const to = istToday();
  const from = daysAgo(to, 365);
  const payments = await ctx.repositories.payments.list(ctx.user.schoolId, {
    from,
    to,
    limit: 100000,
  });
  const buckets = new Map<string, number>();
  for (const p of payments) {
    const key = monthKey(p.paymentDate);
    buckets.set(key, (buckets.get(key) ?? 0) + p.amount);
  }
  const monthly = [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, collected]) => ({ month, collected }));

  return {
    totalBilled: agg.totalBilled,
    totalCollected: agg.totalCollected,
    totalOutstanding: agg.totalOutstanding,
    byStatus: agg.byStatus,
    monthly,
  };
}

/**
 * Top performers by GPA over the active-year cohort (admin). ponytail: O(enrollments)
 * GPA recompute — the ADR-022 §4 named ceiling; the deferred upgrade is a cached summary.
 */
export async function topPerformers(
  ctx: ServiceContext,
  input: { limit?: number | undefined },
): Promise<StudentRankRow[]> {
  assertCan(ctx.user, PERMISSIONS.MARK_READ);
  assertAdmin(ctx);
  const yearId = await activeYearId(ctx);
  if (!yearId) {
    return [];
  }
  const enrollments = await ctx.repositories.enrollments.listByYear(ctx.user.schoolId, yearId);
  const rows: StudentRankRow[] = [];
  for (const e of enrollments) {
    const gpa = await gpaForEnrollment(ctx, e.id);
    rows.push({ studentId: e.studentId, enrollmentId: e.id, gpa, attendancePercentage: null });
  }
  return rows
    .filter((r) => r.gpa !== null)
    .sort((a, b) => (b.gpa ?? 0) - (a.gpa ?? 0))
    .slice(0, input.limit ?? 10);
}

/**
 * At-risk students (admin): attendance % below {@link AT_RISK_ATTENDANCE} OR GPA below
 * {@link AT_RISK_GPA} over the active-year cohort. ponytail: thresholds flagged (ADR §6);
 * O(enrollments) attendance + GPA recompute — the §4 ceiling. Fee-overdue signal is
 * omitted (kept out of the teacher-visible surface; §6 deviation #5).
 */
export async function atRiskStudents(ctx: ServiceContext): Promise<StudentRankRow[]> {
  assertCan(ctx.user, PERMISSIONS.ATTENDANCE_READ);
  assertAdmin(ctx);
  const yearId = await activeYearId(ctx);
  if (!yearId) {
    return [];
  }
  const enrollments = await ctx.repositories.enrollments.listByYear(ctx.user.schoolId, yearId);
  const to = istToday();
  const from = daysAgo(to, 365);

  const rows: StudentRankRow[] = [];
  for (const e of enrollments) {
    const attRows = await ctx.repositories.attendanceRecords.listByEnrollmentInRange(
      e.id,
      from,
      to,
    );
    const cmap: Record<string, number> = {};
    for (const r of attRows) {
      cmap[r.status] = (cmap[r.status] ?? 0) + 1;
    }
    const pct = attendancePct(cmap);
    const gpa = await gpaForEnrollment(ctx, e.id);
    const atRisk =
      (pct !== null && pct < AT_RISK_ATTENDANCE) || (gpa !== null && gpa < AT_RISK_GPA);
    if (atRisk) {
      rows.push({ studentId: e.studentId, enrollmentId: e.id, gpa, attendancePercentage: pct });
    }
  }
  return rows;
}

/* ─────────────────────────── composite (self-authorizing) ─────────────────────── */

/**
 * Role dashboard — composes only the panels the principal is entitled to (ADR-022 §9):
 * each sub-call self-authorizes, so there is no single analytics gate.
 */
export async function dashboard(ctx: ServiceContext): Promise<Dashboard> {
  if (isFullAccess(ctx)) {
    return { role: "ADMIN", school: await schoolSummary(ctx) };
  }
  if (ctx.user.role === "TEACHER") {
    return { role: "TEACHER", teacher: await teacherSummary(ctx) };
  }
  if (ctx.user.role === "PARENT") {
    const childIds = await parentChildIds(ctx);
    const children: StudentSummary[] = [];
    for (const id of childIds) {
      children.push(await studentSummary(ctx, { studentId: id }));
    }
    return { role: "PARENT", children };
  }
  throw new ForbiddenError("No analytics dashboard for this role");
}
