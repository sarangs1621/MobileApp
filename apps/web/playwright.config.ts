import { defineConfig, devices } from "@playwright/test";

/**
 * E2E smoke configuration. Boots the production server and asserts the app is
 * alive. Browser-driven specs run via `pnpm --filter web test:e2e`; not part of
 * the core CI pipeline (browser download) — see docs/DEFINITION_OF_DONE.md.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm run start",
    url: "http://localhost:3000/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { SKIP_ENV_VALIDATION: "true" },
  },
});
