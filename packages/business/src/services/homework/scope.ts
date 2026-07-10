import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@repo/core";
import type {
  Enrollment,
  Homework,
  HomeworkAttachment,
  HomeworkFeedback,
  HomeworkSubmission,
  SubmissionAttachment,
} from "@repo/db";
import type {
  HomeworkAttachmentDto,
  HomeworkDto,
  HomeworkFeedbackDto,
  HomeworkSubmissionDto,
  IsoUtcString,
  IstDateString,
  SubmissionAttachmentDto,
} from "@repo/types";

import type { ServiceContext } from "../../context";
import { isFullAccess, parentChildIds } from "../people/scope";

export { recordAudit } from "../people/scope";

/** True when the acting user is a PARENT (published-only homework read scope). */
export function isParent(ctx: ServiceContext): boolean {
  return ctx.user.role === "PARENT";
}

/* ---- IST date handling (ADR-013 §5; DATABASE_CONVENTIONS §4) ----
 * `dueDate` is `@db.Date`, stored as UTC-midnight of the IST calendar day, so its
 * IST date string is a plain slice. "Now" needs the +5:30 shift BEFORE slicing to
 * land on the correct IST calendar day — compare the two as YYYY-MM-DD strings,
 * never as Date objects. */
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

/** A `@db.Date` value → its IST calendar date string. */
export function dueDateIst(d: Date): IstDateString {
  return d.toISOString().slice(0, 10) as IstDateString;
}

/** A timestamp (or now) → the IST calendar date it falls on. */
export function istCalendarDate(at: Date): IstDateString {
  return new Date(at.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10) as IstDateString;
}

const iso = (d: Date | null): IsoUtcString | null => (d ? (d.toISOString() as IsoUtcString) : null);

/**
 * The acting user's Staff row id (B3 provisioning invariant — mirrors the exam/
 * attendance resolvers). Every homework mutation is authored by a Staff row; a user
 * without one is a provisioning error surfaced as a clean ValidationError (R6).
 */
export async function resolveActingStaffId(ctx: ServiceContext): Promise<string> {
  const staff = await ctx.repositories.staff.findByUserId(ctx.user.userId);
  if (!staff) {
    throw new ValidationError("Acting user has no staff profile (required for homework actions)");
  }
  return staff.id;
}

/** The acting user's Parent row id (B3 extended to parents — R6). */
export async function resolveActingParentId(ctx: ServiceContext): Promise<string> {
  const parent = await ctx.repositories.parents.findByUserId(ctx.user.userId);
  if (!parent) {
    throw new ValidationError("Acting user has no parent profile (required to submit homework)");
  }
  return parent.id;
}

export async function loadHomeworkInSchool(ctx: ServiceContext, id: string): Promise<Homework> {
  const row = await ctx.repositories.homework.findById(id);
  if (!row || row.schoolId !== ctx.user.schoolId) {
    throw new NotFoundError("Homework not found");
  }
  return row;
}

