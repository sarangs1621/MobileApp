import type { Homework, HomeworkStatus } from "@prisma/client";

import type { DbClient } from "../db-client";

export type { Homework, HomeworkStatus };

export interface CreateHomeworkInput {
  schoolId: string;
  academicYearId: string;
  subjectId: string;
  sectionId: string;
  title: string;
  description?: string | null;
  dueDate: Date;
  createdByStaffId: string;
}

/** DRAFT-only content edit (title/description/dueDate freely editable while draft). */
export interface UpdateHomeworkContentInput {
  title?: string;
  description?: string | null;
  dueDate?: Date;
}

/** Fields a guarded lifecycle transition may stamp (publish/close/reopen). */
export interface TransitionHomeworkInput {
  status: HomeworkStatus;
  publishedByStaffId?: string | null | undefined;
  publishedAt?: Date | null | undefined;
  closedByStaffId?: string | null | undefined;
  closedAt?: Date | null | undefined;
  reopenedByStaffId?: string | null | undefined;
  reopenedAt?: Date | null | undefined;
  reopenReason?: string | null | undefined;
}

/**
 * Homework persistence (M6, ADR-013). Persistence only — ownership derivation,
 * edit-by-state rules, the DRAFT-only delete guard, and the cross-table submission
 * invariants live in the business layer. Lifecycle transitions are guarded
 * conditional updates (the M5 ExamSection idiom): they apply only from the expected
 * `fromStatus`, so a lost race is a no-op (null), never a double-transition.
 */
export interface HomeworkRepository {
  findById(id: string): Promise<Homework | null>;
  /** Admin: every homework for a year (all states). */
  listByYear(schoolId: string, academicYearId: string): Promise<Homework[]>;
  /** Teacher/section view: homework in one section, optionally filtered by state. */
  listBySection(
    schoolId: string,
    sectionId: string,
    statuses?: readonly HomeworkStatus[],
  ): Promise<Homework[]>;
  /**
   * Parent visibility (ADR-013 §10): PUBLISHED/CLOSED homework in a section where an
   * own child is enrolled, OR any homework the child already has a submission for
   * (the mid-year-transfer or-clause). `extraIds` is the has-submission set.
   */
  listForParent(
    schoolId: string,
    sectionIds: readonly string[],
    extraIds: readonly string[],
    statuses: readonly HomeworkStatus[],
  ): Promise<Homework[]>;
  create(input: CreateHomeworkInput): Promise<Homework>;
  /** DRAFT-only content edit — null if the homework is no longer DRAFT (raced publish). */
  updateContent(id: string, data: UpdateHomeworkContentInput): Promise<Homework | null>;
  /** dueDate extend while PUBLISHED — null if no longer PUBLISHED. Caller validates ≥ current. */
  extendDueDate(id: string, dueDate: Date): Promise<Homework | null>;
  transition(
    id: string,
    fromStatus: HomeworkStatus,
    data: TransitionHomeworkInput,
  ): Promise<Homework | null>;
  /** DRAFT-only delete (cascades attachments) — count 0 if it was published mid-flight. */
  deleteDraft(id: string): Promise<boolean>;
}

export function createHomeworkRepository(client: DbClient): HomeworkRepository {
  return {
    findById: (id) => client.homework.findUnique({ where: { id } }),
    listByYear: (schoolId, academicYearId) =>
      client.homework.findMany({
        where: { schoolId, academicYearId },
        orderBy: { dueDate: "desc" },
      }),
    listBySection: (schoolId, sectionId, statuses) =>
      client.homework.findMany({
        where: { schoolId, sectionId, ...(statuses ? { status: { in: [...statuses] } } : {}) },
        orderBy: { dueDate: "desc" },
      }),
    listForParent: (schoolId, sectionIds, extraIds, statuses) =>
      client.homework.findMany({
        where: {
          schoolId,
          status: { in: [...statuses] },
          OR: [{ sectionId: { in: [...sectionIds] } }, { id: { in: [...extraIds] } }],
        },
        orderBy: { dueDate: "desc" },
      }),
    create: (input) =>
      client.homework.create({
        data: {
          schoolId: input.schoolId,
          academicYearId: input.academicYearId,
          subjectId: input.subjectId,
          sectionId: input.sectionId,
          title: input.title,
          description: input.description ?? null,
          dueDate: input.dueDate,
          createdByStaffId: input.createdByStaffId,
        },
      }),
    updateContent: async (id, data) => {
      const res = await client.homework.updateMany({
        where: { id, status: "DRAFT" },
        data: {
          ...(data.title !== undefined ? { title: data.title } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.dueDate !== undefined ? { dueDate: data.dueDate } : {}),
        },
      });
      return res.count === 0 ? null : client.homework.findUnique({ where: { id } });
    },
    extendDueDate: async (id, dueDate) => {
      const res = await client.homework.updateMany({
        where: { id, status: "PUBLISHED" },
        data: { dueDate },
      });
      return res.count === 0 ? null : client.homework.findUnique({ where: { id } });
    },
    transition: async (id, fromStatus, data) => {
      const res = await client.homework.updateMany({
        where: { id, status: fromStatus },
        data: {
          status: data.status,
          ...(data.publishedByStaffId !== undefined
            ? { publishedByStaffId: data.publishedByStaffId }
            : {}),
          ...(data.publishedAt !== undefined ? { publishedAt: data.publishedAt } : {}),
          ...(data.closedByStaffId !== undefined ? { closedByStaffId: data.closedByStaffId } : {}),
          ...(data.closedAt !== undefined ? { closedAt: data.closedAt } : {}),
          ...(data.reopenedByStaffId !== undefined
            ? { reopenedByStaffId: data.reopenedByStaffId }
            : {}),
          ...(data.reopenedAt !== undefined ? { reopenedAt: data.reopenedAt } : {}),
          ...(data.reopenReason !== undefined ? { reopenReason: data.reopenReason } : {}),
        },
      });
      return res.count === 0 ? null : client.homework.findUnique({ where: { id } });
    },
    deleteDraft: async (id) => {
      const res = await client.homework.deleteMany({ where: { id, status: "DRAFT" } });
      return res.count > 0;
    },
  };
}
