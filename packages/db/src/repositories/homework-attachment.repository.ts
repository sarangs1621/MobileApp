import type { HomeworkAttachment } from "@prisma/client";

import type { DbClient } from "../db-client";

export type { HomeworkAttachment };

export interface CreateHomeworkAttachmentInput {
  schoolId: string;
  homeworkId: string;
  storagePath: string;
  fileName: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  checksum?: string | null;
  uploadedByStaffId: string;
}

/** Teacher-side attachment metadata (M6). Immutable rows; add/remove only while the
 *  owning homework is DRAFT — the state guard lives in the business layer. */
export interface HomeworkAttachmentRepository {
  findById(id: string): Promise<HomeworkAttachment | null>;
  listByHomework(homeworkId: string): Promise<HomeworkAttachment[]>;
  countByHomework(homeworkId: string): Promise<number>;
  create(input: CreateHomeworkAttachmentInput): Promise<HomeworkAttachment>;
  delete(id: string): Promise<void>;
}

export function createHomeworkAttachmentRepository(client: DbClient): HomeworkAttachmentRepository {
  return {
    findById: (id) => client.homeworkAttachment.findUnique({ where: { id } }),
    listByHomework: (homeworkId) =>
      client.homeworkAttachment.findMany({ where: { homeworkId }, orderBy: { createdAt: "asc" } }),
    countByHomework: (homeworkId) => client.homeworkAttachment.count({ where: { homeworkId } }),
    create: (input) =>
      client.homeworkAttachment.create({
        data: {
          schoolId: input.schoolId,
          homeworkId: input.homeworkId,
          storagePath: input.storagePath,
          fileName: input.fileName,
          mimeType: input.mimeType ?? null,
          sizeBytes: input.sizeBytes ?? null,
          checksum: input.checksum ?? null,
          uploadedByStaffId: input.uploadedByStaffId,
        },
      }),
    delete: async (id) => {
      await client.homeworkAttachment.delete({ where: { id } });
    },
  };
}
