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
  /**
   * READ-ONLY analytics (PERFORMANCE_REVIEW §follow-ups 2) — per-month collected totals
   * (YYYY-MM on the calendar `paymentDate`, ascending) aggregated in SQL; replaces
   * loading up to 100k Payment rows to bucket in JS. Parameterized template — no
   * string-built SQL (SECURITY_AUDIT §injection).
   */
  monthlyTotals(
    schoolId: string,
    from: Date,
    to: Date,
  ): Promise<{ month: string; collected: number }[]>;
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

    monthlyTotals: async (schoolId, from, to) => {
      // SUM(paise) can exceed int4 — cast to bigint and convert (amounts stay Number-safe).
      const rows = await client.$queryRaw<{ month: string; collected: bigint }[]>`
        SELECT to_char("paymentDate", 'YYYY-MM') AS month, SUM("amount")::bigint AS collected
        FROM "Payment"
        WHERE "schoolId" = ${schoolId} AND "paymentDate" >= ${from} AND "paymentDate" <= ${to}
        GROUP BY 1 ORDER BY 1`;
      return rows.map((r) => ({ month: r.month, collected: Number(r.collected) }));
    },
  };
}
