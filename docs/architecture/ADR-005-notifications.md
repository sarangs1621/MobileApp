# ADR-005 — Notification provider abstraction

**Status:** Accepted · **Date:** 2026-06 · **Deciders:** Architecture
**Related:** Dev PRD §3, §4.6, §8.9, §9 · ADR-001

## Context
Notifications span multiple channels (in-app, push, SMS, WhatsApp) and multiple third-party providers (Expo Push → FCM/APNs, MSG91/Gupshup for SMS, Gupshup for WhatsApp). OTP delivery (owned by Supabase Auth) uses an SMS provider too. If provider SDKs are called from feature code, swapping a provider means editing call sites everywhere, credentials get duplicated, and channel policy is scattered.

## Decision
All notification delivery sits behind **one interface in `packages/notifications`**:
```
Business service → NotificationService.send(event)
                     → PushAdapter | SmsAdapter | WhatsAppAdapter | InAppAdapter
```
- Feature code calls `NotificationService` with a channel-agnostic **event**; the service resolves recipients, user locale, and **channel policy** (push primary/free; SMS/WhatsApp only for critical events; WhatsApp only when the `whatsapp` flag is on).
- Each `NotificationAdapter` implements `send()` for one channel; the concrete provider is selected by **environment/config**, never by feature code.
- The **OTP SMS provider** is configured in the same place the `SmsAdapter` reads, so there is a single provider source of truth (no duplicate credentials). Application code never calls a provider SDK for OTP.

## Alternatives Considered
- **Call provider SDKs directly from features:** simplest now, but couples every feature to a vendor and scatters channel policy and credentials. Rejected.
- **Single provider, no abstraction:** brittle — we already need ≥3 providers and want to switch SMS/WhatsApp vendors by region/price. Rejected.
- **Third-party notification orchestrator (e.g. Courier/Knock):** more than a single-school product needs and another vendor/cost (YAGNI). Rejected.

## Consequences
- (+) Providers are swapped by config; channel policy lives in one place; adapters are unit-testable with a fake `DeliveryResult`.
- (+) One source of truth for provider credentials, OTP included.
- (−) A thin abstraction layer to maintain; adapters must map our event model to each provider's payload/template format.
