-- ---------------------------------------------------------------------------
-- M13 — Fees & Payment Management (ADR-021).
--
-- FOUR additive tables over frozen M1–M12 — the first money domain in the
-- codebase. All money is Int minor units (paise), never Float
-- (DATABASE_CONVENTIONS §12).
--
--   • FeeStructure  — a named, per-academic-year fee template.
--   • FeeComponent  — a line of a FeeStructure (amount in paise). Composition
--                     child → Cascade with its structure; the money-of-record is
--                     the invoice's SNAPSHOTTED total, not this template line.
--   • Invoice       — a student's fee bill for one enrollment, generated from a
--                     FeeStructure. totalAmount is SNAPSHOTTED at generate-time
--                     (ADR-021 §2 — the M5 grade / M7 report-card snapshot
--                     precedent). Keeps BOTH studentId (person, cross-year student
--                     ledger) AND enrollmentId (year/section context) — the
--                     justified ADR-020 §1 divergence. Lifecycle
--                     DRAFT→ISSUED→PARTIAL→PAID (immutable after PAID) · CANCELLED.
--                     OVERDUE is compute-on-read, NEVER stored (ADR-021 §3).
--                     issueInvoice → M10 Notification(type=INVOICE_ISSUED) to the
--                     student's parents via the canonical *AndNotify path.
--   • Payment       — an append-only, immutable payment against an Invoice
--                     ("Payment never deleted"). recordPayment updates the invoice
--                     in the SAME $transaction and → M10 Notification(
--                     type=PAYMENT_RECEIVED) to the parents.
--
-- Two new NotificationType enum VALUES (INVOICE_ISSUED, PAYMENT_RECEIVED) for the
-- M13 fan-outs. This is an ALTER TYPE … ADD VALUE — an enum extension, NOT a
-- frozen-*table* ALTER, and additive (existing rows/reads unaffected; the values
-- are not used in DML here). ADR-021 §5 / deviation #4 (the M12 precedent).
--
-- All FKs to frozen tables RESTRICT (brief); FeeComponent → FeeStructure CASCADE
-- (composition child). Every business mutation writes AuditLog in the same
-- transaction (ADR-007). RLS is a separate migration (fees_rls, Step 3).
--
-- Purely additive: creates 2 enums + 2 enum values + 4 tables + their indexes,
-- FKs, CHECK constraints, and one partial-unique guard. NO frozen table
-- (Student, Enrollment, AcademicYear, Staff, Notification, …) is altered — the
-- *.invoices / *.feeStructures / *.invoicesCreated / *.paymentsReceived
-- back-relations are VIRTUAL (no SQL column); proven by `prisma migrate diff`
-- (M12 head → schema shows ONLY these additions, zero ALTER on any frozen table).
-- ---------------------------------------------------------------------------

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'ONLINE');

-- AlterEnum — additive enum VALUES for the M13 notification fan-outs (ADR-021 §5).
-- Not a frozen-table ALTER; the new values are not used in DML in this migration.
ALTER TYPE "NotificationType" ADD VALUE 'INVOICE_ISSUED';
ALTER TYPE "NotificationType" ADD VALUE 'PAYMENT_RECEIVED';

-- CreateTable
CREATE TABLE "FeeStructure" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeComponent" (
    "id" TEXT NOT NULL,
    "feeStructureId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "mandatory" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "FeeComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "feeStructureId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "issueDate" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "totalAmount" INTEGER NOT NULL,
    "paidAmount" INTEGER NOT NULL DEFAULT 0,
    "balanceAmount" INTEGER NOT NULL,
    "remarks" TEXT,
    "createdByStaffId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "paymentDate" DATE NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "referenceNo" TEXT,
    "remarks" TEXT,
    "receivedByStaffId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeeStructure_schoolId_idx" ON "FeeStructure"("schoolId");

-- CreateIndex
CREATE INDEX "FeeStructure_academicYearId_idx" ON "FeeStructure"("academicYearId");

-- CreateIndex
CREATE INDEX "FeeComponent_feeStructureId_idx" ON "FeeComponent"("feeStructureId");

-- CreateIndex  — a student's fee history (student ledger; brief "student")
CREATE INDEX "Invoice_studentId_idx" ON "Invoice"("studentId");

-- CreateIndex
CREATE INDEX "Invoice_enrollmentId_idx" ON "Invoice"("enrollmentId");

-- CreateIndex
CREATE INDEX "Invoice_feeStructureId_idx" ON "Invoice"("feeStructureId");

-- CreateIndex  — console filter (brief "status")
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex  — due/overdue scan (brief "dueDate")
CREATE INDEX "Invoice_dueDate_idx" ON "Invoice"("dueDate");

-- CreateIndex
CREATE INDEX "Invoice_schoolId_idx" ON "Invoice"("schoolId");

-- CreateIndex  — invoiceNumber unique per school (brief "invoiceNumber")
CREATE UNIQUE INDEX "Invoice_schoolId_invoiceNumber_key" ON "Invoice"("schoolId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- CreateIndex  — receiptNumber lookup (brief "receiptNumber")
CREATE INDEX "Payment_receiptNumber_idx" ON "Payment"("receiptNumber");

-- CreateIndex  — receiptNumber unique per school (brief "Receipt numbers unique")
CREATE UNIQUE INDEX "Payment_schoolId_receiptNumber_key" ON "Payment"("schoolId", "receiptNumber");

-- AddForeignKey
ALTER TABLE "FeeStructure" ADD CONSTRAINT "FeeStructure_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeComponent" ADD CONSTRAINT "FeeComponent_feeStructureId_fkey" FOREIGN KEY ("feeStructureId") REFERENCES "FeeStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_feeStructureId_fkey" FOREIGN KEY ("feeStructureId") REFERENCES "FeeStructure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_createdByStaffId_fkey" FOREIGN KEY ("createdByStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_receivedByStaffId_fkey" FOREIGN KEY ("receivedByStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Raw SQL — money invariants & the no-double-billing guard (ADR-021 §1–2).
-- These are NOT expressible in the Prisma schema (CHECK + partial index), so
-- they are invisible to `migrate diff` and never cause drift. Mirrored by schema
-- comments (DATABASE_CONVENTIONS §3).
-- ---------------------------------------------------------------------------

-- Invoice money invariants (brief Step 2: paidAmount <= totalAmount; balance = total - paid).
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_amounts_nonneg_ck"
    CHECK ("totalAmount" >= 0 AND "paidAmount" >= 0);
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_paid_le_total_ck"
    CHECK ("paidAmount" <= "totalAmount");
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_balance_ck"
    CHECK ("balanceAmount" = "totalAmount" - "paidAmount");

-- Payment moves money — a zero/negative "payment" is a future refund row, not this table.
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_pos_ck"
    CHECK ("amount" > 0);

-- No double-billing: at most one non-CANCELLED invoice per (enrollment, structure).
-- A CANCELLED invoice frees the slot for re-issue (ADR-021 §2 idempotent generate).
CREATE UNIQUE INDEX "Invoice_enrollment_structure_active_key"
    ON "Invoice"("enrollmentId", "feeStructureId")
    WHERE "status" <> 'CANCELLED';
