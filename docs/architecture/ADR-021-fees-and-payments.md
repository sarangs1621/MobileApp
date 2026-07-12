# ADR-021 — Fees & Payment Management — M13

**Status:** Accepted — **M13 implemented (Steps 1–9; awaiting milestone approval)** · **Date:** 2026-07-12 · design approved 2026-07-12 (parents view-only / office records; refunds + concessions deferred; two new `NotificationType` values; OVERDUE compute-on-read; both `studentId`+`enrollmentId` on Invoice) · **Deciders:** Architecture, Product
**Related:** ADR-002 (business layer is the authorization gate; routers thin) · ADR-003 (repositories; Prisma only in `packages/db`) ·
ADR-007 (AuditLog in-transaction) · ADR-008 (loose `schoolId`) ·
ADR-010 (Student identity vs Enrollment placement — Invoice keys to **both**, §1) ·
ADR-012 (M5 — the **snapshot-at-a-moment** grade precedent + the race-safe register `ensure` this ADR reuses for numbering + generation) ·
ADR-014 (M7 — report-card **snapshot** immutability precedent) ·
ADR-015 (`createdByStaffId → Staff` / `receivedByStaffId → Staff` actor idiom) ·
**ADR-018 (M10 — the in-app `Notification`/`NotificationRecipient` layer + the canonical `*AndNotify` composition this milestone emits into)** ·
ADR-019 / ADR-020 (M11/M12 — the additive-companion-table + coarse-RLS + flagged-deviation precedent this ADR follows) ·
DATABASE_CONVENTIONS (**Money = `Int` minor units / paise**; `Restrict` on money/audit tables; `@db.Date`; in-tx audit; money movement in `$transaction`) ·
PERMISSIONS_MATRIX (`fee:*` / `payment:*` added here)
**Precedes:** M13 (Fees & Payment Management) — this ADR fixes the design; Steps 2–9 execute it.

---

> **Milestone framing.** M13 adds a **school fee system** for Indian schools over frozen M1–M12 — fee structures,
> invoice generation, partial payments, receipts, a parent fee portal, and M10 notifications. It is **purely additive** —
> **four** new tables (`FeeStructure`, `FeeComponent`, `Invoice`, `Payment`), **two** new enums (`InvoiceStatus`,
> `PaymentMethod`), **two** new `NotificationType` enum **values** (`INVOICE_ISSUED`, `PAYMENT_RECEIVED`), four new
> permissions, and business `*AndNotify` compositions — with **zero change to any frozen M1–M12 table or business
> service** (to be proven by `prisma migrate diff` at Step 2). **No GST, payroll, accounting/Tally, online payment
> gateway, refund workflow, scholarship engine, hostel, transport, inventory, or library** (brief OUT OF SCOPE).
> Notification fan-out is **in-app only**, via M10.

## Context

This is the **first money domain** in the codebase — no `Invoice`/`Payment`/`Fee*` model exists (verified), and no
`Decimal`/money column exists anywhere in `schema.prisma`. So M13 is genuinely net-new (unlike M12, where leave was
already built). The conventions already anticipate it: DATABASE_CONVENTIONS §12 mandates **`Int` minor units (paise),
never `Float`** for money, and the Restrict rule (§ FK) already names `Invoice` and `Payment` as money-of-record tables.

The brief's own text is internally inconsistent, and this ADR resolves it toward the **tighter** constraint (the
explicit OUT OF SCOPE list + Definition of Done, which override the aspirational intro prose):

