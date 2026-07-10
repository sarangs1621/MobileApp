-- ---------------------------------------------------------------------------
-- M7 — ReportCard (Report Cards & Academic Results, ADR-014).
--
-- Owner = Enrollment (ADR-010 §8) — never Student/Exam/Term/Year (those are SCOPE
-- attributes). A pure REPORTING layer over frozen M3–M6: it SNAPSHOTS the
-- compute-on-read (attendance %) and cohort-relative (rank) values plus its own
-- authored fields (remarks, promotion decision), and COPIES the already-immutable
-- upstream GPA for display only. Locked product decisions:
--   R1 — class teacher (ADR-015) drafts remarks + SUBMITS; OFFICE/SUPER_ADMIN
--        APPROVE/PUBLISH/REOPEN/REVOKE; subject teachers never edit.
--   R2 — rank STORED (value + rankScope cohort); own-rank/"hide rank" are APP-layer
--        (no schema flag).
--   R3 — PUBLISHED immutable; a correction is a NEW version (version++), the prior
--        PUBLISHED row → SUPERSEDED (retained). Publish/correction audit is written
--        by the SERVICE (ADR-007) — no column here.
--
-- Purely additive: creates ONE table + 4 enums + its indexes/FKs. No frozen table
-- (Enrollment/Exam/AcademicTerm/Staff) is altered — their back-relations are virtual
-- (no SQL); proven by `prisma migrate diff` (Postgres verification, this step).
-- RLS is Step 4 (a dedicated `report_card_rls` migration) — NOT written here.
-- ---------------------------------------------------------------------------

-- CreateEnum
CREATE TYPE "ReportCardKind" AS ENUM ('EXAM', 'TERM', 'ANNUAL');

-- CreateEnum
CREATE TYPE "ReportCardStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'PUBLISHED', 'SUPERSEDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "RankScope" AS ENUM ('SECTION', 'CLASS');

-- CreateEnum
CREATE TYPE "PromotionDecision" AS ENUM ('PROMOTED', 'RETAINED');

-- CreateTable
CREATE TABLE "ReportCard" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "kind" "ReportCardKind" NOT NULL,
    "examId" TEXT,
    "termId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "ReportCardStatus" NOT NULL DEFAULT 'DRAFT',
    "classTeacherRemark" TEXT,
    "principalRemark" TEXT,
    "promotionDecision" "PromotionDecision",
    "rank" INTEGER,
    "rankScope" "RankScope",
    "cohortSize" INTEGER,
    "attendancePercentage" DOUBLE PRECISION,
    "presentCount" INTEGER,
    "absentCount" INTEGER,
    "lateCount" INTEGER,
    "halfDayCount" INTEGER,
    "leaveCount" INTEGER,
    "workingDays" INTEGER,
    "gpaSnapshot" DOUBLE PRECISION,
    "cgpaSnapshot" DOUBLE PRECISION,
    "pdfPath" TEXT,
    "createdByStaffId" TEXT NOT NULL,
    "submittedByStaffId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedByStaffId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "publishedByStaffId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "reopenedByStaffId" TEXT,
    "reopenedAt" TIMESTAMP(3),
    "reopenReason" TEXT,
    "revokedByStaffId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportCard_enrollmentId_idx" ON "ReportCard"("enrollmentId");

-- CreateIndex
CREATE INDEX "ReportCard_enrollmentId_kind_idx" ON "ReportCard"("enrollmentId", "kind");

-- CreateIndex
CREATE INDEX "ReportCard_examId_idx" ON "ReportCard"("examId");

-- CreateIndex
CREATE INDEX "ReportCard_termId_idx" ON "ReportCard"("termId");

-- CreateIndex
CREATE INDEX "ReportCard_status_idx" ON "ReportCard"("status");

-- CreateIndex
CREATE INDEX "ReportCard_schoolId_idx" ON "ReportCard"("schoolId");

-- AddForeignKey
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_termId_fkey" FOREIGN KEY ("termId") REFERENCES "AcademicTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_createdByStaffId_fkey" FOREIGN KEY ("createdByStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_submittedByStaffId_fkey" FOREIGN KEY ("submittedByStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_approvedByStaffId_fkey" FOREIGN KEY ("approvedByStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_publishedByStaffId_fkey" FOREIGN KEY ("publishedByStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_reopenedByStaffId_fkey" FOREIGN KEY ("reopenedByStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_revokedByStaffId_fkey" FOREIGN KEY ("revokedByStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---- CHECK constraints (structural, single-row invariants; ADR-014) ---------

-- kind ⟺ scope: EXAM has an exam and no term; TERM has a term and no exam; ANNUAL
-- has neither (its year comes from the enrollment). Closes ADR-009's NULL-scope
-- ambiguity — every card carries a determinate scope for its kind.
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_kind_scope"
  CHECK (
    ("kind" = 'EXAM'   AND "examId" IS NOT NULL AND "termId" IS NULL) OR
    ("kind" = 'TERM'   AND "termId" IS NOT NULL AND "examId" IS NULL) OR
    ("kind" = 'ANNUAL' AND "examId" IS NULL     AND "termId" IS NULL)
  );

