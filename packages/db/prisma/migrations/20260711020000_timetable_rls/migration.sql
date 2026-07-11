-- ---------------------------------------------------------------------------
-- M9 Step 4 — Row-Level Security for Timetable Management (ADR-017).
--
-- DEFENSE-IN-DEPTH ONLY (ADR-002). The authoritative gate is the business layer
-- (FeatureFlag `timetable` → assertCan(timetable:*) → row scope). The app reaches
-- these tables as service_role (BYPASSRLS): tRPC → business → Prisma, so these
-- policies do NOT touch the app's own path — they only limit DIRECT client-JWT
-- access. Reuses is_academic_admin() (academic_rls). Role/status come from the DB
-- `User` row, never the JWT. `User.id` == Supabase auth UID, so auth.uid() joins
-- straight to a teacher's TimetableEntry rows.
--
-- NOTE (single-tenant, ADR-008): policies do NOT match schoolId; tenant scoping
-- lives in the repository layer.
--
-- Model (ADR-017 §3):
--   • BellSchedule / Period — read-only REFERENCE: admin ALL; any authenticated
--     user SELECT (the Holiday/GradeScale idiom — a bell schedule is public-within-
--     school reference data). Anon: no policy = denied.
--   • TimetableEntry — admin ALL; TEACHER reads only OWN rows (teacherId =
--     auth.uid() — the personal teaching schedule; this is what forces the
--     "Teacher A cannot read Teacher B" isolation); PARENT reads the child's whole
--     SECTION grid (is_my_child_section). Anon: no policy = denied.
-- Purely additive: enables RLS + policies on the three M9 tables and adds one
-- scope helper. No frozen policy is altered.
-- ---------------------------------------------------------------------------

-- Scope helper: does the current auth user (a parent) have a child enrolled in
-- section `sec`? SECURITY DEFINER so it reads Enrollment/StudentParent/Parent
-- regardless of the caller's grants/RLS; search_path pinned to '' (schema-qualify).
-- Matches ANY enrollment year/status (the business layer narrows to the current
-- year — same posture as attendance_rls / homework_rls).
CREATE OR REPLACE FUNCTION public.is_my_child_section(sec text)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."Enrollment" e
    JOIN public."StudentParent" sp ON sp."studentId" = e."studentId"
    JOIN public."Parent" p ON p.id = sp."parentId"
    WHERE e."sectionId" = sec
      AND p."userId" = (SELECT auth.uid())::text
  );
$$;

-- ---- BellSchedule: admin ALL; read-only reference for any authenticated user ----
ALTER TABLE "BellSchedule" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "timetable_admin_all" ON "BellSchedule"
  FOR ALL TO authenticated
  USING (public.is_academic_admin()) WITH CHECK (public.is_academic_admin());
CREATE POLICY "read_ref" ON "BellSchedule"
  FOR SELECT TO authenticated
  USING (true);

-- ---- Period: admin ALL; read-only reference for any authenticated user ----
ALTER TABLE "Period" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "timetable_admin_all" ON "Period"
  FOR ALL TO authenticated
  USING (public.is_academic_admin()) WITH CHECK (public.is_academic_admin());
CREATE POLICY "read_ref" ON "Period"
  FOR SELECT TO authenticated
  USING (true);

-- ---- TimetableEntry: admin ALL; teacher OWN slots; parent child's SECTION grid ----
ALTER TABLE "TimetableEntry" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "timetable_admin_all" ON "TimetableEntry"
  FOR ALL TO authenticated
  USING (public.is_academic_admin()) WITH CHECK (public.is_academic_admin());
CREATE POLICY "teacher_read_own" ON "TimetableEntry"
  FOR SELECT TO authenticated
  USING ("teacherId" = (SELECT auth.uid())::text);
CREATE POLICY "parent_read_child_section" ON "TimetableEntry"
  FOR SELECT TO authenticated
  USING (public.is_my_child_section("sectionId"));
