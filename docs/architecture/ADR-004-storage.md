# ADR-004 — File storage via private Supabase Storage + signed URLs

**Status:** Accepted · **Date:** 2026-06 · **Deciders:** Architecture, Security
**Related:** Dev PRD §4.4, §8.2, §8.5, §8.6, §10 · ADR-002

## Context
We store homework attachments, **report-card PDFs**, photos, and bulk-import files — some concerning minors. These must never be world-readable, access must be authorized per request, and uploads must be constrained (type/size). This is also the one place where clients may touch Supabase **directly**, so it is exactly where RLS matters.

## Decision
Use **Supabase Storage** with **private buckets**:
- **No public buckets** for student/academic data. Access is via **short-lived signed URLs minted server-side only after a tRPC authz check** (the business service decides who may see a file, then issues the URL).
- **RLS / storage policies** on buckets are the defense-in-depth guard for any direct access (and the authoritative guard if a client is ever given a Supabase token).
- **Uploads validated** server-side: allowed MIME types, max size, and path namespacing by `schoolId`/entity. Generated artifacts (PDFs) are written server-side.

## Alternatives Considered
- **Public buckets / public URLs:** trivial but exposes minors' data to anyone with a link. Rejected outright.
- **External object store (S3/R2):** capable, but adds a vendor and credentials when Supabase Storage already covers the need and integrates with Supabase Auth/RLS. Rejected (YAGNI).
- **Storing files as bytes in Postgres:** bloats the DB, complicates backups, and loses CDN/signed-URL benefits. Rejected.

## Consequences
- (+) Secure-by-default; data is never publicly addressable; access is per-request and time-bounded.
- (+) This is where RLS pulls its weight (ADR-002): direct storage access is policy-gated.
- (−) Signed URLs expire — clients must handle re-fetch; URLs must not be cached long-term.
- (−) Upload validation must be implemented consistently (centralized in the storage service).
