-- ---------------------------------------------------------------------------
-- M12 Step 3 — Row-Level Security for Student Discipline (ADR-020 §5).
--
-- DEFENSE-IN-DEPTH ONLY (ADR-002/020). The authoritative gate is the business
-- layer (assertCan(behaviour:*) + row scope). The app reaches this table as
-- service_role (BYPASSRLS) via tRPC -> business -> Prisma, so these policies do
-- NOT touch the app path — they only deny/limit DIRECT client-JWT access.
--
-- Reuses is_academic_admin() (SUPER_ADMIN|OFFICE_ADMIN ACTIVE) and
-- is_my_child_enrollment() (attendance_rls) — no new helper. Role/status come
-- from the DB `User` row, never the JWT. `User.id` == Supabase auth UID, so
-- auth.uid() joins straight to teacherId, and via the enrollment→student→parent
-- helper to a parent's own children.
--
-- LEAVE RLS is ALREADY M4's (attendance_rls: LeaveRequest admin ALL / teacher
-- own-section / parent own-child) and is UNCHANGED — M12 adds no leave policy.
--
-- NOTE (single-tenant, ADR-008): policies do NOT match schoolId; scoping lives
-- in the repository layer.
--
-- Model (ADR-020 §5):
--   • BehaviourIncident — admin ALL; TEACHER SELECTs OWN incidents (teacherId =
--     auth.uid() — forces "Teacher A cannot read Teacher B"); PARENT SELECTs own
--     child's incidents (is_my_child_enrollment — forces "Parent ≠ other parent").
--     Writes run as service_role. Anon: no policy = denied.
-- Purely additive: enables RLS + policies on the one M12 table.
-- ---------------------------------------------------------------------------

-- ---- BehaviourIncident: admin ALL; teacher own incidents; parent own child ----
ALTER TABLE "BehaviourIncident" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "discipline_admin_all" ON "BehaviourIncident"
  FOR ALL TO authenticated
  USING (public.is_academic_admin()) WITH CHECK (public.is_academic_admin());
CREATE POLICY "teacher_read_own_incidents" ON "BehaviourIncident"
  FOR SELECT TO authenticated
  USING ("teacherId" = (SELECT auth.uid())::text);
CREATE POLICY "parent_read_child_incidents" ON "BehaviourIncident"
  FOR SELECT TO authenticated
  USING (public.is_my_child_enrollment("enrollmentId"));
