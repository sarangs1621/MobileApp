import { PERMISSIONS } from "@repo/constants";
import { ConflictError, ValidationError } from "@repo/core";
import type { Invoice } from "@repo/db";
import type { FeeStructureDto, InvoiceDto, InvoiceStatusKey } from "@repo/types";

import { assertCan } from "../../authorization";
import type { ServiceContext } from "../../context";
import { createBulkNotification } from "../notification/notification.service";
import { parentUserIdsForStudent } from "../notification/recipients";
import { assertStudentInScope, isFullAccess, loadStudentInSchool } from "../people/scope";

import { istToday, mapFeeStructure, mapInvoice } from "./mappers";
import {
  assertCanReadInvoice,
  loadInvoiceInSchool,
  loadStructureInSchool,
  recordAudit,
  resolveActingStaffId,
} from "./scope";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const NUMBER_RETRIES = 6;

/** Enrollment statuses that get billed — the currently-attending set (ADR-021 §3). */
const BILLABLE_STATUSES = new Set(["ADMITTED", "ACTIVE"]);

// ---- P2002 helpers (the codebase's uniqueness-race idiom — submission.service precedent) ----
function p2002Target(e: unknown): string {
  if (typeof e !== "object" || e === null || (e as { code?: string }).code !== "P2002") {
    return "";
  }
  return String((e as { meta?: { target?: unknown } }).meta?.target ?? "");
}
const isInvoiceNumberCollision = (e: unknown): boolean => p2002Target(e).includes("invoiceNumber");
const isP2002 = (e: unknown): boolean => p2002Target(e) !== "" || false;

// ---------------------------------------------------------------------------
// Fee structures
// ---------------------------------------------------------------------------

export interface FeeComponentInput {
  name: string;
  amount: number; // paise
  order: number;
  mandatory: boolean;
}

export interface CreateStructureInput {
  academicYearId: string;
  name: string;
  description?: string | null | undefined;
  components: FeeComponentInput[];
}

export interface UpdateStructureInput {
  name?: string | undefined;
  description?: string | null | undefined;
  active?: boolean | undefined;
  components?: FeeComponentInput[] | undefined;
}

async function loadYearInSchool(ctx: ServiceContext, academicYearId: string) {
  const year = await ctx.repositories.academicYears.findById(academicYearId);
  if (!year || year.schoolId !== ctx.user.schoolId) {
    throw new ValidationError("Academic year not found");
  }
  return year;
}

/** Create a fee structure with its component lines. Admin-only. Audited. */
export async function createStructure(
  ctx: ServiceContext,
  input: CreateStructureInput,
): Promise<FeeStructureDto> {
  assertCan(ctx.user, PERMISSIONS.FEE_MANAGE);
  await loadYearInSchool(ctx, input.academicYearId);
  if (input.components.length === 0) {
    throw new ValidationError("A fee structure needs at least one component");
  }

  const created = await ctx.withTransaction(async (repos) => {
    const row = await repos.feeStructures.create({
      schoolId: ctx.user.schoolId,
      academicYearId: input.academicYearId,
      name: input.name,
      description: input.description ?? null,
      components: input.components,
    });
    await recordAudit(ctx, repos, {
      action: "FEE_STRUCTURE_CREATE",
      entityType: "FeeStructure",
      entityId: row.id,
      after: { name: row.name, components: row.components.length },
    });
    return row;
  });
  return mapFeeStructure(created);
}

/**
 * Update a fee structure (rename / (de)activate / replace components). Admin-only.
 * ponytail: replacing components affects ONLY future invoices — issued invoices keep
 * their snapshotted total (ADR-021 §2, the M5/M7 snapshot precedent). Audited.
 */
export async function updateStructure(
  ctx: ServiceContext,
  id: string,
  input: UpdateStructureInput,
): Promise<FeeStructureDto> {
  assertCan(ctx.user, PERMISSIONS.FEE_MANAGE);
  await loadStructureInSchool(ctx, id);
  if (input.components !== undefined && input.components.length === 0) {
    throw new ValidationError("A fee structure needs at least one component");
  }

  const updated = await ctx.withTransaction(async (repos) => {
    const row = await repos.feeStructures.update(id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      ...(input.components !== undefined ? { components: input.components } : {}),
    });
    await recordAudit(ctx, repos, {
      action: "FEE_STRUCTURE_UPDATE",
      entityType: "FeeStructure",
      entityId: id,
      after: { name: row.name, active: row.active, components: row.components.length },
    });
    return row;
  });
  return mapFeeStructure(updated);
}

export async function listStructures(
  ctx: ServiceContext,
  filter: { academicYearId?: string | undefined; active?: boolean | undefined } = {},
): Promise<FeeStructureDto[]> {
  assertCan(ctx.user, PERMISSIONS.FEE_MANAGE);
  const rows = await ctx.repositories.feeStructures.list(ctx.user.schoolId, {
    ...(filter.academicYearId ? { academicYearId: filter.academicYearId } : {}),
    ...(filter.active !== undefined ? { active: filter.active } : {}),
  });
  return rows.map(mapFeeStructure);
}

