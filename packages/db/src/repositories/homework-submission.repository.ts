import type { HomeworkSubmission, SubmissionStatus } from "@prisma/client";

import type { DbClient } from "../db-client";

export type { HomeworkSubmission, SubmissionStatus };

export interface CreateHomeworkSubmissionInput {
  schoolId: string;
  homeworkId: string;
  enrollmentId: string;
  submittedByParentId: string;
  note?: string | null;
  isLate: boolean;
  submittedAt: Date;
}

export interface ResubmitInput {
  submittedByParentId: string;
  note?: string | null;
  isLate: boolean;
  submittedAt: Date;
}

export interface ReviewInput {
  status: Extract<SubmissionStatus, "RETURNED" | "REVIEWED">;
  reviewedByStaffId: string;
  reviewedAt: Date;
}

/**
 * HomeworkSubmission persistence (M6, ADR-013 §5–6). One row per (homework,
 * enrollment) — the DB `@@unique` makes the duplicate race a P2002 the service maps
 * to Conflict. Resubmit mutates in place (attempt++); review stamps the decision.
 * Both are guarded conditional updates keyed on `(status, attempt)` so a
 * review/resubmit race resolves to a Conflict, never a silent overwrite (R2).
 */
export interface HomeworkSubmissionRepository {
  findById(id: string): Promise<HomeworkSubmission | null>;
  findByHomeworkEnrollment(
    homeworkId: string,
    enrollmentId: string,
  ): Promise<HomeworkSubmission | null>;
  /** Teacher review queue: one homework's submissions, optionally by state. */
  listByHomework(
    homeworkId: string,
    statuses?: readonly SubmissionStatus[],
  ): Promise<HomeworkSubmission[]>;
  /** A child's homework trail (per-enrollment slice). */
  listByEnrollment(enrollmentId: string): Promise<HomeworkSubmission[]>;
  /** Homework ids that any of these enrollments already submitted for (parent §10 or-clause). */
  homeworkIdsForEnrollments(enrollmentIds: readonly string[]): Promise<string[]>;
  /** First submit — may throw P2002 on the unique (caller maps to Conflict). */
  create(input: CreateHomeworkSubmissionInput): Promise<HomeworkSubmission>;
  /** Guarded resubmit: only from (SUBMITTED|RETURNED) at the seen attempt; attempt++. */
  resubmit(
    id: string,
    seenAttempt: number,
    data: ResubmitInput,
  ): Promise<HomeworkSubmission | null>;
  /** Guarded review: only from SUBMITTED at the seen attempt. */
  review(id: string, seenAttempt: number, data: ReviewInput): Promise<HomeworkSubmission | null>;
}

export function createHomeworkSubmissionRepository(client: DbClient): HomeworkSubmissionRepository {
  return {
    findById: (id) => client.homeworkSubmission.findUnique({ where: { id } }),
    findByHomeworkEnrollment: (homeworkId, enrollmentId) =>
      client.homeworkSubmission.findUnique({
        where: { homeworkId_enrollmentId: { homeworkId, enrollmentId } },
      }),
    listByHomework: (homeworkId, statuses) =>
      client.homeworkSubmission.findMany({
        where: { homeworkId, ...(statuses ? { status: { in: [...statuses] } } : {}) },
        orderBy: { submittedAt: "asc" },
      }),
    listByEnrollment: (enrollmentId) =>
      client.homeworkSubmission.findMany({
        where: { enrollmentId },
        orderBy: { submittedAt: "desc" },
      }),
    homeworkIdsForEnrollments: async (enrollmentIds) => {
      if (enrollmentIds.length === 0) {
        return [];
      }
      const rows = await client.homeworkSubmission.findMany({
        where: { enrollmentId: { in: [...enrollmentIds] } },
        select: { homeworkId: true },
        distinct: ["homeworkId"],
      });
      return rows.map((r) => r.homeworkId);
    },
    create: (input) =>
      client.homeworkSubmission.create({
        data: {
          schoolId: input.schoolId,
          homeworkId: input.homeworkId,
          enrollmentId: input.enrollmentId,
          submittedByParentId: input.submittedByParentId,
          note: input.note ?? null,
          isLate: input.isLate,
          firstSubmittedAt: input.submittedAt,
          submittedAt: input.submittedAt,
        },
      }),
    resubmit: async (id, seenAttempt, data) => {
      const res = await client.homeworkSubmission.updateMany({
        where: { id, attempt: seenAttempt, status: { in: ["SUBMITTED", "RETURNED"] } },
        data: {
          status: "SUBMITTED",
          attempt: { increment: 1 },
          submittedByParentId: data.submittedByParentId,
          note: data.note ?? null,
          isLate: data.isLate,
          submittedAt: data.submittedAt,
        },
      });
      return res.count === 0 ? null : client.homeworkSubmission.findUnique({ where: { id } });
    },
    review: async (id, seenAttempt, data) => {
      const res = await client.homeworkSubmission.updateMany({
        where: { id, attempt: seenAttempt, status: "SUBMITTED" },
        data: {
          status: data.status,
          reviewedByStaffId: data.reviewedByStaffId,
          reviewedAt: data.reviewedAt,
        },
      });
      return res.count === 0 ? null : client.homeworkSubmission.findUnique({ where: { id } });
    },
  };
}
