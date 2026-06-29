# UI Design System — School Management Portal

The shared visual language for **web (Next.js + TailwindCSS + shadcn/ui)** and **mobile (Expo + NativeWind)**. Tokens live once in **`packages/ui`** and are consumed by both (Tailwind theme on web; the same token object via NativeWind on mobile) so the brand is defined in one place.

**Principles:** professional · modern · minimal · fast · accessible · responsive · consistent. Avoid unnecessary animation. **Bilingual (English + Malayalam)** and **large tap targets** are first-class, not afterthoughts.

> **Brand pending [CONFIRM §16.7].** The school's logo, colours, and domain are not yet supplied. The values below are a **clean light identity** (matching the proposal) used as **themeable defaults**; only the `primary`/brand hues change when branding lands — the scales, components, and a11y rules do not.

---

## 1. Color tokens
Semantic, not literal — components reference roles, never raw hex. Authored as **HSL CSS variables** (shadcn convention) on web and the same token names on mobile. Ship **light first**; dark mode is a token swap (optional, post-core).

| Token | Role | Light default (HSL) |
|---|---|---|
| `background` / `foreground` | app surface / default text | `0 0% 100%` / `222 47% 11%` |
| `card` / `card-foreground` | card surface / text | `0 0% 100%` / `222 47% 11%` |
| `popover` / `popover-foreground` | overlays | `0 0% 100%` / `222 47% 11%` |
| `primary` / `primary-foreground` | brand actions | `221 83% 53%` / `0 0% 100%` **(placeholder)** |
| `secondary` / `secondary-foreground` | secondary actions | `210 40% 96%` / `222 47% 11%` |
| `muted` / `muted-foreground` | subtle bg / secondary text | `210 40% 96%` / `215 16% 47%` |
| `accent` / `accent-foreground` | hover/active subtle | `210 40% 96%` / `222 47% 11%` |
| `destructive` / `-foreground` | delete/irreversible | `0 84% 60%` / `0 0% 100%` |
| `success` / `warning` / `info` | status | `142 71% 45%` / `38 92% 50%` / `221 83% 53%` |
| `border` / `input` / `ring` | hairlines / field border / focus ring | `214 32% 91%` / `214 32% 91%` / `221 83% 53%` |

**Domain status colors** (single source for badges/cells): attendance `PRESENT`=success, `ABSENT`=destructive, `HALF_DAY`=warning, `LEAVE`=info, `HOLIDAY`=muted; leave/invoice statuses map `PENDING`=warning, `APPROVED`/`PAID`=success, `REJECTED`/`OVERDUE`=destructive. Grades use a neutral scale, never red/green (avoids judgment + colorblind issues).

## 2. Typography scale
- **Families:** UI sans = system stack (`-apple-system, Segoe UI, Roboto, …`). **Malayalam = bundled `Noto Sans Malayalam`** (verified on iOS + Android, Dev PRD §9/§8.11). One mono token for codes/IDs/receipts.
- **Scale** (rem / px @16, with line-height): `xs` .75/12 (1rem), `sm` .875/14 (1.25rem), `base` 1/16 (1.5rem), `lg` 1.125/18, `xl` 1.25/20, `2xl` 1.5/24, `3xl` 1.875/30, `4xl` 2.25/36.
- **Weights:** 400 regular, 500 medium, 600 semibold, 700 bold. Headings 600–700; body 400; labels 500.
- **Malayalam needs more vertical room** — apply a slightly larger line-height for `ml` locale; never clip ascenders/descenders. Don't letter-space Malayalam.

## 3. Spacing scale
4px base unit; tokens are multiples: `0=0, 1=4, 2=8, 3=12, 4=16, 5=20, 6=24, 8=32, 10=40, 12=48, 16=64`. Use tokens only — **no arbitrary pixel values**. Default component padding `4` (16px); page gutters `4`–`6`; section gaps `6`–`8`.

## 4. Border radius
`sm`=4px, `md`=8px (**default** for buttons/inputs/cards), `lg`=12px (dialogs/sheets), `full`=9999 (avatars/pills). Consistent rounding across web and mobile.

## 5. Shadows / elevation
Minimal and purposeful: `sm` (subtle card lift), `md` (dropdowns/popovers), `lg` (dialogs/sheets). Flat by default; elevation only signals layering, never decoration. On mobile map to platform elevation/shadow equivalents.

