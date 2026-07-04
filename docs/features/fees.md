# Feature — Fees (add-on, not yet implemented)

Spec: Dev PRD v1.3 §8.13. Status: `docs/status/Fees.md`. Feature flag: `fees` (ADR-006).

Key rules (when built): fee structures per class/year; invoices per student; Razorpay order + **HMAC verification** + **idempotent webhook**; receipts as `pdfPath` (signed per read); dues view; ACCOUNTANT role active only when `fees` is on. Money = integer minor units. Needs the school's fee structure first.