| Intro prose says | OUT OF SCOPE / DoD says | Resolution (this ADR) |
|---|---|---|
| Admins do "refunds" | "**Refund workflow**" out of scope; refunds "**additive later**" | **Deferred** (deviation #1). Payment is append-only; a refund is a future negative/`REFUND` row. Data model does **not** preclude it. |
| Admins do "concessions" | "**Scholarship engine**" out of scope; DoD lists no concessions | **Deferred** (deviation #2). A concession is a future negative `FeeComponent` or per-invoice adjustment. |
| Parents can "**pay**" | "**No online gateway integration yet**" | **Parents cannot transact without a gateway.** v1 parent = **view dues + view/download receipts**; payment **recording** is admin office-side (cash/UPI/cheque/etc.). This is the one product decision that materially shapes Step 6 — flagged for approval at the STOP (deviation #3). |

## Decision

### 1. Four additive tables + two enums

```
School ─(loose)─ FeeStructure ──1:N──▶ FeeComponent            (a named, per-year fee template; components are lines)
                     │  academicYearId (→ AcademicYear, Restrict)
                     ▼
School ─(loose)─ Invoice ──1:N──▶ Payment                       DRAFT→ISSUED→PARTIAL→PAID (immutable) · CANCELLED
   studentId   (→ Student,    Restrict)   fee history follows the person across years (Step-7 student ledger)
   enrollmentId(→ Enrollment, Restrict)   the year/section/class the invoice was raised for
   feeStructureId (→ FeeStructure, Restrict)  the template it was generated from (blocks structure deletion)
   createdByStaffId (→ Staff, Restrict)   B3 audit actor
   └─(issue)──▶ M10 Notification(type=INVOICE_ISSUED,  actionUrl=/fees/invoices/:id) → student's parents
   Payment.receivedByStaffId (→ Staff, Restrict)  who collected it
   └─(record)─▶ M10 Notification(type=PAYMENT_RECEIVED, actionUrl=/fees/invoices/:id) → student's parents
```

**`FeeStructure`** — `id, schoolId (loose, ADR-008), academicYearId, name, description String?, active Boolean
@default(true), createdAt, updatedAt`. FK `academicYear` **Restrict**. Indexes: `[schoolId]`, `[academicYearId]`.

**`FeeComponent`** — `id, feeStructureId, name, amount Int (paise), order Int, mandatory Boolean @default(true)`. FK
`feeStructure` **Cascade** — a component is a composition child of its structure (the AnnouncementAttachment /
HomeworkAttachment cascade precedent). The money-**of-record** is the invoice's snapshotted total (§2), never the
component, so Cascade here is safe; the real deletion guard is `Invoice → FeeStructure` **Restrict**. Index
`[feeStructureId]`.

**`Invoice`** — `id, schoolId (loose), studentId, enrollmentId, feeStructureId, invoiceNumber (unique per school),
issueDate @db.Date, dueDate @db.Date, status InvoiceStatus @default(DRAFT), totalAmount Int, paidAmount Int
@default(0), balanceAmount Int, remarks String?, createdByStaffId, createdAt, updatedAt`. FKs `student`, `enrollment`,
`feeStructure`, `createdBy (→ Staff)` all **Restrict**.

- **Both `studentId` AND `enrollmentId`** — the same justified divergence from the ADR-011 enrollment-only idiom that
  ADR-020 §1 established for `BehaviourIncident`: `enrollmentId` pins the year/section context an invoice is raised for;
  `studentId` gives the **cross-year student ledger** the brief's Step 7 requires ("Student ledger"). Both indexed.
- **`invoiceNumber` unique per school** — `@@unique([schoolId, invoiceNumber])`. Per-school-sequential (Indian schools
  want an auditable running number). Generation is **race-safe** — the unique constraint is the backstop and the number
  is minted in-tx with a unique-violation retry, reusing the **M5 register `ensure` race hardening** (ADR-012), not a
  new scheme. Format `INV-{academicYear}-{zero-padded seq}`.
- Indexes (per brief — student, invoiceNumber, status, dueDate): `[studentId]`, `[enrollmentId]`, `@@unique([schoolId,
  invoiceNumber])`, `[status]`, `[dueDate]`, plus `[schoolId]`, `[feeStructureId]`.

**`Payment`** — `id, invoiceId, receiptNumber (unique per school), paymentDate @db.Date, amount Int (paise), method
PaymentMethod, referenceNo String?, remarks String?, receivedByStaffId, createdAt`. FKs `invoice`, `receivedBy (→
Staff)` **Restrict**. **`@@unique([schoolId, receiptNumber])`** (schoolId denormalised onto Payment for the tenant-scoped
receipt sequence + RLS; loose, ADR-008). Numbering race-safe like the invoice number. Indexes `[invoiceId]`,
`[receiptNumber]`. **A `Payment` is never updated or deleted** (brief: "Payment never deleted") — an append-only money
ledger (the AuditLog / attendance-correction precedent). A mistake is corrected by a future refund row, not an edit.

**`enum InvoiceStatus { DRAFT ISSUED PARTIAL PAID OVERDUE CANCELLED }`** — the lifecycle (§3). **`OVERDUE` is a
compute-on-read display state, never stored** (§3).
**`enum PaymentMethod { CASH UPI CARD BANK_TRANSFER CHEQUE ONLINE }`** — the brief set.

**CHECK constraints (raw SQL in the migration, mirrored by a schema comment — DATABASE_CONVENTIONS §3):**
- `Invoice`: `totalAmount >= 0`, `paidAmount >= 0`, **`paidAmount <= totalAmount`**, **`balanceAmount = totalAmount -
  paidAmount`** (brief Step 2 requirements — balance is a derived-but-stored value the CHECK keeps honest).
- `Payment`: `amount > 0` (a payment moves money; a zero/negative "payment" is a future refund, not this table).

### 2. Money invariants (the blind spots to write down now)

1. **Invoice total is snapshotted at generation, not computed live.** `Invoice.totalAmount` = sum of the structure's
   `mandatory` `FeeComponent.amount` **frozen at generate-time**. A later `updateStructure` (add/remove/reprice a
   component) **must not** retroactively change already-generated invoices — the **M5 grade-snapshot / M7
   report-card-snapshot** immutability precedent. New structure edits affect only invoices generated **after** the edit.
2. **`generateInvoices` is idempotent — no double-billing.** Re-running generate over a section must not raise a second
   invoice for the same `(enrollmentId, feeStructureId)`. Guarded by **`@@unique([enrollmentId, feeStructureId])`**
   *(partial — `WHERE status <> 'CANCELLED'`, so a cancelled invoice can be re-issued)* + skip-if-exists — the **M5
   register `ensure`** idempotency precedent.

### 3. Invoice lifecycle & immutability

`DRAFT ──issue──▶ ISSUED ──payment(partial)──▶ PARTIAL ──payment(clears)──▶ PAID`   (+ `→ CANCELLED`, `⟿ OVERDUE` derived)

- **`generateInvoices`** creates `DRAFT` invoices (bulk, over a structure × its enrolled students; idempotent §2).
  **`issueInvoice`** moves `DRAFT → ISSUED` and emits the M10 `INVOICE_ISSUED` notification (§4). A `DRAFT` invoice is
  editable (dueDate/remarks); once **ISSUED** the amounts are locked.
- **`recordPayment`** (the money-movement path) inserts a `Payment`, then in the **same `$transaction`** updates the
  invoice `paidAmount += amount`, `balanceAmount = total − paid`, and advances `status`: `ISSUED/PARTIAL → PARTIAL` while
  `balance > 0`, `→ PAID` when `balance = 0`. Audited in-tx (ADR-007). The CHECK (`paid <= total`) rejects an overpayment.
- **`PAID` is terminal and immutable** (brief: "Invoice immutable after PAID") — no further edit/payment/cancel; a
  `recordPayment`/`updateInvoice`/`cancelInvoice` on a `PAID` invoice throws `Conflict`.
- **`cancelInvoice`** moves `DRAFT/ISSUED → CANCELLED` **only while `paidAmount = 0`** (no money has moved). Once any
  payment exists, cancel is refused (a refund — deferred — is the future path). CANCELLED is terminal.
- **`OVERDUE` is compute-on-read, never a stored status.** There is **no cron infrastructure** in the codebase, and the
  whole system computes-on-read (attendance %, exam summaries). An invoice **displays** OVERDUE when `dueDate < today
  (IST) AND status IN (ISSUED, PARTIAL)`; the stored `status` column **never holds `OVERDUE`**. "Overdue reminder
  (future)" (brief) confirms no eager transition/scheduler is in scope for v1.

### 4. Notifications — the canonical M10 `*AndNotify` composition (ADR-018 §3), for two events

Both follow the **exact** ADR-018 §3 pattern — a **business-layer** composer calls the domain action, then **after
commit, best-effort**, resolves recipients (reuse `studentParents.listByStudent → parent → user`) and calls the existing
M10 emit (`createBulkNotification` → one `Notification` + N `NotificationRecipient` rows, audited). A notification-write
failure is caught+logged, **never** fails the committed money action. The router calls the composer (one thin business call).

| Event | Composer | Recipients | Type / priority | actionUrl |
|---|---|---|---|---|
| **Invoice issued** | `issueInvoiceAndNotify` (new `services/fee/`) | the student's parents | `INVOICE_ISSUED` / `NORMAL` | `/fees/invoices/:id` |
| **Payment received** | `recordPaymentAndNotify` (new `services/payment/`) | the student's parents | `PAYMENT_RECEIVED` / `NORMAL` | `/fees/invoices/:id` |

**Overdue reminder is future** (brief) — no third notification in v1 (would need the deferred scheduler).

### 5. Two new `NotificationType` enum values (`INVOICE_ISSUED`, `PAYMENT_RECEIVED`) — additive, not a table ALTER

M10's `NotificationType` has no fee-related value. Adding **`INVOICE_ISSUED`** and **`PAYMENT_RECEIVED`** (matching the
existing `HOMEWORK_PUBLISHED`/`EXAM_PUBLISHED`/`REPORT_CARD_PUBLISHED` idiom) is an `ALTER TYPE … ADD VALUE` in the M13
migration — **an enum extension, not a frozen-*table* ALTER** (the M12 deviation-#2 precedent), additive by construction.
*Fallback if vetoed:* reuse `SYSTEM` + the deep-link `actionUrl` — functional but weaker for client filtering/iconography.

### 6. RLS (Step 3) — coarse, defense-in-depth (business is the real gate; app is `service_role`/BYPASSRLS)

| Table | Admin (SA/OA) | Teacher | Parent | Anon |
|---|---|---|---|---|
| `FeeStructure` / `FeeComponent` | ALL | read | none (parents see their invoices, not templates) | none |
| `Invoice` | ALL | **read** (brief: "Teacher read only") | **own child** SELECT (via `enrollment → student` guardian link) | none |
| `Payment` | ALL | read | **own child** SELECT (via `invoice → enrollment → student`) | none |

Empirical isolation proofs (Step 3, rolled back): **anon denied**; **parent ≠ another parent's child**; **teacher read
but no write**; **admin sees all**. Per-row parent targeting is the standard business + coarse-RLS split (ADR-019/020 §5–6
precedent). Reuse existing helpers (`is_my_child_enrollment` / guardian link); **no new SQL function** expected.

### 7. Permissions — four new grants (the M7/M11/M12 manage/scoped/read shape); no feature flag

- **`fee:manage`** (`FEE_MANAGE`) — **SA/OA**: create/update fee structures, `generateInvoices`, `issueInvoice`,
  `cancelInvoice`, read all.
- **`fee:read`** (`FEE_READ`) — **SA/OA/T/P**: admin → all; teacher → **read-only**; **parent → own-child** invoices +
  dues (the fee portal).
- **`payment:record`** (`PAYMENT_RECORD`) — **SA/OA**: `recordPayment` (office collection). *(Refunds — deferred —
  would extend this grant.)*
- **`payment:read`** (`PAYMENT_READ`) — **SA/OA/P**: admin → all; **parent → own-child** receipts + payment history.
  Teacher: none (payment history is not a teacher concern; teachers read invoices for dues visibility only).
- **No feature flag** — fees are core (the ADR-013/M6 … ADR-020/M12 precedent; no flag infra exists).

### 8. Storage — none in v1

Receipts are **rendered on demand** (web print view / mobile receipt screen) from the `Payment` + `Invoice` data — no
stored receipt PDF, no new bucket (the M7 report-card renderer deferred-PDF precedent; the brief's "download receipt" is
a client-side render/print, not a persisted file). M13 adds **zero** storage surface.

## Deviations from the literal brief (flagged for veto at STOP)

1. **Refunds are deferred** — the brief's intro lists admin "refunds" but OUT OF SCOPE excludes "Refund workflow" and
   says refunds are "additive later." Payment is append-only; a refund is a future negative/`REFUND` row. The data model
   does not preclude it.
2. **Concessions are deferred** — intro lists "concessions"; "Scholarship engine" is out of scope and the DoD omits them.
   A concession is a future negative `FeeComponent` or per-invoice adjustment.
3. **Parents view, admins record.** "Parents can pay" is impossible without the (out-of-scope) online gateway. v1 parent
   = view dues + view/download receipts; payment **recording** is admin office-side. **This changes what Step 6 (mobile)
   ships** — the one product decision to confirm at the STOP.
4. **Two new `NotificationType` enum values** (`INVOICE_ISSUED`, `PAYMENT_RECEIVED`) — an additive `ALTER TYPE … ADD
   VALUE`, not a frozen-table ALTER (§5). Fallback: reuse `SYSTEM`.
5. **`Invoice` keeps both `studentId` and `enrollmentId`** — the justified ADR-020 divergence (student ledger needs the
   cross-year person view; enrollment pins the year/section context).
6. **`OVERDUE` is compute-on-read, not a stored/transitioned status** (§3) — no cron infra; the codebase's
   compute-on-read posture; "overdue reminder (future)" per the brief.

## Alternatives considered

1. **`Decimal`/`Float` money columns.** Rejected — DATABASE_CONVENTIONS §12 mandates `Int` paise (float rounding is
   unacceptable on a money path).
2. **Compute `Invoice.totalAmount` live from components on every read.** Rejected — a later structure edit would silently
   restate issued invoices (§2); snapshot-at-generate is the M5/M7 immutability precedent.
3. **Store `OVERDUE` via a nightly job.** Rejected — no scheduler infra (YAGNI); compute-on-read is exact and free.
4. **A separate `sequence` table / DB sequence for numbering.** Rejected as premature — the `@@unique` + in-tx
   count-and-retry (M5 `ensure`) is sufficient and already a proven pattern; revisit only if throughput demands it.
5. **Persist a receipt PDF (new bucket).** Rejected for v1 — render-on-demand needs no storage surface (M7 precedent);
   add a bucket only if archived/emailed receipts come into scope.
6. **Build refund + concession now.** Rejected — explicitly out of scope; append-only `Payment` + `FeeComponent` keep
   both future-additive.

## Consequences

- (+) **Purely additive** — four tables + two enums + two enum values + `*AndNotify` composers; every frozen M1–M12 table
  and business service untouched (to be proven by `migrate diff` at Step 2).
- (+) **Reuses M10 for delivery** — both events use the canonical `*AndNotify` path; no new emit infrastructure.
- (+) **Money-safe by construction** — `Int` paise, CHECK (`paid <= total`, `balance = total − paid`), append-only
  `Payment`, in-tx money movement, snapshotted totals, idempotent generation, race-safe numbering.
- (+) **Minimal permission surface** — four `fee:*`/`payment:*` grants (the M7/M11/M12 shape); no flag.
- (−) **No online payment** (deviation #3) — parents view; the office records. The gateway is a future seam.
- (−) **No refunds / concessions** (deviations #1–2) — future-additive; the model does not preclude them.
- (−) **Per-row parent targeting is business + coarse RLS** (§6) — the codebase's standing defense-in-depth posture.
- (−) **`PAID` invoices + all `Payment`s are immutable** (§3) — a correction is a new (future refund) row, not an edit.

## STOP — Step 1 boundary — ✅ APPROVED 2026-07-12

Step 1 approved with the product decisions folded in: **parents view dues + receipts; admins record payments** (no
online gateway); **refunds + concessions deferred** (model stays future-additive); **two new `NotificationType` values**
(`INVOICE_ISSUED`/`PAYMENT_RECEIVED`, not the `SYSTEM` fallback); **`OVERDUE` compute-on-read** (never stored); **both
`studentId`+`enrollmentId` on `Invoice`**. All eight deviations stand as designed. Steps 2–9 executed it: additive
migration (zero-ALTER, zero-drift — Step 2), coarse RLS with empirical isolation proofs (Step 3), business layer (Step 4),
thin API + validation (Step 5), mobile parent portal + admin quick-entry (Step 6), web console + structures + receipts +
CSV (Step 7), tests + full gate green (Step 8), this documentation (Step 9). **M13 complete — awaiting milestone approval
to freeze.**

## Implementation notes (Steps 2–9, folded back)

- **Money = `Int` paise everywhere** (DATABASE_CONVENTIONS §12) — the first money domain; CHECKs (`paid<=total`,
  `balance=total-paid`, `amount>0`) proven empirically at Step 2.
- **Numbering via P2002 retry, not the advisory lock** — the count-and-retry-on-unique idiom already in the codebase
  (`submission.service`) was chosen over a novel `pg_advisory_xact_lock`; the `@@unique` index is the correctness
  backstop. `INV-{year}-{seq}` per-year, `RCPT-{seq}` continuous per school.
- **`recordPayment` hardened with an optimistic guard** (`applyPayment` = conditional `updateMany` on the expected
  `paidAmount`) so concurrent payments can't lose an update — the M4/M5 conditional-transition precedent; rolls back +
  retries on a lost race.
- **Notifications emitted inline** (deviation #8) — `issueInvoice`/`recordPayment` call `createBulkNotification` directly
  (the M12 behaviour style) rather than a named `*AndNotify` composer, since they are new M13 actions, not frozen wraps.
- **`OVERDUE` realised in the mapper** — `mapInvoice(row, todayIst)` substitutes OVERDUE for a stored ISSUED/PARTIAL row
  past its `dueDate`; the stored `status` column never holds OVERDUE; business transitions read the stored status.
- **Web filters** — `academicYearId`/`sectionId` relation filters were added to `listInvoices` (via `feeStructure`/
  `enrollment` relations) so the console's Class/Section/Year filters resolve server-side; additive, within-milestone.
