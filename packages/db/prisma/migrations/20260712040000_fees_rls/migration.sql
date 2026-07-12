-- ---------------------------------------------------------------------------
-- M13 Step 3 — Row-Level Security for Fees & Payments (ADR-021 §6).
--
-- DEFENSE-IN-DEPTH ONLY (ADR-002/021). The authoritative gate is the business
-- layer (assertCan(fee:*|payment:*) + row scope). The app reaches these tables
-- as service_role (BYPASSRLS) via tRPC -> business -> Prisma, so these policies
-- do NOT touch the app path — they only deny/limit DIRECT client-JWT access.
--
-- Reuses is_academic_admin() (SUPER_ADMIN|OFFICE_ADMIN ACTIVE) and
-- is_my_child_enrollment() (attendance_rls) — NO new helper. Role/status come
-- from the DB `User` row, never the JWT.
--
-- NOTE (single-tenant, ADR-008): policies do NOT match schoolId; tenant scoping
-- lives in the repository layer.
--
-- Model (ADR-021 §6):
--   • FeeStructure / FeeComponent — admin ALL. Fee templates are served to
--     teachers/parents through the business layer (service_role); no direct-JWT
--     read policy is granted (there is no cheap teacher/parent ownership
--     predicate over a template, and templates are not per-child data). Coarse,
--     business-gated — the standing defense-in-depth posture.
--   • Invoice — admin ALL; PARENT SELECTs own child's invoices
--     (is_my_child_enrollment(enrollmentId) — forces "Parent ≠ other parent").
--   • Payment — admin ALL; PARENT SELECTs own child's payments (via the parent's
--     own-child Invoice — the same guardian link, one hop through invoiceId).
--   • Teacher "read only" (brief) is enforced in the business layer (fee:read,
--     no fee:manage/payment:record) — teachers reach fee reads via service_role,
--     not a direct-JWT policy (no cheap teacher-owns-invoice predicate exists;
--     the coarse-RLS + business-targeting split, ADR-019/020 §5-6 precedent).
--   • Writes run as service_role. Anon: no policy = denied everywhere.
--
-- Purely additive: enables RLS + policies on the four M13 tables only.
-- ---------------------------------------------------------------------------

-- ---- FeeStructure / FeeComponent: admin ALL (templates via business otherwise) ----
ALTER TABLE "FeeStructure" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fee_structure_admin_all" ON "FeeStructure"
  FOR ALL TO authenticated
  USING (public.is_academic_admin()) WITH CHECK (public.is_academic_admin());

ALTER TABLE "FeeComponent" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fee_component_admin_all" ON "FeeComponent"
  FOR ALL TO authenticated
  USING (public.is_academic_admin()) WITH CHECK (public.is_academic_admin());

-- ---- Invoice: admin ALL; parent own child SELECT ----
ALTER TABLE "Invoice" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoice_admin_all" ON "Invoice"
  FOR ALL TO authenticated
  USING (public.is_academic_admin()) WITH CHECK (public.is_academic_admin());
CREATE POLICY "parent_read_child_invoices" ON "Invoice"
  FOR SELECT TO authenticated
  USING (public.is_my_child_enrollment("enrollmentId"));

-- ---- Payment: admin ALL; parent own child SELECT (through the invoice) ----
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payment_admin_all" ON "Payment"
  FOR ALL TO authenticated
  USING (public.is_academic_admin()) WITH CHECK (public.is_academic_admin());
CREATE POLICY "parent_read_child_payments" ON "Payment"
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM "Invoice" i
    WHERE i.id = "Payment"."invoiceId"
      AND public.is_my_child_enrollment(i."enrollmentId")
  ));