## 6. Icon usage
- **lucide** icon set (`lucide-react` web / `lucide-react-native` mobile) for a single consistent style. Sizes: `16` (inline/dense), `20` (default), `24` (touch/nav).
- **Meaningful icons need an accessible label** (`aria-label` / `accessibilityLabel`); purely decorative icons are hidden from assistive tech. Never convey status by icon/color alone — pair with text.

## 7. Button variants
- **Variants:** `primary` (one primary action per view), `secondary`, `outline`, `ghost` (low-emphasis/toolbar), `destructive` (irreversible — always confirm via dialog), `link`.
- **Sizes:** `sm` (32px h), `md` (40px h, default), `lg` (48px). **Mobile minimum touch target ≥ 44×44px** regardless of visual size.
- **States:** default / hover / active / focus-visible (ring) / disabled / **loading** (spinner + disabled, preserves width). Icon-with-text keeps a `2` gap; icon-only buttons require a label.

## 8. Form controls
- Controls: `input`, `textarea`, `select`, `combobox`, `checkbox`, `radio`, `switch`, **date picker (IST-aware)**, **file upload** (validates MIME + size client-side; server re-validates — ADR-004).
- **Every control has a visible `<label>`** (placeholders are not labels). Helper text below; error text replaces helper in `destructive` with the field outlined and `aria-invalid`/`aria-describedby` wired.
- Backed by **React Hook Form + Zod** (the same `packages/validation` schema as the API). Errors map to fields from the API's flattened `fieldErrors` (API §6). All labels/errors localized (en+ml).
- Disable submit while pending; show inline saving state; never double-submit.

## 9. Tables (web-primary)
- For dense admin data (rosters, marks, dues, audit). Structure: sticky header, comfortable default density (compact toggle for big grids), zebra optional, right-align numbers, monospace for IDs/amounts.
- **States are mandatory:** loading (skeleton rows), empty (illustration + primary action), error (retry). **Pagination is cursor-based** by default (API §8); bulk-select with a sticky action bar for batch ops (e.g. attendance, import fixes).
- **On mobile, tables degrade to a card list** (§11) — never horizontal-scroll a wide table on a phone.

## 10. Cards
The default container for grouped content (dashboard tiles, student summary, a homework item). Padding `4`; optional header (title + actions), body, footer. `border` + `radius md` + optional `shadow sm`. Keep one concern per card; avoid nesting cards.

## 11. Dialogs & sheets
- **Dialog (modal)** for focused confirm/short forms on web; **bottom sheet** on mobile for the same. Use a **destructive confirm dialog** for any irreversible action (delete, disable, promote-bulk, drop) naming the consequence.
- Focus is trapped, returns to trigger on close; `Esc`/overlay-tap closes non-destructive dialogs; primary action is keyboard-reachable. Don't stack dialogs.

## 12. Mobile navigation (Expo / expo-router)
- **Role-based bottom tab bar** after sign-in (≤5 tabs). Parent example: Home · Attendance · Homework · Notices · Profile; teacher: Home · Attendance · Marks · Homework · More. Stack navigation within a tab; modals/sheets for create/edit.
- **Parent child-switcher** is a persistent control in the header/Home (Dev PRD §8.10). Tab targets ≥44px; labels always shown (icon-only tabs fail low-literacy users). Respect safe areas; support Android back.

## 13. Desktop layouts (web)
- **App shell:** left **sidebar** (role-aware nav, collapsible) + top bar (school/brand, locale switch, user menu, notifications). Content max-width for readability; data screens go full-width.
- **Breakpoints:** `sm` 640 · `md` 768 · `lg` 1024 · `xl` 1280. Sidebar collapses to a drawer below `lg`. Layouts are responsive but **heavy admin is web-primary** (Dev PRD §2) — phones get the read/daily-flow subset, not dense builders.

## 14. Accessibility rules
- **WCAG 2.1 AA:** text contrast ≥ 4.5:1 (≥3:1 large); UI/border contrast ≥ 3:1. Verify the brand `primary` against `primary-foreground` when §16.7 lands.
- **Visible focus** on every interactive element (the `ring` token); full **keyboard navigation** on web; logical tab order.
- **Semantics:** real landmarks/roles, labelled controls, `aria-live` for async results (e.g. "attendance saved"). **Never rely on color alone** — pair with text/icon.
- **Touch targets ≥ 44×44px**; honor OS **dynamic type / font scaling** (test Malayalam at large sizes); respect **reduced-motion** (we use little animation anyway).
- Set the document/`lang`/locale per user language so screen readers pronounce Malayalam correctly.
