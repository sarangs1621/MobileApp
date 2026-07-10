import { ForbiddenError, NotFoundError, ValidationError } from "@repo/core";
import type { Enrollment, ReportCard } from "@repo/db";
import type { IsoUtcString, ReportCardDto } from "@repo/types";

import type { ServiceContext } from "../../context";
import { assertClassTeacherOfEnrollment } from "../academic/class-teacher.service";
import { isFullAccess, parentChildIds } from "../people/scope";

export { recordAudit } from "../people/scope";
export { assertClassTeacherOfEnrollment } from "../academic/class-teacher.service";

const iso = (d: Date | null): IsoUtcString | null => (d ? (d.toISOString() as IsoUtcString) : null);

/** True when the acting user is a PARENT (PUBLISHED-only, own-child read scope). */
export function isParent(ctx: ServiceContext): boolean {
  return ctx.user.role === "PARENT";
}

export async function loadReportCardInSchool(ctx: ServiceContext, id: string): Promise<ReportCard> {
  const row = await ctx.repositories.reportCards.findById(id);
  if (!row || row.schoolId !== ctx.user.schoolId) {
    throw new NotFoundError("Report card not found");
  }
  return row;
}

export async function loadEnrollmentInSchool(ctx: ServiceContext, id: string): Promise<Enrollment> {
  const row = await ctx.repositories.enrollments.findById(id);
  if (!row || row.schoolId !== ctx.user.schoolId) {
    throw new NotFoundError("Enrollment not found");
  }
  return row;
}

/**
 * MANDATORY year-consistency gate (centralized — every write path calls this). A
 * card's scope YEAR must equal its enrollment's year: EXAM → exam.academicYearId,
 * TERM → term.academicYearId, ANNUAL → trivially the enrollment's year. The kind⟺scope
 * DB CHECK only enforces presence, not the cross-table year (a CHECK cannot join) —
 * so a mismatch is rejected here as a ValidationError. Also proves the exam/term is
 * in-tenant (an in-school enrollment + matching year ⇒ same tenant). Returns the
 * loaded enrollment (callers reuse it for the snapshot).
 */
export async function assertScopeYearMatches(
  ctx: ServiceContext,
  scope: {
    enrollmentId: string;
    kind: ReportCard["kind"];
    examId: string | null;
    termId: string | null;
  },
): Promise<Enrollment> {
  const enrollment = await loadEnrollmentInSchool(ctx, scope.enrollmentId);
  if (scope.kind === "EXAM") {
    if (!scope.examId) {
      throw new ValidationError("An exam report card requires an exam");
    }
    const exam = await ctx.repositories.exams.findById(scope.examId);
    if (!exam || exam.schoolId !== ctx.user.schoolId) {
      throw new NotFoundError("Exam not found");
    }
    if (exam.academicYearId !== enrollment.academicYearId) {
      throw new ValidationError("The exam and the enrollment are in different academic years");
    }
  } else if (scope.kind === "TERM") {
    if (!scope.termId) {
      throw new ValidationError("A term report card requires a term");
    }
    const term = await ctx.repositories.academicTerms.findById(scope.termId);
    if (!term) {
      throw new NotFoundError("Academic term not found");
    }
    if (term.academicYearId !== enrollment.academicYearId) {
      throw new ValidationError("The term and the enrollment are in different academic years");
    }
  }
  // ANNUAL: the card's year IS the enrollment's — no scope FK to cross-check.
  return enrollment;
}

/**
 * Read scope for one card: admin → any; teacher → the assigned class teacher of the
 * card's enrollment (the shared gate — a subject teacher is refused); parent → own
 * child AND PUBLISHED only. Non-published cards are invisible to parents.
 */
export async function assertReportCardReadScope(
  ctx: ServiceContext,
  card: ReportCard,
): Promise<void> {
  if (isFullAccess(ctx)) {
    return;
  }
  if (ctx.user.role === "TEACHER") {
    return assertClassTeacherOfEnrollment(ctx, card.enrollmentId);
  }
  if (ctx.user.role === "PARENT" && card.status === "PUBLISHED") {
    const enrollment = await loadEnrollmentInSchool(ctx, card.enrollmentId);
    const childIds = await parentChildIds(ctx);
    if (childIds.includes(enrollment.studentId)) {
      return;
    }
  }
  throw new ForbiddenError("Out of scope for this report card");
}

/**
 * The acting user's Staff row id (B3 provisioning invariant — mirrors the exam/
 * homework resolvers). Every card mutation records WHO acted; a user without a Staff
 * row is a provisioning error surfaced as a clean ValidationError.
 */
export async function resolveActingStaffId(ctx: ServiceContext): Promise<string> {
  const staff = await ctx.repositories.staff.findByUserId(ctx.user.userId);
  if (!staff) {
    throw new ValidationError(
      "Acting user has no staff profile (required for report-card actions)",
    );
  }
  return staff.id;
}

export function mapReportCard(c: ReportCard): ReportCardDto {
  return {
    id: c.id,
    schoolId: c.schoolId,
    enrollmentId: c.enrollmentId,
    kind: c.kind,
    examId: c.examId,
    termId: c.termId,
    version: c.version,
    status: c.status,
    classTeacherRemark: c.classTeacherRemark,
    principalRemark: c.principalRemark,
    promotionDecision: c.promotionDecision,
    rank: c.rank,
    rankScope: c.rankScope,
    cohortSize: c.cohortSize,
    attendancePercentage: c.attendancePercentage,
    presentCount: c.presentCount,
    absentCount: c.absentCount,
    lateCount: c.lateCount,
    halfDayCount: c.halfDayCount,
    leaveCount: c.leaveCount,
    workingDays: c.workingDays,
    gpaSnapshot: c.gpaSnapshot,
    cgpaSnapshot: c.cgpaSnapshot,
    pdfPath: c.pdfPath,
    createdByStaffId: c.createdByStaffId,
    submittedByStaffId: c.submittedByStaffId,
    submittedAt: iso(c.submittedAt),
    approvedByStaffId: c.approvedByStaffId,
    approvedAt: iso(c.approvedAt),
    publishedByStaffId: c.publishedByStaffId,
    publishedAt: iso(c.publishedAt),
    reopenedByStaffId: c.reopenedByStaffId,
    reopenedAt: iso(c.reopenedAt),
    reopenReason: c.reopenReason,
    revokedByStaffId: c.revokedByStaffId,
    revokedAt: iso(c.revokedAt),
    revokeReason: c.revokeReason,
  };
}
