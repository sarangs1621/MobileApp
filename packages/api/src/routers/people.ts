import {
  archiveStudent,
  createParent,
  createServiceContext,
  createStaff,
  createStudent,
  deleteDocument,
  deleteParent,
  deleteStaff,
  enroll,
  getDocument,
  getParent,
  getStaff,
  getStudent,
  importPeopleCsv,
  linkParent,
  listDocuments,
  mintDocumentDownloadUrl,
  mintDocumentUploadUrl,
  listEnrollmentsByStudent,
  listGuardians,
  listParents,
  listStaff,
  listStudents,
  promote,
  replaceDocument,
  sectionRoster,
  transfer,
  unlinkParent,
  updateParent,
  updateStaff,
  updateStudent,
  uploadDocument,
  withdraw,
} from "@repo/business";
import {
  createParentInput,
  createStaffInput,
  createStudentDocumentInput,
  createStudentInput,
  enrollInput,
  idInput,
  importPeopleCsvInput,
  linkParentInput,
  listStudentsInput,
  mintDocumentUploadUrlInput,
  promoteInput,
  replaceStudentDocumentInput,
  sectionRosterInput,
  studentIdInput,
  transferInput,
  unlinkParentInput,
  updateParentInput,
  updateStaffInput,
  updateStudentInput,
  withdrawInput,
} from "@repo/validation";

import { protectedProcedure, router, storageProcedure } from "../trpc";

/**
 * People-management procedures (M3). Thin transport only — validate (Zod) then
 * delegate to a business service; the service enforces permission + row scope
 * (teacher → own-section, parent → own-child) and writes audit in-transaction
 * (ADR-002/007/010). No logic, no role strings, no Prisma. All run on
 * `protectedProcedure` (ACTIVE); reads are gated by *_READ and mutations by
 * *_MANAGE inside the service.
 */

export const studentRouter = router({
  list: protectedProcedure
    .input(listStudentsInput.optional())
    .query(({ ctx, input }) => listStudents(createServiceContext(ctx.user), input ?? {})),
  get: protectedProcedure
    .input(idInput)
    .query(({ ctx, input }) => getStudent(createServiceContext(ctx.user), input.id)),
  create: protectedProcedure
    .input(createStudentInput)
    .mutation(({ ctx, input }) => createStudent(createServiceContext(ctx.user), input)),
  update: protectedProcedure.input(updateStudentInput).mutation(({ ctx, input }) => {
    const { id, ...data } = input;
    return updateStudent(createServiceContext(ctx.user), id, data);
  }),
  archive: protectedProcedure
    .input(idInput)
    .mutation(({ ctx, input }) => archiveStudent(createServiceContext(ctx.user), input.id)),
  /** Bulk CSV import of students + guardians (ADR-027); returns a per-row error report. */
  importCsv: protectedProcedure
    .input(importPeopleCsvInput)
    .mutation(({ ctx, input }) => importPeopleCsv(createServiceContext(ctx.user), input)),
});

export const parentRouter = router({
  list: protectedProcedure.query(({ ctx }) => listParents(createServiceContext(ctx.user))),
  get: protectedProcedure
    .input(idInput)
    .query(({ ctx, input }) => getParent(createServiceContext(ctx.user), input.id)),
  create: protectedProcedure
    .input(createParentInput)
    .mutation(({ ctx, input }) => createParent(createServiceContext(ctx.user), input)),
  update: protectedProcedure.input(updateParentInput).mutation(({ ctx, input }) => {
    const { id, ...data } = input;
    return updateParent(createServiceContext(ctx.user), id, data);
  }),
  delete: protectedProcedure
    .input(idInput)
    .mutation(({ ctx, input }) => deleteParent(createServiceContext(ctx.user), input.id)),
  link: protectedProcedure
    .input(linkParentInput)
    .mutation(({ ctx, input }) => linkParent(createServiceContext(ctx.user), input)),
  unlink: protectedProcedure
    .input(unlinkParentInput)
    .mutation(({ ctx, input }) => unlinkParent(createServiceContext(ctx.user), input)),
  /** Guardians of one student (student-scoped read, not parent-scoped). */
  guardians: protectedProcedure
    .input(studentIdInput)
    .query(({ ctx, input }) => listGuardians(createServiceContext(ctx.user), input.studentId)),
});

export const teacherProfileRouter = router({
  list: protectedProcedure.query(({ ctx }) => listStaff(createServiceContext(ctx.user))),
  get: protectedProcedure
    .input(idInput)
    .query(({ ctx, input }) => getStaff(createServiceContext(ctx.user), input.id)),
  create: protectedProcedure
    .input(createStaffInput)
    .mutation(({ ctx, input }) => createStaff(createServiceContext(ctx.user), input)),
  update: protectedProcedure.input(updateStaffInput).mutation(({ ctx, input }) => {
    const { id, ...data } = input;
    return updateStaff(createServiceContext(ctx.user), id, data);
  }),
  delete: protectedProcedure
    .input(idInput)
    .mutation(({ ctx, input }) => deleteStaff(createServiceContext(ctx.user), input.id)),
});

export const enrollmentRouter = router({
  /** Full enrollment history of a student (ADR-010 — history is never mutated). */
  listByStudent: protectedProcedure
    .input(studentIdInput)
    .query(({ ctx, input }) =>
      listEnrollmentsByStudent(createServiceContext(ctx.user), input.studentId),
    ),
  sectionRoster: protectedProcedure
    .input(sectionRosterInput)
    .query(({ ctx, input }) => sectionRoster(createServiceContext(ctx.user), input)),
  create: protectedProcedure
    .input(enrollInput)
    .mutation(({ ctx, input }) => enroll(createServiceContext(ctx.user), input)),
  transfer: protectedProcedure
    .input(transferInput)
    .mutation(({ ctx, input }) => transfer(createServiceContext(ctx.user), input)),
  promote: protectedProcedure
    .input(promoteInput)
    .mutation(({ ctx, input }) => promote(createServiceContext(ctx.user), input)),
  withdraw: protectedProcedure
    .input(withdrawInput)
    .mutation(({ ctx, input }) => withdraw(createServiceContext(ctx.user), input.enrollmentId)),
});

export const studentDocumentRouter = router({
  list: protectedProcedure
    .input(studentIdInput)
    .query(({ ctx, input }) => listDocuments(createServiceContext(ctx.user), input.studentId)),
  get: protectedProcedure
    .input(idInput)
    .query(({ ctx, input }) => getDocument(createServiceContext(ctx.user), input.id)),
  upload: protectedProcedure
    .input(createStudentDocumentInput)
    .mutation(({ ctx, input }) => uploadDocument(createServiceContext(ctx.user), input)),
  replace: protectedProcedure.input(replaceStudentDocumentInput).mutation(({ ctx, input }) => {
    const { id, ...data } = input;
    return replaceDocument(createServiceContext(ctx.user), id, data);
  }),
  delete: protectedProcedure
    .input(idInput)
    .mutation(({ ctx, input }) => deleteDocument(createServiceContext(ctx.user), input.id)),
  /** Signed-URL minting (ADR-004) — authz runs in the service BEFORE any URL exists. */
  uploadUrl: storageProcedure
    .input(mintDocumentUploadUrlInput)
    .mutation(({ ctx, input }) =>
      mintDocumentUploadUrl(createServiceContext(ctx.user), ctx.storage, input),
    ),
  downloadUrl: storageProcedure
    .input(idInput)
    .mutation(({ ctx, input }) =>
      mintDocumentDownloadUrl(createServiceContext(ctx.user), ctx.storage, input.id),
    ),
});
