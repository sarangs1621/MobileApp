import type { Enrollment } from "@repo/db";

import type { ServiceContext } from "../../context";
import {
  activeYearId,
  assertStudentInScope,
  isFullAccess,
  loadStudentInSchool,
  parentChildIds,
  teacherSectionIds,
} from "../people/scope";

export {
  activeYearId,
  assertStudentInScope,
  isFullAccess,
  loadStudentInSchool,
  parentChildIds,
  teacherSectionIds,
};

/**
 * The student's enrollment for the ACTIVE year, else their most recent — or null if
 * never enrolled. Analytics reads (attendance %, GPA, homework) are per-enrollment.
 */
export async function currentEnrollment(
  ctx: ServiceContext,
  studentId: string,
): Promise<Enrollment | null> {
  const yearId = await activeYearId(ctx);
  if (yearId) {
    const e = await ctx.repositories.enrollments.findByStudentYear(studentId, yearId);
    if (e) {
      return e;
    }
  }
  const all = await ctx.repositories.enrollments.listByStudent(studentId); // createdAt desc
  return all[0] ?? null;
}
