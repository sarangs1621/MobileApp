import { uiPreset } from "@repo/ui/tailwind-preset";
import type { Config } from "tailwindcss";

const config: Config = {
  presets: [uiPreset],
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};

export default config;
