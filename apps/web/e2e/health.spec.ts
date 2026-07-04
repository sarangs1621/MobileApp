import { expect, test } from "@playwright/test";

test("health endpoint reports ok", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { status: string; service: string };
  expect(body.status).toBe("ok");
  expect(body.service).toBe("web");
});

// Note: page-level e2e (login/dashboard) requires a live Supabase project and is
// run against staging, not in this offline pipeline.
