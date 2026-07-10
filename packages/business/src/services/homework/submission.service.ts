import { HOMEWORK_ATTACHMENT, PERMISSIONS } from "@repo/constants";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@repo/core";
import type { Enrollment, Homework } from "@repo/db";
import type { HomeworkChildContextDto, HomeworkSubmissionDto } from "@repo/types";

import { assertCan } from "../../authorization";
import type { ServiceContext } from "../../context";
import { isFullAccess, parentChildIds } from "../people/scope";

import { assertFileAllowed } from "./attachment.service";
import {
  assertOwnsHomework,
  assertParentOwnsEnrollment,
  assertSubmissionReadScope,
  assertSubmittable,
  dueDateIst,
  istCalendarDate,
  loadEnrollmentInSchool,
  loadHomeworkInSchool,
  loadSubmissionInSchool,
  mapSubmission,
  recordAudit,
  resolveActingParentId,
} from "./scope";

/** Already-uploaded parent file metadata carried into a (re)submit (bytes live in Storage). */
export interface SubmissionAttachmentMeta {
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  checksum?: string | null | undefined;
}

export interface SubmitHomeworkInput {
  homeworkId: string;
  enrollmentId: string;
  note?: string | null | undefined;
  attachments: SubmissionAttachmentMeta[];
}

function validateBundle(
  note: string | null | undefined,
  attachments: SubmissionAttachmentMeta[],
): void {
  if (!note?.trim() && attachments.length === 0) {
    throw new ValidationError("A submission needs a note or at least one attachment");
  }
  if (attachments.length > HOMEWORK_ATTACHMENT.MAX_FILES) {
    throw new ValidationError(`At most ${HOMEWORK_ATTACHMENT.MAX_FILES} files per submission`);
  }
  for (const a of attachments) {
    assertFileAllowed(a.mimeType, a.sizeBytes);
  }
}

/** Load homework + enrollment, run the parent-child scope + §7 submittability chain. */
async function loadForSubmit(
  ctx: ServiceContext,
  homeworkId: string,
  enrollmentId: string,
): Promise<{ homework: Homework; enrollment: Enrollment }> {
  const homework = await loadHomeworkInSchool(ctx, homeworkId);
  const enrollment = await loadEnrollmentInSchool(ctx, enrollmentId);
  await assertParentOwnsEnrollment(ctx, enrollment);
  assertSubmittable(homework, enrollment);
  return { homework, enrollment };
}

/**
 * First submission for a child (attempt 1). Parent-only; enforces every §7
 * invariant + the empty-submission guard, snapshots `isLate` (latest attempt vs
 * dueDate, IST), and writes the submission + its attachments + audit in one
 * transaction. The `@@unique(homeworkId, enrollmentId)` makes a duplicate-submit
 * race a Conflict (the aborted tx rolls back cleanly), not a second row (ADR-013 §5).
 */
