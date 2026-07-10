# Current Milestone

**M6.5 — Class Teacher Management** (ADR-015) — ✅ **Steps 1–10 COMPLETE, awaiting approval.**
Dedicated `ClassTeacherAssignment` (year×section → one teacher; NOT a `TeacherAssignment`
flag; in-place replace, never a 2nd row — ADR-010 §5). Additive: `TeacherAssignment` frozen,
`migrate diff` = CREATE TABLE only. Surface: business + `classTeacher` router + web management
+ mobile read-only. 32 tests (21 business + 11 API), RLS isolation + DB invariants proven,
gate 35/35. Full detail: `docs/milestones/M6.5.md`, `docs/status/ClassTeacher.md`. Introduced
to supply the report-card (M7/ADR-014) dependency — **not** the start of report cards.

---

**M6 — Homework & Assignment Management** (ADR-013, extends ADR-010/011/012 + ADR-004)

## Current Step

**Step 10 (Documentation) ✅ DONE — M6 COMPLETE (all 10 steps), awaiting milestone approval.**
Synced: `features/homework.md` (full rewrite — PRD distribution-only scope corrected),
`status/Homework.md`, `PERMISSIONS_MATRIX.md` (shipped §11 rows; leave/comms relabelled
planned), `API_INVENTORY.md` (25 procedures; stale planned homework rows replaced),
`architecture_index.md` (ADR-013 entry), `RUNBOOK_SUPABASE_SETUP.md §3c` (bucket +
the upload→download round-trip verification checklist), **ADR-013 status →
Accepted/implemented** + §9 path-deviation note, **created `docs/milestones/M6.md`**,
`project_memory.md` (current step/status/next-task), `USER_FLOWS.md` F8 (bidirectional),
`REVIEW_FINDINGS.md` A3 (resolved in favour of submissions). SCREEN_INVENTORY left
as-is (un-reconciled planning doc — M5 Step-10 precedent). No new ADR, no code change.

**Step 9 (Testing) ✅ DONE — awaiting approval before Step 10 (Documentation).**
**85 new homework tests, full gate green (typecheck + lint + test, 35/35 tasks).**
- `homework.services.test.ts` (59) — create/ownership/validity, lifecycle guards
  (publish dueDate≥today, non-DRAFT/close/reopen conflicts, lost-race→Conflict+no-audit),
  edit-by-state (§3 frozen/extend-only), delete DRAFT-only, **parent §10 or-clause
  (R3)** incl. transfer via has-submission + DRAFT hidden, submit §7 invariants
  (wrong-section/year/inactive/not-own-child/not-published/empty/duplicate/isLate),
  resubmit (REVIEWED→Conflict, no-submission→NotFound, lost-race), read scope,
  review (guarded, body required, non-SUBMITTED→Conflict, lost-race→no feedback,
  parent-denied), **storage mint authz** (teacher DRAFT-only + path pattern, parent
  keyed path, disallowed MIME, not-own-child → storage untouched).
- `homework.concurrency.test.ts` (4) — **R2 review-vs-resubmit race** + double-resubmit + concurrent publish + concurrent close (real Promise.all)
  (stateful guarded `(status,attempt)` repo, Promise.all → exactly one wins).
- `homework.test.ts` (api, 8) — route protection, permission gates (parent/accountant),
  Zod BAD_REQUEST, storageProcedure PRECONDITION_FAILED.
- `homework.test.ts` (validation, 14) — schema edges incl. dueDate transform, attachments
  default/max/size, decision enum, positive attempt.
- Storage tested to the **M3 bar** (mock StoragePort: authz gate → storage untouched,
  server-chosen path, adapter called) — **both upload AND download** sides:
  **R4/§10 download authz** proven (another parent CANNOT pull a submission file →
  Forbidden + adapter untouched; parent denied a DRAFT homework file; owner/linked-parent
  succeed). **R6** clean-error: teacher with no Staff row / submitter with no Parent row
  → ValidationError (not a 500).

**⚠ Locked upload criterion — PARTIALLY met, honestly:** the mint→PUT→persist authz +
wiring is proven (mock StoragePort, M3 bar); the **real byte upload→download round-trip
against a provisioned `homework-files` bucket was NOT run** — no bucket exists in any
automated env (identical constraint to M3, whose storage also has no byte-level test).
The round-trip stays a **manual runbook verification** the user performs once the bucket
is provisioned (ADR-013 §9). Not claimed as automated-passing. Carries to Step 10 as a
provisioning/verification note.

