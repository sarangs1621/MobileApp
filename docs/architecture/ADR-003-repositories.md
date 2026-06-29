# ADR-003 — Repositories as the data-access boundary

**Status:** Accepted · **Date:** 2026-06 · **Deciders:** Architecture
**Related:** Dev PRD §4.1, §4.2 · ADR-002

## Context
Business services need data access that is testable, consistent (school-scoping, soft-delete/lifecycle rules), and decoupled from the ORM. If Prisma is called directly from routers or scattered through services, queries duplicate, scoping is easy to forget, and unit tests require a real database.

## Decision
`packages/db` exposes **repositories** — the **only** module that imports `@prisma/client`. Business services depend on repository interfaces, not on Prisma.
- Each aggregate gets a repository (e.g. `StudentRepository`, `AttendanceRepository`) returning domain-shaped data/types from `packages/types`.
- Cross-aggregate writes that must be atomic (e.g. mark entry + audit) run in a Prisma transaction owned by the repository/service, not the router.
- Repositories centralize `schoolId` scoping and lifecycle filters so callers can't forget them.

## Alternatives Considered
- **Raw Prisma in routers/services:** fastest to write, but couples every layer to the ORM, duplicates scoping, and makes services hard to unit-test. Rejected.
- **Generic `Repository<T>` abstraction:** over-engineered for our finite, well-known aggregates (YAGNI); hides Prisma's strengths. Rejected — we use concrete, purpose-named repositories.
- **Active-record models:** mixes persistence into domain objects, violating separation of concerns and the pure-`core` rule. Rejected.

## Consequences
- (+) Services are unit-testable with a fake repository; no DB needed for use-case tests.
- (+) One place to enforce scoping, indexes-aware queries, and transactions.
- (+) The ORM is swappable in principle and never leaks past `db`.
- (−) Some boilerplate per aggregate; we accept it for the testability/clarity it buys.