export async function submitHomework(
  ctx: ServiceContext,
  input: SubmitHomeworkInput,
): Promise<HomeworkSubmissionDto> {
  assertCan(ctx.user, PERMISSIONS.SUBMISSION_SUBMIT);
  const parentId = await resolveActingParentId(ctx);
  const { homework } = await loadForSubmit(ctx, input.homeworkId, input.enrollmentId);
  validateBundle(input.note, input.attachments);

  const existing = await ctx.repositories.homeworkSubmissions.findByHomeworkEnrollment(
    input.homeworkId,
    input.enrollmentId,
  );
  if (existing) {
    throw new ConflictError("A submission already exists for this child; resubmit instead");
  }

  const now = new Date();
  const isLate = istCalendarDate(now) > dueDateIst(homework.dueDate);

  try {
    return await ctx.withTransaction(async (repos) => {
      const submission = await repos.homeworkSubmissions.create({
        schoolId: ctx.user.schoolId,
        homeworkId: input.homeworkId,
        enrollmentId: input.enrollmentId,
        submittedByParentId: parentId,
        note: input.note ?? null,
        isLate,
        submittedAt: now,
      });
      await repos.submissionAttachments.createMany(
        input.attachments.map((a) => ({
          schoolId: ctx.user.schoolId,
          submissionId: submission.id,
          attempt: submission.attempt,
          storagePath: a.storagePath,
          fileName: a.fileName,
          mimeType: a.mimeType,
          sizeBytes: a.sizeBytes,
          checksum: a.checksum ?? null,
          uploadedByParentId: parentId,
        })),
      );
      await recordAudit(ctx, repos, {
        action: "HOMEWORK_SUBMIT",
        entityType: "HomeworkSubmission",
        entityId: submission.id,
        after: { attempt: submission.attempt, isLate, files: input.attachments.length },
      });
      return mapSubmission(submission);
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      throw new ConflictError("A submission already exists for this child; resubmit instead");
    }
    throw e;
  }
}

/**
 * Resubmit for a child (attempt++). Preconditions: homework PUBLISHED (§7),
 * submission is SUBMITTED or RETURNED (never after REVIEWED — §6). Guarded on
 * `(status, attempt)` so a review/resubmit race is a Conflict, never a silent
 * overwrite (R2). Appends attachments tagged with the NEW attempt (append-only
 * history). Audited.
 */
export async function resubmitHomework(
  ctx: ServiceContext,
  input: SubmitHomeworkInput,
): Promise<HomeworkSubmissionDto> {
  assertCan(ctx.user, PERMISSIONS.SUBMISSION_SUBMIT);
  const parentId = await resolveActingParentId(ctx);
  const { homework } = await loadForSubmit(ctx, input.homeworkId, input.enrollmentId);
  validateBundle(input.note, input.attachments);

  const existing = await ctx.repositories.homeworkSubmissions.findByHomeworkEnrollment(
    input.homeworkId,
    input.enrollmentId,
  );
  if (!existing) {
    throw new NotFoundError("No submission to resubmit");
  }
  if (existing.status === "REVIEWED") {
    throw new ConflictError("A reviewed submission cannot be resubmitted");
  }

  const now = new Date();
  const isLate = istCalendarDate(now) > dueDateIst(homework.dueDate);
  const seenAttempt = existing.attempt;

  return ctx.withTransaction(async (repos) => {
    const updated = await repos.homeworkSubmissions.resubmit(existing.id, seenAttempt, {
      submittedByParentId: parentId,
      note: input.note ?? null,
      isLate,
      submittedAt: now,
    });
    if (!updated) {
      throw new ConflictError(
        "The submission changed while you were resubmitting; reload and retry",
      );
    }
    await repos.submissionAttachments.createMany(
      input.attachments.map((a) => ({
        schoolId: ctx.user.schoolId,
        submissionId: updated.id,
        attempt: updated.attempt,
        storagePath: a.storagePath,
        fileName: a.fileName,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        checksum: a.checksum ?? null,
        uploadedByParentId: parentId,
      })),
    );
    await recordAudit(ctx, repos, {
      action: "HOMEWORK_RESUBMIT",
      entityType: "HomeworkSubmission",
      entityId: updated.id,
      before: { attempt: seenAttempt },
      after: { attempt: updated.attempt, isLate, files: input.attachments.length },
    });
    return mapSubmission(updated);
  });
}

/** A homework's submissions (teacher review queue / admin) — owning teacher or admin only. */
export async function listSubmissions(
  ctx: ServiceContext,
  homeworkId: string,
  statuses?: readonly ("SUBMITTED" | "RETURNED" | "REVIEWED")[],
): Promise<HomeworkSubmissionDto[]> {
  assertCan(ctx.user, PERMISSIONS.SUBMISSION_READ);
  const homework = await loadHomeworkInSchool(ctx, homeworkId);
  // Teacher must own; parents don't enumerate a homework's submissions (they read their own child's).
  await assertOwnsHomework(ctx, homework);
  const rows = await ctx.repositories.homeworkSubmissions.listByHomework(homeworkId, statuses);
  return rows.map(mapSubmission);
}

/**
 * A parent's per-child submission context for one homework (mobile submit flow).
 * For each own child: the ACTIVE-in-section enrollment to submit against (null if
 * none — e.g. transferred out) and their existing submission if any (found across
 * all their enrollments, so a transferred child's history stays reachable — §10).
 * Only children with a submit target OR an existing submission are returned.
 */
export async function listHomeworkChildContext(
  ctx: ServiceContext,
  homeworkId: string,
): Promise<HomeworkChildContextDto[]> {
  assertCan(ctx.user, PERMISSIONS.SUBMISSION_READ);
  const homework = await loadHomeworkInSchool(ctx, homeworkId);
  const childIds = await parentChildIds(ctx);
  const out: HomeworkChildContextDto[] = [];
  for (const studentId of childIds) {
    const enrollments = await ctx.repositories.enrollments.listByStudent(studentId);
    const target = enrollments.find(
      (e) => e.status === "ACTIVE" && e.sectionId === homework.sectionId,
    );
    let submission: HomeworkSubmissionDto | null = null;
    for (const e of enrollments) {
      const s = await ctx.repositories.homeworkSubmissions.findByHomeworkEnrollment(
        homeworkId,
        e.id,
      );
      if (s) {
        submission = mapSubmission(s);
        break;
      }
    }
    if (!target && !submission) {
      continue;
    }
    const student = await ctx.repositories.students.findById(studentId);
    out.push({
      studentId,
      studentName: student ? `${student.firstName} ${student.lastName}` : studentId,
      enrollmentId: target?.id ?? null,
      submission,
    });
  }
  return out;
}

/** One submission (read-scoped: admin any / owning teacher / own-child parent). */
export async function getSubmission(
  ctx: ServiceContext,
  submissionId: string,
): Promise<HomeworkSubmissionDto> {
  assertCan(ctx.user, PERMISSIONS.SUBMISSION_READ);
  const submission = await loadSubmissionInSchool(ctx, submissionId);
  await assertSubmissionReadScope(ctx, submission);
  return mapSubmission(submission);
}

/**
 * A child's homework submission trail — admin (any) or the linked parent (own child)
 * ONLY. Teachers are intentionally excluded here: this returns a child's submissions
 * across ALL subjects, but a teacher's submission visibility is own-subject×section
 * (ADR-013 §10). Teachers use the per-homework review queue ({@link listSubmissions},
 * ownership-gated) instead — this keeps the two read paths §10-consistent.
 */
export async function submissionsForEnrollment(
  ctx: ServiceContext,
  enrollmentId: string,
): Promise<HomeworkSubmissionDto[]> {
  assertCan(ctx.user, PERMISSIONS.SUBMISSION_READ);
  const enrollment = await loadEnrollmentInSchool(ctx, enrollmentId);
  if (ctx.user.role === "PARENT") {
    await assertParentOwnsEnrollment(ctx, enrollment);
  } else if (!isFullAccess(ctx)) {
    throw new ForbiddenError("Out of scope for this enrollment");
  }
  const rows = await ctx.repositories.homeworkSubmissions.listByEnrollment(enrollmentId);
  return rows.map(mapSubmission);
}
