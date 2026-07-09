-- ---------------------------------------------------------------------------
-- M6 Step 4 — Row-Level Security for Homework & Assignment Management (ADR-013).
--
-- DEFENSE-IN-DEPTH ONLY (ADR-002/013). The AUTHORITATIVE gate is the business
-- layer (assertCan + scope). The app reaches these tables as service_role
-- (BYPASSRLS) via tRPC -> business -> Prisma, so these policies do NOT touch the
-- app path; they only deny/limit DIRECT client-JWT access. Enabling RLS with
-- policies FOR authenticated = deny-all to anon and to any authenticated user
-- matching no policy.
--
-- Rules (Step-4 brief):
--   Admins    (SUPER_ADMIN|OFFICE_ADMIN ACTIVE)  ALL on every table.
--   Teachers  READ + WRITE only homework they OWN — ownership is
--             TeacherAssignment(teacher, homework.subject, homework.section),
--             ADR-013 §4 (same subject×section grain as ADR-011/012; derived,
--             never stored). Teacher DELETE is additionally restricted to
--             DRAFT homework — the R5-analog guard (a direct-JWT delete of a
--             published assignment would cascade real submissions; the business
--             layer enforces DRAFT-only, RLS mirrors it).
--   Teachers  READ + review-UPDATE submissions under their own homework;
--             READ + INSERT feedback (immutable — no UPDATE/DELETE policy).
--   Parents   READ published/closed homework for their OWN child — section
--             match OR their child already holds a submission (the ADR-013 §10
--             or-clause: a mid-year transfer never strands submitted work).
--             DRAFT homework is invisible. INSERT/UPDATE their own child's
--             submission only, and only as THEIR OWN Parent record (actor
--             spoofing fails the WITH CHECK). Attachments: READ own child's,
--             INSERT own (append-only — no UPDATE/DELETE policy). Feedback:
--             READ own child's only.
--   Anonymous deny (no policy).
--
-- Reuses is_academic_admin() (academic_rls), is_my_child_enrollment()
-- (attendance_rls), is_my_parent_record() (people_rls). NOTE (single-tenant,
-- ADR-008): policies do NOT match schoolId; tenant scoping lives in the
-- repository layer. Lifecycle rules beyond the two encoded gates (parent
-- visibility, DRAFT-only teacher delete) stay business-layer (M4/M5 posture).
--
-- The `homework-files` STORAGE bucket policies are provisioned with the bucket
-- via the Supabase runbook (storage.objects is dashboard/ops-managed, like
-- student-documents — runbook §3b pattern), not in this migration.
-- ---------------------------------------------------------------------------

-- ---- scope helpers (SECURITY DEFINER; search_path pinned to '') ----

-- Teacher (auth user) is assigned to teach this subject in this section — the
-- ADR-013 §4 ownership grain. Takes the row's own columns so it also gates
-- INSERT (the homework row need not exist yet).
CREATE OR REPLACE FUNCTION public.teaches_subject_in_section(subj text, sec text)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."TeacherAssignment" ta
    WHERE ta."subjectId" = subj
      AND ta."sectionId" = sec
      AND ta."teacherId" = (SELECT auth.uid())::text
  );
$$;

-- Teacher owns the homework behind a child row (attachment / submission).
CREATE OR REPLACE FUNCTION public.teaches_homework(hw text)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."Homework" h
    JOIN public."TeacherAssignment" ta
      ON ta."subjectId" = h."subjectId" AND ta."sectionId" = h."sectionId"
    WHERE h.id = hw
      AND ta."teacherId" = (SELECT auth.uid())::text
  );
$$;

-- Teacher owns the homework behind a submission (for feedback / sub-attachments).
CREATE OR REPLACE FUNCTION public.teaches_submission_homework(subm text)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."HomeworkSubmission" s
    JOIN public."Homework" h ON h.id = s."homeworkId"
    JOIN public."TeacherAssignment" ta
      ON ta."subjectId" = h."subjectId" AND ta."sectionId" = h."sectionId"
    WHERE s.id = subm
      AND ta."teacherId" = (SELECT auth.uid())::text
  );
