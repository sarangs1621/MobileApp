import type { Invoice, InvoiceStatus, Prisma } from "@prisma/client";

import type { DbClient } from "../db-client";

export type { Invoice, InvoiceStatus };

export interface CreateInvoiceInput {
  schoolId: string;
  studentId: string;
  enrollmentId: string;
  feeStructureId: string;
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
  totalAmount: number; // paise (snapshot at generate — ADR-021 §2)
  balanceAmount: number;
  createdByStaffId: string;
  remarks?: string | null;
}

export interface UpdateInvoiceInput {
  status?: InvoiceStatus;
  paidAmount?: number;
  balanceAmount?: number;
  remarks?: string | null;
  dueDate?: Date;
}

export interface ListInvoicesFilter {
  studentId?: string;
  enrollmentId?: string;
  feeStructureId?: string;
  status?: InvoiceStatus;
  /** Via the structure's academic year (relation filter). */
  academicYearId?: string;
  /** Via the enrollment's section (relation filter). */
  sectionId?: string;
  limit: number;
  /** Keyset cursor — rows strictly older than this createdAt. */
  before?: Date;
}

/**
 * Persistence for `Invoice` (ADR-003, ADR-021). No authorization; the business layer
 * resolves permission/scope, the lifecycle transition graph, and mints the number.
 */
export interface InvoiceRepository {
  create(input: CreateInvoiceInput): Promise<Invoice>;
  findById(id: string): Promise<Invoice | null>;
  /** The one non-CANCELLED invoice for this enrollment×structure, if any (idempotent generate). */
  findActiveByEnrollmentStructure(
    enrollmentId: string,
    feeStructureId: string,
  ): Promise<Invoice | null>;
  /** Count for per-academic-year invoice numbering (via the structure's year). */
  countForYear(schoolId: string, academicYearId: string): Promise<number>;
  list(schoolId: string, filter: ListInvoicesFilter): Promise<Invoice[]>;
  update(id: string, input: UpdateInvoiceInput): Promise<Invoice>;
  /**
   * Guarded money apply: update paid/balance/status ONLY if the row still has
   * `expectedPaidAmount` and is still ISSUED/PARTIAL — optimistic concurrency so two
   * concurrent payments can't both apply against a stale paidAmount (returns the count
   * of rows changed; 0 = a concurrent payment won, caller rolls back + retries).
   */
  applyPayment(
    id: string,
    expectedPaidAmount: number,
    next: { paidAmount: number; balanceAmount: number; status: InvoiceStatus },
  ): Promise<number>;
}

export function createInvoiceRepository(client: DbClient): InvoiceRepository {
  return {
    create: (input) =>
      client.invoice.create({
        data: {
          schoolId: input.schoolId,
          studentId: input.studentId,
          enrollmentId: input.enrollmentId,
          feeStructureId: input.feeStructureId,
          invoiceNumber: input.invoiceNumber,
          issueDate: input.issueDate,
          dueDate: input.dueDate,
          totalAmount: input.totalAmount,
          balanceAmount: input.balanceAmount,
          createdByStaffId: input.createdByStaffId,
          remarks: input.remarks ?? null,
        },
      }),

    findById: (id) => client.invoice.findUnique({ where: { id } }),

    findActiveByEnrollmentStructure: (enrollmentId, feeStructureId) =>
      client.invoice.findFirst({
        where: { enrollmentId, feeStructureId, status: { not: "CANCELLED" } },
      }),

    countForYear: (schoolId, academicYearId) =>
      client.invoice.count({ where: { schoolId, feeStructure: { academicYearId } } }),

    list: (schoolId, filter) => {
      const where: Prisma.InvoiceWhereInput = { schoolId };
      if (filter.studentId) {
        where.studentId = filter.studentId;
      }
      if (filter.enrollmentId) {
        where.enrollmentId = filter.enrollmentId;
      }
      if (filter.feeStructureId) {
        where.feeStructureId = filter.feeStructureId;
      }
      if (filter.status) {
        where.status = filter.status;
      }
      if (filter.academicYearId) {
        where.feeStructure = { academicYearId: filter.academicYearId };
      }
      if (filter.sectionId) {
        where.enrollment = { sectionId: filter.sectionId };
      }
      if (filter.before) {
        where.createdAt = { lt: filter.before };
      }
      return client.invoice.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: filter.limit,
      });
    },

    update: (id, input) =>
      client.invoice.update({
        where: { id },
        data: {
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.paidAmount !== undefined ? { paidAmount: input.paidAmount } : {}),
          ...(input.balanceAmount !== undefined ? { balanceAmount: input.balanceAmount } : {}),
          ...(input.remarks !== undefined ? { remarks: input.remarks } : {}),
          ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
        },
      }),

    applyPayment: async (id, expectedPaidAmount, next) => {
      const res = await client.invoice.updateMany({
        where: { id, paidAmount: expectedPaidAmount, status: { in: ["ISSUED", "PARTIAL"] } },
        data: {
          paidAmount: next.paidAmount,
          balanceAmount: next.balanceAmount,
          status: next.status,
        },
      });
      return res.count;
    },
  };
}
