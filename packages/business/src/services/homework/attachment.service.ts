import { HOMEWORK_ATTACHMENT, PERMISSIONS, STORAGE_BUCKETS } from "@repo/constants";
import { ConflictError, NotFoundError, ValidationError } from "@repo/core";
import type { HomeworkAttachmentDto } from "@repo/types";

import { assertCan } from "../../authorization";
import type { ServiceContext } from "../../context";
import type { MintedUploadUrl, StoragePort } from "../people/document-storage.service";

import {
  assertHomeworkReadScope,
  assertOwnsHomework,
  loadHomeworkInSchool,
  mapHomeworkAttachment,
  recordAudit,
  resolveActingStaffId,
} from "./scope";

/** Signed read URLs stay valid this long — the M3 constant (long enough to open, too short to share). */
const DOWNLOAD_URL_TTL_SECONDS = 300;

/** Validate the client's CLAIMED mime/size against the M6 limits (ADR-013 §7). The
 *  bucket is private and paths are server-chosen, so this is the accepted ceiling. */
export function assertFileAllowed(mimeType: string, sizeBytes: number): void {
  if (!HOMEWORK_ATTACHMENT.ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new ValidationError(`File type not allowed: ${mimeType}`);
  }
  if (sizeBytes <= 0 || sizeBytes > HOMEWORK_ATTACHMENT.MAX_FILE_BYTES) {
    throw new ValidationError("File exceeds the maximum allowed size");
  }
}

const safeFileName = (name: string): string => name.replace(/[^\w.-]+/g, "_").slice(-100);

