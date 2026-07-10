# Feature — Homework & Assignment Management (M6)

Feature-specific rules. References the PRD/ADR; does not duplicate them.
Spec: M6 kickoff brief · **ADR-013 (homework & assignment management)** · ADR-012
(publication + audited-reopen patterns reused) · ADR-011 (register/actor patterns) ·
ADR-010 (Enrollment is the join point) · ADR-004 (private Storage + signed URLs) ·
Dev PRD v1.3 §8.6 (**superseded in part — see Scope below**) · `docs/PERMISSIONS_MATRIX.md`.

## Scope correction (brief overrides the PRD)

Dev PRD v1.3 §8.6 / decision-log #13 scoped homework as **distribution-only** ("no
online submission/upload; digital uploads a separate paid add-on `homework-uploads`").
The **M6 kickoff brief reverses this**: submissions, submission attachments, parent
submit/resubmit, teacher review, and feedback are all **core M6 scope** — no feature
flag (ADR-013 §Alternatives). As with M5's publish-notify, the brief wins. The PRD
docs and the planned permission rows are corrected here (Step 10). **No Student login
exists — the submitting actor is always a Parent.**

## Entities & ownership (ADR-013)

Submissions key to **`Enrollment`, never `Student`** (ADR-010 §8) — history survives
promotion by construction. Homework is authored per section (it **is** the register —
no fan-out entity). Five entities:

- **`Homework`** — the assignment: `(school, academicYear, Subject × Section)`,
  year-stamped from the ACTIVE year at creation; **owns the `DRAFT → PUBLISHED →
  CLOSED` lifecycle + publication** (parent visibility). No `ownerTeacherId` —
  ownership derives from `TeacherAssignment`. Audit actors `createdBy/publishedBy/
  closedBy/reopenedBy` → Staff. Content freezes at publish; `dueDate` extend-only.
- **`HomeworkAttachment`** — teacher files (metadata; bytes in Storage). Immutable;
  add/remove **DRAFT-only**. Cascade from Homework.
- **`HomeworkSubmission`** — per **Enrollment**; `@@unique(homeworkId, enrollmentId)`
  (one row per child per assignment — the duplicate race is a DB error). Parent
  actor (`submittedByParentId`). `SUBMITTED → RETURNED → REVIEWED`; resubmit mutates
  **in place** (attempt++). `isLate` snapshotted at (re)submit vs `dueDate` (IST).
- **`SubmissionAttachment`** — parent files, **append-only, tagged by `attempt`** (a
  resubmit never deletes prior attempts' files — dispute answerability).
- **`HomeworkFeedback`** — immutable teacher review rounds; `decision` (RETURNED/
  REVIEWED) + `body` (**text only — no grading**, out of scope), pinned to `attempt`.

## Invariants (DB + business, both layers)

- **Single grain:** publication = parent visibility, per `Homework` (no separate
  publish axis). PUBLISH requires `dueDate ≥ today` (IST); publishing an already-
  overdue assignment is rejected. Submissions accepted **only** while PUBLISHED;
  review/feedback stay allowed after CLOSE.
- **Lifecycle is guarded** `DRAFT → PUBLISHED → CLOSED` + one audited backward
  transition `reopen` (CLOSED → PUBLISHED, requires a reason, clears the close
  stamp — the M5 unlock analog). All transitions are `updateMany WHERE status=<from>`
  → `Conflict` on a lost race, audited in-transaction. **No auto-close cron** —
  lateness is a snapshot, close is explicit.
- **Content freezes at publish; only `dueDate` moves** (extend-only, never below
  today or the current value). CLOSED = no edits. Delete is **business-guarded to
  DRAFT** (R5 analog); a DRAFT structurally has no submissions, so the Cascade only
  ever wipes teacher draft content.
- **§7 cross-table submission invariants** (service-enforced — the DB can't express
  them): section match, year match (`enrollment.academicYearId === homework.
  academicYearId` — the cross-year guarantee), ACTIVE enrollment, StudentParent
  own-child link, homework PUBLISHED, tenant consistency. Empty submission (no note,
  no files) rejected.
- **Resubmit / review races** settle via guarded `(status, attempt)` updates (R2):
  a review runs `WHERE status='SUBMITTED' AND attempt=<seen>`, a resubmit
  `WHERE attempt=<seen> AND status IN('SUBMITTED','RETURNED')` — a lost race is a
  `Conflict`, never a silent overwrite. **No resubmit after REVIEWED** (terminal).
- **First submit** may hit the `@@unique` → the aborted tx rolls back cleanly and is
  mapped to `Conflict` ("resubmit instead"), never a second row.
- **Actors are a `Staff` row** (teachers) / **`Parent` row** (submitters) — B3
  extended to parents (R6); a missing actor row is a clean `ValidationError`, not a
  500. Every mutation writes `AuditLog` in the same transaction.

## Parent visibility — the §10 or-clause (R3, the subtlest rule)

A parent sees a homework that is **PUBLISHED/CLOSED** AND either their child holds an
**ACTIVE enrollment in its section** (section-match) **OR** their child already has a
**submission** for it (has-submission). The has-submission branch keeps a **mid-year-
transferred** child's old-section homework + feedback reachable (`Enrollment.sectionId`
mutates in place, ADR-010 §5) — they can *see* it but not *submit* into it (new
submissions still require the §7 section match). DRAFT is invisible to parents.

## Authorization (permission + ROW scope, business layer)

