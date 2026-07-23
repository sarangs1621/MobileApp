import { uiPreset } from "@repo/ui/tailwind-preset";
import type { Config } from "tailwindcss";

/**
 * Web Tailwind config. Extends the shared preset with the Sri Gujarati Vidyalaya
 * design-handoff palette (design_handoff_school_portal/_ds tokens) so screens can
 * use the handoff's exact names: maroon/gold/cream/sand/ink + status tints.
 * Warm brown-tinted shadows replace the defaults; fadeUp/popIn power the
 * entrance + modal motion spec.
 */
const config: Config = {
  presets: [uiPreset],
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        maroon: {
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
        gold: {
          100: "#F8F0DC",
          200: "#F2E4C4",
          300: "#E7CE9A",
          400: "#D6B36A",
          500: "#C29A45",
          600: "#A67D2C",
          700: "#8A661F",
          800: "#6F4E13",
        },
        cream: { 50: "#FCF9F3", 100: "#F6F1E7", 200: "#EDE4D5" },
        sand: { 300: "#E0D3BF", 400: "#C9B89E" },
        ink: {
          300: "#B6A998",
          400: "#948676",
          500: "#6E6052",
          700: "#44382C",
          800: "#33271B",
          900: "#241A11",
          950: "#160F09",
        },
        // Handoff status tints (green-100/600 etc. equal the preset's
        // success/warning/danger/info steps; exposed under the handoff names).
        green: { 100: "#E4EFE6", 600: "#3E7A4F" },
        amber: { 100: "#F6ECD4", 600: "#B07A1E" },
        red: { 100: "#F6E2DC", 600: "#B23A28" },
        blue: { 100: "#DEE9F2", 600: "#2E5E8C" },
      },
      borderColor: { subtle: "#E0D3BF", strong: "#C9B89E", "on-dark": "rgba(252,249,243,0.16)" },
      boxShadow: {
        sm: "0 1px 3px rgba(58,22,7,0.06)",
        DEFAULT: "0 2px 8px rgba(36,22,10,0.07)",
        md: "0 8px 24px rgba(58,22,7,0.10)",
        lg: "0 16px 40px rgba(58,22,7,0.16)",
        modal: "0 24px 60px rgba(22,15,9,0.30)",
      },
      borderRadius: { card: "16px", modal: "18px" },
      fontFamily: {
        mono: ["var(--font-mono)", "ui-monospace", '"SF Mono"', "Menlo", "monospace"],
      },
      letterSpacing: { eyebrow: "0.16em" },
      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        popIn: {
          from: { opacity: "0", transform: "translateY(10px) scale(0.98)" },
          to: { opacity: "1", transform: "none" },
        },
      },
      animation: {
        "fade-up": "fadeUp 0.5s ease-out both",
        "pop-in": "popIn 0.25s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