export async function loadSubmissionInSchool(
  ctx: ServiceContext,
  id: string,
): Promise<HomeworkSubmission> {
  const row = await ctx.repositories.homeworkSubmissions.findById(id);
  if (!row || row.schoolId !== ctx.user.schoolId) {
    throw new NotFoundError("Submission not found");
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
 * Teacher ownership (ADR-013 §4): admin → any; teacher → must hold a
 * TeacherAssignment for exactly this homework's (subject, section); anyone else →
 * Forbidden. Ownership is DERIVED here, never stored.
 */
export async function assertOwnsSubjectSection(
  ctx: ServiceContext,
  subjectId: string,
  sectionId: string,
): Promise<void> {
  if (isFullAccess(ctx)) {
    return;
  }
  if (ctx.user.role === "TEACHER") {
    const owned = await ctx.repositories.teacherAssignments.findByTriple(
      ctx.user.userId,
      subjectId,
      sectionId,
    );
    if (owned) {
      return;
    }
  }
  throw new ForbiddenError("Out of scope for this homework");
}

export function assertOwnsHomework(ctx: ServiceContext, homework: Homework): Promise<void> {
  return assertOwnsSubjectSection(ctx, homework.subjectId, homework.sectionId);
}

/** ACTIVE enrollments across all of a parent's children (section-match source, §10). */
async function parentActiveEnrollments(ctx: ServiceContext): Promise<Enrollment[]> {
  const childIds = await parentChildIds(ctx);
  const perChild = await Promise.all(
    childIds.map((sid) => ctx.repositories.enrollments.listByStudent(sid)),
  );
  return perChild.flat().filter((e) => e.status === "ACTIVE");
}

/** ALL enrollments across a parent's children (has-submission source — survives transfer/promotion). */
async function parentAllEnrollments(ctx: ServiceContext): Promise<Enrollment[]> {
  const childIds = await parentChildIds(ctx);
  const perChild = await Promise.all(
    childIds.map((sid) => ctx.repositories.enrollments.listByStudent(sid)),
  );
  return perChild.flat();
}

/**
 * Read scope for one homework (ADR-013 §10, the subtlest rule — R3): admin → any;
 * teacher → own (subject × section); parent → PUBLISHED/CLOSED only AND either a
 * section-match (own child ACTIVE in this section) OR a has-submission match (own
 * child already submitted for this homework — the mid-year-transfer or-clause).
 */
export async function assertHomeworkReadScope(
  ctx: ServiceContext,
  homework: Homework,
): Promise<void> {
  if (isFullAccess(ctx)) {
    return;
  }
  if (ctx.user.role === "TEACHER") {
    return assertOwnsHomework(ctx, homework);
  }
  if (ctx.user.role === "PARENT" && homework.status !== "DRAFT") {
    const all = await parentAllEnrollments(ctx);
    const sectionMatch = all.some(
      (e) => e.status === "ACTIVE" && e.sectionId === homework.sectionId,
    );
    if (sectionMatch) {
      return;
    }
    const submitted = await ctx.repositories.homeworkSubmissions.homeworkIdsForEnrollments(
      all.map((e) => e.id),
    );
    if (submitted.includes(homework.id)) {
      return;
    }
  }
  throw new ForbiddenError("Out of scope for this homework");
}

/**
 * Own-child scope for a submission's enrollment (§10): admin/teacher scoping is done
 * by the owning homework; a parent may only touch a submission whose enrollment
 * belongs to one of their children.
 */
export async function assertParentOwnsEnrollment(
  ctx: ServiceContext,
  enrollment: Enrollment,
): Promise<void> {
  const childIds = await parentChildIds(ctx);
  if (!childIds.includes(enrollment.studentId)) {
    throw new ForbiddenError("Out of scope for this child");
  }
}

/** The section ids + already-submitted homework ids that make up a parent's homework feed. */
export async function parentVisibilityKeys(
  ctx: ServiceContext,
): Promise<{ sectionIds: string[]; submittedHomeworkIds: string[] }> {
  const active = await parentActiveEnrollments(ctx);
  const all = await parentAllEnrollments(ctx);
  const sectionIds = [...new Set(active.map((e) => e.sectionId).filter((s): s is string => !!s))];
  const submittedHomeworkIds = await ctx.repositories.homeworkSubmissions.homeworkIdsForEnrollments(
    all.map((e) => e.id),
  );
  return { sectionIds, submittedHomeworkIds };
}

/**
 * The cross-table submit/resubmit invariants the DB cannot express (ADR-013 §7).
 * Checked on every submit AND resubmit: homework PUBLISHED, section match, year
 * match, ACTIVE enrollment, same tenant. The parent-link (own child) is a separate
 * scope check ({@link assertParentOwnsEnrollment}) run first.
 */
export function assertSubmittable(homework: Homework, enrollment: Enrollment): void {
  if (homework.status !== "PUBLISHED") {
    throw new ConflictError("This homework is not open for submissions");
  }
  if (enrollment.schoolId !== homework.schoolId) {
    throw new ForbiddenError("Enrollment is not in this school");
  }
  if (enrollment.sectionId !== homework.sectionId) {
    throw new ForbiddenError("Enrollment is not in this homework's section");
  }
  if (enrollment.academicYearId !== homework.academicYearId) {
    throw new ValidationError("Enrollment is not in this homework's academic year");
  }
  if (enrollment.status !== "ACTIVE") {
    throw new ValidationError("Only an active enrollment can submit homework");
  }
}

/**
 * Read scope for one submission (and its attachments/feedback): admin → any;
 * teacher → owns the submission's homework (subject × section); parent → the
 * submission's enrollment belongs to an own child (§10).
 */
export async function assertSubmissionReadScope(
  ctx: ServiceContext,
  submission: HomeworkSubmission,
): Promise<void> {
  if (isFullAccess(ctx)) {
    return;
  }
  if (ctx.user.role === "TEACHER") {
    const homework = await loadHomeworkInSchool(ctx, submission.homeworkId);
    return assertOwnsHomework(ctx, homework);
  }
  if (ctx.user.role === "PARENT") {
    const enrollment = await loadEnrollmentInSchool(ctx, submission.enrollmentId);
    return assertParentOwnsEnrollment(ctx, enrollment);
  }
  throw new ForbiddenError("Out of scope for this submission");
}

/* ---- mappers ---- */

export function mapHomework(h: Homework): HomeworkDto {
  return {
    id: h.id,
    schoolId: h.schoolId,
    academicYearId: h.academicYearId,
    subjectId: h.subjectId,
    sectionId: h.sectionId,
    title: h.title,
    description: h.description,
    dueDate: dueDateIst(h.dueDate),
    status: h.status,
    createdByStaffId: h.createdByStaffId,
    publishedByStaffId: h.publishedByStaffId,
    publishedAt: iso(h.publishedAt),
    closedByStaffId: h.closedByStaffId,
    closedAt: iso(h.closedAt),
    reopenedByStaffId: h.reopenedByStaffId,
    reopenedAt: iso(h.reopenedAt),
    reopenReason: h.reopenReason,
  };
}

export function mapHomeworkAttachment(a: HomeworkAttachment): HomeworkAttachmentDto {
  return {
    id: a.id,
    schoolId: a.schoolId,
    homeworkId: a.homeworkId,
    storagePath: a.storagePath,
    fileName: a.fileName,
    mimeType: a.mimeType,
    sizeBytes: a.sizeBytes,
    checksum: a.checksum,
    uploadedByStaffId: a.uploadedByStaffId,
    createdAt: a.createdAt.toISOString() as IsoUtcString,
  };
}

export function mapSubmission(s: HomeworkSubmission): HomeworkSubmissionDto {
  return {
    id: s.id,
    schoolId: s.schoolId,
    homeworkId: s.homeworkId,
    enrollmentId: s.enrollmentId,
    submittedByParentId: s.submittedByParentId,
    note: s.note,
    status: s.status,
    attempt: s.attempt,
    isLate: s.isLate,
    firstSubmittedAt: s.firstSubmittedAt.toISOString() as IsoUtcString,
    submittedAt: s.submittedAt.toISOString() as IsoUtcString,
    reviewedByStaffId: s.reviewedByStaffId,
    reviewedAt: iso(s.reviewedAt),
  };
}

export function mapSubmissionAttachment(a: SubmissionAttachment): SubmissionAttachmentDto {
  return {
    id: a.id,
    schoolId: a.schoolId,
    submissionId: a.submissionId,
    attempt: a.attempt,
    storagePath: a.storagePath,
    fileName: a.fileName,
    mimeType: a.mimeType,
    sizeBytes: a.sizeBytes,
    checksum: a.checksum,
    uploadedByParentId: a.uploadedByParentId,
    createdAt: a.createdAt.toISOString() as IsoUtcString,
  };
}

export function mapFeedback(f: HomeworkFeedback): HomeworkFeedbackDto {
  return {
    id: f.id,
    schoolId: f.schoolId,
    submissionId: f.submissionId,
    authorStaffId: f.authorStaffId,
    attempt: f.attempt,
    decision: f.decision,
    body: f.body,
    createdAt: f.createdAt.toISOString() as IsoUtcString,
  };
}
