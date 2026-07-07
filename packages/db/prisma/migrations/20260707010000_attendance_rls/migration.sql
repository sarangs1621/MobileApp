-- ---------------------------------------------------------------------------
-- M4 Step 4 — Row-Level Security for Attendance Management.
--
-- DEFENSE-IN-DEPTH ONLY (ADR-002/011). The authoritative gate is the business
-- layer (assertCan + assertScope). The app reaches these tables as service_role
-- (BYPASSRLS) via tRPC -> business -> Prisma, so these policies do NOT touch the
-- app path (parent leave submission, teacher marking, corrections all run as
-- service_role); they only deny/limit DIRECT client-JWT access. Reads only —
-- writes never come through a client JWT.
--
-- Reuses is_academic_admin() (SUPER_ADMIN|OFFICE_ADMIN ACTIVE = "full
-- management") and teaches_section() from the M3/M2 RLS migrations.
--
-- NOTE (single-tenant, ADR-008): policies do NOT match schoolId; scoping lives
-- in the repository layer.
-- ---------------------------------------------------------------------------

-- ---- scope helpers (SECURITY DEFINER; search_path pinned to '') ----

-- Parent (auth user) is linked to the student behind this enrollment.
CREATE OR REPLACE FUNCTION public.is_my_child_enrollment(enr text)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."Enrollment" e
    JOIN public."StudentParent" sp ON sp."studentId" = e."studentId"
    JOIN public."Parent" p ON p.id = sp."parentId"
    WHERE e.id = enr
      AND p."userId" = (SELECT auth.uid())::text
  );
$$;

-- Teacher (auth user) teaches the section this enrollment sits in. Coarse (any
-- year); the business layer narrows to the ACTIVE year. A null-section
-- enrollment joins to nothing, so it is not teacher-visible.
CREATE OR REPLACE FUNCTION public.teaches_enrollment(enr text)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."Enrollment" e
    JOIN public."TeacherAssignment" ta ON ta."sectionId" = e."sectionId"
    WHERE e.id = enr
      AND ta."teacherId" = (SELECT auth.uid())::text
  );
$$;

-- Teacher teaches the section of this attendance session.
CREATE OR REPLACE FUNCTION public.teaches_session(ses text)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."AttendanceSession" s
    JOIN public."TeacherAssignment" ta ON ta."sectionId" = s."sectionId"
    WHERE s.id = ses
      AND ta."teacherId" = (SELECT auth.uid())::text
  );
$$;

-- Teacher teaches the section behind this attendance record (via its session).
CREATE OR REPLACE FUNCTION public.teaches_record(rec text)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."AttendanceRecord" r
    JOIN public."AttendanceSession" s ON s.id = r."sessionId"
    JOIN public."TeacherAssignment" ta ON ta."sectionId" = s."sectionId"
    WHERE r.id = rec
      AND ta."teacherId" = (SELECT auth.uid())::text
  );
$$;

-- Enabling RLS with policies only FOR authenticated = deny-all to anon and to any
-- authenticated user who matches no policy. service_role (app path) bypasses.

-- ---- AttendanceSession: admin ALL; teacher own-assigned-section SELECT ----
ALTER TABLE "AttendanceSession" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendance_admin_all" ON "AttendanceSession"
  FOR ALL TO authenticated
  USING (public.is_academic_admin()) WITH CHECK (public.is_academic_admin());
CREATE POLICY "teacher_read_sessions" ON "AttendanceSession"
  FOR SELECT TO authenticated
  USING (public.teaches_section("sectionId"));

-- ---- AttendanceRecord: admin ALL; teacher own-section; parent own-child ----
ALTER TABLE "AttendanceRecord" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendance_admin_all" ON "AttendanceRecord"
  FOR ALL TO authenticated
  USING (public.is_academic_admin()) WITH CHECK (public.is_academic_admin());
CREATE POLICY "teacher_read_records" ON "AttendanceRecord"
  FOR SELECT TO authenticated
  USING (public.teaches_session("sessionId"));
CREATE POLICY "parent_read_records" ON "AttendanceRecord"
  FOR SELECT TO authenticated
  USING (public.is_my_child_enrollment("enrollmentId"));

-- ---- LeaveRequest: admin ALL; teacher own-section; parent own-child ----
ALTER TABLE "LeaveRequest" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendance_admin_all" ON "LeaveRequest"
  FOR ALL TO authenticated
  USING (public.is_academic_admin()) WITH CHECK (public.is_academic_admin());
CREATE POLICY "teacher_read_leave" ON "LeaveRequest"
  FOR SELECT TO authenticated
  USING (public.teaches_enrollment("enrollmentId"));
CREATE POLICY "parent_read_leave" ON "LeaveRequest"
  FOR SELECT TO authenticated
  USING (public.is_my_child_enrollment("enrollmentId"));

-- ---- AttendanceCorrection: admin ALL; teacher own-section (staff-facing) ----
ALTER TABLE "AttendanceCorrection" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendance_admin_all" ON "AttendanceCorrection"
  FOR ALL TO authenticated
  USING (public.is_academic_admin()) WITH CHECK (public.is_academic_admin());
CREATE POLICY "teacher_read_corrections" ON "AttendanceCorrection"
  FOR SELECT TO authenticated
  USING (public.teaches_record("attendanceRecordId"));

-- ---- Holiday: admin ALL; read-only school calendar for any authenticated user ----
ALTER TABLE "Holiday" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendance_admin_all" ON "Holiday"
  FOR ALL TO authenticated
  USING (public.is_academic_admin()) WITH CHECK (public.is_academic_admin());
CREATE POLICY "read_calendar" ON "Holiday"
  FOR SELECT TO authenticated
  USING (true);
