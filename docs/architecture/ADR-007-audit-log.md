# ADR-007 — Audit log (append-only, decoupled references)

**Status:** Accepted · **Date:** 2026-06 · **Deciders:** Architecture, Security
**Related:** Dev PRD §6 (AuditLog), §7, §8.12 · ADR-002, ADR-003

## Context
Marks, attendance edits, role/user changes, enrollment/promotion, and payments are dispute-prone and concern minors. We need a trustworthy, immutable record of **who changed what, when, and from/to what value**, that survives even if the referenced operational rows or actor accounts change.

## Decision
A single **append-only `AuditLog`** written by **business services** (not routers, not triggers) on every sensitive mutation:
- Columns: `actorUserId`, `action`, `entityType`, `entityId`, `beforeJson`, `afterJson`, `createdAt`, `schoolId`.
- **References are intentionally loose** (not FKs): `actorUserId` and `entityType + entityId` are **polymorphic** across every table and must remain valid history even if the underlying row is later archived/deleted. This decoupling is the feature, not an oversight.
- Indexed by `([entityType, entityId])` (entity history) and `([schoolId, createdAt])` (audit viewer, newest-first).
- Writes happen in the **same transaction** as the mutation, so an audited change is all-or-nothing. Super-admin-only viewer with filters (§8.12).
- `ImportJob` follows the same "operational history, loose refs" rationale.

## Alternatives Considered
- **Database triggers writing audit rows:** captures everything, but loses the application's actor/intent context, is harder to test, and couples audit to DB internals. Rejected (services have the actor + before/after intent).
- **Temporal/versioned tables:** powerful full-history, but heavyweight and more than dispute-resolution needs (YAGNI). Rejected.
- **FK-linked audit references:** would block deletion/retention of operational rows and break the "history outlives the row" requirement. Rejected.

## Consequences
- (+) Immutable, queryable history independent of operational data lifecycle.
- (+) Captures actor + before/after intent that triggers can't.
- (−) Discipline required: every sensitive service path must write its audit row (covered by tests and the Definition of Done).
- (−) Polymorphic `entityType/entityId` has no referential guarantee — acceptable and intended for an append-only log.
