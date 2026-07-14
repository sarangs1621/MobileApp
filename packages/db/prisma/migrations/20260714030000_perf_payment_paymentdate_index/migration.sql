-- Perf (PERFORMANCE_REVIEW follow-up 2): serves the SQL-aggregated monthly fee-collection
-- totals (WHERE schoolId AND paymentDate range GROUP BY month). Added together with the
-- feeCollection rewrite, exactly as the review planned. Additive: one CREATE INDEX, no ALTER.
CREATE INDEX "Payment_schoolId_paymentDate_idx" ON "Payment"("schoolId", "paymentDate");
