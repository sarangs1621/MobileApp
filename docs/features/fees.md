# Feature — Fees & Payment Management (M13)

**Spec:** `docs/architecture/ADR-021-fees-and-payments.md` · `docs/milestones/M13.md`
**Status:** Implemented (M13) — awaiting milestone approval.

> Supersedes the Dev PRD v1.3 §8.13 placeholder: M13 ships **no Razorpay gateway, no `fees` feature flag, and no
> ACCOUNTANT fee role** — the gateway is out of scope (parents view, the office records), the domain is core
> (permission-only), and receipts render on demand (no stored `pdfPath`). Money is `Int` minor units, as the PRD required.

A school fee system for Indian schools over frozen M1–M12 — fee structures, invoice generation, partial payments,
receipts, a parent fee portal, and M10 notifications. The **first money domain** in the codebase: all money is stored
as **`Int` paise** (minor units), never float (DATABASE_CONVENTIONS §12). On issue an invoice emits an M10
`Notification(type=INVOICE_ISSUED)`; on payment it emits `PAYMENT_RECEIVED` — both to the student's parents. **No GST,
payroll, accounting/Tally, online payment gateway, refund workflow, scholarship engine, hostel, transport, inventory,
or library.**

## Model (grain)

```
School ─(loose)─ FeeStructure ──1:N──▶ FeeComponent      (a named, per-year fee template; components are lines)
                     │ academicYearId (→ AcademicYear, Restrict)
                     ▼
School ─(loose)─ Invoice ──1:N──▶ Payment                 DRAFT→ISSUED→PARTIAL→PAID (immutable) · CANCELLED
  studentId (→ Student, Restrict)      fee history follows the person across years (the student ledger)
  enrollmentId (→ Enrollment, Restrict) the year/section/class the invoice was raised for
  feeStructureId (→ FeeStructure, Restrict)  blocks structure deletion once billed
  createdByStaffId (→ Staff, Restrict)  B3 audit actor
  └─(issue)──▶ M10 Notification(type=INVOICE_ISSUED,  actionUrl=/fees/invoices/:id) → student's parents
  Payment.receivedByStaffId (→ Staff, Restrict)  who collected it
  └─(record)─▶ M10 Notification(type=PAYMENT_RECEIVED, actionUrl=/fees/invoices/:id) → student's parents
```

