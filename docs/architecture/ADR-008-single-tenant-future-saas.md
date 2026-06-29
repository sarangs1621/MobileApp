# ADR-008 — Single-tenant now, SaaS-ready later

**Status:** Accepted · **Date:** 2026-06 · **Deciders:** Architecture, Product
**Related:** Dev PRD §2, §6 (School / schoolId), §4.5 · ADR-006

## Context
This is a **paid single-school** deployment. The client may later want a **multi-school SaaS**. The mandate is explicit: design for future extensibility **without** prematurely building multi-tenancy or adding unnecessary abstractions.

## Decision
Build **single-tenant**, but namespace data for a clean future port:
- Every core table carries a **`schoolId` scalar** (kept **loose**, not a FK — see Dev PRD §6 note). There is exactly one `School` row today.
- **Auth and routing are single-tenant** — no tenant resolution, no per-tenant subdomains, no tenant middleware. We do **not** build any of that now (YAGNI).
- The **business layer always scopes queries by `schoolId`**, so multi-tenant correctness is already exercised on every read/write even with one school.
- Feature flags are already **per-school** (ADR-006).

## Alternatives Considered
- **Full multi-tenancy now** (tenant auth, isolation, per-tenant config): large effort for value the client hasn't bought; violates YAGNI and the "don't prematurely optimize" mandate. Rejected.
- **No `schoolId` at all** (add it later): would force a painful backfill + relation rewrite across every table when SaaS arrives. Rejected.
- **Schema-per-tenant / DB-per-tenant:** strongest isolation, but heavy ops and migration burden, unjustified for one school. Rejected (revisit only if a future enterprise tenant demands isolation).

## Consequences
- (+) The path to SaaS is incremental: promote `schoolId` to a real FK + add `School` relations, introduce tenant resolution in auth/routing, and turn on per-school flags — **no rewrite of feature code**, because scoping already exists.
- (+) No multi-tenant complexity or cost today.
- (−) `schoolId` discipline must be enforced (every query scoped) — covered by repositories (ADR-003) and review.
- (−) Loose `schoolId` has no DB-level referential guarantee while single-tenant; acceptable with one `School` row and centralized scoping.