**Step 8 (Web) ✅ DONE — awaiting approval before Step 9 (Testing).**
Next.js console under `apps/web/app/(app)/homework/` (mirrors the M5 exam console;
gated on HOMEWORK_READ so admin/teacher/parent all reach it). Pages: `layout`
(shell + access gate), `page` (role-aware list — admin year-picker, teacher own +
"New homework" create modal via `homework.targets`, parent §10 feed), `[homeworkId]`
(role-aware detail). `components/homework/ui.tsx`: status labels + `fileError`
client pre-check + `pushToSignedUrl` (homework-files bucket). Dashboard gains a
Homework link (HOMEWORK_READ).
**LOCKED criterion MET — real file upload+download on both sides**, reusing the
proven M3 documents-panel flow (`mint uploadUrl → uploadToSignedUrl(path,token,file)
→ persist metadata`): teacher attachments (add/remove DRAFT-only, download any state)
via `attachmentUploadUrl/attachmentAdd/attachmentRemove/attachmentDownloadUrl`;
parent submit/resubmit stages files (`submission.attachmentUploadUrl` per next
attempt) + note, sent atomically via `submit`/`resubmit`, downloads via
`submission.attachmentDownloadUrl`. Teacher/admin: edit + lifecycle
(publish/close/reopen-with-reason/delete) + submission review table (return/accept +
feedback history, CSV export). Full gate green: typecheck + lint + test, 35/35.
**Two deferrals flagged:** (1) admin create-from-scratch picker — `homework.targets`
is teacher-scoped (empty for admins), so web create is teacher-driven; the service
supports admin create, only the all-subjects×all-sections picker is unbuilt (rare
need). (2) Live upload verification needs the `homework-files` bucket provisioned
(user runbook, ADR-013 §9) — code path is byte-identical to the shipped M3 upload.

**⚠ Step-9 acceptance criterion (locked):** the file path has NEVER been executed at
runtime (no bucket in the gate env). Step 9 MUST include a real upload→download
round-trip — one teacher attachment AND one parent submission attachment against a
provisioned `homework-files` bucket — not just service unit tests. Otherwise M6 ships
with the file path unrun on every surface.
**⚠ Step-10 known-limitation (locked):** OFFICE_ADMIN holds `homework:manage` but the
web create picker is teacher-scoped (`homework.targets` empty for admins) → an admin
cannot create homework from scratch on web (can manage/review/upload to existing).
Service supports it; only the all-subjects×all-sections picker is unbuilt. Record in
Step-10 known-limitations.

**Step 7 (Mobile) ✅ DONE — awaiting approval before Step 8 (Web).**
Expo/expo-router screens under `apps/mobile/src/app/(app)/homework/` (mirrors the M5
exam screen pattern; brief overrides read-only default → teacher create/publish/
review + parent submit/resubmit/feedback). Screens: `index` (role-aware list —
teacher own + "New", parent §10 feed), `new` (teacher create: target picker + title/
desc/dueDate), `[homeworkId]` (role-aware detail — teacher publish/close/reopen/
delete + review link; parent per-child submit/resubmit via `childContext`, feedback
link), `[homeworkId]/submissions` (teacher review queue, student-labelled via section
roster), `submission/[submissionId]` (note + files + feedback history + teacher
review form RETURNED/REVIEWED). Shared `components/homework-ui.tsx` (status labels +
`AttachmentList` = tap-to-open signed URL via expo-linking). Home screen gains a
Homework section (HOMEWORK_MANAGE / parent HOMEWORK_READ). **Two composed read
endpoints added** (backend, name-enriched — the markable/registers idiom):
`homework.targets` (teacher assignable subject×section) and `submission.childContext`
(parent per-child enrollment + existing submission for a homework, transfer-safe).
**Scope decision — mobile is text-loop + attachment DOWNLOAD only; file UPLOAD is
deferred to Web (Step 8):** no file-picker dep on mobile, and the core loop is fully
functional text-first (note-only submissions + text feedback are valid; homework/
feedback carry no required files). Parent submit requires a non-empty note on mobile;
files ride the web app. **Flag if mobile upload is wanted in-scope.** Full gate green:
typecheck + lint + test, 35/35.

