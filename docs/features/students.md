# Feature — Students / People (not yet implemented)

Spec: Dev PRD v1.3 §6, §8.2. Status: `docs/status/Students.md`.

Key rules (when built in M2): students are **records, not users**; guardian↔student is **many-to-many** with one `isPrimary`; bulk CSV/Excel import with validation + error report + `ImportJob`; student lifecycle per academic year (`admitted→active→promoted/retained/transferred/dropped→alumni`). Depends on frozen Authentication.
