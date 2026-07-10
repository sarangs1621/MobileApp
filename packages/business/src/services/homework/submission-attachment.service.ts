import { PERMISSIONS, STORAGE_BUCKETS } from "@repo/constants";
import { NotFoundError, ValidationError } from "@repo/core";
import type { SubmissionAttachmentDto } from "@repo/types";

import { assertCan } from "../../authorization";
import type { ServiceContext } from "../../context";
import type { MintedUploadUrl, StoragePort } from "../people/document-storage.service";

import { assertFileAllowed } from "./attachment.service";
import {
  assertParentOwnsEnrollment,
  assertSubmissionReadScope,
  assertSubmittable,
  loadEnrollmentInSchool,
  loadHomeworkInSchool,
  loadSubmissionInSchool,
  mapSubmissionAttachment,
  resolveActingParentId,
} from "./scope";

const DOWNLOAD_URL_TTL_SECONDS = 300;
const safeFileName = (name: string): string => name.replace(/[^\w.-]+/g, "_").slice(-100);

export interface MintSubmissionUploadInput {
  homeworkId: string;
  enrollmentId: string;
  /** The attempt these files belong to (1 for first submit, current+1 for a resubmit). */
  attempt: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Mint a one-time signed UPLOAD URL for a parent submission file. Full write-authz
 * chain BEFORE the URL (submit permission, parent owns the child, §7 submittability,
 * mime/size). Path is server-chosen and namespaced by (homework, enrollment, attempt)
 * so the submission row need not exist yet — the atomic submit persists the metadata
 * (ponytail: path keyed by homeworkId/enrollmentId, not submissionId as ADR-013 §9
 * sketches — same private/server-chosen/attempt-tagged properties, enables a
 * single-transaction submit; flagged for the Step-10 doc).
 */
export async function mintSubmissionUploadUrl(
  ctx: ServiceContext,
  storage: StoragePort,
  input: MintSubmissionUploadInput,
): Promise<MintedUploadUrl> {
  assertCan(ctx.user, PERMISSIONS.SUBMISSION_SUBMIT);
  await resolveActingParentId(ctx);
  if (!Number.isInteger(input.attempt) || input.attempt < 1) {
    throw new ValidationError("attempt must be a positive integer");
  }
  const homework = await loadHomeworkInSchool(ctx, input.homeworkId);
  const enrollment = await loadEnrollmentInSchool(ctx, input.enrollmentId);
  await assertParentOwnsEnrollment(ctx, enrollment);
  assertSubmittable(homework, enrollment);
  assertFileAllowed(input.mimeType, input.sizeBytes);

  const storagePath = `${ctx.user.schoolId}/submission/${input.homeworkId}/${input.enrollmentId}/${input.attempt}/${crypto.randomUUID()}-${safeFileName(input.fileName)}`;
  const { signedUrl, token } = await storage.createSignedUploadUrl(
    STORAGE_BUCKETS.HOMEWORK_FILES,
    storagePath,
  );
  return { storagePath, signedUrl, token };
}

/** A submission's attachments (read-scoped: admin / owning teacher / own-child parent). */
export async function listSubmissionAttachments(
  ctx: ServiceContext,
  submissionId: string,
): Promise<SubmissionAttachmentDto[]> {
  assertCan(ctx.user, PERMISSIONS.SUBMISSION_READ);
  const submission = await loadSubmissionInSchool(ctx, submissionId);
  await assertSubmissionReadScope(ctx, submission);
  const rows = await ctx.repositories.submissionAttachments.listBySubmission(submissionId);
  return rows.map(mapSubmissionAttachment);
}

/**
 * Mint a short-lived signed READ URL for a parent submission file. Runs the full
 * submission read-authz chain (§10) first — admin, the owning teacher (derived), and
 * the linked parents may read; NEVER another parent.
 */
export async function mintSubmissionAttachmentDownloadUrl(
  ctx: ServiceContext,
  storage: StoragePort,
  attachmentId: string,
): Promise<{ url: string; fileName: string }> {
  assertCan(ctx.user, PERMISSIONS.SUBMISSION_READ);
  const attachment = await ctx.repositories.submissionAttachments.findById(attachmentId);
  if (!attachment || attachment.schoolId !== ctx.user.schoolId) {
    throw new NotFoundError("Attachment not found");
  }
  const submission = await loadSubmissionInSchool(ctx, attachment.submissionId);
  await assertSubmissionReadScope(ctx, submission);

  const url = await storage.createSignedDownloadUrl(
    STORAGE_BUCKETS.HOMEWORK_FILES,
    attachment.storagePath,
    DOWNLOAD_URL_TTL_SECONDS,
  );
  return { url, fileName: attachment.fileName };
}