$$;

-- Homework is parent-visible: never DRAFT, and (an own-child enrollment sits in
-- the homework's section) OR (an own child already holds a submission for it) —
-- ADR-013 §10. The or-clause keeps a transferred child's submitted work (and its
-- feedback) reachable after the in-place sectionId move (ADR-010 §5). Coarse on
-- year/status (any enrollment year, any enrollment status) — the business layer
-- narrows to eligible enrollments, same posture as attendance_rls.
CREATE OR REPLACE FUNCTION public.is_homework_parent_visible(hw text)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."Homework" h
    WHERE h.id = hw
      AND h.status <> 'DRAFT'
      AND (
        EXISTS (
          SELECT 1 FROM public."Enrollment" e
          JOIN public."StudentParent" sp ON sp."studentId" = e."studentId"
          JOIN public."Parent" p ON p.id = sp."parentId"
          WHERE e."sectionId" = h."sectionId"
            AND p."userId" = (SELECT auth.uid())::text
        )
        OR EXISTS (
          SELECT 1 FROM public."HomeworkSubmission" s
          JOIN public."Enrollment" e ON e.id = s."enrollmentId"
          JOIN public."StudentParent" sp ON sp."studentId" = e."studentId"
          JOIN public."Parent" p ON p.id = sp."parentId"
          WHERE s."homeworkId" = h.id
            AND p."userId" = (SELECT auth.uid())::text
        )
      )
  );
$$;

-- The submission belongs to an own child (for sub-attachments / feedback reads).
CREATE OR REPLACE FUNCTION public.is_my_child_submission(subm text)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."HomeworkSubmission" s
    JOIN public."Enrollment" e ON e.id = s."enrollmentId"
    JOIN public."StudentParent" sp ON sp."studentId" = e."studentId"
    JOIN public."Parent" p ON p.id = sp."parentId"
    WHERE s.id = subm
      AND p."userId" = (SELECT auth.uid())::text
  );
$$;

-- ---- Homework: admin ALL; teacher own subject×section (DELETE: DRAFT only);
--      parent SELECT published/closed own-child (§10 or-clause) ----
ALTER TABLE "Homework" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "homework_admin_all" ON "Homework"
  FOR ALL TO authenticated
  USING (public.is_academic_admin()) WITH CHECK (public.is_academic_admin());
CREATE POLICY "teacher_read_homework" ON "Homework"
  FOR SELECT TO authenticated
  USING (public.teaches_subject_in_section("subjectId", "sectionId"));
CREATE POLICY "teacher_insert_homework" ON "Homework"
  FOR INSERT TO authenticated
  WITH CHECK (public.teaches_subject_in_section("subjectId", "sectionId"));
CREATE POLICY "teacher_update_homework" ON "Homework"
  FOR UPDATE TO authenticated
  USING (public.teaches_subject_in_section("subjectId", "sectionId"))
  WITH CHECK (public.teaches_subject_in_section("subjectId", "sectionId"));
CREATE POLICY "teacher_delete_draft_homework" ON "Homework"
  FOR DELETE TO authenticated
  USING (public.teaches_subject_in_section("subjectId", "sectionId") AND "status" = 'DRAFT');
CREATE POLICY "parent_read_homework" ON "Homework"
  FOR SELECT TO authenticated
  USING (public.is_homework_parent_visible("id"));

-- ---- HomeworkAttachment: mirrors Homework visibility; teacher add/remove own ----
ALTER TABLE "HomeworkAttachment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "homework_admin_all" ON "HomeworkAttachment"
  FOR ALL TO authenticated
  USING (public.is_academic_admin()) WITH CHECK (public.is_academic_admin());
CREATE POLICY "teacher_read_homework_attachment" ON "HomeworkAttachment"
  FOR SELECT TO authenticated
  USING (public.teaches_homework("homeworkId"));
