-- ---------------------------------------------------------------------------
-- M7 Step 4 — Row-Level Security for Report Cards (ADR-014).
--
-- DEFENSE-IN-DEPTH ONLY (ADR-002). The AUTHORITATIVE gate is the business layer
-- (assertCan + the ADR-015 assertClassTeacherOfEnrollment scope + the lifecycle
-- guards). The app reaches this table as service_role (BYPASSRLS) via tRPC ->
-- business -> Prisma, so these policies do NOT touch the app path; they only
-- deny/limit DIRECT client-JWT access. RLS ON with policies FOR authenticated =
-- deny-all to anon and to any authenticated user matching no policy.
--
-- Rules (Step-4 brief; R1/R2/R3):
--   Admins   (SUPER_ADMIN|OFFICE_ADMIN ACTIVE)   ALL — generate/approve/publish/
--            reopen/revoke are all admin (R1).
--   Class    the ClassTeacherAssignment holder for the card's (year, section)
--   teacher  (ADR-015) — SELECT own-section cards (any status, to author remarks),
--            and UPDATE only while DRAFT/SUBMITTED (draft the remark + submit for
--            review, R1). No INSERT (generation is admin), no DELETE (cards are
--            Restrict, never deleted). The DRAFT/SUBMITTED gate is the M6-analog
--            "own + not-yet-locked" guard — a direct-JWT class teacher can never
--            mutate an APPROVED/PUBLISHED card. A SUBJECT teacher of the same
--            section is NOT the class teacher, so matches no policy (ADR-014 §7).
--   Parents  SELECT their OWN child's card, and ONLY when PUBLISHED (the parent-
--            visibility gate, exactly the M5/M6 posture) — DRAFT/SUBMITTED/
--            APPROVED and SUPERSEDED/REVOKED are invisible. Read-only.
--   Anonymous deny (no policy).
--
-- Reuses is_academic_admin() (academic_rls) and is_my_child_enrollment()
-- (attendance_rls); adds is_class_teacher_of_enrollment(). NOTE (single-tenant,
-- ADR-008): policies do NOT match schoolId; tenant scoping lives in the repo
-- layer. The card-status parent gate is a column on ReportCard itself, so no
-- helper is needed for it. The `report-card` STORAGE bucket policies are
-- provisioned with the bucket via the Supabase runbook (storage.objects is
-- dashboard/ops-managed, like homework-files/student-documents), not here (R5).
-- ---------------------------------------------------------------------------

-- ---- scope helper (SECURITY DEFINER; search_path pinned to '') ----

-- The auth user is the assigned CLASS TEACHER for this enrollment's (year,
-- section) — the ADR-015 ClassTeacherAssignment grain (keyed academicYear ×
-- section). Matches BOTH year and section so a class teacher only reaches the
-- cards of the section they hold FOR THAT YEAR. A subject teacher (TeacherAssignment
-- only) never matches. Takes the enrollmentId so it gates the row via its owner.
CREATE OR REPLACE FUNCTION public.is_class_teacher_of_enrollment(enr text)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."Enrollment" e
    JOIN public."ClassTeacherAssignment" cta
      ON cta."sectionId" = e."sectionId"
     AND cta."academicYearId" = e."academicYearId"
    WHERE e.id = enr
      AND cta."teacherId" = (SELECT auth.uid())::text
  );
$$;

-- ---- ReportCard: admin ALL; class-teacher SELECT own-section + UPDATE
--      draft/submitted; parent SELECT PUBLISHED own-child ----
ALTER TABLE "ReportCard" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "report_card_admin_all" ON "ReportCard"
  FOR ALL TO authenticated
  USING (public.is_academic_admin()) WITH CHECK (public.is_academic_admin());

CREATE POLICY "class_teacher_read_report_card" ON "ReportCard"
  FOR SELECT TO authenticated
  USING (public.is_class_teacher_of_enrollment("enrollmentId"));

CREATE POLICY "class_teacher_draft_report_card" ON "ReportCard"
  FOR UPDATE TO authenticated
  USING (public.is_class_teacher_of_enrollment("enrollmentId") AND "status" IN ('DRAFT', 'SUBMITTED'))
  WITH CHECK (public.is_class_teacher_of_enrollment("enrollmentId") AND "status" IN ('DRAFT', 'SUBMITTED'));

CREATE POLICY "parent_read_published_report_card" ON "ReportCard"
  FOR SELECT TO authenticated
  USING (public.is_my_child_enrollment("enrollmentId") AND "status" = 'PUBLISHED');
