import type { ServiceContext } from "../../context";

type Repos = ServiceContext["repositories"];

/**
 * Recipient resolution for notification events (ADR-018 §4). Recipients are DERIVED
 * from the existing Enrollment / StudentParent / TeacherAssignment data — no new
 * recipient store, no recipient column. Resolved once at emit and persisted by
 * `createBulkNotification`. Pure reads (no auth) — the triggering action was the gate.
 */

async function parentUserIdsForStudents(repos: Repos, studentIds: string[]): Promise<string[]> {
  if (studentIds.length === 0) {
    return [];
  }
  const links = (
    await Promise.all(studentIds.map((sid) => repos.studentParents.listByStudent(sid)))
  ).flat();
  const parentIds = [...new Set(links.map((l) => l.parentId))];
  const parents = await Promise.all(parentIds.map((pid) => repos.parents.findById(pid)));
  // A parent record without a login `userId` (not yet onboarded) has no inbox — skip it.
  return [...new Set(parents.flatMap((p) => (p?.userId ? [p.userId] : [])))];
}

/** Login-user ids of the parents of every student enrolled in a section (this year). */
export async function parentUserIdsForSection(
  repos: Repos,
  academicYearId: string,
  sectionId: string,
): Promise<string[]> {
  const enrollments = await repos.enrollments.listBySection(academicYearId, sectionId);
  const studentIds = [...new Set(enrollments.map((e) => e.studentId))];
  return parentUserIdsForStudents(repos, studentIds);
}

/** Login-user ids of a single student's parents. */
export function parentUserIdsForStudent(repos: Repos, studentId: string): Promise<string[]> {
  return parentUserIdsForStudents(repos, [studentId]);
}

/**
 * Login-user ids of the teachers assigned to any section the exam covers (via its
 * assessments → exam sections → TeacherAssignment). `TeacherAssignment.teacherId`
 * IS a `User` id, so it is the recipient directly. Section-level (not subject-
 * filtered) — an exam publish is a coarse "results are live" signal (ADR-018 §4).
 */
export async function teacherUserIdsForExam(
  repos: Repos,
  schoolId: string,
  examId: string,
): Promise<string[]> {
  const assessments = await repos.assessments.listByExam(examId);
  if (assessments.length === 0) {
    return [];
  }
  const examSections = await repos.examSections.listByAssessmentIds(assessments.map((a) => a.id));
  const sectionIds = [...new Set(examSections.map((s) => s.sectionId))];
  const assignments = (
    await Promise.all(
      sectionIds.map((sid) => repos.teacherAssignments.list(schoolId, { sectionId: sid })),
    )
  ).flat();
  return [...new Set(assignments.map((a) => a.teacherId))];
}
