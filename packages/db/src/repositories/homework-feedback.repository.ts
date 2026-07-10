import type { HomeworkFeedback, SubmissionStatus } from "@prisma/client";

import type { DbClient } from "../db-client";

export type { HomeworkFeedback };

export interface CreateHomeworkFeedbackInput {
  schoolId: string;
  submissionId: string;
  authorStaffId: string;
  attempt: number;
  decision: Extract<SubmissionStatus, "RETURNED" | "REVIEWED">;
  body: string;
}

/** HomeworkFeedback persistence (M6, ADR-013 §8). Append-only immutable review
 *  rounds — no update/delete surface by design. */
export interface HomeworkFeedbackRepository {
  findById(id: string): Promise<HomeworkFeedback | null>;
  listBySubmission(submissionId: string): Promise<HomeworkFeedback[]>;
  create(input: CreateHomeworkFeedbackInput): Promise<HomeworkFeedback>;
}

export function createHomeworkFeedbackRepository(client: DbClient): HomeworkFeedbackRepository {
  return {
    findById: (id) => client.homeworkFeedback.findUnique({ where: { id } }),
    listBySubmission: (submissionId) =>
      client.homeworkFeedback.findMany({
        where: { submissionId },
        orderBy: { createdAt: "asc" },
      }),
    create: (input) =>
      client.homeworkFeedback.create({
        data: {
          schoolId: input.schoolId,
          submissionId: input.submissionId,
          authorStaffId: input.authorStaffId,
          attempt: input.attempt,
          decision: input.decision,
          body: input.body,
        },
      }),
  };
}
