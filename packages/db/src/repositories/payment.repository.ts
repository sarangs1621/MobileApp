import type { Payment, PaymentMethod, Prisma } from "@prisma/client";

import type { DbClient } from "../db-client";

export type { Payment, PaymentMethod };

export interface CreatePaymentInput {
  schoolId: string;
  invoiceId: string;
  receiptNumber: string;
  paymentDate: Date;
  amount: number; // paise
  method: PaymentMethod;
  referenceNo?: string | null;
  remarks?: string | null;
  receivedByStaffId: string;
}

export interface ListPaymentsFilter {
  method?: PaymentMethod;
  /** Inclusive paymentDate range (calendar dates). */
  from?: Date;
  to?: Date;
  limit: number;
  before?: Date;
}

/**
 * Persistence for `Payment` — append-only, never updated/deleted (ADR-021 §1). No
 * authorization; the business layer mints the receipt number and updates the invoice.
 */
export interface PaymentRepository {
  create(input: CreatePaymentInput): Promise<Payment>;
  findById(id: string): Promise<Payment | null>;
  listByInvoice(invoiceId: string): Promise<Payment[]>;
  list(schoolId: string, filter: ListPaymentsFilter): Promise<Payment[]>;
  /** Count for per-school receipt numbering (a continuous receipt book). */
  countForSchool(schoolId: string): Promise<number>;
}

export function createPaymentRepository(client: DbClient): PaymentRepository {
  return {
    create: (input) =>
      client.payment.create({
        data: {
          schoolId: input.schoolId,
          invoiceId: input.invoiceId,
          receiptNumber: input.receiptNumber,
          paymentDate: input.paymentDate,
          amount: input.amount,
          method: input.method,
          referenceNo: input.referenceNo ?? null,
          remarks: input.remarks ?? null,
          receivedByStaffId: input.receivedByStaffId,
        },
      }),

    findById: (id) => client.payment.findUnique({ where: { id } }),

    listByInvoice: (invoiceId) =>
      client.payment.findMany({ where: { invoiceId }, orderBy: { createdAt: "desc" } }),

    list: (schoolId, filter) => {
      const where: Prisma.PaymentWhereInput = { schoolId };
      if (filter.method) {
        where.method = filter.method;
      }
      if (filter.from || filter.to) {
        where.paymentDate = {
          ...(filter.from ? { gte: filter.from } : {}),
          ...(filter.to ? { lte: filter.to } : {}),
        };
      }
      if (filter.before) {
        where.createdAt = { lt: filter.before };
      }
      return client.payment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: filter.limit,
      });
    },

    countForSchool: (schoolId) => client.payment.count({ where: { schoolId } }),
  };
}
