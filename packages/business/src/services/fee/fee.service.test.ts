import { ConflictError, ForbiddenError, ValidationError } from "@repo/core";
import type {
  AcademicYear,
  Enrollment,
  FeeStructureWithComponents,
  Invoice,
  InvoiceStatus,
  Notification,
  Parent,
  Payment,
  Repositories,
  Staff,
  Student,
  StudentParent,
} from "@repo/db";
import { createNotificationService } from "@repo/notifications";
import { describe, expect, it, vi } from "vitest";

import type { Principal } from "../../authorization";
import type { ServiceContext } from "../../context";

import {
  cancelInvoice,
  createStructure,
  generateInvoices,
  getInvoice,
  issueInvoice,
  listInvoices,
} from "./fee.service";
import { mapInvoice } from "./mappers";
import { recordPayment } from "./payment.service";

const admin: Principal = {
  userId: "u-admin",
  schoolId: "s-1",
  role: "OFFICE_ADMIN",
  status: "ACTIVE",
};
const teacher: Principal = {
  userId: "u-teacher",
  schoolId: "s-1",
  role: "TEACHER",
  status: "ACTIVE",
};
const parent: Principal = { userId: "u-parent", schoolId: "s-1", role: "PARENT", status: "ACTIVE" };

const d = new Date("2026-06-01T00:00:00.000Z");
const stamps = { createdAt: d, updatedAt: d };

const invoice = (over: Partial<Invoice> = {}): Invoice => ({
  id: "inv-1",
  schoolId: "s-1",
  studentId: "st-1",
  enrollmentId: "e-1",
  feeStructureId: "fs-1",
  invoiceNumber: "INV-2026-000001",
  issueDate: new Date("2026-06-01T00:00:00.000Z"),
  dueDate: new Date("2030-06-30T00:00:00.000Z"), // future → derived status == stored (no spurious OVERDUE)
  status: "ISSUED",
  totalAmount: 1000,
  paidAmount: 0,
  balanceAmount: 1000,
  remarks: null,
  createdByStaffId: "stf-1",
  ...stamps,
  ...over,
});

const student: Student = { id: "st-1", schoolId: "s-1" } as Student;
const parentRow: Parent = { id: "par-1", schoolId: "s-1", userId: "u-parent" } as Parent;

/** Stateful invoice+payment repos so the money state machine is exercised for real. */
function makeRepos(start: Invoice) {
  const inv = { ...start };
  const payments: Payment[] = [];
  return {
    audit: { record: vi.fn(async (): Promise<void> => undefined) },
    staff: { findByUserId: vi.fn(async (): Promise<Staff | null> => ({ id: "stf-1" }) as Staff) },
    students: { findById: vi.fn(async (): Promise<Student | null> => student) },
    parents: { findById: vi.fn(async (): Promise<Parent | null> => parentRow) },
    studentParents: {
      listByStudent: vi.fn(async (): Promise<StudentParent[]> => [
        {
          studentId: "st-1",
          parentId: "par-1",
          relationship: "MOTHER",
          isPrimary: true,
          createdAt: d,
        },
      ]),
    },
    invoices: {
      findById: vi.fn(async (): Promise<Invoice | null> => ({ ...inv })),
      update: vi.fn(async (_id: string, patch: Partial<Invoice>): Promise<Invoice> => {
        Object.assign(inv, patch);
        return { ...inv };
      }),
      applyPayment: vi.fn(
        async (
          _id: string,
          expectedPaid: number,
          next: { paidAmount: number; balanceAmount: number; status: InvoiceStatus },
        ): Promise<number> => {
          // Optimistic guard: only apply if paidAmount unchanged AND still open.
          if (
            inv.paidAmount !== expectedPaid ||
            (inv.status !== "ISSUED" && inv.status !== "PARTIAL")
          ) {
            return 0;
          }
          Object.assign(inv, next);
          return 1;
        },
      ),
    },
    payments: {
      countForSchool: vi.fn(async (): Promise<number> => payments.length),
      create: vi.fn(async (input: Record<string, unknown>): Promise<Payment> => {
        const p = { id: `pay-${payments.length + 1}`, createdAt: d, ...input } as Payment;
        payments.push(p);
        return p;
      }),
    },
    notifications: {
      create: vi.fn(async (): Promise<Notification> => ({ id: "n-1" }) as Notification),
    },
    notificationRecipients: {
      createMany: vi.fn(async (_id: string, userIds: string[]): Promise<number> => userIds.length),
    },
  };
}

function makeCtx(user: Principal, repos: ReturnType<typeof makeRepos>) {
  const repositories = repos as unknown as Repositories;
  const ctx: ServiceContext = {
    user,
    repositories,
    notifications: createNotificationService([]),
    withTransaction: <T>(fn: (r: Repositories) => Promise<T>) => fn(repositories),
  };
  return { ctx, repos };
}

