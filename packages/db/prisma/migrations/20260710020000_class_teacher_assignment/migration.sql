-- ---------------------------------------------------------------------------
-- M6.5 — ClassTeacherAssignment (Class Teacher Management, ADR-015).
--
-- The CURRENT holder of the class-teacher slot for a (academicYear × section).
-- A dedicated model, NOT a flag on TeacherAssignment: a teacher may teach several
-- subjects in a section, and a class teacher may teach NO subject there — so
-- class-teacher-ship is its own fact, keyed (academicYear × section) → ONE
-- teacher. YEAR-SCOPED (each year gets its own row → cross-year history is
-- preserved by construction). The row is UPDATED in place when the class teacher
-- changes (ADR-010 in-place within-year reassignment); AuditLog carries the
-- change history. `teacherId → User` (matches TeacherAssignment + RLS auth.uid()).
-- `assignedAt` = when the CURRENT teacher took the slot (re-stamped on replace).
-- `createdByStaffId → Staff` = the acting staff who assigned (B3 audit actor).
--
-- Purely additive: creates ONE new table + its indexes + its own FKs. No frozen
-- table (User/Section/AcademicYear/Staff/TeacherAssignment) is altered — the Staff
-- back-relation is virtual (no SQL); proven by `prisma migrate diff`.
-- ---------------------------------------------------------------------------

-- CreateTable
CREATE TABLE "ClassTeacherAssignment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByStaffId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassTeacherAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClassTeacherAssignment_teacherId_idx" ON "ClassTeacherAssignment"("teacherId");

-- CreateIndex
CREATE INDEX "ClassTeacherAssignment_schoolId_idx" ON "ClassTeacherAssignment"("schoolId");

-- CreateIndex  — exactly ONE class teacher per section per year
CREATE UNIQUE INDEX "ClassTeacherAssignment_academicYearId_sectionId_key" ON "ClassTeacherAssignment"("academicYearId", "sectionId");

-- AddForeignKey
ALTER TABLE "ClassTeacherAssignment" ADD CONSTRAINT "ClassTeacherAssignment_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassTeacherAssignment" ADD CONSTRAINT "ClassTeacherAssignment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassTeacherAssignment" ADD CONSTRAINT "ClassTeacherAssignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey  — audit actor (B3), Restrict preserves history
ALTER TABLE "ClassTeacherAssignment" ADD CONSTRAINT "ClassTeacherAssignment_createdByStaffId_fkey" FOREIGN KEY ("createdByStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---- Row-Level Security (defense-in-depth ONLY, ADR-002) ------------------
-- The authoritative gate is the business layer (assertCan + the isClassTeacher
-- scope predicate). App reaches this table as service_role (BYPASSRLS); these
-- policies only limit DIRECT client-JWT access. Reuses is_academic_admin()
-- (academic_rls). Admins ALL; a teacher may READ only their own class-teacher
-- rows (teacherId = auth.uid()). Parents/anon: no policy = denied.
ALTER TABLE "ClassTeacherAssignment" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "class_teacher_admin_all" ON "ClassTeacherAssignment"
  FOR ALL TO authenticated
  USING (public.is_academic_admin()) WITH CHECK (public.is_academic_admin());

CREATE POLICY "class_teacher_read_own" ON "ClassTeacherAssignment"
  FOR SELECT TO authenticated
  USING ("teacherId" = (SELECT auth.uid())::text);
