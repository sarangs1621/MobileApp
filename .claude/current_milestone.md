# Current Milestone

**M6 — Homework & Assignment Management** (ADR-013, extends ADR-010/011/012 + ADR-004)

## Current Step

**Step 4 (RLS) ✅ DONE — awaiting approval before Step 5 (Business layer).**
Dedicated migration `20260710010000_homework_rls` (defense-in-depth; app path =
service_role BYPASSRLS): 5 new SECURITY-DEFINER helpers
(`teaches_subject_in_section`, `teaches_homework`, `teaches_submission_homework`,
`is_homework_parent_visible` — the §10 or-clause, `is_my_child_submission`) +
reused `is_academic_admin`/`is_my_child_enrollment`/`is_my_parent_record`.
Policies: admin ALL ×5 tables · teacher own subject×section READ/INSERT/UPDATE,
DELETE **DRAFT-only** (R5-analog) · teacher review-UPDATE own submissions +
INSERT feedback · parent READ published/closed own-child (section-match OR
has-submission), INSERT/resubmit-UPDATE own child **as own Parent record**
(actor-spoof fails WITH CHECK), INSERT own sub-attachments · append-only/
immutable = no UPDATE/DELETE policies on attachments/feedback · anon none.
**Proven on the scratch cluster with stubbed uuid `auth.uid()`: 28/28 isolation
proofs PASS (10 read scenarios incl. or-clause post-transfer + sibling-parent
isolation; 18 write scenarios incl. cross-section insert denial, actor spoof,
published-delete block, admin ALL).** Drift re-check after RLS: no difference.
Storage-bucket policies for `homework-files` ride the runbook (ops-managed,
like student-documents §3b) — not this migration.

**Step 3 (Relationships) ✅ DONE.**
Every M6 edge live-verified on the scratch cluster via **rollback-safe probes
(R1–R10 + sanity, 11/11 PASS, zero probe rows persisted)**: R1 delete-rule matrix
exact (17/17 FKs — 4 Cascade content edges, 13 Restrict; **no SetNull by design**);
R2 promotion — submission stays on the old enrollment, new-year row starts empty;
R3 mid-year transfer — submission intact after in-place sectionId move AND the
(homework, enrollment) unique still blocks a duplicate (ADR-012 §12 analog); R4
cascade precision — draft delete touches only its own content tree; R5/R6 durable
actors (Staff feedback-author, Parent uploader undeletable); R7 guarded transition
primitive (winner 1 row / loser 0); R8 stale review keyed to (SUBMITTED, attempt)
strikes 0 rows after a resubmit; R9 storage ownership (2 storagePath cols, zero
*url* cols); R10 DROPPED enrollment keeps its submission history.
`DB_RELATIONSHIP_DIAGRAM.md`: implemented-M6 section added, PRD homework sketch
flagged superseded, onDelete summary updated.

**Step 2 (Database Design) ✅ DONE.**
Migration `20260710000000_homework_management`: 5 models (Homework,
HomeworkAttachment, HomeworkSubmission, SubmissionAttachment, HomeworkFeedback) +
2 enums (HomeworkStatus, SubmissionStatus). DB invariants: unique
`(homeworkId, enrollmentId)`; CHECKs — DRAFT⟺no publish stamp, CLOSED⟺close stamp
(reopen clears it), attempt≥1 ×3, firstSubmittedAt≤submittedAt, decision-state
stamps, feedback decision≠SUBMITTED. **No partial uniques needed** (no nullable key
columns — documented in the migration). Delete rules: Cascade content chain
(guarded to DRAFT at business layer), Restrict on Enrollment/Parent/Staff/
Section/Subject/Year. **Empirically proven on a scratch Postgres 17 cluster**
(initdb trust, port 5433): all 11 migrations applied in order (Supabase
`auth.uid()` stubbed), `migrate diff` DB-vs-datamodel = **no drift**, **22/22
constraint proofs PASS** (P1–P20 incl. cascade-chain, Restrict edges, resubmit
round-trip, duplicate-title acceptance). Prisma validate ✓ generate ✓ db
typecheck+lint ✓.

Step 1 produced **ADR-013**. Surfaced then: brief overrides PRD distribution-only
(#13); OA gets `homework:manage`.

**Note:** starting M6 was taken as implicit approval of M5 → M3/M4/M5 treated as
frozen (critical bug/security fixes only). Flag if that reading is wrong.

## Scope (M6)

`Homework` (Subject×Section, year-stamped; owns lifecycle + publication; ownership
derived from TeacherAssignment; content frozen at publish, dueDate extend-only),
`HomeworkAttachment` (teacher files), `HomeworkSubmission` (per **Enrollment**;
unique (homework, enrollment); Parent actor; isLate snapshot; guarded transitions),
`SubmissionAttachment` (append-only, attempt-tagged), `HomeworkFeedback` (immutable
review rounds, text-only — **no grading**). Storage via ADR-004 StoragePort +
private `homework-files` bucket. Everything audited in-tx, everything
permission+scope checked.

## Out of scope

Notifications/push, chat/discussion threads, grading/marks on homework, plagiarism,
report cards, attendance, exams, timetable — later milestones. Publish/feedback send
no notification (brief overrides PRD, M5 precedent).

## Roles

SUPER_ADMIN/OFFICE_ADMIN full management school-wide · TEACHER creates/publishes/
closes/reviews own subject×section (derived) · PARENT reads published homework for
own child + submits/resubmits for own child + reads own feedback · ACCOUNTANT none.
No student login — parents submit for children.

## Workflow (stop after each step)

1 Requirements ✅ · 2 DB ⏳ · 3 Relationships · 4 RLS · 5 Business · 6 API ·
7 Mobile (teacher create/publish/review + parent submit/resubmit/feedback — brief
overrides the read-only default) · 8 Web (dashboard, CRUD, submission table,
filters, CSV, storage upload, feedback) · 9 Testing · 10 Documentation.

## Invariants (ADR-013)

Submission keys to **Enrollment, never Student** · ownership derived from
TeacherAssignment (no ownerTeacherId) · publication = parent-visibility gate,
per-homework single grain · content frozen at publish; dueDate extend-only ·
submissions only while PUBLISHED; feedback allowed after CLOSED · unique
(homeworkId, enrollmentId) — resubmit mutates in place (attempt++), never a second
row · no resubmit after REVIEWED · isLate snapshotted at (re)submit vs IST dueDate
(no auto-close cron) · attachments/feedback append-only · section-match + year-match
+ ACTIVE-enrollment + StudentParent-link enforced in service (R1) · guarded
conditional transitions (R2) · delete only in DRAFT (R5 analog) · storage paths
server-chosen, signed after authz, `*Path` never URLs · every mutation audited
in-transaction · B3: staff/parent actor rows required (R6).

## Open items / risks

- **R1** cross-year/section integrity is service-checked, not FK.
- **R2** review-vs-resubmit concurrency → guarded (status, attempt) updates + race tests.
- **R3** parent visibility or-clause (section-match OR has-submission) — subtlest read rule.
- **R4** doubled storage-authz surface (teacher + parent files).
- **R6** B3 extends to parents (Parent.userId required to submit).
- Bucket `homework-files` provisioning = user runbook step before live uploads.
- PRD/status/feature docs still say distribution-only — corrected in Step 10.
