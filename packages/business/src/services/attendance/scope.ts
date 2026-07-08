import { ForbiddenError, NotFoundError, ValidationError } from "@repo/core";
import type { AttendanceSession, Enrollment } from "@repo/db";
import type { IstDateString } from "@repo/types";

import type { ServiceContext } from "../../context";
import { isFullAccess, parentChildIds, teacherSectionIds } from "../people/scope";

export { isFullAccess, recordAudit, teacherSectionIds } from "../people/scope";

/** @db.Date → YYYY-MM-DD IST string (dates arrive as Date from the Zod boundary
 *  via `istDateSchema`; this is only for audit/summary echoes). */
export function toIstDateString(date: Date): IstDateString {
  return date.toISOString().slice(0, 10) as IstDateString;
}

/** Resolve a child's display name from an enrollment (for admin approval queues);
 *  falls back to the enrollment id if the graph is incomplete. */
export async function studentNameForEnrollment(
  ctx: ServiceContext,
  enrollmentId: string,
): Promise<string> {
  const enrollment = await ctx.repositories.enrollments.findById(enrollmentId);
  if (!enrollment) {
    return enrollmentId;
  }
  const student = await ctx.repositories.students.findById(enrollment.studentId);
  return student ? `${student.firstName} ${student.lastName}` : enrollment.studentId;
}

/**
 * The acting user's `Staff` row id (REVIEW_FINDINGS B3). Every attendance
 * mutation is authored by a Staff row (session created/submitted/locked,
 * correction requested/decided); a marking user without one is a provisioning
 * error, surfaced as a clean ValidationError rather than an FK violation.
 */
export async function resolveActingStaffId(ctx: ServiceContext): Promise<string> {
  const staff = await ctx.repositories.staff.findByUserId(ctx.user.userId);
  if (!staff) {
    throw new ValidationError("Acting user has no staff profile (required for attendance actions)");
  }
  return staff.id;
}

/** Load an enrollment, enforcing tenant ownership (404 if missing or other-school). */
export async function loadEnrollmentInSchool(ctx: ServiceContext, id: string): Promise<Enrollment> {
  const row = await ctx.repositories.enrollments.findById(id);
  if (!row || row.schoolId !== ctx.user.schoolId) {
    throw new NotFoundError("Enrollment not found");
  }
  return row;
}

/** Load an attendance session, enforcing tenant ownership (404 otherwise). */
export async function loadSessionInSchool(
  ctx: ServiceContext,
  id: string,
): Promise<AttendanceSession> {
  const row = await ctx.repositories.attendanceSessions.findById(id);
  if (!row || row.schoolId !== ctx.user.schoolId) {
    throw new NotFoundError("Attendance session not found");
  }
  return row;
}

/** Admin → any; teacher → only sections they teach; anyone else → Forbidden. */
export async function assertTeachesSection(ctx: ServiceContext, sectionId: string): Promise<void> {
  if (isFullAccess(ctx)) {
    return;
  }
  if (ctx.user.role === "TEACHER" && (await teacherSectionIds(ctx)).includes(sectionId)) {
    return;
  }
  throw new ForbiddenError("Out of scope for this section");
}

/**
 * Read-scope for a single enrollment's attendance/leave: admin → any; teacher →
 * the enrollment's section is one they teach; parent → the enrollment's student
 * is their child. Coarse on year (business reads are per-record anyway).
 */
export async function assertEnrollmentInScope(
  ctx: ServiceContext,
  enrollment: Enrollment,
): Promise<void> {
  if (isFullAccess(ctx)) {
    return;
  }
  if (ctx.user.role === "TEACHER") {
    if (enrollment.sectionId && (await teacherSectionIds(ctx)).includes(enrollment.sectionId)) {
      return;
    }
  } else if (ctx.user.role === "PARENT") {
    if ((await parentChildIds(ctx)).includes(enrollment.studentId)) {
      return;
    }
  }
  throw new ForbiddenError("Out of scope for this enrollment");
}

/**
 * Working-day resolution (ADR-011 §9). M4 layers = weekday baseline (treated as
 * working — the weekend rule is [CONFIRM §16.15], not hard-coded here) minus
 * Holiday. A session cannot be opened on a holiday. The WorkingDayOverride layer
 * (make-up days) is the designed-in extension point — NOT built in M4, so a
 * holiday is a hard block with no override.
 */
export async function assertWorkingDay(
  ctx: ServiceContext,
  academicYearId: string,
  date: Date,
): Promise<void> {
  const holiday = await ctx.repositories.holidays.findByYearDate(academicYearId, date);
  if (holiday) {
    throw new ValidationError(`Cannot record attendance on a holiday (${holiday.name})`);
  }
}
