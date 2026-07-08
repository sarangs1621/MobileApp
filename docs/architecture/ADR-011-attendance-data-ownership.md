# ADR-011 — Attendance data ownership (Session/Record on Enrollment)

**Status:** Accepted · **Date:** 2026-07 · **Deciders:** Architecture, Product
**Related:** Dev PRD §8.4 (attendance), §8.7 (leave→attendance), §8.19 (holidays/school settings) · ADR-010 (Enrollment is the join point) · ADR-007 (audit) · ADR-002 (business layer is the authorization gate) · ADR-003 (repositories) · ADR-008 (loose `schoolId`) · REVIEW_FINDINGS B1 (Holiday model), B2 (leave × attendance invariant), B3 (`markedBy` needs a Staff row) · DATABASE_CONVENTIONS (status-enum lifecycle, no soft-delete, `@db.Date`)
**Precedes:** M4 (Attendance Management) implementation — this ADR defines the model; **no code is written here.** It **supersedes** the v1.2-draft `Attendance[enrollmentId, date, period]` single-table sketch (Dev PRD §8.4, `docs/status/Attendance.md`).

## Context

M4 adds the first **high-volume, per-day** module: attendance. It must serve daily registers now, be future-ready for subject/period attendance without a migration, carry leave and correction workflows, respect a holiday calendar, and feed term/annual percentages to report cards (ADR-009) — all while four downstream modules (Marks, ReportCards, Fees, and now Attendance) already agree to join through **`Enrollment`** (ADR-010 §8).

The v1.2 draft sketched a single `Attendance` table keyed `[enrollmentId, date, period]` with a `period 0` whole-day sentinel. That shape has a known defect (**REVIEW_FINDINGS B2**): once a school marks period-wise, leave writing `period 0 = LEAVE` and a teacher writing `period 3 = PRESENT` can coexist — the student is simultaneously on leave and present. It also has no natural home for register-level lifecycle (who opened it, who submitted, who locked), subject metadata, or a clean correction trail. So we redesign around an **AttendanceSession → AttendanceRecord** split before writing any schema.

## Decision

### 1. Attendance keys to `Enrollment`, never `Student`

`AttendanceRecord.enrollmentId → Enrollment` (`onDelete: Restrict`). No attendance table carries a `studentId`. This is ADR-010 §8 applied: placement (year/class/section) lives on the enrollment, so an attendance fact is only meaningful against an enrollment. **History survives promotion by construction** — promotion creates a *new* enrollment row (ADR-010 §4) and never mutates the old one, so 2025–26's records stay permanently attached to the 2025–26 enrollment while the student moves into a fresh row with zero attendance. A lifetime register is `WHERE e.studentId = ? ORDER BY year` over immutable per-year slices. `Restrict` means a year carrying attendance can never be hard-deleted; leavers become `DROPPED`/`ALUMNI`.

### 2. Two entities: `AttendanceSession` (the event) → `AttendanceRecord` (per-student mark)

An **`AttendanceSession`** is one attendance *event* for a section on a date: fields `academicYearId`, `date` (`@db.Date`, IST), `sessionType` (`DAILY | SUBJECT`), `sectionId`, `subjectId` (nullable — null for DAILY), `status`, and the audit actors of §4. Uniqueness (partial index, `subjectId` nullable):

```
UNIQUE (sectionId, date, sessionType, subjectId)   -- one register per section/date/type/subject
```

so a section can hold a DAILY register **and** separate Math / English subject registers on the same date with no collision. Duplicate-session creation is a DB-enforced error, not a service race.

An **`AttendanceRecord`** is one student's mark within a session: `sessionId → AttendanceSession` (`onDelete: Cascade` — a session's records are its content), `enrollmentId → Enrollment` (`Restrict`), and `status: AttendanceStatus`. Uniqueness `UNIQUE (sessionId, enrollmentId)` — **one mark per student per session**, so a student cannot be marked twice, and re-submitting a register is an idempotent **upsert** (offline-replay / double-tap safe), not a duplicate-insert.

```
enum AttendanceStatus { PRESENT  ABSENT  LATE  HALF_DAY  LEAVE }
```

