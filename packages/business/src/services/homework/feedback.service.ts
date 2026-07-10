import { PERMISSIONS } from "@repo/constants";
import { ConflictError, ValidationError } from "@repo/core";
import type { HomeworkFeedbackDto, HomeworkSubmissionDto, SubmissionStatusKey } from "@repo/types";

import { assertCan } from "../../authorization";
import type { ServiceContext } from "../../context";

import {
  assertOwnsHomework,
  assertSubmissionReadScope,
  loadHomeworkInSchool,
  loadSubmissionInSchool,
  mapFeedback,
  mapSubmission,
  recordAudit,
  resolveActingStaffId,
} from "./scope";

export interface ReviewSubmissionInput {
  submissionId: string;
  /** RETURNED = changes requested (parent may resubmit); REVIEWED = terminal accept. */
  decision: Extract<SubmissionStatusKey, "RETURNED" | "REVIEWED">;
  body: string;
}

/**
 * Review a submission (owning teacher/admin) — writes an immutable feedback round,
 * transitions the submission (RETURNED/REVIEWED + reviewedBy/At), and audits, all in
 * ONE transaction (ADR-013 §8). Guarded on `(status='SUBMITTED', attempt)` so a
 * review/resubmit race is a Conflict, never a stale overwrite (R2). Review is allowed
 * after CLOSE (teachers mark late batches), so no homework-state gate here.
 */
export async function reviewSubmission(
  ctx: ServiceContext,
  input: ReviewSubmissionInput,
): Promise<HomeworkSubmissionDto> {
  assertCan(ctx.user, PERMISSIONS.SUBMISSION_REVIEW);
  const staffId = await resolveActingStaffId(ctx);
  if (!input.body.trim()) {
    throw new ValidationError("Feedback body is required");
  }
  const submission = await loadSubmissionInSchool(ctx, input.submissionId);
  const homework = await loadHomeworkInSchool(ctx, submission.homeworkId);
  await assertOwnsHomework(ctx, homework);
  if (submission.status !== "SUBMITTED") {
    throw new ConflictError("Only a submitted (awaiting-review) submission can be reviewed");
  }
  const seenAttempt = submission.attempt;

  return ctx.withTransaction(async (repos) => {
    const reviewed = await repos.homeworkSubmissions.review(submission.id, seenAttempt, {
      status: input.decision,
      reviewedByStaffId: staffId,
      reviewedAt: new Date(),
    });
    if (!reviewed) {
      throw new ConflictError("The submission changed before your review landed; reload and retry");
    }
    await repos.homeworkFeedback.create({
      schoolId: ctx.user.schoolId,
      submissionId: submission.id,
      authorStaffId: staffId,
      attempt: seenAttempt,
      decision: input.decision,
      body: input.body,
    });
    await recordAudit(ctx, repos, {
      action: "HOMEWORK_REVIEW",
      entityType: "HomeworkSubmission",
      entityId: submission.id,
      before: { status: "SUBMITTED", attempt: seenAttempt },
      after: { status: input.decision },
    });
    return mapSubmission(reviewed);
  });
}

/** A submission's feedback rounds (read-scoped: admin / owning teacher / own-child parent). */
export async function listFeedback(
  ctx: ServiceContext,
  submissionId: string,
): Promise<HomeworkFeedbackDto[]> {
  assertCan(ctx.user, PERMISSIONS.SUBMISSION_READ);
  const submission = await loadSubmissionInSchool(ctx, submissionId);
  await assertSubmissionReadScope(ctx, submission);
  const rows = await ctx.repositories.homeworkFeedback.listBySubmission(submissionId);
  return rows.map(mapFeedback);
}