export async function getStructure(ctx: ServiceContext, id: string): Promise<FeeStructureDto> {
  assertCan(ctx.user, PERMISSIONS.FEE_MANAGE);
  return mapFeeStructure(await loadStructureInSchool(ctx, id));
}

// ---------------------------------------------------------------------------
// Invoice generation & lifecycle
// ---------------------------------------------------------------------------

export interface GenerateInvoicesInput {
  feeStructureId: string;
  sectionId: string;
  dueDate: Date;
  issueDate?: Date | undefined;
}

export interface GenerateInvoicesResult {
  created: number;
  skipped: number;
}

/**
 * Bulk-generate DRAFT invoices for the currently-billable enrollments of one section,
 * from one fee structure. The total is SNAPSHOTTED from the structure's mandatory
 * components (ADR-021 §2). Idempotent — a student who already has a non-CANCELLED
 * invoice for this structure is skipped (no double-billing). Admin-only. Each invoice
 * is its own audited transaction with a race-safe per-year number. Section-scoped by
 * design (frozen enrollment repo untouched); class/year coverage is a Step-7 concern.
 */
export async function generateInvoices(
  ctx: ServiceContext,
  input: GenerateInvoicesInput,
): Promise<GenerateInvoicesResult> {
  assertCan(ctx.user, PERMISSIONS.FEE_MANAGE);
  const structure = await loadStructureInSchool(ctx, input.feeStructureId);
  if (!structure.active) {
    throw new ConflictError("Cannot generate invoices from an inactive fee structure");
  }
  const total = structure.components
    .filter((c) => c.mandatory)
    .reduce((sum, c) => sum + c.amount, 0);
  if (total <= 0) {
    throw new ValidationError("Fee structure has no billable (mandatory) amount");
  }
  const year = await loadYearInSchool(ctx, structure.academicYearId);
  const yearToken = year.startDate.getUTCFullYear();
  const staffId = await resolveActingStaffId(ctx);
  const issueDate = input.issueDate ?? new Date();

  const enrollments = await ctx.repositories.enrollments.listBySection(
    structure.academicYearId,
    input.sectionId,
  );
  const billable = enrollments.filter((e) => BILLABLE_STATUSES.has(e.status));

  let created = 0;
  let skipped = 0;
  for (const enr of billable) {
    const existing = await ctx.repositories.invoices.findActiveByEnrollmentStructure(
      enr.id,
      structure.id,
    );
    if (existing) {
      skipped++;
      continue;
    }
    try {
      await mintAndCreateInvoice(ctx, {
        studentId: enr.studentId,
        enrollmentId: enr.id,
        feeStructureId: structure.id,
        academicYearId: structure.academicYearId,
        yearToken,
        issueDate,
        dueDate: input.dueDate,
        totalAmount: total,
        staffId,
      });
      created++;
    } catch (e) {
      // A concurrent generate won the (enrollment, structure) partial-unique — skip it.
      if (isP2002(e)) {
        skipped++;
        continue;
      }
      throw e;
    }
  }
  return { created, skipped };
}

/** Mint a race-safe per-year invoice number and create the DRAFT invoice + audit, in one
 *  transaction; retry on the (rare) concurrent number collision (unique index is the backstop). */
async function mintAndCreateInvoice(
  ctx: ServiceContext,
  p: {
    studentId: string;
    enrollmentId: string;
    feeStructureId: string;
    academicYearId: string;
    yearToken: number;
    issueDate: Date;
    dueDate: Date;
    totalAmount: number;
    staffId: string;
  },
): Promise<Invoice> {
  for (let attempt = 0; attempt < NUMBER_RETRIES; attempt++) {
    try {
      return await ctx.withTransaction(async (repos) => {
        const seq = (await repos.invoices.countForYear(ctx.user.schoolId, p.academicYearId)) + 1;
        const invoiceNumber = `INV-${p.yearToken}-${String(seq).padStart(6, "0")}`;
        const row = await repos.invoices.create({
          schoolId: ctx.user.schoolId,
          studentId: p.studentId,
          enrollmentId: p.enrollmentId,
          feeStructureId: p.feeStructureId,
          invoiceNumber,
          issueDate: p.issueDate,
          dueDate: p.dueDate,
          totalAmount: p.totalAmount,
          balanceAmount: p.totalAmount,
          createdByStaffId: p.staffId,
        });
        await recordAudit(ctx, repos, {
          action: "INVOICE_GENERATE",
          entityType: "Invoice",
          entityId: row.id,
          after: { invoiceNumber, totalAmount: p.totalAmount, studentId: p.studentId },
        });
        return row;
      });
    } catch (e) {
      if (isInvoiceNumberCollision(e) && attempt < NUMBER_RETRIES - 1) {
        continue; // ponytail: per-school number collision race — recount and retry
      }
      throw e;
    }
  }
  throw new ConflictError("Could not allocate an invoice number");
}

