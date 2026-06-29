/**
 * Design tokens (UI_DESIGN_SYSTEM.md). The single source of truth consumed by
 * the Tailwind preset (web) and NativeWind (mobile). Colors are HSL channels so
 * web can wrap them as `hsl(var(--token))`. Brand hues are placeholders pending
 * §16.7 — only `primary` changes when branding lands.
 */
export const colorTokens = {
  background: "0 0% 100%",
  foreground: "222 47% 11%",
  card: "0 0% 100%",
  cardForeground: "222 47% 11%",
  primary: "221 83% 53%",
  primaryForeground: "0 0% 100%",
  secondary: "210 40% 96%",
  secondaryForeground: "222 47% 11%",
  muted: "210 40% 96%",
  mutedForeground: "215 16% 47%",
  accent: "210 40% 96%",
  accentForeground: "222 47% 11%",
  destructive: "0 84% 60%",
  destructiveForeground: "0 0% 100%",
  success: "142 71% 45%",
  warning: "38 92% 50%",
  info: "221 83% 53%",
  border: "214 32% 91%",
  input: "214 32% 91%",
  ring: "221 83% 53%",
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

/** Border radius scale (px). */
export const radius = { sm: 4, md: 8, lg: 12, full: 9999 } as const;

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
  spacing,
  radius,
  fontSize,
} as const;

export type Tokens = typeof tokens;
