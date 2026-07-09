-- CreateEnum
CREATE TYPE "HomeworkStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('SUBMITTED', 'RETURNED', 'REVIEWED');

-- CreateTable
CREATE TABLE "Homework" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" DATE NOT NULL,
    "status" "HomeworkStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByStaffId" TEXT NOT NULL,
    "publishedByStaffId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "closedByStaffId" TEXT,
    "closedAt" TIMESTAMP(3),
    "reopenedByStaffId" TEXT,
    "reopenedAt" TIMESTAMP(3),
    "reopenReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Homework_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeworkAttachment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "homeworkId" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "checksum" TEXT,
    "uploadedByStaffId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeworkAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeworkSubmission" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "homeworkId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "submittedByParentId" TEXT NOT NULL,
    "note" TEXT,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "firstSubmittedAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL,
    "reviewedByStaffId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeworkSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionAttachment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "checksum" TEXT,
    "uploadedByParentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeworkFeedback" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "authorStaffId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "decision" "SubmissionStatus" NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeworkFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Homework_sectionId_status_dueDate_idx" ON "Homework"("sectionId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "Homework_academicYearId_sectionId_idx" ON "Homework"("academicYearId", "sectionId");

-- CreateIndex
CREATE INDEX "Homework_subjectId_idx" ON "Homework"("subjectId");

-- CreateIndex
CREATE INDEX "Homework_schoolId_idx" ON "Homework"("schoolId");

-- CreateIndex
CREATE INDEX "HomeworkAttachment_homeworkId_idx" ON "HomeworkAttachment"("homeworkId");

-- CreateIndex
CREATE INDEX "HomeworkAttachment_schoolId_idx" ON "HomeworkAttachment"("schoolId");

-- CreateIndex
CREATE INDEX "HomeworkSubmission_enrollmentId_idx" ON "HomeworkSubmission"("enrollmentId");

-- CreateIndex
CREATE INDEX "HomeworkSubmission_homeworkId_status_idx" ON "HomeworkSubmission"("homeworkId", "status");

-- CreateIndex
CREATE INDEX "HomeworkSubmission_schoolId_idx" ON "HomeworkSubmission"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "HomeworkSubmission_homeworkId_enrollmentId_key" ON "HomeworkSubmission"("homeworkId", "enrollmentId");

-- CreateIndex
CREATE INDEX "SubmissionAttachment_submissionId_attempt_idx" ON "SubmissionAttachment"("submissionId", "attempt");

-- CreateIndex
CREATE INDEX "SubmissionAttachment_schoolId_idx" ON "SubmissionAttachment"("schoolId");

-- CreateIndex
CREATE INDEX "HomeworkFeedback_submissionId_idx" ON "HomeworkFeedback"("submissionId");

-- CreateIndex
CREATE INDEX "HomeworkFeedback_schoolId_idx" ON "HomeworkFeedback"("schoolId");

-- AddForeignKey
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_createdByStaffId_fkey" FOREIGN KEY ("createdByStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_publishedByStaffId_fkey" FOREIGN KEY ("publishedByStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_closedByStaffId_fkey" FOREIGN KEY ("closedByStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_reopenedByStaffId_fkey" FOREIGN KEY ("reopenedByStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkAttachment" ADD CONSTRAINT "HomeworkAttachment_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "Homework"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkAttachment" ADD CONSTRAINT "HomeworkAttachment_uploadedByStaffId_fkey" FOREIGN KEY ("uploadedByStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkSubmission" ADD CONSTRAINT "HomeworkSubmission_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "Homework"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkSubmission" ADD CONSTRAINT "HomeworkSubmission_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkSubmission" ADD CONSTRAINT "HomeworkSubmission_submittedByParentId_fkey" FOREIGN KEY ("submittedByParentId") REFERENCES "Parent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkSubmission" ADD CONSTRAINT "HomeworkSubmission_reviewedByStaffId_fkey" FOREIGN KEY ("reviewedByStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionAttachment" ADD CONSTRAINT "SubmissionAttachment_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "HomeworkSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionAttachment" ADD CONSTRAINT "SubmissionAttachment_uploadedByParentId_fkey" FOREIGN KEY ("uploadedByParentId") REFERENCES "Parent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkFeedback" ADD CONSTRAINT "HomeworkFeedback_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "HomeworkSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkFeedback" ADD CONSTRAINT "HomeworkFeedback_authorStaffId_fkey" FOREIGN KEY ("authorStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ============================================================================
-- Raw-SQL invariants (not expressible in the Prisma DSL) — ADR-013.
-- ============================================================================

-- Homework: the parent-visibility gate cannot drift from its stamp. DRAFT rows
-- carry no publish stamp; PUBLISHED/CLOSED rows always carry one (publish is
-- forward-only from DRAFT — ADR-013 §2).
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_draft_iff_unpublished"
  CHECK (("status" = 'DRAFT') = ("publishedAt" IS NULL));

-- Homework: CLOSED rows always carry a close stamp, and ONLY closed rows do —
-- the audited reopen clears closedAt/closedByStaffId (reopen* fields + AuditLog
-- keep the history; ADR-013 §2).
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_closed_iff_stamped"
  CHECK (("status" = 'CLOSED') = ("closedAt" IS NOT NULL));

-- Submission: attempts count from 1; the first-submission stamp never postdates
-- the latest (re)submission.
ALTER TABLE "HomeworkSubmission" ADD CONSTRAINT "HomeworkSubmission_attempt_positive"
  CHECK ("attempt" >= 1);
ALTER TABLE "HomeworkSubmission" ADD CONSTRAINT "HomeworkSubmission_first_before_latest"
  CHECK ("firstSubmittedAt" <= "submittedAt");

-- Submission: a decision state (RETURNED/REVIEWED) always carries its decision
-- stamps. (SUBMITTED may also carry them — a post-RETURNED resubmit keeps the
-- last decision's stamps; ADR-013 §6.)
ALTER TABLE "HomeworkSubmission" ADD CONSTRAINT "HomeworkSubmission_decision_stamped"
  CHECK ("status" = 'SUBMITTED' OR ("reviewedByStaffId" IS NOT NULL AND "reviewedAt" IS NOT NULL));

-- Attachments/feedback: attempt tags count from 1 (append-only history rounds).
ALTER TABLE "SubmissionAttachment" ADD CONSTRAINT "SubmissionAttachment_attempt_positive"
  CHECK ("attempt" >= 1);
ALTER TABLE "HomeworkFeedback" ADD CONSTRAINT "HomeworkFeedback_attempt_positive"
  CHECK ("attempt" >= 1);

-- Feedback: a review round records an OUTCOME — RETURNED or REVIEWED, never the
-- waiting state (SubmissionStatus is reused as the decision domain; ADR-013 §8).
ALTER TABLE "HomeworkFeedback" ADD CONSTRAINT "HomeworkFeedback_decision_is_outcome"
  CHECK ("decision" <> 'SUBMITTED');

-- NOTE (deliberate absences):
--  * No unique on Homework(section, subject, title, dueDate) — duplicate titles
--    are legal; the assignment has no natural key (ADR-013 §1).
--  * No PARTIAL unique indexes needed in M6 — the one uniqueness rule
--    (homeworkId, enrollmentId) has no nullable column, so a plain composite
--    unique is exact (contrast ADR-009/M4 where NULLs forced partial indexes).
--  * Cross-table rules (section/year match, ACTIVE enrollment, StudentParent
--    link, PUBLISHED-only submission) are SERVICE invariants (ADR-013 §7) — a
--    Postgres CHECK cannot reference another table.
