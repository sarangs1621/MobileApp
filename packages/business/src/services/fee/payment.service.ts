import { PERMISSIONS } from "@repo/constants";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@repo/core";
import type { Invoice, Payment } from "@repo/db";
import type { InvoiceDto, PaymentDto, PaymentMethodKey } from "@repo/types";

import { assertCan } from "../../authorization";
import type { ServiceContext } from "../../context";
import { createBulkNotification } from "../notification/notification.service";
import { parentUserIdsForStudent } from "../notification/recipients";
import { isFullAccess } from "../people/scope";

import { mapInvoice, mapPayment } from "./mappers";
import {
  assertCanReadInvoice,
  loadInvoiceInSchool,
  loadPaymentInSchool,
  recordAudit,
  resolveActingStaffId,
} from "./scope";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const PAYMENT_RETRIES = 6;

/** Internal signal to roll back + retry when a concurrent payment or a receipt-number
 *  collision loses the race (never leaves the service). */
class PaymentRetry extends Error {}

function isReceiptNumberCollision(e: unknown): boolean {
  if (typeof e !== "object" || e === null || (e as { code?: string }).code !== "P2002") {
    return false;
  }
  return String((e as { meta?: { target?: unknown } }).meta?.target ?? "").includes(
    "receiptNumber",
  );
}

export interface RecordPaymentInput {
  invoiceId: string;
  amount: number; // paise
  method: PaymentMethodKey;
  referenceNo?: string | null | undefined;
  remarks?: string | null | undefined;
  paymentDate?: Date | undefined;
}

export interface RecordPaymentResult {
  payment: PaymentDto;
  invoice: InvoiceDto;
}

/**
 * Record a payment against an issued/partial invoice (the money-movement path, ADR-021 §3).
 * Payment insert + invoice paid/balance/status advance are ONE transaction, guarded by an
 * optimistic paidAmount check so concurrent payments can't lose an update (the M4/M5
 * conditional-transition hardening). ISSUED→PAID directly when a single payment clears the
 * balance. Then, best-effort after commit, notifies the student's parents. Admin-only.
 */
export async function recordPayment(
  ctx: ServiceContext,
  input: RecordPaymentInput,
): Promise<RecordPaymentResult> {
  assertCan(ctx.user, PERMISSIONS.PAYMENT_RECORD);
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new ValidationError("Payment amount must be a positive integer (paise)");
  }
  // Cheap pre-check for a clean error; the authoritative guard is inside the tx (stored status).
  const pre = await loadInvoiceInSchool(ctx, input.invoiceId);
  if (pre.status !== "ISSUED" && pre.status !== "PARTIAL") {
    throw new ConflictError(`Cannot record a payment on a ${pre.status.toLowerCase()} invoice`);
  }
  const staffId = await resolveActingStaffId(ctx);
  const paymentDate = input.paymentDate ?? new Date();

  let payment: Payment | null = null;
  let invoice: Invoice | null = null;
  for (let attempt = 0; attempt < PAYMENT_RETRIES; attempt++) {
    try {
      const res = await ctx.withTransaction(async (repos) => {
        const fresh = await repos.invoices.findById(input.invoiceId);
        if (!fresh) {
          throw new NotFoundError("Invoice not found");
        }
        if (fresh.status !== "ISSUED" && fresh.status !== "PARTIAL") {
          throw new ConflictError(
            `Cannot record a payment on a ${fresh.status.toLowerCase()} invoice`,
          );
        }
        if (input.amount > fresh.balanceAmount) {
          throw new ConflictError("Payment exceeds the outstanding balance");
        }
        const seq = (await repos.payments.countForSchool(ctx.user.schoolId)) + 1;
        const receiptNumber = `RCPT-${String(seq).padStart(6, "0")}`;
        const pay = await repos.payments.create({
          schoolId: ctx.user.schoolId,
          invoiceId: fresh.id,
          receiptNumber,
          paymentDate,
          amount: input.amount,
          method: input.method,
          referenceNo: input.referenceNo ?? null,
          remarks: input.remarks ?? null,
          receivedByStaffId: staffId,
        });
        const newPaid = fresh.paidAmount + input.amount;
        const newBalance = fresh.totalAmount - newPaid;
        const newStatus = newBalance === 0 ? "PAID" : "PARTIAL";
        const changed = await repos.invoices.applyPayment(fresh.id, fresh.paidAmount, {
          paidAmount: newPaid,
          balanceAmount: newBalance,
          status: newStatus,
        });
        if (changed === 0) {
          // A concurrent payment moved paidAmount — roll back this payment insert and retry.
          throw new PaymentRetry();
        }
        const updated = await repos.invoices.findById(fresh.id);
        await recordAudit(ctx, repos, {
          action: "PAYMENT_RECORD",
          entityType: "Payment",
          entityId: pay.id,
          after: {
            receiptNumber,
            amount: input.amount,
            invoiceId: fresh.id,
            invoiceStatus: newStatus,
          },
        });
        return { pay, updated: updated as Invoice };
      });
      payment = res.pay;
      invoice = res.updated;
      break;
    } catch (e) {
      if (
        (e instanceof PaymentRetry || isReceiptNumberCollision(e)) &&
        attempt < PAYMENT_RETRIES - 1
      ) {
        continue;
      }
      throw e;
    }
  }
  if (!payment || !invoice) {
    throw new ConflictError("Could not record the payment (too many concurrent attempts)");
  }

  // Best-effort M10 fan-out (inline, like M12 behaviour — no *AndNotify composer).
  try {
    const userIds = await parentUserIdsForStudent(ctx.repositories, invoice.studentId);
    await createBulkNotification(ctx, {
      type: "PAYMENT_RECEIVED",
      priority: "NORMAL",
      title: "Fee payment received",
      body: `Receipt ${payment.receiptNumber} — ₹${(payment.amount / 100).toFixed(2)} received`,
      actionUrl: `/fees/invoices/${invoice.id}`,
      userIds,
    });
  } catch (err) {
    console.error(`[fee] payment-received notify failed for ${payment.id}`, err);
  }

  return { payment: mapPayment(payment), invoice: mapInvoice(invoice) };
}

