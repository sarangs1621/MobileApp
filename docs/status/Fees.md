# Status — Fees & Payment Management

- **Status:** Implemented (M13 Steps 1–9 complete) — awaiting milestone approval.
- **Current milestone:** M13 (Fees & Payment Management) — the fee system over frozen M1–M12.
- **Completion:** 100% of M13 scope.
- **Spec / decision:** `docs/architecture/ADR-021-fees-and-payments.md` · `docs/milestones/M13.md` ·
  `docs/features/fees.md`
- **Model:** `FeeStructure` → `FeeComponent` (Cascade) and `Invoice` → `Payment` (Restrict). **First money domain —
  all money is `Int` paise** (never float). Invoice keeps **both** studentId (person, cross-year ledger) + enrollmentId
  (year/section context; the ADR-020 divergence). Enums `InvoiceStatus` (DRAFT/ISSUED/PARTIAL/PAID/OVERDUE/CANCELLED),
  `PaymentMethod` (CASH/UPI/CARD/BANK_TRANSFER/CHEQUE/ONLINE). All FKs to frozen tables **Restrict**; FeeComponent→
  FeeStructure **Cascade**. CHECKs `paidAmount<=totalAmount`, `balanceAmount=totalAmount-paidAmount`, `Payment.amount>0`;
  partial-unique `(enrollmentId,feeStructureId) WHERE status<>CANCELLED` (no double-billing). Indexes: invoice
  (studentId), (enrollmentId), (status), (dueDate), unique (schoolId,invoiceNumber); payment unique (schoolId,receiptNumber).
- **Lifecycle:** admin `generateInvoices` (section-scoped, idempotent, **total snapshotted** from mandatory components);
  `issueInvoice` DRAFT→ISSUED; `recordPayment` advances paid/balance/status in one tx with an **optimistic paidAmount
  guard** (concurrent-payment safe), ISSUED/PARTIAL→PARTIAL→PAID; `cancelInvoice` unpaid only. **PAID + all Payments
  immutable; Payments append-only.** `OVERDUE` is **compute-on-read**, never stored. Every mutation audited in-tx.
- **Notifications:** post-commit best-effort M10 `INVOICE_ISSUED` (on issue) + `PAYMENT_RECEIVED` (on record) to the
  student's parents (reuse `createBulkNotification`/`parentUserIdsForStudent`; `actionUrl=/fees/invoices/:id`). Emitted
  **inline** (M12 style; new actions, not frozen wraps). +2 `NotificationType` enum values.
- **Read scope:** business-resolved (admin all/console + payment log; teacher own-section invoices read-only; parent
  own-child invoices + receipts). RLS is **coarse** defense-in-depth (admin ALL / parent own-child SELECT / anon none) —
  the app is `service_role`/BYPASSRLS.
- **Surface:** business (`services/fee/*`) · `fee.*` (10) + `payment.*` (4) tRPC routers · mobile (fees picker → ledger
  + outstanding dues → invoice detail + payment history + admin quick-entry → receipt; INVOICE_ISSUED/PAYMENT_RECEIVED
  deep-link to /fees/invoices/:id; **parents view-only**) · web `/fees` console (year/class/section/status filters,
  generate, issue/record/cancel, receipts, CSV, outstanding) + `/fees/structures` (CRUD) + `/fees/receipt/[paymentId]`
  (printable). **Permission-only (no flag).**
- **Permissions:** `fee:manage` (SA/OA), `fee:read` (SA/OA/T/P), `payment:record` (SA/OA), `payment:read` (SA/OA/P).
- **Tests:** 13 business (fee.service — lifecycle, partial payment, transitions, overpay/wrong-state guards, cancel
  guard, parent read-scope, derived OVERDUE, generate idempotency + snapshot, permission matrix) + 13 API transport
  (fee 7 + payment 6) = 26. Migration additive + zero drift (Step 2 — fresh deploy 26 migrations); RLS isolation proven
  empirically (Step 3 — admin all, parent ≠ other parent, anon none); CHECK/partial-unique enforcement proven (Step 2).
  Full gate green (lint/typecheck 14/14, test business **432** / api **359**, db:validate, mobile typecheck, web build
  **38/38 pages**).
- **Frozen?** No (freezes on M13 approval). M1–M12 remained frozen; purely additive (4 tables + 2 enums + 2
  NotificationType values, proven by `migrate diff` zero-ALTER on any frozen table).
- **Known limitations:** no online payment gateway (parents view, office records); no refunds/concessions (out of scope,
  future-additive — append-only Payment + negative FeeComponent); OVERDUE compute-on-read (no scheduler);
  `generateInvoices` section-scoped (frozen enrollment repo untouched); per-user read business-only (coarse RLS); PAID +
  Payments immutable; no stored receipt PDF (render-on-demand).
- **Supersedes:** the Dev PRD v1.3 §8.13 placeholder (Razorpay / `fees` flag / ACCOUNTANT fee-role) — none of those ship
  in M13; the gateway/refunds/GST are out of scope and the domain is core (permission-only).