**⚠ Step-8 acceptance criterion (locked, not optional):** Web MUST deliver working
teacher **and** parent file **upload + download** (mint→PUT→persist metadata). This is
the ONLY surface where M6's core "attachments are core scope" requirement is met, since
mobile is download-only — Web upload cannot itself be deferred or M6 ships with no
working file-submission path on any surface.

**Step 6 (API) ✅ DONE — awaiting approval before Step 7 (Mobile).**
Two tRPC routers in `@repo/api` (thin transport, M5 exam pattern): **`homework`**
(create/update/publish/close/reopen/delete/get/list + teacher attachment
upload-url/add/list/download-url/remove) and **`submission`** (parent submit/resubmit,
listByHomework/get/listByEnrollment reads, parent attachment upload-url/list/
download-url, teacher review + feedback). Signed-URL mints ride `storageProcedure`
(ADR-004 host-injected StoragePort); everything else `protectedProcedure`. Both
mounted in `root.ts` (`homework`, `submission`). **Validation** (`@repo/validation`):
homework/submission Zod schemas — dueDate via `istDateSchema`, attachment meta
(fileName/storagePath/mimeType/sizeBytes/checksum), review decision enum; state
machine + §7 invariants stay in the services (not duplicated). Shared
`MintedUploadUrl` reused from people/document-storage (avoids a barrel name clash +
the TS2742 portability trap). Core authz grant-snapshot test updated for the 5 new
permissions. **Full monorepo gate green: typecheck + lint + test, 35/35 tasks.**
Homework API transport tests deferred to **Step 9** (exam precedent).

**Step 5 (Business layer) ✅ DONE — awaiting approval before Step 6 (API).**
Homework use-case layer built in `@repo/business` mirroring the M5 exam pattern
(derived ownership, guarded transitions, audit-in-tx, StoragePort mint). **5 new
repositories** (`homework`, `homeworkAttachments`, `homeworkSubmissions`,
`submissionAttachments`, `homeworkFeedback`) wired into `Repositories`. **5
permissions** (`homework:manage/read`, `submission:submit/review/read`) + role map
(§11: OA/SA/TEACHER manage+review; PARENT read+submit; ACCOUNTANT none). **DTOs**
for all 5 entities in `@repo/types`; **STORAGE_BUCKETS.HOMEWORK_FILES** +
`HOMEWORK_ATTACHMENT` limits (25 MB, 10 files, doc/image MIME) in `@repo/constants`.
Services (`services/homework/`): lifecycle (create/update/publish/close/reopen/
delete — DRAFT-only delete, publish-requires-dueDate≥today IST, dueDate extend-only,
audited reopen); teacher attachment mint/add/list/download/remove (DRAFT-guarded);
parent submit/resubmit (atomic submission+attachments, §7 invariants, isLate
snapshot vs IST dueDate, unique→Conflict, guarded `(status,attempt)` resubmit);
parent attachment mint/download (never other parents); review (RETURNED/REVIEWED +
immutable feedback + guarded transition, allowed after CLOSE); role-scoped reads
incl. the **§10 parent or-clause** (section-match OR has-submission, PUBLISHED/CLOSED
only — survives mid-year transfer). **Deviation flagged:** parent upload path keyed
by `homeworkId/enrollmentId/attempt` (not `submissionId` as §9 sketches) to enable
single-transaction submit — same private/server-chosen/attempt-tagged properties;
correct in Step 10 doc. **Testing deferred to Step 9** per the milestone workflow
(exam precedent: services in Step 5, tests in Step 9). Gate: typecheck + lint green
across constants/types/db/business + api/web consumers.

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

1 Requirements ✅ · 2 DB ✅ · 3 Relationships ✅ · 4 RLS ✅ · 5 Business ✅ · 6 API ✅ ·
7 Mobile ✅ (teacher create/publish/review + parent submit/resubmit/feedback — brief
overrides the read-only default; mobile = text loop + download, upload deferred to web) ·
8 Web ✅ (console + full teacher/parent file upload+download — locked criterion met) ·
9 Testing ✅ (83 homework tests incl. R4 download-authz + R6 clean-error; storage to M3 bar; real byte round-trip stays runbook-gated) ·
10 Documentation ✅ (all shipped-surface docs synced; ADR-013 accepted; M6.md created; runbook §3c round-trip checklist added; OFFICE_ADMIN limitation recorded)

**═══ M6 COMPLETE — all 10 steps shipped, awaiting milestone approval to freeze. ═══** (dashboard, CRUD, submission table,
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