export interface MintHomeworkUploadInput {
  homeworkId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Mint a one-time signed UPLOAD URL for a teacher homework file. Full write-authz
 * chain first (manage permission, tenant, derived ownership, DRAFT-only, mime/size,
 * count) — the path is server-chosen (`{schoolId}/homework/{homeworkId}/{uuid}-{name}`,
 * ADR-013 §9) so a client can never pick or overwrite another school's object.
 */
export async function mintHomeworkUploadUrl(
  ctx: ServiceContext,
  storage: StoragePort,
  input: MintHomeworkUploadInput,
): Promise<MintedUploadUrl> {
  assertCan(ctx.user, PERMISSIONS.HOMEWORK_MANAGE);
  const homework = await loadHomeworkInSchool(ctx, input.homeworkId);
  await assertOwnsHomework(ctx, homework);
  if (homework.status !== "DRAFT") {
    throw new ConflictError("Attachments can only be added while the homework is a draft");
  }
  assertFileAllowed(input.mimeType, input.sizeBytes);
  const existing = await ctx.repositories.homeworkAttachments.countByHomework(input.homeworkId);
  if (existing >= HOMEWORK_ATTACHMENT.MAX_FILES) {
    throw new ValidationError(`A homework may have at most ${HOMEWORK_ATTACHMENT.MAX_FILES} files`);
  }

  const storagePath = `${ctx.user.schoolId}/homework/${input.homeworkId}/${crypto.randomUUID()}-${safeFileName(input.fileName)}`;
  const { signedUrl, token } = await storage.createSignedUploadUrl(
    STORAGE_BUCKETS.HOMEWORK_FILES,
    storagePath,
  );
  return { storagePath, signedUrl, token };
}

export interface AddHomeworkAttachmentInput {
  homeworkId: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  checksum?: string | null | undefined;
}

/** Persist teacher attachment metadata after the upload succeeds (DRAFT-only, count-guarded). Audited. */
export async function addHomeworkAttachment(
  ctx: ServiceContext,
  input: AddHomeworkAttachmentInput,
): Promise<HomeworkAttachmentDto> {
  assertCan(ctx.user, PERMISSIONS.HOMEWORK_MANAGE);
  const staffId = await resolveActingStaffId(ctx);
  const homework = await loadHomeworkInSchool(ctx, input.homeworkId);
  await assertOwnsHomework(ctx, homework);
  if (homework.status !== "DRAFT") {
    throw new ConflictError("Attachments can only be added while the homework is a draft");
  }
  assertFileAllowed(input.mimeType, input.sizeBytes);
  const existing = await ctx.repositories.homeworkAttachments.countByHomework(input.homeworkId);
  if (existing >= HOMEWORK_ATTACHMENT.MAX_FILES) {
    throw new ValidationError(`A homework may have at most ${HOMEWORK_ATTACHMENT.MAX_FILES} files`);
  }

  return ctx.withTransaction(async (repos) => {
    const created = await repos.homeworkAttachments.create({
      schoolId: ctx.user.schoolId,
      homeworkId: input.homeworkId,
      storagePath: input.storagePath,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      checksum: input.checksum ?? null,
      uploadedByStaffId: staffId,
    });
    await recordAudit(ctx, repos, {
      action: "HOMEWORK_ATTACHMENT_ADD",
      entityType: "HomeworkAttachment",
      entityId: created.id,
      after: { homeworkId: input.homeworkId, fileName: created.fileName },
    });
    return mapHomeworkAttachment(created);
  });
}

/** Teacher attachment list for a homework (read-scoped like the homework itself). */
export async function listHomeworkAttachments(
  ctx: ServiceContext,
  homeworkId: string,
): Promise<HomeworkAttachmentDto[]> {
  assertCan(ctx.user, PERMISSIONS.HOMEWORK_READ);
  const homework = await loadHomeworkInSchool(ctx, homeworkId);
  await assertHomeworkReadScope(ctx, homework);
  const rows = await ctx.repositories.homeworkAttachments.listByHomework(homeworkId);
  return rows.map(mapHomeworkAttachment);
}

/**
 * Mint a short-lived signed READ URL for a teacher attachment — runs the homework
 * read-authz chain (§10) BEFORE any URL exists, so a parent out of scope can't pull
 * a file by id.
 */
export async function mintHomeworkAttachmentDownloadUrl(
  ctx: ServiceContext,
  storage: StoragePort,
  attachmentId: string,
): Promise<{ url: string; fileName: string }> {
  assertCan(ctx.user, PERMISSIONS.HOMEWORK_READ);
  const attachment = await ctx.repositories.homeworkAttachments.findById(attachmentId);
  if (!attachment || attachment.schoolId !== ctx.user.schoolId) {
    throw new NotFoundError("Attachment not found");
  }
  const homework = await loadHomeworkInSchool(ctx, attachment.homeworkId);
  await assertHomeworkReadScope(ctx, homework);

  const url = await storage.createSignedDownloadUrl(
    STORAGE_BUCKETS.HOMEWORK_FILES,
    attachment.storagePath,
    DOWNLOAD_URL_TTL_SECONDS,
  );
  return { url, fileName: attachment.fileName };
}

/** Remove a teacher attachment (DRAFT-only, owning teacher/admin). Metadata only — bytes are left (M3 posture). Audited. */
export async function removeHomeworkAttachment(
  ctx: ServiceContext,
  attachmentId: string,
): Promise<void> {
  assertCan(ctx.user, PERMISSIONS.HOMEWORK_MANAGE);
  const attachment = await ctx.repositories.homeworkAttachments.findById(attachmentId);
  if (!attachment || attachment.schoolId !== ctx.user.schoolId) {
    throw new NotFoundError("Attachment not found");
  }
  const homework = await loadHomeworkInSchool(ctx, attachment.homeworkId);
  await assertOwnsHomework(ctx, homework);
  if (homework.status !== "DRAFT") {
    throw new ConflictError("Attachments can only be removed while the homework is a draft");
  }

  await ctx.withTransaction(async (repos) => {
    await repos.homeworkAttachments.delete(attachmentId);
    await recordAudit(ctx, repos, {
      action: "HOMEWORK_ATTACHMENT_REMOVE",
      entityType: "HomeworkAttachment",
      entityId: attachmentId,
      before: { homeworkId: attachment.homeworkId, fileName: attachment.fileName },
    });
  });
}
