import {
  createServiceContext,
  getReceipt,
  listPayments,
  listPaymentsByInvoice,
  recordPayment,
} from "@repo/business";
import { idInput, listPaymentsInput, recordPaymentInput } from "@repo/validation";

import { protectedProcedure, router } from "../trpc";

/**
 * Payment procedures (M13, ADR-021). Thin transport only — validate (Zod) then
 * delegate; the business service enforces permission (payment:record/read), the
 * stored-status guard, the atomic + optimistic invoice advance, receipt numbering,
 * in-tx audit, and the post-commit M10 notification. No logic, no Prisma.
 */
export const paymentRouter = router({
  /** Record a payment against an issued/partial invoice (office collection). */
  record: protectedProcedure
    .input(recordPaymentInput)
    .mutation(({ ctx, input }) => recordPayment(createServiceContext(ctx.user), input)),
  /** A single receipt (payment + its invoice), scope-gated. `id` = paymentId. */
  receipt: protectedProcedure
    .input(idInput)
    .query(({ ctx, input }) => getReceipt(createServiceContext(ctx.user), input.id)),
  /** Payment history for one invoice, scope-gated. `id` = invoiceId. */
  listByInvoice: protectedProcedure
    .input(idInput)
    .query(({ ctx, input }) => listPaymentsByInvoice(createServiceContext(ctx.user), input.id)),
  /** The admin payment log — school-wide, filterable by method / date range. */
  list: protectedProcedure
    .input(listPaymentsInput)
    .query(({ ctx, input }) => listPayments(createServiceContext(ctx.user), input)),
});
