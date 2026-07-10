# ADR-014 — Report Card Snapshot Ownership (M7)

**Status:** **Accepted / Implemented (M7 Steps 1–10 shipped)** · **Date:** 2026-07-10 (analysis), 2026-07-11 (implemented) · **Deciders:** Architecture, Product
**Related:** Dev PRD v1.3 §6 (`ReportCard` model sketch), §8.5 (exams/marks/grades/report cards), §16.3 `[CONFIRM]` (rank visibility) ·
**ADR-009** (ReportCard.examId optional + partial unique — *the direct predecessor; extended here*) ·
ADR-010 (Enrollment is the single join point) · ADR-011 (attendance compute-on-read + weighting) ·
ADR-012 (exam publication + snapshot-at-lock + GPA/CGPA from snapshots) · ADR-013 (register/actor/derived-ownership patterns) ·
ADR-002 (business layer is the authorization gate) · ADR-003 (repositories) · ADR-004 (private Storage, signed-on-read) ·
ADR-007 (in-transaction audit) · ADR-008 (loose `schoolId`) · DATABASE_CONVENTIONS (status-enum lifecycle, no soft-delete, `@db.Date`)
**Precedes:** M7 (Report Card & Academic Results) — this ADR defined the model and answered the Step-1 questions; **M7 has since shipped it** (schema, RLS, business, API, mobile, web, tests). See `docs/milestones/M7.md`, `docs/features/report-cards.md`, `docs/status/ReportCards.md`.

---

## Implementation reconciliation (M7 — shipped)

The analysis below is the original Step-1 record. Where the shipped implementation refined a proposed direction (all with R1/R2/R3 product sign-off), the **final decision is:**