/** Issue a DRAFT invoice (→ ISSUED), then best-effort notify the student's parents. Admin-only. */
export async function issueInvoice(ctx: ServiceContext, id: string): Promise<InvoiceDto> {
  assertCan(ctx.user, PERMISSIONS.FEE_MANAGE);
  const inv = await loadInvoiceInSchool(ctx, id);
  if (inv.status !== "DRAFT") {
    throw new ConflictError("Only a draft invoice can be issued");
  }

  const issued = await ctx.withTransaction(async (repos) => {
    const row = await repos.invoices.update(id, { status: "ISSUED" });
    await recordAudit(ctx, repos, {
      action: "INVOICE_ISSUE",
      entityType: "Invoice",
      entityId: id,
      after: { status: row.status, invoiceNumber: row.invoiceNumber },
    });
    return row;
  });

  // Best-effort M10 fan-out (ADR-018 §3 posture; inline like M12 behaviour — no *AndNotify
  // composer since issueInvoice is a NEW M13 action, not a frozen wrap). A hiccup never
  // fails the committed issue.
  try {
    const userIds = await parentUserIdsForStudent(ctx.repositories, issued.studentId);
    await createBulkNotification(ctx, {
      type: "INVOICE_ISSUED",
      priority: "NORMAL",
      title: "Fee invoice issued",
      body: `Invoice ${issued.invoiceNumber} is now due`,
      actionUrl: `/fees/invoices/${issued.id}`,
      userIds,
    });
  } catch (err) {
    console.error(`[fee] invoice-issued notify failed for ${issued.id}`, err);
  }

  return mapInvoice(issued);
}

/** Cancel a DRAFT/ISSUED invoice with no payments (→ CANCELLED, terminal). Admin-only. */
export async function cancelInvoice(ctx: ServiceContext, id: string): Promise<InvoiceDto> {
  assertCan(ctx.user, PERMISSIONS.FEE_MANAGE);
  const inv = await loadInvoiceInSchool(ctx, id);
  if (inv.status === "PAID") {
    throw new ConflictError("A paid invoice cannot be cancelled");
  }
  if (inv.status === "CANCELLED") {
    throw new ConflictError("Invoice is already cancelled");
  }
  if (inv.paidAmount > 0) {
    throw new ConflictError("Cannot cancel an invoice with payments (a refund is out of scope)");
  }

  const cancelled = await ctx.withTransaction(async (repos) => {
    const row = await repos.invoices.update(id, { status: "CANCELLED" });
    await recordAudit(ctx, repos, {
      action: "INVOICE_CANCEL",
      entityType: "Invoice",
      entityId: id,
      before: { status: inv.status },
      after: { status: row.status },
    });
    return row;
  });
  return mapInvoice(cancelled);
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export interface ListInvoicesInput {
  studentId?: string | undefined;
  enrollmentId?: string | undefined;
  feeStructureId?: string | undefined;
  status?: Exclude<InvoiceStatusKey, "OVERDUE"> | undefined;
  academicYearId?: string | undefined;
  sectionId?: string | undefined;
  limit?: number | undefined;
  before?: string | undefined;
}

function pageArgs(input: { limit?: number | undefined; before?: string | undefined }) {
  const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const before = input.before ? new Date(input.before) : undefined;
  return { limit, ...(before ? { before } : {}) };
}

/** The admin fees CONSOLE (ADR-021 §6) — school-wide, filterable. Admin-only (fee:manage). */
export async function listInvoices(
  ctx: ServiceContext,
  input: ListInvoicesInput = {},
): Promise<InvoiceDto[]> {
  assertCan(ctx.user, PERMISSIONS.FEE_MANAGE);
  const today = istToday();
  const rows = await ctx.repositories.invoices.list(ctx.user.schoolId, {
    ...(input.studentId ? { studentId: input.studentId } : {}),
    ...(input.enrollmentId ? { enrollmentId: input.enrollmentId } : {}),
    ...(input.feeStructureId ? { feeStructureId: input.feeStructureId } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(input.academicYearId ? { academicYearId: input.academicYearId } : {}),
    ...(input.sectionId ? { sectionId: input.sectionId } : {}),
    ...pageArgs(input),
  });
  return rows.map((r) => mapInvoice(r, today));
}

/** A student's fee ledger (ADR-021 §1) — admin all; teacher own-section; parent own child. */
export async function listInvoicesByStudent(
  ctx: ServiceContext,
  studentId: string,
  input: { limit?: number | undefined; before?: string | undefined } = {},
): Promise<InvoiceDto[]> {
  assertCan(ctx.user, PERMISSIONS.FEE_READ);
  const student = await loadStudentInSchool(ctx, studentId);
  if (!isFullAccess(ctx)) {
    await assertStudentInScope(ctx, student);
  }
  const today = istToday();
  const rows = await ctx.repositories.invoices.list(ctx.user.schoolId, {
    studentId,
    ...pageArgs(input),
  });
  return rows.map((r) => mapInvoice(r, today));
}

/** Read one invoice, gated by scope (ADR-021 §6). */
export async function getInvoice(ctx: ServiceContext, id: string): Promise<InvoiceDto> {
  assertCan(ctx.user, PERMISSIONS.FEE_READ);
  const inv = await loadInvoiceInSchool(ctx, id);
  await assertCanReadInvoice(ctx, inv);
  return mapInvoice(inv);
}