- **FeeStructure** — `schoolId` (loose, ADR-008), `academicYearId`, `name`, `description?`, `active @default(true)`.
- **FeeComponent** — `feeStructureId`, `name`, `amount` (paise), `order`, `mandatory @default(true)`. FK →FeeStructure
  **Cascade** (a composition child; the money-of-record is the invoice's snapshotted total, not this template line).
- **Invoice** — keeps **BOTH `studentId` and `enrollmentId`** (the ADR-020 divergence: the student ledger needs the
  cross-year person view; enrollment pins the year/section context). `invoiceNumber` unique per school (`INV-{year}-{seq}`,
  per-year sequence), `issueDate`/`dueDate` `@db.Date`, `status @default(DRAFT)`, `totalAmount`/`paidAmount`/
  `balanceAmount` (paise), `remarks?`, `createdByStaffId`. All FKs **Restrict**.
- **Payment** — **append-only, never updated/deleted**. `invoiceId`, `receiptNumber` unique per school (`RCPT-{seq}`,
  continuous), `paymentDate` `@db.Date`, `amount` (paise), `method`, `referenceNo?`, `remarks?`, `receivedByStaffId`.
- CHECKs: Invoice `paidAmount <= totalAmount`, `balanceAmount = totalAmount - paidAmount`, amounts `>= 0`; Payment
  `amount > 0`. Partial-unique `(enrollmentId, feeStructureId) WHERE status <> 'CANCELLED'` — no double-billing.
- `enum InvoiceStatus` (DRAFT · ISSUED · PARTIAL · PAID · OVERDUE · CANCELLED) · `enum PaymentMethod` (CASH · UPI · CARD
  · BANK_TRANSFER · CHEQUE · ONLINE). **+2 `NotificationType` values** (INVOICE_ISSUED · PAYMENT_RECEIVED).

## Invoice lifecycle & money invariants (ADR-021 §2/§3)

- **`generateInvoices`** (admin) bulk-creates `DRAFT` invoices for a section's currently-billable enrollments
  (ADMITTED/ACTIVE) from one structure. **Idempotent** — a student who already has a non-CANCELLED invoice for that
  structure is skipped (no double-billing). The **total is SNAPSHOTTED** from the structure's *mandatory* components at
  generate-time (the M5/M7 snapshot precedent) — a later `updateStructure` never restates issued invoices. Numbers are
  race-safe (per-year count + unique-index backstop with bounded P2002 retry).
- **`issueInvoice`** `DRAFT→ISSUED` and emits `INVOICE_ISSUED`. **`recordPayment`** inserts a `Payment` and advances the
  invoice `paidAmount`/`balanceAmount`/`status` in **one transaction**, guarded by an **optimistic `paidAmount` check**
  so concurrent payments can't lose an update (the M4/M5 conditional-transition hardening). `ISSUED/PARTIAL → PARTIAL`
  while a balance remains, `→ PAID` when it clears (ISSUED→PAID directly on a full payment). Overpayment is refused
  (service guard + DB CHECK). **PAID is terminal and immutable.**
- **`cancelInvoice`** `DRAFT/ISSUED → CANCELLED` **only while unpaid**; once a payment exists cancel is refused (a refund
  is out of scope). CANCELLED is terminal.
- **`OVERDUE` is compute-on-read, never stored** — an invoice displays OVERDUE when `dueDate < today (IST) AND status IN
  (ISSUED, PARTIAL)`. The stored `status` column never holds OVERDUE (no cron infra; "overdue reminder" is future).
- Every mutation writes **AuditLog in the same transaction** (ADR-007). Payments are never deleted.

## Notifications (reuse M10, ADR-018 §3)

`issueInvoice` and `recordPayment` each commit + audit in-tx, then **after commit, best-effort**, resolve the student's
parents (reuse M10 `parentUserIdsForStudent`) and call `createBulkNotification` (one `Notification` + N recipients). A
notify failure is caught+logged, never fails the committed money action. Emitted **inline** (the M12 behaviour style) —
these are new M13 actions, not frozen wraps, so no `*AndNotify` composer symbol exists.

## Read scope (ADR-021 §6)

Business-resolved (RLS is coarse defense-in-depth — admin ALL / parent own-child SELECT on Invoice+Payment / anon none):

| Viewer | Sees |
|---|---|
| Admin (`fee:manage`) | all structures + invoices (the console, filterable by year/class/section/status) + the payment log |
| Teacher (`fee:read`) | invoices/dues for own-section students, **read-only** (no payment access) |
| Parent (`fee:read`/`payment:read`) | own child's invoices, dues, and receipts (the fee portal) |

## Surface

- **Business:** `services/fee/*` (fee.service, payment.service, scope, mappers). Prisma only in repositories
  (`fee-structure`, `invoice` incl. guarded `applyPayment`, `payment`).
- **API:** `fee.*` (10) + `payment.*` (4) tRPC routers — thin transport, Zod in `@repo/validation`.
- **Mobile:** `/fees` (student picker, role-scoped) → `/fees/student/[studentId]` (ledger + outstanding dues) →
  `/fees/invoices/[id]` (detail + payment history + **admin quick payment entry**) → `/fees/receipt/[paymentId]`.
  INVOICE_ISSUED / PAYMENT_RECEIVED deep-link to `/fees/invoices/:id`. **Parents view only** (no online gateway).
- **Web:** `/fees` admin console (year/class/section/status filters, generate, issue/record/cancel, receipts, CSV export,
  outstanding total) · `/fees/structures` (fee-structure CRUD) · `/fees/receipt/[paymentId]` (printable receipt).
- **Permissions:** `fee:manage` (SA/OA), `fee:read` (SA/OA/T/P), `payment:record` (SA/OA), `payment:read` (SA/OA/P).
  **Permission-only — no feature flag.**

## Tests

Business (fee.service, 13): invoice lifecycle (issue-only-from-DRAFT, partial→PAID, ISSUED→PAID direct), partial payment
+ receipt numbering, overpay/non-positive/wrong-state rejects, cancel guard (refused once paid), parent read-scope,
derived OVERDUE, generate (idempotent skip + mandatory-only snapshot + non-billable filtered), permission matrix
(non-admin refused manage/generate/issue/record; teacher refused admin console). API transport (13): protection +
permission gates (before any repo call) + Zod. Migration additive + zero drift (Step 2); RLS isolation proven
empirically (Step 3 — admin all, parent ≠ other parent, anon none).

## Known limitations

- **No online payment gateway** — parents view dues + receipts; payment **recording** is admin office-side (cash/UPI/
  cheque/…). The gateway is a future seam.
- **No refunds / concessions** — out of scope; `Payment` is append-only and `FeeComponent` supports a future negative
  line, so both stay future-additive.
- **OVERDUE is compute-on-read** — no scheduler; there is no eager overdue transition or reminder in v1.
- **`generateInvoices` is section-scoped** — the frozen enrollment repo is untouched; class/year coverage iterates
  sections in the web console.
- **Per-user read scope is business-resolved** — RLS is coarse (the app is `service_role`/BYPASSRLS); the business gate
  + tests carry confidentiality.
- **PAID invoices + all Payments are immutable** — a correction is a new (future refund) row, not an edit.
- **No stored receipt PDF** — receipts render on demand (web print / mobile screen).
