import {
  cancelInvoice,
  createServiceContext,
  createStructure,
  generateInvoices,
  getInvoice,
  getStructure,
  issueInvoice,
  listInvoices,
  listInvoicesByStudent,
  listStructures,
  updateStructure,
} from "@repo/business";
import {
  createStructureInput,
  generateInvoicesInput,
  idInput,
  listInvoicesByStudentInput,
  listInvoicesInput,
  listStructuresInput,
  updateStructureInput,
} from "@repo/validation";

import { protectedProcedure, router } from "../trpc";

/**
 * Fee structure + invoice procedures (M13, ADR-021). Thin transport only — validate
 * (Zod) then delegate; the business service enforces permission (fee:manage/read),
 * scope, the invoice lifecycle (DRAFT→ISSUED→PARTIAL→PAID, immutable after PAID;
 * CANCELLED), the snapshotted total, in-tx audit, and the post-commit M10 notification
 * on issue. No logic, no role strings, no Prisma.
 */
export const feeRouter = router({
  /* ---- fee structures (admin) ---- */
  listStructures: protectedProcedure
    .input(listStructuresInput)
    .query(({ ctx, input }) => listStructures(createServiceContext(ctx.user), input)),
  getStructure: protectedProcedure
    .input(idInput)
    .query(({ ctx, input }) => getStructure(createServiceContext(ctx.user), input.id)),
  createStructure: protectedProcedure
    .input(createStructureInput)
    .mutation(({ ctx, input }) => createStructure(createServiceContext(ctx.user), input)),
  updateStructure: protectedProcedure.input(updateStructureInput).mutation(({ ctx, input }) => {
    const { id, ...rest } = input;
    return updateStructure(createServiceContext(ctx.user), id, rest);
  }),

  /* ---- invoices ---- */
  /** Admin console — school-wide, filterable by student / status / structure. */
  listInvoices: protectedProcedure
    .input(listInvoicesInput)
    .query(({ ctx, input }) => listInvoices(createServiceContext(ctx.user), input)),
  /** A student's fee ledger (admin all; teacher own-section; parent own child). */
  listInvoicesByStudent: protectedProcedure
    .input(listInvoicesByStudentInput)
    .query(({ ctx, input }) => {
      const { studentId, ...rest } = input;
      return listInvoicesByStudent(createServiceContext(ctx.user), studentId, rest);
    }),
  /** One invoice, scope-gated. */
  getInvoice: protectedProcedure
    .input(idInput)
    .query(({ ctx, input }) => getInvoice(createServiceContext(ctx.user), input.id)),
  /** Bulk-generate DRAFT invoices for a section from a structure (idempotent). */
  generateInvoices: protectedProcedure
    .input(generateInvoicesInput)
    .mutation(({ ctx, input }) => generateInvoices(createServiceContext(ctx.user), input)),
  /** DRAFT → ISSUED (notifies the student's parents). */
  issueInvoice: protectedProcedure
    .input(idInput)
    .mutation(({ ctx, input }) => issueInvoice(createServiceContext(ctx.user), input.id)),
  /** DRAFT/ISSUED (unpaid) → CANCELLED. */
  cancelInvoice: protectedProcedure
    .input(idInput)
    .mutation(({ ctx, input }) => cancelInvoice(createServiceContext(ctx.user), input.id)),
});
