# Product

## Register

product

## Users

Staff (super admin, admin, teachers) and parents of Sri Gujarathi Vidhyalaya, a single-school deployment in India. Staff work at desks on the web app during the school day (attendance, exams, fees, reports); parents mostly use the mobile app, often on low-end Android, some preferring Malayalam. Users are task-focused, not tech enthusiasts.

## Product Purpose

A school management portal covering the full academic workflow: people, attendance, exams, report cards, homework, fees, documents, announcements, messaging, and analytics. Success = staff complete daily administrative tasks quickly and parents trust what they see about their child.

## Brand Personality

Institutional, calm, trustworthy. The interface should feel like a well-run school office: orderly, legible, unhurried. No playfulness at the expense of clarity.

## Anti-references

- Consumer-flashy SaaS landing aesthetics (gradients, glassmorphism, oversized type).
- Cluttered legacy ERP screens (endless toolbars, dense mystery icons).
- Anything that looks like a template demo rather than the school's own tool.

## Design Principles

1. **Earned familiarity** — standard affordances, same vocabulary on every screen (ADR-UX1 component kit).
2. **One token source** — all color/type/spacing come from `packages/ui/src/tokens.ts`; never raw hex in components.
3. **Legible first** — Inter, fixed type scale, ≥4.5:1 body contrast, warm-gray neutrals (never pure black/white).
4. **Restrained color** — institutional blue for actions, deep navy for emphasis surfaces, domain accents only as subtle scanning aids.
5. **Fast and quiet motion** — 150–250 ms, state-conveying only; low-end Android is the floor.

## Accessibility & Inclusion

WCAG AA contrast, visible focus rings on every interactive element, labels on all form fields, `prefers-reduced-motion` respected, Malayalam locale support (Inter + Noto Sans Malayalam fallback).
