import { expect, test } from "@playwright/test";

test("health endpoint reports ok", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { status: string; service: string };
  expect(body.status).toBe("ok");
  expect(body.service).toBe("web");
});

test("home page renders the foundation landing", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "School Portal" })).toBeVisible();
});
