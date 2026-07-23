/**
 * Design tokens (UI_DESIGN_SYSTEM.md). The single source of truth consumed by
 * the Tailwind preset (web) and NativeWind (mobile). Colors are HSL channels so
 * web can wrap them as `hsl(var(--token))`. Branding (§16.7) landed 2026-07-18:
 * the Sri Gujarati Vidyalaya heritage identity — maroon/sienna brand (from the
 * 1869 crest), heritage-gold accents, parchment neutrals and warm ink text.
 */
export const colorTokens = {
  background: "40 60% 97%", // cream-50 parchment page
  foreground: "28 36% 10%", // ink-900 warm dark
  card: "0 0% 100%",
  cardForeground: "28 36% 10%",
  primary: "19 72% 28%", // maroon-700 #7A3414 (crest brand)
  primaryForeground: "40 60% 97%",
  secondary: "40 46% 94%", // cream-100 raised surface
  secondaryForeground: "28 36% 10%",
  muted: "40 46% 94%",
  mutedForeground: "30 15% 38%", // ink-500
  accent: "43 67% 92%", // gold-100
  accentForeground: "38 71% 25%", // gold-800
  destructive: "8 63% 43%", // muted heritage red
  destructiveForeground: "40 60% 97%",
  success: "137 33% 36%",
  warning: "38 71% 40%",
  info: "209 51% 36%",
  border: "36 35% 81%", // sand-300 hairline
  input: "36 35% 81%",
  ring: "41 51% 52%", // gold-500 focus ring
} as const;

/** 4px base spacing scale. */
export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

/**
 * Full brand + neutral + semantic + domain-accent scales (ADR-UX1 §1). Fixed
 * values (dark mode is out of scope, so no runtime swap needed) — the Tailwind
 * layer (web preset + mobile config) consumes these; components reference named
 * steps (`bg-primary-600`, `text-neutral-800`), never raw hex. This object is the
 * reference-of-truth; the mobile JS config mirrors it (can't import TS — ADR §6).
 */
export const palette = {
  // Crest maroon / sienna — brand #7A3414 is 600.
  primary: {
    50: "#FBF1E9",
    100: "#F6E3D5",
    200: "#ECC6AC",
    300: "#D89A72",
    400: "#C0703F",
    500: "#A65326",
    600: "#7A3414",
    700: "#642811",
    800: "#4F1E0C",
    900: "#3A1607",
    950: "#2A0F04",
  },
  // Deep maroon — emphasis surfaces (sidebar, page headers). Keeps the `navy`
  // name so existing `bg-navy-*` call sites rebrand without churn.
  navy: {
    50: "#FBF1E9",
    100: "#F6E3D5",
    200: "#ECC6AC",
    300: "#D89A72",
    400: "#C0703F",
    500: "#A65326",
    600: "#8F4019",
    700: "#7A3414",
    800: "#642811",
    900: "#4F1E0C",
    950: "#3A1607",
  },
  // Warm parchment → ink — text/surfaces/borders. Never pure #000/#FFF.
  neutral: {
    50: "#FCF9F3",
    100: "#F6F1E7",
    200: "#EDE4D5",
    300: "#E0D3BF",
    400: "#948676",
    500: "#6E6052",
    600: "#5A4C3F",
    700: "#44382C",
    800: "#33271B",
    900: "#241A11",
    950: "#160F09",
  },
  success: {
    50: "#F1F7F2",
    100: "#E4EFE6",
    200: "#C9DFCF",
    500: "#4C8C5E",
    600: "#3E7A4F",
    700: "#32633F",
  },
  warning: {
    50: "#FBF4E1",
    100: "#F6ECD4",
    200: "#EDD9A9",
    500: "#C28A28",
    600: "#B07A1E",
    700: "#8F6318",
  },
  danger: {
    50: "#FAEDEA",
    100: "#F6E2DC",
    200: "#EBC5BA",
    500: "#C24A36",
    600: "#B23A28",
    700: "#922F20",
  },
  info: {
    50: "#EDF3F8",
    100: "#DEE9F2",
    200: "#BFD5E6",
    500: "#3A6F9F",
    600: "#2E5E8C",
    700: "#254B70",
  },
} as const;

/** Domain accents (subtle — card left-border + icon tint so modules are scannable). */
export const domainAccent = {
  attendance: "#0D9488",
  exams: "#7C3AED",
  homework: "#EA580C",
  fees: "#16A34A",
  calendar: "#0891B2",
  messages: "#DB2777",
} as const;

/** Fixed type scale (ADR-UX1 §2) — size/lineHeight in px, weight numeric. */
export const typography = {
  display: { size: 28, lineHeight: 34, weight: 600 },
  title: { size: 20, lineHeight: 28, weight: 600 },
  body: { size: 16, lineHeight: 24, weight: 400 },
  secondary: { size: 14, lineHeight: 20, weight: 400 },
  caption: { size: 12, lineHeight: 16, weight: 500 },
} as const;

/**
 * Hanken Grotesk (UI sans) + Newsreader (display serif for headings) — the
 * heritage identity pair. ml = future i18n fallback chain.
 */
export const fontFamily = {
  sans: '"Hanken Grotesk", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  display: '"Newsreader", Georgia, "Times New Roman", serif',
  ml: '"Hanken Grotesk", "Noto Sans Malayalam", sans-serif',
} as const;

/** Motion durations in ms (ADR-UX1 §4) — fast, subtle; low-end Android. */
export const motion = { fast: 150, base: 200, panel: 250 } as const;

/** Border radius scale (px). `xl` (16) = modals/sheets (ADR-UX1 §3). */
export const radius = { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 } as const;

/** Typography scale (px). */
export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
  "4xl": 36,
} as const;

export const tokens = {
  color: colorTokens,
  palette,
  domainAccent,
  spacing,
  radius,
  fontSize,
  typography,
  fontFamily,
  motion,
} as const;

export type Tokens = typeof tokens;