- Permissions (ADR-013 §11): `homework:manage` (create/edit/publish/close/reopen/
  delete + teacher attachments), `homework:read`, `submission:submit` (create/
  resubmit + parent attachments — **parent-only**), `submission:review` (return/
  accept + feedback), `submission:read`.
- SUPER_ADMIN + OFFICE_ADMIN: full management + review, school-wide. TEACHER:
  manage/read/review for **own subject×section** (derived via `TeacherAssignment`;
  exact match — homework is always subject-bound). PARENT: read own child's
  PUBLISHED/CLOSED (§10) + submit/resubmit own child + read own submissions/feedback.
  ACCOUNTANT / anon: none.
- **Deviations from the PRD-planned matrix** (decided in ADR-013 §11): OFFICE_ADMIN
  gets `homework:manage` (brief's "Admin ALL" + M2–M5 consistency); `submission:
  submit` is parent-only (admins don't fabricate a child's submission); teacher scope
  is uniformly `ownSubject×Section` (no division-only variant — always subject-bound).
- RLS (defense-in-depth only — Prisma bypasses): admin ALL; teacher own subject×
  section; parent own-child (published homework via the §10 or-clause, own-child
  submissions/attachments/feedback, INSERT/resubmit scoped to own child as own Parent
  record); anon none. Proven **28/28** read+write isolation on local Postgres (Step 4).

## Storage (ADR-004, one new private bucket)

Reuses the M3 `StoragePort` machinery unchanged. One new private bucket
**`homework-files`**. Server-chosen paths (a client never picks a path):
- teacher: `{schoolId}/homework/{homeworkId}/{uuid}-{name}`
- parent: `{schoolId}/submission/{homeworkId}/{enrollmentId}/{attempt}/{uuid}-{name}`
  — **deviates from ADR-013 §9's `{submissionId}` sketch** so submit is a single
  atomic transaction (submission row + attachment metadata persist together); same
  private / server-chosen / attempt-tagged properties, no behavioural change.

Upload URLs minted only after the full write-authz chain (teacher owns the DRAFT;
parent passes every §7 invariant); MIME/size validated at mint (allow-list +
25 MB / 10 files, `HOMEWORK_ATTACHMENT`). Download URLs (300 s TTL) minted only after
read-authz — submission files are visible to admins, the owning teacher, and the
linked parents, **never another parent**. Metadata delete never deletes bytes (M3
posture). **Bucket provisioning is a user runbook step** — see
`RUNBOOK_SUPABASE_SETUP.md §3c`.

## API

Two thin routers on `protectedProcedure`: `homework.*` (create/update/publish/close/
reopen/delete/get/list/targets + teacher attachment mint/add/list/download/remove)
and `submission.*` (submit/resubmit, listByHomework/get/listByEnrollment/childContext,
parent attachment mint/list/download, review/feedback). Signed-URL mints ride
`storageProcedure` (host-injected `StoragePort`). Two composed reads back the UIs:
`homework.targets` (teacher assignable subject×section, name-enriched) and
`submission.childContext` (parent per-child enrollment + existing submission). See
`API_INVENTORY.md`.

## UI

- **Web (`/homework`, gated on `homework:read`):** role-aware. Admin/teacher —
  dashboard (year picker / own feed + create), detail (edit + lifecycle, **teacher
  file upload/download** DRAFT-only, submission review table with return/accept +
  feedback history + CSV export). Parent — feed + per-child **submit/resubmit with
  file upload** + note, feedback. Uploads reuse the M3 `mint → uploadToSignedUrl →
  persist` flow.
- **Mobile:** teacher — own homework list + create + publish/close/reopen/delete +
  review queue. Parent — children's feed + submit/resubmit (note) + feedback.
  **Mobile is text-loop + attachment *download*; file *upload* is web-only** (no
  native picker dep — the loop is functional text-first, files ride the web app).

## Tests (Step 9)

Business rules with mocked repositories (`homework.services.test.ts`, 59) — lifecycle
guards, §3 edit-by-state, §7 submit invariants, the **§10 parent or-clause (R3)** incl.
transfer, resubmit/review guards, and storage mint authz **both upload and download**
(R4 — another parent cannot pull a submission file) + **R6** clean missing-actor error.
`homework.concurrency.test.ts` (4) — the real **R2 review-vs-resubmit `Promise.all`
race**. Transport gates + Zod in `packages/api/.../homework.test.ts` (8) and
`@repo/validation/homework.test.ts` (14). Storage covered to the **M3 bar** (mock
`StoragePort`); the real byte upload→download round-trip is a provisioning-runbook
verification (`RUNBOOK_SUPABASE_SETUP.md §3c`). No defects surfaced.

## Known limitations / deferred

- **OFFICE_ADMIN can't create homework from scratch on web** — the create picker is
  teacher-scoped (`homework.targets` is empty for admins, who hold no
  `TeacherAssignment`). The service supports admin create; only the all-subjects×
  all-sections picker is unbuilt (rare need — admins manage/review/upload to existing
  homework). Derived ownership makes the teacher the natural author.
- **No un-review / un-close-to-DRAFT correction** — a mistaken REVIEWED has no
  in-module correction path in M6 (extension point: an audited-correction analog).
- **Publish/feedback send no notification** (brief overrides PRD, M5 precedent).
- **Storage byte-cleanup deferred** (append-only history keeps old-attempt files) —
  same bucket-hygiene posture as M3.
- **Mobile file upload** deferred to web (see UI).
