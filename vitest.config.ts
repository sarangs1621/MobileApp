import { defineConfig } from "vitest/config";

/**
 * Shared Vitest config (CODING_STANDARDS §9). Packages run `vitest run` from
 * their own dir and inherit this. Per-file environment can be overridden with
 * a `// @vitest-environment jsdom` comment (e.g. web component tests).
 * Coverage is opt-in via `vitest run --coverage`; thresholds are added per
 * feature as real logic lands (M0 has almost none).
 */
export default defineConfig({
  // Automatic JSX runtime so component tests need no explicit React import.
  esbuild: { jsx: "automatic" },
  test: {
    globals: false,
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.{test,spec}.{ts,tsx}", "src/**/index.ts", "**/*.d.ts"],
    },
  },
});
