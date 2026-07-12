-- M17 Step 6 (ADR-025 §6) — performance review.
-- Purely additive: two indexes serving existing keyset-paginated list queries
-- (fee-invoice list `invoice.repository.ts:163`, payment list `payment.repository.ts:77`),
-- both `where schoolId ORDER BY createdAt DESC` with a `createdAt < before` cursor.
-- Mirrors the existing `Document[schoolId,createdAt]` index. Zero ALTER on any
-- frozen column — proven by `prisma migrate diff` (only these two CreateIndex).

-- CreateIndex
CREATE INDEX "Invoice_schoolId_createdAt_idx" ON "Invoice"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_schoolId_createdAt_idx" ON "Payment"("schoolId", "createdAt");
