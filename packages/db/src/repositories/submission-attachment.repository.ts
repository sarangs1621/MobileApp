import type { SubmissionAttachment } from "@prisma/client";

import type { DbClient } from "../db-client";

export type { SubmissionAttachment };

export interface CreateSubmissionAttachmentInput {
  schoolId: string;
  submissionId: string;
  attempt: number;
  storagePath: string;
  fileName: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  checksum?: string | null;
  uploadedByParentId: string;
}

/** Parent-side attachment metadata (M6, ADR-013 §6). Append-only, attempt-tagged —
 *  a resubmission never deletes prior attempts' files (dispute answerability). */
export interface SubmissionAttachmentRepository {
  findById(id: string): Promise<SubmissionAttachment | null>;
  listBySubmission(submissionId: string): Promise<SubmissionAttachment[]>;
  createMany(inputs: readonly CreateSubmissionAttachmentInput[]): Promise<number>;
}

export function createSubmissionAttachmentRepository(
  client: DbClient,
): SubmissionAttachmentRepository {
  return {
    findById: (id) => client.submissionAttachment.findUnique({ where: { id } }),
    listBySubmission: (submissionId) =>
      client.submissionAttachment.findMany({
        where: { submissionId },
        orderBy: [{ attempt: "asc" }, { createdAt: "asc" }],
      }),
    createMany: async (inputs) => {
      if (inputs.length === 0) {
        return 0;
      }
      const res = await client.submissionAttachment.createMany({
        data: inputs.map((i) => ({
          schoolId: i.schoolId,
          submissionId: i.submissionId,
          attempt: i.attempt,
          storagePath: i.storagePath,
          fileName: i.fileName,
          mimeType: i.mimeType ?? null,
          sizeBytes: i.sizeBytes ?? null,
          checksum: i.checksum ?? null,
          uploadedByParentId: i.uploadedByParentId,
        })),
      });
      return res.count;
    },
  };
}
