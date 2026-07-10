# ADR-015 — Class Teacher Assignment (independent from TeacherAssignment) — M6.5

**Status:** Accepted — **M6.5 implemented** (Steps 1–10 shipped 2026-07-10; awaiting milestone approval) · **Date:** 2026-07-10 · **Deciders:** Architecture, Product
**Related:** ADR-002 (business layer is the authorization gate) · ADR-003 (repositories) · ADR-007 (in-transaction audit) · ADR-008 (loose `schoolId`) ·
ADR-010 (Enrollment/year model — status-not-soft-delete, per-year history) · ADR-011/012/013 (register/actor/derived-ownership + RLS patterns reused verbatim) ·
ADR-014 (Report Card — the **consumer**; its class-teacher rationale relocates here) · Dev PRD §5 (RBAC), decision #12 ("Class Teacher is not a role") ·
DATABASE_CONVENTIONS (status-enum lifecycle, no soft-delete, `@db.Date`, camelCase) · PERMISSIONS_MATRIX
**Precedes:** M6.5 (Class Teacher Management) implementation — this ADR defines the model and answers Step-1 questions. **No Prisma model change, migration, or service is written here.** Schema is Step 2.

---

> **Milestone framing.** This is **M6.5 — Class Teacher Management**, a small standalone milestone, **not** M7 and **not** part of Report Cards. It introduces exactly **one** domain concept — `Section → Class Teacher (for a year)` — and nothing else (no report-card, attendance, homework, exam, timetable, or messaging logic). It exists to supply the architectural dependency ADR-014 (Report Cards) needs, but it stands on its own.
>
> **Adopts an existing foundation.** A minimal, uncommitted `ClassTeacherAssignment` foundation was built in a prior session (schema model, migration `20260710020000_class_teacher_assignment`, repository, business service `class-teacher.service.ts`, tests). M6.5 **adopts and evolves** it rather than rebuilding — Step 2 evolves the model to this ADR's spec (add `assignedAt`, `createdByStaffId`); Steps 3–5 keep the proven repo/service (adding `replace`); Steps 6–8 add the missing API/Web/Mobile; Step 10 relocates ADR-014's class-teacher rationale here and updates the milestone docs. This ADR is the **source of truth** for the concept; ADR-014 becomes a consumer that references it.

## Context

The academic model already has **`TeacherAssignment`** — the operational unit `Teacher × Subject × Section` (who teaches what, where). It does **not** answer a different, orthogonal question: **who is the class teacher (homeroom teacher) of an entire section for a year?** That role is not about a subject; it is about pastoral/administrative ownership of a whole section — the person who authors a report card's overall remarks (ADR-014), and, in later milestones, the natural owner of section-wide leave decisions and announcements (PRD §8.8 — out of scope here).

