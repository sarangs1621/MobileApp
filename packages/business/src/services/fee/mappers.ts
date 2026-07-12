import type { FeeStructureWithComponents, Invoice, Payment } from "@repo/db";
import type {
  FeeComponentDto,
  FeeStructureDto,
  InvoiceDto,
  InvoiceStatusKey,
  IsoUtcString,
  IstDateString,
  PaymentDto,
} from "@repo/types";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // Asia/Kolkata, no DST (homework/scope precedent)

const iso = (d: Date): IsoUtcString => d.toISOString() as IsoUtcString;
/** @db.Date → YYYY-MM-DD (the stored calendar date, no timezone shift). */
const dateStr = (d: Date): IstDateString => d.toISOString().slice(0, 10) as IstDateString;

/** Today's IST calendar date — the reference for the derived OVERDUE status (ADR-021 §3). */
export function istToday(): IstDateString {
  return new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10) as IstDateString;
}

export function mapFeeStructure(s: FeeStructureWithComponents): FeeStructureDto {
  return {
    id: s.id,
    schoolId: s.schoolId,
    academicYearId: s.academicYearId,
    name: s.name,
    description: s.description,
    active: s.active,
    components: s.components.map((c): FeeComponentDto => ({
      id: c.id,
      feeStructureId: c.feeStructureId,
      name: c.name,
      amount: c.amount,
      order: c.order,
      mandatory: c.mandatory,
    })),
    createdAt: iso(s.createdAt),
    updatedAt: iso(s.updatedAt),
  };
}

/**
 * Map an invoice, substituting the DERIVED OVERDUE status: a stored ISSUED/PARTIAL
 * invoice whose dueDate has passed (IST) displays as OVERDUE (never stored — §3).
 * Business transitions read the row's stored status, never this display value.
 */
export function mapInvoice(inv: Invoice, today: IstDateString = istToday()): InvoiceDto {
  const stored = inv.status as InvoiceStatusKey;
  const due = dateStr(inv.dueDate);
  const status: InvoiceStatusKey =
    (stored === "ISSUED" || stored === "PARTIAL") && due < today ? "OVERDUE" : stored;
  return {
    id: inv.id,
    schoolId: inv.schoolId,
    studentId: inv.studentId,
    enrollmentId: inv.enrollmentId,
    feeStructureId: inv.feeStructureId,
    invoiceNumber: inv.invoiceNumber,
    issueDate: dateStr(inv.issueDate),
    dueDate: due,
    status,
    totalAmount: inv.totalAmount,
    paidAmount: inv.paidAmount,
    balanceAmount: inv.balanceAmount,
    remarks: inv.remarks,
    createdByStaffId: inv.createdByStaffId,
    createdAt: iso(inv.createdAt),
    updatedAt: iso(inv.updatedAt),
  };
}

export function mapPayment(p: Payment): PaymentDto {
  return {
    id: p.id,
    schoolId: p.schoolId,
    invoiceId: p.invoiceId,
    receiptNumber: p.receiptNumber,
    paymentDate: dateStr(p.paymentDate),
    amount: p.amount,
    method: p.method,
    referenceNo: p.referenceNo,
    remarks: p.remarks,
    receivedByStaffId: p.receivedByStaffId,
    createdAt: iso(p.createdAt),
  };
}
