# ADR-002 — Single tRPC API with application-enforced authorization

**Status:** Accepted · **Date:** 2026-06 · **Deciders:** Architecture
**Related:** Dev PRD §4.2, §4.4, §7, §10 · ADR-003, ADR-004

## Context
One backend serves both Next.js web and an Expo mobile app, across five roles, with an audit trail and (under the `fees` flag) money movement. We need end-to-end type safety, one auditable place for authorization and use-case logic, and a clear answer to "where is access control enforced?" given that Prisma connects to Postgres over a **privileged** connection.

## Decision
Expose a **single tRPC API** (hosted by the Next.js app) consumed by both clients, and make **authorization application-enforced**:
- **Routers are transport-only:** validate input with a shared Zod schema (`packages/validation`), apply the **coarse role guard**, then delegate to a **business service** (`packages/business`). No business logic in routers.
- **Business services apply fine-grained scope** (teacher→divisions, class-teacher→own division, guardian→linked students, office→school-wide non-destructive, super-admin→all) and write `AuditLog` rows on sensitive mutations.
- **Supabase RLS is defense-in-depth, not the primary gate.** Because Prisma bypasses RLS (privileged connection), the authoritative checks live in TypeScript where they are testable; RLS guards Storage/signed-URLs/direct access and acts as a backstop (ADR-004).

## Alternatives Considered
- **REST/OpenAPI:** mature, but loses end-to-end inference and needs hand-maintained client types for two apps. Rejected.
- **GraphQL:** flexible, but heavier (schema, resolvers, N+1 management) than this single-team, single-tenant product needs (YAGNI). Rejected.
- **RLS as the primary authorization mechanism:** would require every data path to run as the request user (no privileged Prisma connection) and pushes complex scope logic into SQL policies that are hard to test and audit. Rejected as primary; kept as defense-in-depth.

## Consequences
- (+) End-to-end types across web + mobile; one place for authz + audit.
- (+) Thin routers + service layer make use-cases unit-testable without HTTP.
- (−) We must be disciplined: no Prisma in routers, no business logic in routers, RLS never assumed sufficient for the tRPC path.
- (−) tRPC couples clients to TypeScript (acceptable — the whole stack is TS).