Because status is a single enum on one record per `(session, enrollment)`, the **B2 contradiction is structurally impossible** — there is no second row that can disagree with the first.

### 3. Session ownership derives from `TeacherAssignment` — it is **not** stored on the session

The session carries **no `teacherId`/owner column.** "Who may mark this register" is *derived* at authorization time from `TeacherAssignment` (ADR-010 / M2), the single source of truth for teacher scope:

- **SUBJECT session:** a teacher may mark iff a `TeacherAssignment` exists for **(that `subjectId`, that `sectionId`)** — exact match.
- **DAILY session (no subject):** a teacher may mark iff they hold **any** `TeacherAssignment` for that section. (Tightening to class-teacher-only awaits the class-teacher flag deferred in M3 — Dev PRD §16.14 `[CONFIRM]`; the looser rule is a documented, additive-to-fix limitation, not a blocker.)
- **SUPER_ADMIN / OFFICE_ADMIN:** always, within school scope.

**Why derive, not store:** an owner column duplicates a truth that already lives in `TeacherAssignment` and would rot the moment an assignment is reassigned — the historical session would still point at a teacher who no longer teaches the section. Ownership is a *live* authorization question; the session records *who acted* (§4), not *who is entitled*.

### 4. Session stores **audit actors**, not an owner

Three nullable Staff FKs capture the lifecycle transitions, mirroring the ADR-007 in-transaction audit discipline:

```
createdByStaffId   → Staff   (non-null; who opened the register)
submittedByStaffId → Staff?  (set on DRAFT→SUBMITTED)
lockedByStaffId    → Staff?  (set on SUBMITTED→LOCKED)
```

These are the durable record of *who did what*, complementary to (not a replacement for) `AuditLog`. All three FK to **`Staff`** (not `User`): per **REVIEW_FINDINGS B3**, every `SUPER_ADMIN`/`OFFICE_ADMIN`/`TEACHER` who marks attendance must have a `Staff` row (provisioning invariant — seed + invite + import must guarantee one). Flagged as an M4 dependency/risk.

### 5. Session lifecycle: `DRAFT → SUBMITTED → LOCKED`

```
enum AttendanceSessionStatus { DRAFT  SUBMITTED  LOCKED }
```

- **DRAFT** — register opened, marks being entered/edited freely.
- **SUBMITTED** — the day's marking is done (`submittedByStaffId` stamped); the register is the day's official record.
- **LOCKED** — closed to direct edits (`lockedByStaffId` stamped). After LOCK, the **only** path to change a record is the correction workflow (§7).

Transitions are forward-only and audited. (No `OPEN` state — DRAFT is the working state.)

**Canonical state machine + allowed operations:**

```
DRAFT ──submitSession──▶ SUBMITTED ──lockSession──▶ LOCKED
  ▲                                                    │
  └── markAttendance (edits)          AttendanceCorrection (approved)
```

| Operation | Allowed only when session is | Effect |
|---|---|---|
| `markAttendance` | **DRAFT** | idempotent upsert of records |
| `submitSession` | **DRAFT** → SUBMITTED | stamps `submittedBy/At` |
| `lockSession` | **SUBMITTED** → LOCKED | stamps `lockedBy/At` |
| (record change) | **after LOCKED** | only via `AttendanceCorrection`, approved (§8) |

`markAttendance` is **DRAFT-only**: once a register is SUBMITTED it is the official record and is not edited in place — reopening is not a modelled transition (forward-only), so any post-SUBMITTED change is a correction. This keeps a single, auditable path for altering a submitted/locked register.

### 6. Roster = **ACTIVE** enrollments of the ACTIVE year

The register's rows are the section's `ACTIVE` enrollments for the ACTIVE `AcademicYear` (ADR-010 resolves "current" through the single ACTIVE year, not a per-row flag). `ADMITTED`-but-unplaced, `PROMOTED`, `TRANSFERRED`, `DROPPED`, `ALUMNI` enrollments are **excluded** — so **attendance after withdrawal is refused** (no ACTIVE enrollment to mark) and **attendance after promotion** lands only on the new-year ACTIVE row.

### 7. Leave influences the **default** mark at marking time — it never eagerly writes records

