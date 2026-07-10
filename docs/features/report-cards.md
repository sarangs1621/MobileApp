# Report Cards & Academic Results (M7)

**Status:** Implemented (M7 Steps 1–10). **Spec:** `docs/architecture/ADR-014-report-card-snapshot-ownership.md` (extends ADR-009); class-teacher authority from `docs/architecture/ADR-015-class-teacher-assignment.md`. **Milestone:** `docs/milestones/M7.md`.

The **academic reporting layer** over the frozen M3–M6 modules. A `ReportCard` **consumes** enrollment, attendance, marks, and GPA; it **owns** only report-specific fields (remarks, promotion decision) and **snapshots** the values that are otherwise mutable or cohort-relative. It never duplicates business ownership or writes back to marks/attendance/enrollment.

## Model

- **Owner = `Enrollment`** (ADR-010 §8) — never Student/Exam/Term/Year, which are *scope*. History is promotion-proof by construction (the card keys to the immutable enrollment row).
- **`kind`** discriminator: `EXAM` (carries `examId`), `TERM` (carries `termId`), `ANNUAL` (neither — the year is the enrollment's). The kind⟺scope pairing is a DB CHECK; per-kind partial-unique indexes enforce **one live PUBLISHED per `(enrollment, kind, scope)`** and **one row per `(scope, version)`**.
- **Snapshot fields** (frozen at APPROVE): `attendancePercentage` + present/absent/late/halfDay/leave/workingDays counts, `rank` + `rankScope` + `cohortSize`, `gpaSnapshot` (`cgpaSnapshot` reserved, currently null). All null in DRAFT/SUBMITTED.
- **Authored fields** (card is the system of record): `classTeacherRemark`, `principalRemark`, `promotionDecision`.
- **`pdfPath`** — a private-bucket path (ADR-004), signed on read; deliberately **not** lifecycle-gating (PDF rendering is deferred, so storage can never block a transition).
- All lifecycle actors are `Staff` rows (B3), `onDelete: Restrict` — a card is never orphaned or cascade-deleted.

## Lifecycle

```
DRAFT ──submit──▶ SUBMITTED ──approve──▶ APPROVED ──publish──▶ PUBLISHED
  ▲                   │                      │
  └──── reopen ◀───────┴──────────────────────┘        (clears stamps + snapshot)
  PUBLISHED ──correct──▶ (new DRAFT vN+1) … ──publish──▶ supersedes the prior → SUPERSEDED
  PUBLISHED ──revoke──▶ REVOKED
```

Every transition is a **guarded conditional update** (applies only from the expected status), so a lost race is a clean no-op, never a double-transition.

- **DRAFT** — the class teacher authors `classTeacherRemark`; admins may edit `principalRemark`/`promotionDecision`. Not parent-visible.
- **SUBMITTED** — the class teacher submitted for review. Approving a **DRAFT is rejected** (skip-state), so every card passes the review gate.
- **APPROVED** (≡ ADR-014's "GENERATED") — admin approval **freezes the snapshot** and stamps `approvedAt`. Not parent-visible.
- **PUBLISHED** — released; parent-visible; the snapshot is immutable.
- **SUPERSEDED** — a correction's replacement was published; retained for history.
- **REVOKED** — a published card pulled from parents (no replacement); reason required.

## Snapshot behaviour

The snapshot is assembled **once, at APPROVE**, from the canonical services — never re-derived:

- **Attendance %** — `attendanceSummary` over the card's window (TERM → the term; ANNUAL/EXAM → the year). Compute-on-read (ADR-011), so it **must** be frozen — a later `AttendanceCorrection` cannot change a published number.
- **GPA** — `gpaForEnrollment` from `Mark` snapshots (already immutable at LOCK, ADR-012). Copied for display/query.
- **Rank** — cohort-relative over the section's enrollments this year, by GPA (competition ranking; ties share a rank). **All-or-nothing:** with no computable GPA, `rank`/`rankScope`/`cohortSize` are **all null** — never a partial rank. `rankScope` is `SECTION` (CLASS is the reserved alternative). A future "hide rank" school setting is app-layer — there is no schema flag.

After APPROVE, editing marks/attendance/GPA upstream never changes an existing card (it holds frozen columns); a reopen clears the snapshot so a re-approve recomputes.

## Correction / versioning

Published cards are **immutable**. A fix is a **new version** (ADR-014 §4, option B):

1. `correct` on a PUBLISHED card spawns a new **DRAFT `version+1`** for the same scope, copying the authored fields. The old card stays PUBLISHED. A second concurrent correction is refused (the one-active-draft-per-scope service invariant).
2. The new version runs the normal DRAFT→…→APPROVED chain.
3. `publish` on the new version **supersedes-then-publishes in one transaction** — the prior PUBLISHED row → SUPERSEDED, the new one → PUBLISHED — so there is never momentarily two live published cards (the partial-unique index also guards this). Every publish and supersede is written to `AuditLog`.

## Class-teacher workflow

The **class teacher** of a section (M6.5 `ClassTeacherAssignment` — *not* a `TeacherAssignment` flag) authors the report-card remark. The gate is the shared `assertClassTeacherOfEnrollment` scope: a subject teacher of the same section is refused. They may `draftRemark` and `submit` while the card is **DRAFT**; after SUBMITTED it is read-only to them. On web this is the `/report-cards` console (section picker constrained to their class-teacher sections) + the detail page.

## Admin workflow

Office/Principal authority (`OFFICE_ADMIN`/`SUPER_ADMIN`, "Principal" is not a role) drives generation and release: `generate` → (class-teacher review) → `approve` (freezes snapshot) → `publish`; plus `edit` (pre-publish), `reopen`, `revoke`, and `correct`. Web: the `/report-cards` console (year/section/kind/status filters, Generate) + `/report-cards/[id]` (snapshot, version history, status-gated actions).

## Parent visibility

Parents see a card **iff** it is PUBLISHED for their own child's enrollment (own-child link + status gate) — never DRAFT/SUBMITTED/APPROVED, never SUPERSEDED/REVOKED. They read the structured snapshot (attendance, GPA, rank, promotion, remarks) — no PDF is required. Mobile: `report-cards/children` → `report-cards/[studentId]` (current-year cards). Web: the parent branch of `/report-cards`.

## Authorization

- `report_card:manage` — SUPER_ADMIN, OFFICE_ADMIN (full lifecycle, school-wide).
- `report_card:remark` — TEACHER (draft remark + submit; narrowed to the class teacher by scope).
- `report_card:read` — SUPER_ADMIN, OFFICE_ADMIN, TEACHER (own-section), PARENT (own-child PUBLISHED). ACCOUNTANT: none.

RLS is defense-in-depth (the business layer is authoritative): admin ALL; class-teacher SELECT own-section + UPDATE only DRAFT/SUBMITTED; parent SELECT own-child PUBLISHED.

## Known limitations

- **No PDF generation** — `pdfPath` + a private bucket are provisioned; rendering (and bilingual en+ml templates) is deferred.
- **No report-card notifications**; **no CGPA-across-years** snapshot (`cgpaSnapshot` reserved, null).
- **Mobile is parent-read only** — class-teacher authoring + admin lifecycle are web.
- **Web card list = current-year via section roster**; a cross-year student trail (Q6) is a later add.
- **`sectionRoster` scope nuance:** the admin Generate picker uses `enrollment.sectionRoster` (TeacherAssignment-scoped, admin-full-access). The class-teacher list is driven by `reportCard.listForSection` (ClassTeacherAssignment-scoped), so a class teacher who teaches no subject in their own section still sees the cards.
- **Students shown by roll/enrollment id** — no student **name** is exposed in the report-card surface (same convention as the rest of the app).
