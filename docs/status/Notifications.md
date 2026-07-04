# Status — Notifications

- **Status:** Infrastructure only (interfaces in `@repo/notifications`); delivery not built
- **Current milestone:** later — push + scheduled absence/reminder jobs; WhatsApp add-on (`whatsapp`)
- **Completion:** ~10% (abstraction + adapter interfaces exist; no provider adapters, no `registerDevice`)
- **Dependencies:** Authentication (frozen), `DeviceToken` model, Expo Push / MSG91 / Gupshup
- **Frozen?** No
- **Known issues:** provider adapters unimplemented; channel policy per ADR-005; `deregisterDevice` + token pruning (REVIEW_FINDINGS B13).
- **Next work:** its milestone — Push/SMS/WhatsApp/InApp adapters behind the existing `NotificationService`.
- **Spec:** Dev PRD v1.3 §4.6, §8.9, §9.