A `LeaveRequest` is: `enrollmentId → Enrollment`, `parentId → Parent`, `fromDate`/`toDate` (`@db.Date`), `reason`, `status`.

```
enum LeaveStatus { PENDING  APPROVED  REJECTED  CANCELLED }
```

Parent applies for their own child; admin / class-teacher (`leave:decide`) approves or rejects; parent may `CANCEL` while `PENDING`. **Resolution of B2, refined:**

- **Approved leave does NOT create or overwrite `AttendanceRecord`s.** No phantom rows are manufactured for future dates, and a teacher's existing mark is never silently flipped.
- **Leave only biases the default status when a session is processed.** When a register is marked for a date the enrollment has approved leave covering, that student's *default* mark is `LEAVE` (the marker may still override — e.g. the student showed up after all).
- **`AttendanceRecord`s exist only as part of `AttendanceSession` processing.** Leave is an overlay on marking, not a writer of attendance.
- Existing attendance is updated **only when the approval workflow explicitly requires it** (an admin action that says "apply this leave to the already-marked register"), never as an automatic side effect of approval.

This keeps a single writer for attendance (session processing) and removes the dual-source-of-truth that made B2 dangerous.

### 8. Corrections are **immutable requests**; approval mutates the record, never the correction

An `AttendanceCorrection` is an append-only request against one record:

```
attendanceRecordId  → AttendanceRecord
requestedByStaffId  → Staff
previousStatus      AttendanceStatus   -- snapshot at request time
requestedStatus     AttendanceStatus   -- what it should become
reason              String
status              CorrectionStatus   -- PENDING → APPROVED | REJECTED (single terminal transition)
decidedByStaffId    → Staff?           -- append-once on decision
decidedAt           DateTime?
```

```
enum CorrectionStatus { PENDING  APPROVED  REJECTED }
```

- The **request payload** (`attendanceRecordId`, `previousStatus`, `requestedStatus`, `reason`) is **immutable** — a correction is a historical assertion and is never edited or deleted. Only the decision fields transition once (`PENDING → APPROVED/REJECTED` with `decidedBy`/`decidedAt`).
- **On APPROVE** (one transaction, ADR-007): the target `AttendanceRecord.status` is set to `requestedStatus`, the correction moves to `APPROVED`, and an `AuditLog` row records old→new. The correction row is the durable human trail; AuditLog is the machine trail; **the record itself is never overwritten silently.** Optimistic guard: approval verifies the record's *current* status still equals `previousStatus` (stacked corrections don't clobber each other).
- **On REJECT** the record is untouched.

This is the only sanctioned way to change a LOCKED record.

### 9. Holiday as a **working-day calendar**, resolved — not a service-level override boolean

`Holiday` is year-scoped: `academicYearId → AcademicYear` (`Restrict`), `name`, `date` (`@db.Date`), `type`. `UNIQUE (academicYearId, date)`.

```
enum HolidayType { NATIONAL  SCHOOL  FESTIVAL  EMERGENCY_CLOSURE }
```

Session creation does **not** accept an `override: boolean`. Instead it consults a **working-day resolution** over a layered school calendar:

```
resolveWorkingDay(academicYearId, date) :=
     baseline  weekday is a working day per SchoolSettings (§8.19; weekend rule [CONFIRM §16.15])
  ∧  minus     a Holiday exists for (year, date)              → NON_WORKING
  ∧  plus      an explicit WorkingDayOverride reclassifies it → WORKING  (make-up day)
               or                                              → NON_WORKING (ad-hoc closure)
```

Creating a session on a `NON_WORKING` day is rejected. **M4 implements the baseline + Holiday layers**; the `WorkingDayOverride` layer is a **designed-in extension point** — session creation already calls `resolveWorkingDay(...)` rather than checking a boolean, so adding overrides later needs **no change to callers and no migration of existing logic**. This replaces the throwaway "pass `override=true`" hack with a calendar the whole product can query ("is 2026-10-02 a working day?") and that make-up-day scheduling will reuse unchanged.

### 10. Analytics foundation (feeds report cards, no new joins)

