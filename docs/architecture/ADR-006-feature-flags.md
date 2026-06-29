# ADR-006 — Feature flags for add-ons

**Status:** Accepted · **Date:** 2026-06 · **Deciders:** Architecture, Product
**Related:** Dev PRD §1, §4.5, §8.13–§8.17 · ADR-008

## Context
The product is one generous **Core** plus modular **add-ons** (`fees`, `whatsapp`, `timetable`, `analytics`, `offline`) sold per tier. Add-ons must be **built but off** so the contracted tier can enable them — and so others can be switched on later **with no rebuild or migration**.

## Decision
Use a database-backed flag: `FeatureFlag(schoolId, key, enabled)` with `@@unique([schoolId, key])`.
- Add-on **routers and UI both check the flag.** Off ⇒ the UI hides the surface **and** the endpoint returns `FORBIDDEN` (never rely on the UI alone).
- Flags are **seeded per contracted tier** at deploy; flipping one on is a data change, not a code change.
- Flag keys live in `packages/constants` (single source of truth, no string literals at call sites).
- Keyed by `schoolId` so the same mechanism works unchanged when the product becomes multi-school (ADR-008).

## Alternatives Considered
- **Env-var flags:** simple, but global per-deploy, not per-school, and toggling needs a redeploy. Rejected (blocks the "enable later, no rebuild" requirement and future multi-tenancy).
- **Separate deployments per tier:** maximal isolation, but multiplies ops and diverges codebases. Rejected.
- **Third-party flag service (LaunchDarkly etc.):** overkill and a cost for a finite set of commercial add-ons (YAGNI). Rejected.

## Consequences
- (+) Add-ons ship dark and enable instantly per school; no migration to turn one on.
- (+) Per-school keying is future-SaaS-ready.
- (−) Every add-on must be guarded in **both** API and UI — enforced in review and tests (an authorization test per flagged procedure).
- (−) Flag checks add a small read; cache per request.
