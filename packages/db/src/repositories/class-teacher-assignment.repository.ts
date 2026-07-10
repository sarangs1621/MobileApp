import type { ClassTeacherAssignment } from "@prisma/client";

import type { DbClient } from "../db-client";

export type { ClassTeacherAssignment };

export interface CreateClassTeacherAssignmentInput {
  schoolId: string;
  academicYearId: string;
  sectionId: string;
  teacherId: string;
  createdByStaffId: string;
  // assignedAt uses the DB default (now()) on initial assign — not passed here.
}

/** Replace = in-place update of the single (year, section) slot (ADR-015). */
export interface ReplaceClassTeacherAssignmentInput {
  teacherId: string;
  assignedAt: Date; // re-stamped to now() by the service
  createdByStaffId: string;
}

/**
 * Persistence for `ClassTeacherAssignment` (ADR-003, ADR-015). No
 * authorization/business rules. The natural key is (academicYear, section) —
 * exactly one class teacher per section per year; a replacement is an in-place
 * `update`, never a second row.
 */
export interface ClassTeacherAssignmentRepository {
  findById(id: string): Promise<ClassTeacherAssignment | null>;
  /** The single class teacher of a section in a given year, or null. */
  findBySectionYear(
    academicYearId: string,
    sectionId: string,
  ): Promise<ClassTeacherAssignment | null>;
  create(input: CreateClassTeacherAssignmentInput): Promise<ClassTeacherAssignment>;
  update(id: string, input: ReplaceClassTeacherAssignmentInput): Promise<ClassTeacherAssignment>;
  delete(id: string): Promise<void>;
}

export function createClassTeacherAssignmentRepository(
  client: DbClient,
): ClassTeacherAssignmentRepository {
  return {
    findById: (id) => client.classTeacherAssignment.findUnique({ where: { id } }),
    findBySectionYear: (academicYearId, sectionId) =>
      client.classTeacherAssignment.findUnique({
        where: { academicYearId_sectionId: { academicYearId, sectionId } },
      }),
    create: (input) => client.classTeacherAssignment.create({ data: input }),
    update: (id, input) => client.classTeacherAssignment.update({ where: { id }, data: input }),
    delete: async (id) => {
      await client.classTeacherAssignment.delete({ where: { id } });
    },
  };
}