Historically this was sketched as a **`TeacherAssignment.isClassTeacher` boolean** (PRD decision #12; the stale references in `DB_RELATIONSHIP_DIAGRAM.md`, `PERMISSIONS_MATRIX.md`, and `DATABASE_CONVENTIONS.md` were reconciled to this model in Step 10). **That flag was never implemented** (`schema.prisma` comment "No isClassTeacher flag yet"), and M6.5 **rejects** it — see Decision §1.

## Decision

### 1. A **dedicated model**, never a flag on `TeacherAssignment`

`ClassTeacherAssignment` is its own table. A `isClassTeacher` boolean on `TeacherAssignment(teacher, subject, section)` **cannot express the concept**:

- **Which row carries it?** A teacher who teaches 3 subjects in a section has **3** `TeacherAssignment` rows — the flag would have to be set on one arbitrarily (or all three, an invariant nothing enforces).
- **A class teacher may teach *no* subject in their section** — then there is **no** `TeacherAssignment` row to carry the flag at all.
- The two facts have **different cardinality and lifecycle**: `TeacherAssignment` is `(teacher, subject, section)` and immutable (delete+create); class-teacher-ship is `(section, year) → exactly one teacher` and has a "current holder" that gets replaced.

So class-teacher-ship is a **first-class fact with its own key**, not an attribute of a teaching assignment. `TeacherAssignment` stays **exactly as frozen in M2** — no `isClassTeacher`, no overload.

### 2. Model

```
model ClassTeacherAssignment {
  id               String        @id @default(cuid())
  schoolId         String        // loose tenant ref (ADR-008)
  academicYearId   String
  sectionId        String
  teacherId        String        // → User (the class teacher; see §4)
  assignedAt       DateTime      @default(now())   // when the CURRENT teacher took the slot (now() on assign AND replace)
  createdByStaffId String        // → Staff — WHO assigned (audit actor, B3)
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt
  // relations: academicYear (Restrict), section (Restrict), teacher→User (Restrict), createdBy→Staff (Restrict)

  @@unique([academicYearId, sectionId])   // one class teacher per section per year
  @@index([teacherId])
  @@index([schoolId])
}
```

- **`assignedAt`** — **when the CURRENT teacher took the slot.** Set to `now()` on **assign** and **re-stamped to `now()` on replace** (so it always means "the current holder's start", never the original assignment forever). It is **not** back/forward-dated. The previous holder's `assignedAt` is preserved in the `AuditLog` before-image (§5), not the live row. Distinct from `createdAt` (the row-write time, which never changes).
- **`createdByStaffId → Staff`** — the audit actor (who performed the assignment), the B3 invariant reused from M4/M5/M6 (`markedBy`/`createdBy` → `Staff`). This is the milestone's own audit-actor column, complementary to `AuditLog`.
- **NO `endedAt`.** History does **not** need a date-range: an assignment is scoped to a year, and history is **per-year rows** (2025–26 has its row, 2026–27 has its own) — the ADR-010 §6 idiom (status/enum + immutable per-year rows, *no* soft-delete, *no* `[from,to)` ranges). Adding `endedAt` now would be YAGNI and would invite the multi-row-per-year ambiguity ADR-010 §C rejected. Within-year replacement is captured by `AuditLog` (§5), not a date range. `endedAt` is the documented extension point **iff** a future milestone needs sub-year date-ranged homeroom history.

### 3. Grain & uniqueness — **one class teacher per section per year; a teacher may own many sections**

`@@unique([academicYearId, sectionId])` — a section has **exactly one** class teacher in a given year (DB-enforced; race-free). The reverse is unconstrained: **one teacher may be the class teacher of multiple sections** (and across multiple years). This mirrors the M2/ADR-011 "roster is per (section, year)" grain and the ACTIVE-year resolution (ADR-010).

### 4. `teacherId → User`, `createdByStaffId → Staff` (locked)

- **`teacherId → User`** (`onDelete: Restrict`). Chosen to match the **sibling** `TeacherAssignment.teacherId → User` (`schema.prisma:216`) and its RLS idiom `teacherId = auth.uid()` — the teacher-SELECT-own policy (§6) is then a **direct** predicate with no join. *(Trade-off acknowledged: M4/M5/M6 actor FKs point at `Staff`; here the assigned teacher is an identity/authorization subject, not an audit actor, so `User` is the right ref — the same call TeacherAssignment made. The **audit actor** `createdByStaffId` **does** go to `Staff`, honoring B3.)*
- **`createdByStaffId → Staff`** (`onDelete: Restrict`) — the B3 audit-actor invariant.

### 5. Business lifecycle — Assign · Replace · Remove · Get (only these)

| Op | Rule | Audit |
|---|---|---|
| **Assign** | admin-only; teacher is an ACTIVE `TEACHER` in school; section + year in school; `(year, section)` slot free → else `ConflictError`. | `CLASS_TEACHER_ASSIGN`, in-tx |
| **Replace** | admin-only; the slot **is** taken (else `NotFoundError`) → **in-place `update`** of the single row: `teacherId` = new, `assignedAt` = now(), `createdByStaffId` = acting staff. No delete, no insert, no second row. | ONE `CLASS_TEACHER_REPLACE`, before/after `{teacherId, assignedAt}`, in-tx |
| **Remove** | admin-only; frees the slot. | `CLASS_TEACHER_REMOVE`, in-tx |
| **Get** | any academic reader; returns the current class teacher of `(year, section)` or null. | — |

- **Replace is in-place update**, not delete+create — the slot is a single mutable "current holder", and the `AuditLog` before/after is the change trail. (Diverges deliberately from `TeacherAssignment`'s immutable delete+create, which has no single-slot semantics.) This is what "future-ready for replacement" + "no `endedAt`" means: replacement is an audited mutation of the current row, year-history lives in separate per-year rows.
- The prior foundation also carries `isClassTeacherOfEnrollment` / `assertClassTeacherOfEnrollment` — the scope predicate ADR-014 (Report Cards) consumes. It stays; it is **read-only** and adds no report-card logic here.
- **Nothing else.** No report-card, attendance, homework, exam, timetable, or messaging logic in this service.

### 6. RLS (defense-in-depth; business layer authoritative — ADR-002)

Mirrors M2–M6. Reuses `is_academic_admin()`.

| Actor | Policy |
|---|---|
| **Admin** (`SUPER_ADMIN`/`OFFICE_ADMIN` ACTIVE) | ALL |
| **Teacher** | SELECT own (`"teacherId" = (SELECT auth.uid())::text`) |
| **Parent** | none |
| **Anonymous** | none (no policy = deny) |

### 7. Permissions & roles — **reuse `academic:manage` / `academic:read`** (no frozen-policy change)

Assigning a class teacher **is** managing an academic-structure assignment — `academic:manage`'s remit already covers "assignments" (`permissions.ts:37`), exactly as `TeacherAssignment` CRUD uses it. So:

- **Write** (Assign/Replace/Remove) → `ACADEMIC_MANAGE` (SUPER_ADMIN, OFFICE_ADMIN already hold it).
- **Read** (Get, mobile display) → `ACADEMIC_READ` (SUPER_ADMIN, OFFICE_ADMIN, TEACHER already hold it; RLS narrows teacher rows to own).
- **PARENT / ACCOUNTANT** → none.

This adds **zero** new permission keys and **no** change to the frozen `ROLE_PERMISSIONS` arrays — the minimum, and consistent with the sibling assignment concept. *Alternative — a dedicated `class_teacher:manage`/`:read` pair — is recorded as the option if class-teacher management ever needs to be granted independently of academic-structure management; not the case today.* The **PERMISSIONS_MATRIX** is updated (Step 10) to document the mapping.

### 8. Relationships & delete rules — **Restrict everywhere; additive virtual back-relations only**

- `academicYearId → AcademicYear` **Restrict** · `sectionId → Section` **Restrict** · `teacherId → User` **Restrict** · `createdByStaffId → Staff` **Restrict**.
- **Restrict everywhere** preserves history — a year/section/teacher/staff carrying class-teacher rows cannot be hard-deleted (matches ADR-010/011/012/013 posture).
- Frozen models (`User`, `Section`, `AcademicYear`, `Staff`) receive **only additive virtual back-relations** (`classTeacherAssignments` / `classTeacherAssignmentsCreated`) — Prisma-required, **generate no SQL** (proven for the existing three by `prisma migrate diff`; Step 2 adds the `Staff` back-relation for `createdByStaffId`, same property). No frozen schema is destructively modified.

## Edge cases

- Assign to an already-assigned `(year, section)` → `ConflictError` (use Replace).
- Replace on a free slot → treated as Assign, or `NotFoundError` (Step-2 decision; recommend: Replace requires an existing row).
- Assign a non-`TEACHER` / non-ACTIVE user → `ValidationError`.
- Cross-school section/year/teacher → `NotFoundError` (tenant guard).
- Deleting a teacher/section/year/staff that holds class-teacher rows → blocked by Restrict.
- Same teacher as class teacher of many sections → allowed (only the reverse is unique).

## Risks

- **R1 — Actor provisioning (B3):** the admin performing an assignment needs a `Staff` row (`createdByStaffId`). Same provisioning invariant as M4–M6.
- **R2 — Doc drift:** stale `isClassTeacher`-flag references (`DB_RELATIONSHIP_DIAGRAM.md:66`, `PERMISSIONS_MATRIX.md:14`) must be reconciled in Step 10 to point at this model, not the rejected flag.
- **R3 — ADR-014 overlap:** ADR-014 currently carries the class-teacher rationale; Step 10 trims it to a reference to this ADR so the two don't argue.

## Alternatives considered

1. **`TeacherAssignment.isClassTeacher` flag** — REJECTED (§1): can't express multi-subject or teach-nothing class teachers; wrong cardinality.
2. **`Section.classTeacherId` column on the frozen `Section`** — REJECTED: mutates a frozen M2 table, not year-scoped (a section persists across years but its class teacher rotates), and offers no audit-actor/`assignedAt`.
3. **Date-ranged homeroom membership (`endedAt`/`[from,to)`)** — REJECTED (YAGNI): per-year rows + AuditLog already answer "who was class teacher in year Y" and "when did it change"; ranges add overlap constraints for a need that doesn't exist yet (the ADR-010 §C call).
4. **Dedicated `class_teacher:*` permissions** — deferred (§7): reuse of `academic:manage`/`:read` is smaller and correct; dedicated perms only if independent granting is ever needed.
5. **Rebuild from scratch (discard the foundation)** — REJECTED by product this session: adopt & evolve reuses proven, drift-free, tested code.

## Future migration risks

- Adding `endedAt` later (sub-year homeroom history) is additive (nullable) — no reshape.
- Switching `teacherId` User→Staff later would be a real migration (data backfill) — avoided by locking `User` now to match `TeacherAssignment`.
- New consumers (leave-decide, announcements) read this model unchanged — no new ownership.

## M6.5 scope & steps (stop after each; STOP after 10)

**Only one concept: `Section → Class Teacher (year)`.** Steps: 1 Requirements→this ADR · 2 DB (evolve model: +`assignedAt`, +`createdByStaffId`, +Staff back-relation; migration; prove additive + no drift) · 3 Relationships · 4 RLS · 5 Business (Assign/Replace/Remove/Get) · 6 API (thin: Zod→business→repo) · 7 Mobile (read-only display) · 8 Web (assign/replace/remove/list) · 9 Testing (duplicate rejected, replace, scopes, RLS, delete-restrict, API authz, web+mobile compile) · 10 Documentation (this ADR final + architecture_index, PERMISSIONS_MATRIX, API_INVENTORY, status, `docs/milestones/M6.5.md`; reconcile stale flag refs; trim ADR-014).

## STOP — Step 1 boundary

This ADR is the M6.5 **Step 1** deliverable. **No Prisma model change, migration, service, API, or UI is written in this step.** Schema evolution is **Step 2** and begins only after approval. **This is NOT the start of Report Cards / M7 — do not implement report-card logic.**