/** A single receipt (payment + its invoice), gated by invoice read-scope. */
export async function getReceipt(
  ctx: ServiceContext,
  paymentId: string,
): Promise<{ payment: PaymentDto; invoice: InvoiceDto }> {
  assertCan(ctx.user, PERMISSIONS.PAYMENT_READ);
  const payment = await loadPaymentInSchool(ctx, paymentId);
  const invoice = await loadInvoiceInSchool(ctx, payment.invoiceId);
  await assertCanReadInvoice(ctx, invoice);
  return { payment: mapPayment(payment), invoice: mapInvoice(invoice) };
}

/** Payment history for one invoice (ADR-021) — scoped by the invoice's read gate. */
export async function listPaymentsByInvoice(
  ctx: ServiceContext,
  invoiceId: string,
): Promise<PaymentDto[]> {
  assertCan(ctx.user, PERMISSIONS.PAYMENT_READ);
  const invoice = await loadInvoiceInSchool(ctx, invoiceId);
  await assertCanReadInvoice(ctx, invoice);
  const rows = await ctx.repositories.payments.listByInvoice(invoiceId);
  return rows.map(mapPayment);
}

export interface ListPaymentsInput {
  method?: PaymentMethodKey | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
  limit?: number | undefined;
  before?: string | undefined;
}

/** The admin payment log (ADR-021 §6) — school-wide, filterable. Admin-only. */
export async function listPayments(
  ctx: ServiceContext,
  input: ListPaymentsInput = {},
): Promise<PaymentDto[]> {
  assertCan(ctx.user, PERMISSIONS.PAYMENT_READ);
  if (!isFullAccess(ctx)) {
    // The school-wide log is admin-only; parents use the per-invoice history.
    throw new ForbiddenError("The payment log is available to administrators only");
  }
  const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const before = input.before ? new Date(input.before) : undefined;
  const rows = await ctx.repositories.payments.list(ctx.user.schoolId, {
    ...(input.method ? { method: input.method } : {}),
    ...(input.from ? { from: input.from } : {}),
    ...(input.to ? { to: input.to } : {}),
    limit,
    ...(before ? { before } : {}),
  });
  return rows.map(mapPayment);
}