- **Owner = `Enrollment`** (§1) — shipped as proposed. `kind` EXAM/TERM/ANNUAL + nullable `examId`/`termId`; per-kind partial-unique indexes (ADR-009's realized seam).
- **Lifecycle = `DRAFT → SUBMITTED → APPROVED → PUBLISHED`** (+ `SUPERSEDED`, `REVOKED`). The proposed §2 `GENERATED` state **shipped as `APPROVED`** (renamed to R1's "approve" verb); a **`SUBMITTED`** review state was added (R1: the class teacher submits, the office/principal approves) and a **`REVOKED`** terminal state (R1: pull a published card). Approving a **DRAFT is rejected** (skip-state) — every card passes the review gate.
- **Snapshot frozen at APPROVE** (§3) — attendance %, rank, GPA; rank is **all-or-nothing** (null value ⇒ null rank/rankScope/cohortSize). **R2 resolved:** rank is **stored** with `rankScope = SECTION` (CLASS reserved); own-rank-only + a future "hide rank" setting are app-layer (no schema flag).
- **Correction = option B (§4) — supersession/versioning.** **R3 resolved:** published cards are immutable; a correction is a **new `version`**; publishing it **supersedes-then-publishes in one transaction** (prior → `SUPERSEDED`), so never two live PUBLISHED; every publish/correction is audited. (This supersedes the §4 *recommendation* of (A) overwrite-and-audit.)
- **Class-teacher remark authorship** (§7) — via `assertClassTeacherOfEnrollment` (M6.5/ADR-015). **R1 resolved.**
- **Stored PDF** (`pdfPath`, §9) — the column + private bucket are provisioned; **rendering is deferred** (not built in M7).

The section-by-section analysis that follows is retained as the decision record; read the bullets above as the shipped truth where they differ.

---

> **What this ADR adds over ADR-009.** ADR-009 decided exactly one thing: `ReportCard.examId` stays **nullable**, with exam-bound uniqueness enforced by a partial unique index. It deliberately left everything else open — it even names the extension point: *"whatever feature introduces [non-exam cards] adds its own discriminator and uniqueness rule."* **M7 is that feature.** ADR-014 makes the decisions ADR-009 deferred: the card-type discriminator, the publication lifecycle, **which values snapshot into the card vs. read live**, ownership of rank / remarks / promotion decision, the correction model, and PDF-stored-vs-on-demand. Nothing here contradicts ADR-009; §Conflict Search proves it and reconciles the one place they touch (upsert-overwrite).

## Context

M1–M6 are frozen. M7 is the **academic reporting layer** built on top of them — it **consumes** existing data and must **never duplicate business ownership** already implemented:

```
M3 Enrollment ─┐
M4 Attendance ─┼─▶ M7 Report Card   (read-only over M3–M5;
M5 Marks/GPA ──┘                     owns ONLY report-specific fields)
```

The `ReportCard` model **does not exist in the schema** (verified: `grep -n "^model" schema.prisma` — no `ReportCard`; the only references are ADR-009, ADR-010 §8, PRD §6, and a `Mark` index comment "future report card (ADR-009)"). It was deliberately deferred to M7. So M7 builds it from the ADR-009 blueprint, and this analysis fixes the open questions.

The load-bearing patterns M7 reuses (all shipped, all verified against the repo):

- **Enrollment is the single join point** (ADR-010 §8): Attendance, Mark, and now ReportCard all FK to `Enrollment.id`, never `Student`. History is promotion-proof by construction — promotion creates a *new* enrollment, never mutating the old (§4).
- **Snapshot-at-settle** (ADR-012 §3–4): `Mark` freezes `totalObtained / percentage / gradeLetterSnapshot / gradePointSnapshot` at LOCK so a later `GradeScale` edit can never rewrite a settled result. GPA/CGPA are computed **from those snapshots** (`gpaForEnrollment`, live from immutable rows) — never recomputed from the live scale.
- **Publish = parent-visibility gate** (ADR-012 §1–2): `exam.publish` exposes every LOCKED section at once; parents never see partial/draft state. Visibility is `published AND locked` (both layers).
- **Ownership derives from `TeacherAssignment`** (ADR-011 §3, ADR-012 §9, ADR-013): never a stored `ownerTeacherId`; rows persist *who acted* (Staff actors, B3 invariant), authz is a live question.
- **Attendance % is compute-on-read** (ADR-011 §10): **no summary table, no cron** — `AttendanceService.attendanceSummary(enrollmentId, range)` aggregates `AttendanceRecord` rows using the canonical weighting (PRESENT/LATE 1.0, HALF_DAY 0.5, ABSENT 0, LEAVE excluded).
- **Private storage, signed-on-read** (ADR-004): PDF is a `*Path` column in a private bucket, signed after a business authz check — never a stored URL (M6 `homework-files` is the latest instance).

---

## Decision

### 1. Report Card ownership — **Enrollment** (owner) with **scope attributes** (exam? / term? / kind)

**Owner = `Enrollment`.** `ReportCard.enrollmentId → Enrollment` (`onDelete: Restrict`). This is not a fresh choice — ADR-010 §8 already names `ReportCard.enrollmentId` as one of the four modules that join through Enrollment, and ADR-009 locked it. **Exam, Academic Term, and Academic Year are *scope attributes* of a card, not owners of it:**

| Candidate | Verdict | Why |
|---|---|---|
| **Enrollment** | ✅ **OWNER** | The only entity that ties a student to a *specific year's placement*. A report card is meaningless without "which student, which year, which class/section" — that is exactly `Enrollment` (ADR-010 §1). One join point → attendance %, marks, GPA all already gather by `enrollmentId` with no new placement logic. |
| Exam | ❌ scope only | An exam-bound progress card references *one* exam (`examId`), but an **annual/consolidated card spans many exams** and a **term card spans none directly**. Owning by Exam cannot represent those. ADR-009 rejected `examId`-required for exactly this reason. |
| Academic Term | ❌ scope only | A term card carries `termId` as a **scope filter** (which attendance range, which exams fall in the term). But a term is a subdivision of a year shared by every student — it cannot own a per-student artifact. |
| Academic Year | ❌ scope only | Same as Term, coarser. The year is reachable via `enrollment.academicYearId`; storing it on the card would denormalize a value already one hop away. |

**Consequence — the discriminator is now required (ADR-009's deferred extension point).** Because M7 builds **term** and **annual** cards, not just exam-bound ones, the NULL-`examId` space that ADR-009 left unconstrained must now be discriminated. M7 adds a **`kind`** discriminator (e.g. `EXAM | TERM | ANNUAL`) and, for term/annual cards, the scope FK (`termId?`). Uniqueness becomes per-kind (§4). *This is a Step-2 schema decision — recorded here as the direction, not written.*

```
Student (identity)
  └─< Enrollment  ◀── OWNER of the report card (year-bound placement)
         ├─ academicYearId → AcademicYear   ── scope (annual card)
         ├─ classId / sectionId             ── cohort for rank
         └─< ReportCard
                ├─ kind:  EXAM | TERM | ANNUAL          ── discriminator (NEW, M7)
                ├─ examId?  → Exam    (EXAM cards)      ── scope, nullable (ADR-009)
                ├─ termId?  → AcademicTerm (TERM cards) ── scope, nullable (NEW, M7)
                ├─ pdfPath  (private bucket, ADR-004)   ── stored artifact
                └─ snapshot fields (§3)                 ── frozen at publish
```

### 2. Publication lifecycle — `DRAFT → GENERATED → PUBLISHED` (+ conditional supersession)

> **SHIPPED as `DRAFT → SUBMITTED → APPROVED → PUBLISHED` (+ `SUPERSEDED`, `REVOKED`).** `GENERATED`
> below = the shipped **`APPROVED`** state (snapshot frozen, not parent-visible); R1 added the
> **`SUBMITTED`** review state before it and the **`REVOKED`** terminal state. See the reconciliation block.

Mirrors the M5 exam publication semantics (publish = the parent-visibility gate) but adds one state M5 does not need — an **approval gap** between "numbers assembled" and "released to parents" (the office/principal review step, Q7):

```
DRAFT ──generate──▶ GENERATED ──publish──▶ PUBLISHED
  ▲                    │  (snapshot frozen;   (parent-visible;
  │                    │   NOT parent-visible) snapshot immutable)
  └── regenerate ──────┘
                                          (correction: supersede → new PUBLISHED row,
                                           old marked SUPERSEDED — see §4)
```

| State | Meaning | Parent sees? | Snapshot | Who acts |
|---|---|---|---|---|
| **DRAFT** | Card exists; remarks/promotion being authored; numbers may be re-pulled. | No | not frozen | Office/Principal (+ class-teacher remarks, §7) |
| **GENERATED** | Snapshot **frozen** (§3) + PDF rendered; awaiting release. | No | frozen | Office/Principal generate |
| **PUBLISHED** | Released. Snapshot + PDF are immutable. | **Yes** | immutable | **Principal / OFFICE_ADMIN publish** |
| *SUPERSEDED* | A correction published a replacement; this row is retained for audit. | No | immutable | (set by the correction, §4) |

- **`GENERATED` vs collapsing to two states.** `GENERATED` is a *real* state only because Q7 needs an approval gap (frozen-but-not-released). A school with no office/principal review step collapses `GENERATED`→`PUBLISHED` into one action — the model still holds; the state simply isn't dwelt in. **Recommend keeping it** (cheap, and the approval gap is the norm for report cards).
- **No `ARCHIVED` state.** "Archived" is **derivable** from `AcademicYear.status = CLOSED` (ADR-010 §6) — a published card in a closed year *is* an archived card. Adding an `ARCHIVED` enum value would duplicate a truth already one hop away (the same anti-pattern ADR-010 §D rejects for soft-delete). The one genuinely new "retired" meaning — *superseded by a correction* — is `SUPERSEDED`, and it exists only if §4 chooses supersession.
- **Who publishes:** **Principal / OFFICE_ADMIN / SUPER_ADMIN** only (school-wide authority). A subject **TEACHER never publishes** — see §7 for why the current model gives a subject teacher no standing over a cross-subject card.
- **Parent visibility gate = `PUBLISHED`** (exactly ADR-012's rule): parents see a card **iff** it is PUBLISHED for their own child's enrollment. Never DRAFT, never GENERATED.

### 3. Data-source ownership — snapshot vs. live (the core of this ADR)

The stored PDF (§9) already freezes *every rendered value*. So a **structured snapshot column** is justified **only** when the value must be **displayed or queried outside the PDF** (mobile/web card views, "compare previous years" — Q6) **and** it is not already immutable at its source. Applying that discriminator value-by-value:

| Value | Source | Snapshot into card? | Why |
|---|---|---|---|
| **Attendance %** | ADR-011 compute-on-read (mutable — an `AttendanceCorrection` changes it after the fact) | ✅ **MUST snapshot** | Not immutable at source; a post-publish correction would silently change a "published" number. Freeze the term/annual % + present/absent/late counts at generate. |
| **Class rank** | Cohort-relative, point-in-time (depends on *every* peer's marks at compute time) | ✅ **MUST snapshot** | Not a property of one enrollment; recomputing later (peers added/corrected/transferred) yields a different rank. Must freeze the value *and* its scope (§ open item — see rank `[CONFIRM]`). |
| **Teacher remarks / Principal comments** | Authored **on the card** — exists nowhere else | ✅ **card-owned field** | The report card is the system of record for these. New columns, no external source. |
| **Promotion decision / status** | Authored on the card at year-end (ADR-010 promotion is a *separate* enrollment mutation) | ✅ **card-owned field** | The card records the *decision as shown to the parent*; the actual promotion is ADR-010 §4 (new enrollment). The card snapshots the stated outcome, it does **not** drive the enrollment mutation (§8). |
| **Grades / marks / GPA** | `Mark` snapshots (already frozen at LOCK, ADR-012 §3) + `gpaForEnrollment` (derived from those) | ➖ **copy for display, not for immutability** | Already reproducible forever — the immutability requirement is *already met upstream*. A structured copy on the card is a **display/query convenience** (render the card view without re-joining Marks; support Q6 year-comparison), not a correctness need. State the driver honestly: convenience, not immutability. |

**Rule of thumb for Step 2:** force a stored field iff the value is (a) computed-on-read, (b) cohort-relative, or (c) authored-on-the-card. Everything already-immutable upstream (marks/GPA) is copied only if the app needs to show it without the PDF.

### 4. Report generation — generate, freeze, and correct by **supersession** (reconciling ADR-009)

- **Generate:** assemble DRAFT → compute snapshot (§3) → render PDF → `GENERATED`. Idempotent per `(enrollment, kind, scope)`.
- **Regenerate (pre-publish):** allowed freely while `DRAFT`/`GENERATED` — re-pull numbers, re-render. This is ADR-009's **upsert-overwrite** and stays exactly as ADR-009 decided (line 21: *"re-generation upserts that row"*). **No versioning before publish.**
- **Lock at publish:** `PUBLISHED` freezes the snapshot + PDF. No in-place edit after publish (the ADR-012 lock discipline).
- **Correction after publish — CHOICE, flagged for sign-off:**
  - **(A) Overwrite-and-audit** (honors ADR-009 literally): re-publish overwrites the same row; the `AuditLog` before/after JSON carries what-was-previously-published. Simplest; one row per `(enrollment, kind, scope)`; the partial-unique index from ADR-009 is untouched.
  - **(B) Supersede/version** (extends ADR-009): publishing a correction inserts a **new** PUBLISHED row and marks the prior `SUPERSEDED`; parents always read the latest PUBLISHED. Gives an immutable published-history but **requires changing the uniqueness rule** (from "one per `(enrollment, examId)`" to "one *live* per `(enrollment, kind, scope)`"), which is an explicit extension of ADR-009 and **must be called out** (it is, here).
  - **Recommendation:** **(A) overwrite-and-audit** for M7 — it honors ADR-009 with zero schema-constraint change, and the AuditLog already gives the "what was published before" trail. Choose (B) only if the school requires a legally-retained immutable copy of every superseded card. *This is the single decision most needing product sign-off.*
  - **✅ SHIPPED: (B) supersession/versioning** (R3 sign-off — an immutable retained history of every version is required). A correction is a new `version`; publishing it supersedes-then-publishes in one tx (prior → `SUPERSEDED`); never two live PUBLISHED; every publish/correction audited.
- **History / corrections workflow:** the report card is **never a back-door to edit marks or attendance** (§ Boundary). A wrong grade is fixed via ADR-012 **Unlock → Edit → Lock → Publish** on the exam; a wrong attendance mark via ADR-011 **AttendanceCorrection**. Only *card-owned* fields (remarks, promotion decision, rank scope) are editable on the card itself; fixing an upstream number means re-generating (pre-publish) or correcting-then-republishing (post-publish, per A/B above).

### 5. Academic dependencies (read-only consumption of frozen modules)

| Dependency | Interaction | Direction |
|---|---|---|
| **M3 Enrollment** | Owner FK; supplies student/year/class/section; cohort for rank. | read |
| **M4 Attendance Summary** | `attendanceSummary(enrollmentId, termRange)` → snapshot % + counts (§3). Compute-on-read, so **must freeze** at generate. | read → snapshot |
| **M5 Marks** | `Mark` snapshots gathered by `enrollmentId` → grades table on the card. Already immutable. | read |
| **GradeScale / GradeBand** | **Not read live.** The letter/point are already snapshotted on each `Mark` (ADR-012 §3); the card copies those, never re-resolves the scale. A GradeScale edit can never move a published grade. | none (uses Mark snapshots) |
| **`gpaForEnrollment` (M5 service)** | GPA computed from Mark snapshots → snapshot onto the card. | read → snapshot |
| **Academic Terms** | `termId` scope for a term card; term date-range bounds the attendance aggregation. | read (scope) |
| **Promotion (ADR-010 §4)** | Card snapshots the *stated* promotion decision; the enrollment mutation is separate. Card **never** writes Enrollment. | read (records outcome) |
| **Withdrawal / Transfer / Repeat / Graduation** | All are Enrollment-status transitions (`DROPPED / TRANSFERRED / RETAINED / ALUMNI`). Published cards survive untouched because they key to the *immutable* enrollment row (§8). | none (survive by construction) |

### 6. Parent visibility

- **DRAFT / GENERATED:** **never** visible to parents (the whole point of the approval gap, §2).
- **PUBLISHED:** visible **iff** it is the parent's own child's enrollment (`StudentParent` link, the M6 §10 idiom). RLS defense-in-depth mirrors M5/M6 (`parent SELECT published own-child`).
- **PDF download:** yes — signed-on-read (ADR-004), after the same authz check. Never a stored URL.
- **Compare previous years (Q6):** yes, and it is *free* — a parent's cards are `WHERE enrollment.studentId = ? AND status = PUBLISHED ORDER BY academicYear`, over immutable per-year rows (ADR-010 §1 trajectory query). This is a **driver for the structured display fields in §3** (year-over-year comparison needs queryable columns, not just PDFs).

### 7. Teacher workflow — **class teacher authors remarks; office/principal generates + publishes**

> **RESOLVED — see ADR-015 (the source of truth).** Product chose: **the class teacher authors
> the report card's teacher remarks.** The class-teacher concept is owned by **M6.5 / ADR-015**
> (`ClassTeacherAssignment` — `(academicYear × section) → one teacher`; a dedicated model, not a
> `TeacherAssignment` flag; managed under `academic:manage`). Report cards **consume** it as a
> read-only gate: the remark-authoring check is the business-layer scope predicate
> `assertClassTeacherOfEnrollment` — only the assigned class teacher passes; a subject teacher of
> the same section is refused. Office/Principal still generate + publish. This ADR adds no
> class-teacher architecture; it depends on ADR-015. The analysis below records why the dedicated
> model was required (the argument now lives in ADR-015 §1).

**The finding that redirected this question:** a `Mark` is visible **per-subject** — a teacher sees only their own subject × section (ADR-012 RLS). A report card **aggregates every subject** for a student. **No entity in the pre-M7 model owned a cross-subject card**, and there was **no `isClassTeacher` flag** — verified: `TeacherAssignment` schema comment *"No isClassTeacher flag yet"*, ADR-011 §3 defers it, PRD decision #12 confirms "Class Teacher is not a role." So a subject TEACHER **cannot** be the owner/generator/reviewer of a cross-subject card, and there was **no owner for a "class-teacher remark" field** — which is exactly what `ClassTeacherAssignment` now supplies.

Two ways to land it — **recommend (a) for M7 core, (b) as an additive Step-2 option flagged for sign-off:**

- **(a) Office/Principal-generated (recommended M7 scope).** Generation, review, and publication are **OFFICE_ADMIN / Principal / SUPER_ADMIN** (school-wide authority, exactly the M6 "full management school-wide" grant). Subject teachers contribute **nothing directly to the card** — their input is already captured upstream as Marks (M5) and attendance (M4). No new schema, no class-teacher dependency. Remarks are principal/office comments.
- **(b) Class-teacher remarks — RESOLVED via M6.5/ADR-015 (shipped).** Product chose this: the class teacher authors a per-section remark. The class-teacher concept shipped as the dedicated **`ClassTeacherAssignment`** model (M6.5/ADR-015) — **not** a `TeacherAssignment.isClassTeacher` flag (that flag was rejected; `TeacherAssignment` stays frozen). M7 adds only a card-owned `classTeacherRemark` field, gated by `assertClassTeacherOfEnrollment` (ADR-015). Additive (a nullable field); ownership stays Enrollment and generation authority stays office/principal.

| Action | SUPER_ADMIN | OFFICE_ADMIN | Principal¹ | TEACHER (subject) | Class-teacher¹ᵇ | PARENT | ACCOUNTANT |
|---|---|---|---|---|---|---|---|
| Generate / regenerate card | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Edit principal/office remarks | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Edit class-teacher remark *(option b)* | ✅ | ✅ | ✅ | ❌ | own section | ❌ | ❌ |
| Edit promotion decision | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Publish / supersede** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Edit grades | ❌ *(via M5 unlock only)* | ❌ *(M5)* | ❌ *(M5)* | ❌ *(M5, own subject)* | ❌ | ❌ | ❌ |
| Edit attendance | ❌ *(via M4 correction only)* | ❌ *(M4)* | ❌ *(M4)* | ❌ *(M4)* | ❌ | ❌ | ❌ |
| Read PUBLISHED card | ✅ | ✅ | ✅ | ❌² | ❌² | own child | ❌ |
| Download PDF | ✅ | ✅ | ✅ | ❌² | ❌² | own child | ❌ |

¹ "Principal" is not a role — it is SUPER_ADMIN/OFFICE_ADMIN authority in the existing model (no Principal role exists). ¹ᵇ Only if option (b) lands. ² Teacher card-read is a scope question deferred with the class-teacher flag; M7 core has no teacher read of full cards. **"Edit grades / edit attendance" are permanently ❌ on the card** — corrections flow through ADR-012 / ADR-011, never the report card (§ Boundary).

### 8. Promotion interaction (ADR-010) — history survives by construction

**Promotion never mutates history — and the report card inherits this for free**, because it keys to the *immutable* enrollment row:

- **Promotion** (ADR-010 §4): outgoing enrollment → `PROMOTED`, a **new** enrollment row for next year. The old year's report card stays attached to the old (untouched) enrollment; the new year starts with **no card**. Nothing re-points.
- **Retention** (§7): new enrollment, same `classId`, old → `RETAINED`. Prior card intact.
- **Withdrawal** (`DROPPED`): enrollment marked terminal; `onDelete: Restrict` on `ReportCard.enrollmentId` means **the card can never be orphaned or hard-deleted** — a withdrawn student keeps every published card.
- **Transfer** (§5, in-place `sectionId` change): the card's *snapshotted* rank/attendance are frozen at generate, so a post-generation transfer does **not** re-attribute the published card (unlike live section-scoped queries, ADR-010 §5). This is a **point *for* snapshotting rank** (§3).
- **Graduation** (`ALUMNI`): identical to withdrawal — cards persist; alumni transcript (a future milestone) reads the immutable per-year card trail.

The report card **records** the promotion decision as shown to the parent; it does **not perform** promotion (that is `promoteBulk`, ADR-010 §4). One-directional: enrollment lifecycle → card content, never card → enrollment.

### 9. PDF architecture — **stored snapshot**, signed-on-read

**Decision: stored PDF**, `ReportCard.pdfPath` in a private bucket, signed-on-read after a business authz check (ADR-004; the M6 `homework-files` pattern is the latest instance). ADR-009's model sketch already committed to `pdfPath` — this ADR confirms it.

| Option | Trade-off | Verdict |
|---|---|---|
| **Stored snapshot (`pdfPath`)** | The PDF *is* the frozen artifact — byte-identical every read, reproducible forever, immune to any later data/template change. Costs bucket storage + a generate step. Matches ADR-004 + ADR-012 immutability. | ✅ **CHOSEN** |
| On-demand generation | No storage; always "fresh." But *fresh is wrong here* — it re-queries live data and a template change would silently alter a published card's appearance. Breaks the immutability the whole module promises, and re-renders on every parent view. | ❌ |

A stored PDF also *is* the snapshot for every rendered value (§3) — the structured columns exist only for the values the **app** must show/query outside the PDF.

### 10. Future compatibility (no schema redesign required)

The Enrollment-owner + `kind`-discriminator + nullable-scope + snapshot-payload shape absorbs later milestones **additively**:

- **Transcript / alumni transcript:** already a query over the immutable per-year PUBLISHED cards (`WHERE studentId = ? ORDER BY year`). No new ownership.
- **CBSE / ICSE / State Board / semester systems:** new `kind` values (+ their own scope FK/uniqueness rule) — the exact ADR-009 extension mechanism, now generalized. No migration of existing cards.
- **Multiple grading policies:** already handled upstream — the grade letter/point are snapshotted per `Mark` (ADR-012); a new policy is a new `GradeScale`, invisible to already-published cards.
- **Digital signatures / verification QR / verification URL:** additive nullable columns on `ReportCard` (`signaturePath?`, `verificationCode?`) — pure add, no reshape. The stored-PDF model is *required* for a stable signature/QR target (you can't sign an on-demand render).

The one deliberate extension point requiring future work: a **new report `kind`** brings its own uniqueness rule (ADR-009's stated pattern). That is designed-in, not a redesign.

---

## Architecture Review — Conflict Search

| ADR | Conflict? | Reconciliation |
|---|---|---|
| **ADR-009** | **Touches, does not conflict.** | ADR-009 decided `examId`-nullable + partial-unique *only*, and explicitly delegated the discriminator/uniqueness of non-exam cards to "whatever feature introduces them." M7 is that feature → adds `kind` + `termId?`. The **one place to watch is upsert-overwrite** (ADR-009 line 21): §4 **recommends (A) overwrite-and-audit to honor it verbatim**; option (B) supersession would *extend* ADR-009's uniqueness rule and is flagged as an explicit extension, not a silent override. **No conflict under the recommendation.** |
| **ADR-010** | No. | Enrollment ownership + `Restrict` + promotion-non-destructive are *reused*, not altered. |
| **ADR-011** | No. | Attendance stays compute-on-read; the card **snapshots the output**, never adds a summary table or a second attendance writer. |
| **ADR-012** | No. | Marks/GPA snapshots are *consumed*; the card adds no marks path and no second publication authority over exams. Card publication is a *separate* gate over a *different* entity. |
| **ADR-013** | No. | Only pattern reuse (derived ownership, Staff actors, signed storage, audit-in-tx). |

**Is ADR-014 necessary?** **Yes.** The one adjacent ADR (009) explicitly scopes itself to `examId` nullability and *names the deferral* that M7 fills. The snapshot set, lifecycle, rank/remark/promotion ownership, correction model, and PDF strategy are decided **nowhere** in ADR-001–013. A new ADR is the honest home for them. *(Had ADR-009 covered snapshot semantics, this would fold into it — it does not.)*

---

## Alternatives Considered

1. **Own the card by Exam (`examId` required).** Rejected — cannot represent term/annual/consolidated cards; already rejected by ADR-009.
2. **No stored snapshot — render everything live/on-demand.** Rejected (§9) — breaks published-card immutability; a GradeScale or template change would rewrite history.
3. **Snapshot *everything* into structured columns (including marks/GPA "for safety").** Rejected as over-built — marks/GPA are *already* immutable upstream (ADR-012 §3); a structured copy is a display convenience, justified per-value (§3), not a blanket rule. Copy only what the app must show outside the PDF.
4. **Add an `ARCHIVED` lifecycle state.** Rejected — derivable from `AcademicYear.status = CLOSED` (ADR-010 §6); a stored enum value duplicates a one-hop truth. The only genuine "retired" meaning is `SUPERSEDED` (and only under §4 option B).
5. **Version every regeneration.** Rejected pre-publish (ADR-009 upsert-overwrite governs); post-publish it is the flagged §4-B choice, taken only if immutable published-history is a hard requirement.
6. **A `TeacherAssignment.isClassTeacher` flag for remark authorship.** REJECTED and superseded — the class-teacher concept shipped as the dedicated `ClassTeacherAssignment` model (M6.5/ADR-015), not a flag; the card **owns** the remark and reads authorship via `assertClassTeacherOfEnrollment`. The card owner stays Enrollment.

## Edge Cases

- **Card before marks are locked/published:** generation must **refuse or clearly flag** subjects whose `ExamSection` is not LOCKED (no snapshot exists to freeze) — mirrors ADR-012's "publish exposes only LOCKED."
- **Mid-year transfer after generate, before publish:** snapshotted section/rank are frozen; regenerate if the school wants the new section reflected (pre-publish only).
- **Attendance correction after publish:** the published % is frozen (§3); fixing it is a §4 correction (overwrite-and-audit / supersede), never a silent recompute.
- **GradeScale edited after a card publishes:** no effect — grades are Mark snapshots (ADR-012 §3).
- **Rank ties / absent students / incomplete cohort:** rank scope + tie rule is an **open `[CONFIRM]`** (PRD §16.3) — see Risks.
- **Withdrawn/alumni student:** cards persist (`Restrict`); no orphaning.
- **Re-publish race (two admins):** guard with the M5/M6 guarded-transition idiom (conditional update on current status) — exactly one publish wins.
- **Non-exam card with no discriminator (legacy ADR-009 NULL space):** M7's `kind` closes this — every card has a kind from day one.

## Risks

- **R1 — Class-teacher gap. ✅ RESOLVED (2026-07-10).** Product chose class-teacher-authored remarks; the dedicated additive **`ClassTeacherAssignment`** model + `assertClassTeacherOfEnrollment` gate are built and verified (see §7 banner). No longer a blocker for the ReportCard step, which consumes the predicate.
- **R2 — Rank visibility & scope. ✅ RESOLVED (2026-07-11).** Rank is **stored** with `rankScope = SECTION` (CLASS reserved), frozen at approve, all-or-nothing (null GPA ⇒ null rank). Own-rank-only + a future "hide rank" school setting are app-layer — no schema flag.
- **R3 — Correction model. ✅ RESOLVED (2026-07-11).** Chose **(B) supersession/versioning** (§4) — published immutable, correction = new version, prior → `SUPERSEDED`, supersede-then-publish in one tx, all audited.
- **R4 — B3 actor invariant** extends to report cards: whoever generates/publishes needs a `Staff` row (the M4/M5/M6 provisioning invariant).
- **R5 — Bucket provisioning:** a private report-card bucket (or a namespace in an existing one) must be provisioned before live PDF generation — a runbook step, exactly like `homework-files` (M6).
- **R6 — Bilingual PDF (en + ml):** PRD §8.5 requires printable **bilingual** cards; template/font work is a real Step-7/8 cost, flagged now.

## Future Migration Risks

- **New board formats (CBSE/ICSE/State/semester):** absorbed by new `kind` values — but each brings its **own uniqueness rule**; forgetting it re-opens ADR-009's NULL-space ambiguity. The discriminator must be treated as *the* extension seam.
- **Choosing overwrite (§4-A) now, needing immutable history later:** migrating A→B is additive (add `status=SUPERSEDED` + relax the unique index to "one live per scope"), but pre-existing overwritten cards will have **no** superseded history (it was in AuditLog only). Acceptable if flagged at sign-off.
- **Rank scope change** (section→class or vice-versa) after cards ship: snapshotted ranks are frozen under the old scope; a scope change is non-retroactive by construction. Fine, but must be communicated.
- **Class-teacher remark before a slot is assigned:** the class teacher is `ClassTeacherAssignment` (M6.5/ADR-015); a card generated for a section with no class teacher simply has no teacher-remark author — a null, not a migration hazard.

## Consequences

- (+) **Zero new ownership** — the card reuses Enrollment (ADR-010), Mark/GPA snapshots (ADR-012), attendance compute-on-read (ADR-011), signed storage (ADR-004). It is a pure reporting layer.
- (+) **Immutability is inherited, not reinvented** — marks/GPA are already frozen; the card only newly-freezes the compute-on-read (attendance) and cohort-relative (rank) values, plus its own authored fields.
- (+) **History survives promotion/withdrawal/transfer/graduation by construction** (Enrollment `Restrict` + non-destructive lifecycle).
- (+) **Future formats/transcripts/signatures are additive** — the `kind` discriminator is the designed extension seam.
- (−) **Two decisions need product sign-off before Step 2:** the class-teacher/teacher-workflow scope (R1) and rank visibility (R2); one needs it before finalizing the schema constraint (R3, correction model).
- (−) **Bilingual PDF + bucket provisioning** are real downstream costs (R5, R6).

---

## Status — Implemented (M7 Steps 1–10 shipped)

This ADR began as the **M7 Step 1 (Requirements Analysis)** deliverable. R1 (class-teacher scope), R2 (rank), and R3 (correction model) were resolved with product and **M7 shipped all 10 steps** — schema (`20260710030000`), RLS (`20260710040000`), business (`services/report-card`), API (`reportCard`, 12 procedures), mobile (parent viewing), web (`/report-cards` console), and tests (54 automated + DB proofs). The shipped decisions are summarized in the **Implementation reconciliation** block at the top; the section-by-section analysis is retained as the decision record. See `docs/milestones/M7.md`, `docs/features/report-cards.md`, `docs/status/ReportCards.md`.
