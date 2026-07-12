import { NotFoundError, ValidationError } from "@repo/core";
import type { FeeStructureWithComponents, Invoice, Payment } from "@repo/db";

import type { ServiceContext } from "../../context";
import { assertStudentInScope, isFullAccess, loadStudentInSchool } from "../people/scope";

export { recordAudit, isFullAccess } from "../people/scope";

/** The acting user's Staff row id — the B3 audit actor (createdBy / receivedBy). */
export async function resolveActingStaffId(ctx: ServiceContext): Promise<string> {
  const staff = await ctx.repositories.staff.findByUserId(ctx.user.userId);
  if (!staff) {
    throw new ValidationError(
      "Acting user has no staff profile (required to manage fees / record payments)",
    );
  }
  return staff.id;
}

/** Load a fee structure, enforcing tenant ownership (404 if missing / other-school). */
export async function loadStructureInSchool(
  ctx: ServiceContext,
  id: string,
): Promise<FeeStructureWithComponents> {
  const s = await ctx.repositories.feeStructures.findById(id);
  if (!s || s.schoolId !== ctx.user.schoolId) {
    throw new NotFoundError("Fee structure not found");
  }
  return s;
}

/** Load an invoice, enforcing tenant ownership (404 if missing / other-school). */
export async function loadInvoiceInSchool(ctx: ServiceContext, id: string): Promise<Invoice> {
  const inv = await ctx.repositories.invoices.findById(id);
  if (!inv || inv.schoolId !== ctx.user.schoolId) {
    throw new NotFoundError("Invoice not found");
  }
  return inv;
}

/** Load a payment, enforcing tenant ownership (404 if missing / other-school). */
export async function loadPaymentInSchool(ctx: ServiceContext, id: string): Promise<Payment> {
  const p = await ctx.repositories.payments.findById(id);
  if (!p || p.schoolId !== ctx.user.schoolId) {
    throw new NotFoundError("Payment not found");
  }
  return p;
}

/**
 * Read gate for a single invoice (ADR-021 §6): admin ALL; else the invoice's student
 * must be in the reader's scope (teacher own-section read-only / parent own-child) —
 * via the shared people scope helper.
 */
export async function assertCanReadInvoice(ctx: ServiceContext, invoice: Invoice): Promise<void> {
  if (isFullAccess(ctx)) {
    return;
  }
  const student = await loadStudentInSchool(ctx, invoice.studentId);
  await assertStudentInScope(ctx, student);
}