-- Snapshot is frozen at APPROVE (== ADR-014 §2 GENERATED): the approve stamp is
-- present iff the card has left DRAFT/SUBMITTED. Reopen clears approvedAt back to
-- NULL (SUBMITTED/APPROVED → DRAFT), so a reopened card satisfies this again.
-- pdfPath is DELIBERATELY not in this CHECK — storage (runbook-provisioned, R5)
-- must never be able to block a lifecycle transition.
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_snapshot_iff_approved"
  CHECK (("approvedAt" IS NULL) = ("status" IN ('DRAFT', 'SUBMITTED')));

-- The publish stamp is present iff the card has ever been published — the parent-
-- visibility gate can't drift from its stamp. SUPERSEDED/REVOKED were both once
-- PUBLISHED, so they keep the stamp.
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_published_stamp"
  CHECK (("publishedAt" IS NOT NULL) = ("status" IN ('PUBLISHED', 'SUPERSEDED', 'REVOKED')));

-- The revoke stamp is present iff the card is REVOKED (reason is service-required,
-- like ExamSection.unlockReason — no CHECK on the text).
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_revoked_stamp"
  CHECK (("revokedAt" IS NOT NULL) = ("status" = 'REVOKED'));

-- Numeric domains. version counts from 1 (R3). rank/cohort are 1-based and a rank
-- never exceeds its cohort. percentage is a real 0..100. GPA/CGPA are non-negative.
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_version_positive"
  CHECK ("version" >= 1);
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_rank_domain"
  CHECK (
    ("rank" IS NULL OR "rank" >= 1) AND
    ("cohortSize" IS NULL OR "cohortSize" >= 1) AND
    ("rank" IS NULL OR "cohortSize" IS NULL OR "rank" <= "cohortSize")
  );
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_percentage_domain"
  CHECK ("attendancePercentage" IS NULL OR ("attendancePercentage" >= 0 AND "attendancePercentage" <= 100));
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_gpa_domain"
  CHECK (("gpaSnapshot" IS NULL OR "gpaSnapshot" >= 0) AND ("cgpaSnapshot" IS NULL OR "cgpaSnapshot" >= 0));
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_counts_nonneg"
  CHECK (
    ("presentCount" IS NULL OR "presentCount" >= 0) AND
    ("absentCount"  IS NULL OR "absentCount"  >= 0) AND
    ("lateCount"    IS NULL OR "lateCount"    >= 0) AND
    ("halfDayCount" IS NULL OR "halfDayCount" >= 0) AND
    ("leaveCount"   IS NULL OR "leaveCount"   >= 0) AND
    ("workingDays"  IS NULL OR "workingDays"  >= 0)
  );

-- ---- Partial unique indexes (per-kind; R3 versioned publication) ------------
-- @@unique can't express WHERE, and examId/termId are nullable (NULL <> NULL in a
-- plain composite unique), so uniqueness is enforced per kind in raw SQL — the
-- exact ADR-009 mechanism, now generalized to the kind discriminator (ADR-014 §10).

-- (a) At most ONE PUBLISHED card per (enrollment, kind, scope): a parent can never
--     see two live published cards for the same report. A correction supersedes-
--     then-publishes in ONE transaction (UPDATE old→SUPERSEDED, then new→PUBLISHED),
--     so there is never momentarily two PUBLISHED rows. "One ACTIVE draft per scope"
--     is DELIBERATELY a service invariant, not structural (M6 cross-row stance).
CREATE UNIQUE INDEX "ReportCard_one_published_exam"
  ON "ReportCard"("enrollmentId", "examId")
  WHERE "kind" = 'EXAM' AND "status" = 'PUBLISHED';
CREATE UNIQUE INDEX "ReportCard_one_published_term"
  ON "ReportCard"("enrollmentId", "termId")
  WHERE "kind" = 'TERM' AND "status" = 'PUBLISHED';
CREATE UNIQUE INDEX "ReportCard_one_published_annual"
  ON "ReportCard"("enrollmentId")
  WHERE "kind" = 'ANNUAL' AND "status" = 'PUBLISHED';

-- (b) No two rows share a version within a (enrollment, kind, scope): every
--     correction is a distinct, preserved version (R3 "previous versions remain").
CREATE UNIQUE INDEX "ReportCard_version_per_scope_exam"
  ON "ReportCard"("enrollmentId", "examId", "version")
  WHERE "kind" = 'EXAM';
CREATE UNIQUE INDEX "ReportCard_version_per_scope_term"
  ON "ReportCard"("enrollmentId", "termId", "version")
  WHERE "kind" = 'TERM';
CREATE UNIQUE INDEX "ReportCard_version_per_scope_annual"
  ON "ReportCard"("enrollmentId", "version")
  WHERE "kind" = 'ANNUAL';

-- NOTE (deliberate absences):
--  * No RLS here — Step 4 (report_card_rls), mirrors M4/M5/M6 (dedicated _rls migration).
--  * No AuditLog column/table change — publish/correction audit is service-written (ADR-007).
--  * No per-subject snapshot child table — marks are already immutable upstream
--    (ADR-012 §3); the PDF holds the rendered table, gpaSnapshot the queryable
--    aggregate (ADR-014 Alternative #3).
--  * Cross-table rules (scope's year matches the enrollment's; only LOCKED marks
--    snapshot; class-teacher-of-enrollment authorship) are SERVICE invariants
--    (ADR-014 §5/§7) — a Postgres CHECK cannot reference another table.