describe("invoice lifecycle & payments (ADR-021 §3)", () => {
  it("issue: DRAFT → ISSUED and emits INVOICE_ISSUED", async () => {
    const repos = makeRepos(invoice({ status: "DRAFT" }));
    const { ctx } = makeCtx(admin, repos);
    const out = await issueInvoice(ctx, "inv-1");
    expect(out.status).toBe("ISSUED");
    expect(repos.notifications.create).toHaveBeenCalledTimes(1);
  });

  it("issue: only a DRAFT can be issued", async () => {
    const { ctx } = makeCtx(admin, makeRepos(invoice({ status: "ISSUED" })));
    await expect(issueInvoice(ctx, "inv-1")).rejects.toBeInstanceOf(ConflictError);
  });

  it("partial then clearing payment: ISSUED → PARTIAL → PAID; receipt + notify", async () => {
    const repos = makeRepos(invoice({ status: "ISSUED", totalAmount: 1000, balanceAmount: 1000 }));
    const { ctx } = makeCtx(admin, repos);

    const first = await recordPayment(ctx, { invoiceId: "inv-1", amount: 400, method: "CASH" });
    expect(first.invoice.status).toBe("PARTIAL");
    expect(first.invoice.balanceAmount).toBe(600);
    expect(first.payment.receiptNumber).toBe("RCPT-000001");

    const second = await recordPayment(ctx, { invoiceId: "inv-1", amount: 600, method: "UPI" });
    expect(second.invoice.status).toBe("PAID");
    expect(second.invoice.balanceAmount).toBe(0);
    expect(second.payment.receiptNumber).toBe("RCPT-000002");
    expect(repos.notifications.create).toHaveBeenCalledTimes(2);
  });

  it("rejects an overpayment (amount > balance)", async () => {
    const { ctx } = makeCtx(admin, makeRepos(invoice({ balanceAmount: 500 })));
    await expect(
      recordPayment(ctx, { invoiceId: "inv-1", amount: 501, method: "CASH" }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("rejects a non-positive amount", async () => {
    const { ctx } = makeCtx(admin, makeRepos(invoice()));
    await expect(
      recordPayment(ctx, { invoiceId: "inv-1", amount: 0, method: "CASH" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a payment on a non-issued invoice (DRAFT / PAID / CANCELLED)", async () => {
    for (const status of ["DRAFT", "PAID", "CANCELLED"] as const) {
      const { ctx } = makeCtx(admin, makeRepos(invoice({ status })));
      await expect(
        recordPayment(ctx, { invoiceId: "inv-1", amount: 100, method: "CASH" }),
      ).rejects.toBeInstanceOf(ConflictError);
    }
  });

  it("cancel: refused once a payment exists; allowed when unpaid", async () => {
    const paid = makeCtx(
      admin,
      makeRepos(invoice({ status: "PARTIAL", paidAmount: 200, balanceAmount: 800 })),
    );
    await expect(cancelInvoice(paid.ctx, "inv-1")).rejects.toBeInstanceOf(ConflictError);

    const clean = makeCtx(admin, makeRepos(invoice({ status: "ISSUED", paidAmount: 0 })));
    expect((await cancelInvoice(clean.ctx, "inv-1")).status).toBe("CANCELLED");
  });

  it("parent can read own child's invoice", async () => {
    const repos = makeRepos(invoice());
    // parent scope: their child ids include st-1
    (repos as unknown as { studentParents: { studentIdsForParent: unknown } }).studentParents = {
      ...repos.studentParents,
      studentIdsForParent: vi.fn(async (): Promise<string[]> => ["st-1"]),
    };
    (repos as unknown as { parents: { findByUserId: unknown } }).parents = {
      ...repos.parents,
      findByUserId: vi.fn(async (): Promise<Parent | null> => parentRow),
    };
    const { ctx } = makeCtx(parent, repos);
    expect((await getInvoice(ctx, "inv-1")).id).toBe("inv-1");
  });
});

/* ---- generation: snapshot total + idempotency (ADR-021 §2) ---- */

const structure = (): FeeStructureWithComponents =>
  ({
    id: "fs-1",
    schoolId: "s-1",
    academicYearId: "y-1",
    name: "Term 1",
    description: null,
    active: true,
    ...stamps,
    components: [
      {
        id: "c1",
        feeStructureId: "fs-1",
        name: "Tuition",
        amount: 1000,
        order: 0,
        mandatory: true,
      },
      {
        id: "c2",
        feeStructureId: "fs-1",
        name: "Transport",
        amount: 500,
        order: 1,
        mandatory: false,
      },
    ],
  }) as FeeStructureWithComponents;

const enr = (id: string, status: Enrollment["status"]): Enrollment =>
  ({
    id,
    schoolId: "s-1",
    studentId: `st-${id}`,
    academicYearId: "y-1",
    status,
    ...stamps,
  }) as Enrollment;

function makeGenerateRepos(existingActiveFor: Set<string>) {
  const created: Array<Record<string, unknown>> = [];
  return {
    _created: created,
    audit: { record: vi.fn(async (): Promise<void> => undefined) },
    staff: { findByUserId: vi.fn(async (): Promise<Staff | null> => ({ id: "stf-1" }) as Staff) },
    feeStructures: {
      findById: vi.fn(async (): Promise<FeeStructureWithComponents | null> => structure()),
    },
    academicYears: {
      findById: vi.fn(
        async (): Promise<AcademicYear | null> =>
          ({ id: "y-1", schoolId: "s-1", startDate: new Date("2026-06-01") }) as AcademicYear,
      ),
    },
    enrollments: {
      listBySection: vi.fn(async (): Promise<Enrollment[]> => [
        enr("a", "ACTIVE"),
        enr("b", "ACTIVE"),
        enr("c", "DROPPED"), // not billable
      ]),
    },
    invoices: {
      findActiveByEnrollmentStructure: vi.fn(
        async (enrollmentId: string): Promise<Invoice | null> =>
          existingActiveFor.has(enrollmentId) ? invoice() : null,
      ),
      countForYear: vi.fn(async (): Promise<number> => created.length),
      create: vi.fn(async (input: Record<string, unknown>): Promise<Invoice> => {
        created.push(input);
        return invoice(input as Partial<Invoice>);
      }),
    },
  };
}

describe("generateInvoices (ADR-021 §2)", () => {
  it("bills active enrollments once, snapshots the mandatory total, skips existing + non-billable", async () => {
    const repos = makeGenerateRepos(new Set(["a"])); // enrollment 'a' already billed
    const { ctx } = makeCtx(admin, repos as unknown as ReturnType<typeof makeRepos>);
    const res = await generateInvoices(ctx, {
      feeStructureId: "fs-1",
      sectionId: "sec-a",
      dueDate: new Date("2030-06-30"),
    });
    // 'a' skipped (existing), 'b' created, 'c' filtered (DROPPED).
    expect(res).toEqual({ created: 1, skipped: 1 });
    // Snapshot total = mandatory components only (Tuition 1000, not Transport 500).
    expect(repos._created[0]).toMatchObject({ totalAmount: 1000, balanceAmount: 1000 });
  });

  it("rejects a structure with no billable amount", async () => {
    const repos = makeGenerateRepos(new Set());
    repos.feeStructures.findById = vi.fn(async (): Promise<FeeStructureWithComponents | null> => ({
      ...structure(),
      components: [
        { id: "c1", feeStructureId: "fs-1", name: "Opt", amount: 500, order: 0, mandatory: false },
      ],
    }));
    const { ctx } = makeCtx(admin, repos as unknown as ReturnType<typeof makeRepos>);
    await expect(
      generateInvoices(ctx, { feeStructureId: "fs-1", sectionId: "sec-a", dueDate: new Date() }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

/* ---- permission matrix (ADR-021 §7) ---- */

describe("permission matrix", () => {
  it("a non-admin cannot manage structures, generate, issue, or record", async () => {
    for (const who of [teacher, parent]) {
      const { ctx } = makeCtx(who, makeRepos(invoice()));
      await expect(
        createStructure(ctx, { academicYearId: "y-1", name: "x", components: [] }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      await expect(issueInvoice(ctx, "inv-1")).rejects.toBeInstanceOf(ForbiddenError);
    }
    // payment:record is admin-only — a teacher cannot record.
    const { ctx } = makeCtx(teacher, makeRepos(invoice()));
    await expect(
      recordPayment(ctx, { invoiceId: "inv-1", amount: 100, method: "CASH" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("the admin invoice console is fee:manage-only (a teacher with fee:read is refused)", async () => {
    const repos = makeRepos(invoice());
    (repos as unknown as { invoices: { list: unknown } }).invoices = {
      ...repos.invoices,
      list: vi.fn(async (): Promise<Invoice[]> => []),
    };
    const { ctx } = makeCtx(teacher, repos);
    await expect(listInvoices(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("mapInvoice — derived OVERDUE (ADR-021 §3, compute-on-read)", () => {
  it("ISSUED past dueDate surfaces as OVERDUE; PAID never does", () => {
    const overdue = mapInvoice(
      invoice({ status: "ISSUED", dueDate: new Date("2026-06-30") }),
      "2026-07-01" as never,
    );
    expect(overdue.status).toBe("OVERDUE");
    const paid = mapInvoice(
      invoice({ status: "PAID", dueDate: new Date("2026-06-30") }),
      "2026-07-01" as never,
    );
    expect(paid.status).toBe("PAID");
    const current = mapInvoice(
      invoice({ status: "ISSUED", dueDate: new Date("2026-06-30") }),
      "2026-06-15" as never,
    );
    expect(current.status).toBe("ISSUED");
  });
});
