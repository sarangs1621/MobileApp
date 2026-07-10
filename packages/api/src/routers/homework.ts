import {
  addHomeworkAttachment,
  closeHomework,
  createHomework,
  createServiceContext,
  deleteHomework,
  getHomework,
  getSubmission,
  listFeedback,
  listHomeworkChildContext,
  listHomework,
  listHomeworkAttachments,
  listHomeworkTargets,
  listSubmissionAttachments,
  listSubmissions,
  mintHomeworkAttachmentDownloadUrl,
  mintHomeworkUploadUrl,
  mintSubmissionAttachmentDownloadUrl,
  mintSubmissionUploadUrl,
  publishHomework,
  removeHomeworkAttachment,
  reopenHomework,
  resubmitHomework,
  reviewSubmission,
  submissionsForEnrollment,
  submitHomework,
  updateHomework,
} from "@repo/business";
import {
  addHomeworkAttachmentInput,
  attachmentIdInput,
  createHomeworkInput,
  enrollmentIdInput,
  homeworkIdInput,
  listHomeworkInput,
  listSubmissionsInput,
  mintHomeworkUploadUrlInput,
  mintSubmissionUploadUrlInput,
  reopenHomeworkInput,
  reviewSubmissionInput,
  submissionIdInput,
  submitHomeworkInput,
  updateHomeworkInput,
} from "@repo/validation";

import { protectedProcedure, router, storageProcedure } from "../trpc";

/**
 * Homework & Assignment procedures (M6, ADR-013). Thin transport only — validate
 * (Zod) then delegate to a business service; the service enforces permission + scope
 * (admin manage school-wide; teacher own subject×section derived; parent own-child),
 * the DRAFT→PUBLISHED→CLOSED lifecycle + audited reopen, the §7 submission
 * invariants + guarded transitions, and writes audit in-transaction. Signed-URL
 * minting runs the full authz chain in the service BEFORE any URL exists (ADR-004).
 * No logic, no role strings, no Prisma.
 */

export const homeworkRouter = router({
  create: protectedProcedure
    .input(createHomeworkInput)
    .mutation(({ ctx, input }) => createHomework(createServiceContext(ctx.user), input)),
  update: protectedProcedure
    .input(updateHomeworkInput)
    .mutation(({ ctx, input }) =>
      updateHomework(createServiceContext(ctx.user), input.homeworkId, input),
    ),
  publish: protectedProcedure
    .input(homeworkIdInput)
    .mutation(({ ctx, input }) =>
      publishHomework(createServiceContext(ctx.user), input.homeworkId),
    ),
  close: protectedProcedure
    .input(homeworkIdInput)
    .mutation(({ ctx, input }) => closeHomework(createServiceContext(ctx.user), input.homeworkId)),
  reopen: protectedProcedure
    .input(reopenHomeworkInput)
    .mutation(({ ctx, input }) => reopenHomework(createServiceContext(ctx.user), input)),
  delete: protectedProcedure
    .input(homeworkIdInput)
    .mutation(({ ctx, input }) => deleteHomework(createServiceContext(ctx.user), input.homeworkId)),
  get: protectedProcedure
    .input(homeworkIdInput)
    .query(({ ctx, input }) => getHomework(createServiceContext(ctx.user), input.homeworkId)),
  /** Role-scoped feed: admin (year/section) · teacher (own subject×section) · parent (§10 or-clause). */
  list: protectedProcedure
    .input(listHomeworkInput)
    .query(({ ctx, input }) => listHomework(createServiceContext(ctx.user), input)),
  /** The teacher's assignable (subject × section) targets, name-enriched (create picker + labels). */
  targets: protectedProcedure.query(({ ctx }) =>
    listHomeworkTargets(createServiceContext(ctx.user)),
  ),

  /* ---- teacher attachments (add/remove only while DRAFT) ---- */
  attachments: protectedProcedure
    .input(homeworkIdInput)
    .query(({ ctx, input }) =>
      listHomeworkAttachments(createServiceContext(ctx.user), input.homeworkId),
    ),
  attachmentUploadUrl: storageProcedure
    .input(mintHomeworkUploadUrlInput)
    .mutation(({ ctx, input }) =>
      mintHomeworkUploadUrl(createServiceContext(ctx.user), ctx.storage, input),
    ),
  attachmentAdd: protectedProcedure
    .input(addHomeworkAttachmentInput)
    .mutation(({ ctx, input }) => addHomeworkAttachment(createServiceContext(ctx.user), input)),
  attachmentDownloadUrl: storageProcedure
    .input(attachmentIdInput)
    .mutation(({ ctx, input }) =>
      mintHomeworkAttachmentDownloadUrl(
        createServiceContext(ctx.user),
        ctx.storage,
        input.attachmentId,
      ),
    ),
  attachmentRemove: protectedProcedure
    .input(attachmentIdInput)
    .mutation(({ ctx, input }) =>
      removeHomeworkAttachment(createServiceContext(ctx.user), input.attachmentId),
    ),
});

export const submissionRouter = router({
  /* ---- parent submit / resubmit ---- */
  submit: protectedProcedure
    .input(submitHomeworkInput)
    .mutation(({ ctx, input }) => submitHomework(createServiceContext(ctx.user), input)),
  resubmit: protectedProcedure
    .input(submitHomeworkInput)
    .mutation(({ ctx, input }) => resubmitHomework(createServiceContext(ctx.user), input)),

  /* ---- reads ---- */
  /** A homework's submissions (teacher review queue / admin) — ownership-gated. */
  listByHomework: protectedProcedure
    .input(listSubmissionsInput)
    .query(({ ctx, input }) =>
      listSubmissions(createServiceContext(ctx.user), input.homeworkId, input.statuses),
    ),
  get: protectedProcedure
    .input(submissionIdInput)
    .query(({ ctx, input }) => getSubmission(createServiceContext(ctx.user), input.submissionId)),
  /** A child's submission trail — admin or the linked parent only (§10). */
  listByEnrollment: protectedProcedure
    .input(enrollmentIdInput)
    .query(({ ctx, input }) =>
      submissionsForEnrollment(createServiceContext(ctx.user), input.enrollmentId),
    ),
  /** Parent's per-child submit context for a homework (enrollment + existing submission). */
  childContext: protectedProcedure
    .input(homeworkIdInput)
    .query(({ ctx, input }) =>
      listHomeworkChildContext(createServiceContext(ctx.user), input.homeworkId),
    ),

  /* ---- parent submission attachments ---- */
  attachments: protectedProcedure
    .input(submissionIdInput)
    .query(({ ctx, input }) =>
      listSubmissionAttachments(createServiceContext(ctx.user), input.submissionId),
    ),
  attachmentUploadUrl: storageProcedure
    .input(mintSubmissionUploadUrlInput)
    .mutation(({ ctx, input }) =>
      mintSubmissionUploadUrl(createServiceContext(ctx.user), ctx.storage, input),
    ),
  attachmentDownloadUrl: storageProcedure
    .input(attachmentIdInput)
    .mutation(({ ctx, input }) =>
      mintSubmissionAttachmentDownloadUrl(
        createServiceContext(ctx.user),
        ctx.storage,
        input.attachmentId,
      ),
    ),

  /* ---- teacher review + feedback ---- */
  review: protectedProcedure
    .input(reviewSubmissionInput)
    .mutation(({ ctx, input }) => reviewSubmission(createServiceContext(ctx.user), input)),
  feedback: protectedProcedure
    .input(submissionIdInput)
    .query(({ ctx, input }) => listFeedback(createServiceContext(ctx.user), input.submissionId)),
});