`AttendanceSummary` is a **compute-on-read business service** (`AttendanceService.attendanceSummary`) keyed by `enrollmentId` + date range (daily → monthly → term). **There is no summary table and no cron job** — the percentage is computed on demand from the underlying `AttendanceRecord` rows. Only if measured read cost ever demands it would a materialized rollup be added; M4 does not need one.

**Canonical attendance weighting** (single source of truth for every % in the product):

| Status | Weight in % | In denominator? |
|---|---|---|
| `PRESENT` | **1.0** | yes |
| `LATE` | **1.0** (attended; surfaced separately as a punctuality count) | yes |
| `HALF_DAY` | **0.5** | yes |
| `ABSENT` | **0** | yes |
| `LEAVE` | — | **excluded** (not counted for or against) unless a future policy changes it |

`percentage = (Σ weights of countable records) / (count of countable records)`, where *countable* = every record except `LEAVE`; `null` when there are no countable days. Because every record joins `enrollmentId` and terms are `AcademicTerm` ranges on the ACTIVE year, term/annual % for a report card (ADR-009) is a pure aggregation — no per-report placement logic. **M4 builds the records + this aggregation only**; scheduled % rollups and the absence-push job are out of scope (notification/analytics milestones).

## Alternatives Considered

**A. Single `Attendance[enrollmentId, date, period]` table with a `period 0` sentinel (v1.2 draft) — REJECTED / SUPERSEDED.**
Fewer tables, but it admits the B2 leave-vs-present contradiction once period-wise is enabled, has no home for register lifecycle (created/submitted/locked) or subject metadata, and makes corrections a silent in-place overwrite. The Session/Record split fixes all three; a subject register is just `sessionType=SUBJECT`, so period-wise is future-ready without the sentinel hack.

**B. Store a `teacherId`/owner on `AttendanceSession` — REJECTED.**
Duplicates a truth that lives in `TeacherAssignment`, and rots on reassignment (a historical session would name a teacher who no longer teaches the section). Ownership is a *live* authorization question resolved from `TeacherAssignment`; the session records *who acted* (`createdBy/submittedBy/lockedBy`), which is the fact worth persisting.

**C. Approved leave eagerly writes `LEAVE` records across its date range — REJECTED.**
Manufactures attendance rows for dates with no session, and can silently flip a teacher's existing mark — two writers for one fact, the exact ambiguity B2 warns about. Leave as a *marking-time default* keeps session processing the single writer.

**D. Corrections overwrite the record in place, or the correction row is mutable — REJECTED.**
Loses the "never change history silently" guarantee. An immutable request + a single audited approval transition is the auditable trail the product promises.

**E. `Holiday` + a service-level `override: boolean` on session creation — REJECTED.**
A per-call boolean can't answer "is this date a working day?" for the rest of the product, and can't represent make-up days. A resolved working-day calendar is future-friendly and reusable; the override layer is designed-in behind `resolveWorkingDay(...)`.

## Consequences

- (+) **History is promotion-proof and per-year** — records key to `enrollmentId`; nothing re-points when a student advances.
- (+) **B2 dissolved** — one status per `(session, enrollment)` makes contradictory marks impossible; leave has one writer.
- (+) **Register lifecycle + audit are first-class** (DRAFT→SUBMITTED→LOCKED, created/submitted/locked-by Staff), and corrections are an immutable, auditable trail.
- (+) **Subject/period attendance is future-ready** with no migration (a subject register is `sessionType=SUBJECT`); the working-day calendar and analytics are reusable surfaces.
- (+) **Report cards get term % for free** — pure aggregation over `enrollmentId` + `AcademicTerm` ranges.
- (−) **Two tables + more enums** than the single-table sketch — justified by lifecycle, subject metadata, and the correction trail the sketch couldn't hold.
- (−) **`markedBy`/actor FKs require a `Staff` row for every marking user (B3)** — a provisioning invariant M4 depends on.
- (−) **Daily-session ownership is looser than class-teacher-only** until the class-teacher flag lands (§3) — accepted, additive to fix.
- (−) `resolveWorkingDay`'s override layer is **designed but not built in M4** — Holiday + weekday baseline only; make-up days come later behind the same interface.
