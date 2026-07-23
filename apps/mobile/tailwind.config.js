/**
 * NativeWind config. Semantic ROLE colors mirror the `--token` CSS variables in
 * global.css; the fixed brand/neutral/semantic SCALES + domain accents + type
 * scale mirror `packages/ui/src/tokens.ts` — the reference-of-truth (this JS
 * config can't import the TS token source; ADR-UX1 §6 — keep in sync).
 */

// --- mirror of packages/ui tokens (ADR-UX1 §1) ---
// Heritage branding (2026-07-18): crest maroon brand, deep-maroon `navy`
// surfaces, warm parchment/ink neutrals, muted status hues.
const palette = {
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
};
const domainAccent = {
  attendance: "#0D9488",
  exams: "#7C3AED",
  homework: "#EA580C",
  fees: "#16A34A",
  calendar: "#0891B2",
  messages: "#DB2777",
};
// Heritage gold accent + warm sand hairlines (mirror of web tokens — the design
// handoff's maroon/gold/cream/sand/ink system). `neutral` already carries the
// cream+ink values; `primary` carries maroon. Gold + sand were the gaps.
const gold = {
  100: "#F8F0DC",
  200: "#F2E4C4",
  300: "#E7CE9A",
  400: "#D6B36A",
  500: "#C29A45",
  600: "#A67D2C",
  700: "#8A661F",
  800: "#6F4E13",
};
const sand = { 300: "#E0D3BF", 400: "#C9B89E" };

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        primary: {
          ...palette.primary,
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        navy: palette.navy,
        neutral: palette.neutral,
        success: { ...palette.success, DEFAULT: palette.success[600] },
        warning: { ...palette.warning, DEFAULT: palette.warning[600] },
        danger: palette.danger,
        info: { ...palette.info, DEFAULT: palette.info[600] },
        attendance: domainAccent.attendance,
        exams: domainAccent.exams,
        homework: domainAccent.homework,
        fees: domainAccent.fees,
        calendar: domainAccent.calendar,
        messages: domainAccent.messages,
        gold,
        sand,
        border: "hsl(var(--border))",
      },
      borderColor: { subtle: sand[300], strong: sand[400] },
      // Hanken Grotesk (sans) + Newsreader (serif display) loaded in _layout.
      // `font-sans` → UI sans; `font-display` → heritage serif for headings.
      fontFamily: {
        sans: ["HankenGrotesk_400Regular"],
        display: ["Newsreader_600SemiBold"],
        "display-medium": ["Newsreader_500Medium"],
      },
      // `secondary` omitted — collides with the color; use `text-sm` (14/20).
      fontSize: {
        display: ["28px", "34px"],
        title: ["20px", "28px"],
        body: ["16px", "24px"],
        caption: ["12px", "16px"],
        eyebrow: ["11px", "14px"],
      },
      letterSpacing: { eyebrow: "1.6px" },
      // Warm brown-tinted shadows (RN boxShadow; mirror of web sm/md).
      boxShadow: {
        sm: "0px 1px 3px rgba(58,22,7,0.06)",
        md: "0px 8px 24px rgba(58,22,7,0.10)",
      },
      borderRadius: { xl: "16px", card: "16px", modal: "18px", pill: "999px" },
    },
  },
  plugins: [],
};