CREATE POLICY "teacher_insert_homework_attachment" ON "HomeworkAttachment"
  FOR INSERT TO authenticated
  WITH CHECK (public.teaches_homework("homeworkId"));
CREATE POLICY "teacher_delete_homework_attachment" ON "HomeworkAttachment"
  FOR DELETE TO authenticated
  USING (public.teaches_homework("homeworkId"));
CREATE POLICY "parent_read_homework_attachment" ON "HomeworkAttachment"
  FOR SELECT TO authenticated
  USING (public.is_homework_parent_visible("homeworkId"));

-- ---- HomeworkSubmission: teacher READ + review-UPDATE own; parent READ +
--      INSERT + resubmit-UPDATE own child as own Parent record ----
ALTER TABLE "HomeworkSubmission" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "homework_admin_all" ON "HomeworkSubmission"
  FOR ALL TO authenticated
  USING (public.is_academic_admin()) WITH CHECK (public.is_academic_admin());
CREATE POLICY "teacher_read_submission" ON "HomeworkSubmission"
  FOR SELECT TO authenticated
  USING (public.teaches_homework("homeworkId"));
CREATE POLICY "teacher_review_submission" ON "HomeworkSubmission"
  FOR UPDATE TO authenticated
  USING (public.teaches_homework("homeworkId"))
  WITH CHECK (public.teaches_homework("homeworkId"));
CREATE POLICY "parent_read_own_submission" ON "HomeworkSubmission"
  FOR SELECT TO authenticated
  USING (public.is_my_child_enrollment("enrollmentId"));
CREATE POLICY "parent_insert_own_submission" ON "HomeworkSubmission"
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_my_child_enrollment("enrollmentId")
    AND public.is_my_parent_record("submittedByParentId")
  );
CREATE POLICY "parent_resubmit_own_submission" ON "HomeworkSubmission"
  FOR UPDATE TO authenticated
  USING (public.is_my_child_enrollment("enrollmentId"))
  WITH CHECK (
    public.is_my_child_enrollment("enrollmentId")
    AND public.is_my_parent_record("submittedByParentId")
  );

-- ---- SubmissionAttachment: append-only — no UPDATE/DELETE policy for anyone
--      but admin; parent INSERT own child's, as own Parent record ----
ALTER TABLE "SubmissionAttachment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "homework_admin_all" ON "SubmissionAttachment"
  FOR ALL TO authenticated
  USING (public.is_academic_admin()) WITH CHECK (public.is_academic_admin());
CREATE POLICY "teacher_read_submission_attachment" ON "SubmissionAttachment"
  FOR SELECT TO authenticated
  USING (public.teaches_submission_homework("submissionId"));
CREATE POLICY "parent_read_own_submission_attachment" ON "SubmissionAttachment"
  FOR SELECT TO authenticated
  USING (public.is_my_child_submission("submissionId"));
CREATE POLICY "parent_insert_own_submission_attachment" ON "SubmissionAttachment"
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_my_child_submission("submissionId")
    AND public.is_my_parent_record("uploadedByParentId")
  );

-- ---- HomeworkFeedback: immutable — no UPDATE/DELETE policy for anyone but
--      admin; teacher INSERT on own homework's submissions; parent READ own ----
ALTER TABLE "HomeworkFeedback" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "homework_admin_all" ON "HomeworkFeedback"
  FOR ALL TO authenticated
  USING (public.is_academic_admin()) WITH CHECK (public.is_academic_admin());
CREATE POLICY "teacher_read_feedback" ON "HomeworkFeedback"
  FOR SELECT TO authenticated
  USING (public.teaches_submission_homework("submissionId"));
CREATE POLICY "teacher_insert_feedback" ON "HomeworkFeedback"
  FOR INSERT TO authenticated
  WITH CHECK (public.teaches_submission_homework("submissionId"));
CREATE POLICY "parent_read_own_feedback" ON "HomeworkFeedback"
  FOR SELECT TO authenticated
  USING (public.is_my_child_submission("submissionId"));
