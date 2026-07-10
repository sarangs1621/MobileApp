import {
  assignClassTeacher,
  createServiceContext,
  getClassTeacherForSection,
  removeClassTeacher,
  replaceClassTeacher,
} from "@repo/business";
import {
  assignClassTeacherInput,
  classTeacherSectionInput,
  idInput,
  replaceClassTeacherInput,
} from "@repo/validation";

import { protectedProcedure, router } from "../trpc";

/**
 * Class Teacher Management procedures (M6.5, ADR-015). Thin transport only —
 * validate (Zod) then delegate to a business service; the service enforces
 * permission + scope and writes audit in-transaction (ADR-002/007). No logic,
 * no role strings, no Prisma. `assign`/`replace`/`remove` are gated by
 * ACADEMIC_MANAGE and `get` by ACADEMIC_READ inside the service.
 */
export const classTeacherRouter = router({
  /** The current class teacher of a (year, section), or null. */
  get: protectedProcedure
    .input(classTeacherSectionInput)
    .query(({ ctx, input }) => getClassTeacherForSection(createServiceContext(ctx.user), input)),
  /** Assign a class teacher to an empty (year, section) slot. */
  assign: protectedProcedure
    .input(assignClassTeacherInput)
    .mutation(({ ctx, input }) => assignClassTeacher(createServiceContext(ctx.user), input)),
  /** Replace the class teacher of an occupied slot — in-place update (ADR-015). */
  replace: protectedProcedure
    .input(replaceClassTeacherInput)
    .mutation(({ ctx, input }) => replaceClassTeacher(createServiceContext(ctx.user), input)),
  /** Remove a class-teacher assignment by id (frees the slot). */
  remove: protectedProcedure
    .input(idInput)
    .mutation(({ ctx, input }) => removeClassTeacher(createServiceContext(ctx.user), input.id)),
});
