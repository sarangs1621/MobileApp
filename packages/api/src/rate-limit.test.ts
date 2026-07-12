import { describe, expect, it } from "vitest";

import { checkRateLimit, rateLimitFor } from "./rate-limit";

describe("rateLimitFor", () => {
  it("limits the named sensitive mutations", () => {
    expect(rateLimitFor("homework.publish")).toEqual({ limit: 20, windowMs: 60_000 });
    expect(rateLimitFor("document.approve")).toEqual({ limit: 20, windowMs: 60_000 });
  });

  it("limits upload-URL mints but not downloads or reads", () => {
    expect(rateLimitFor("document.uploadUrl")).toEqual({ limit: 30, windowMs: 60_000 });
    expect(rateLimitFor("settings.logoUploadUrl")?.limit).toBe(30);
    expect(rateLimitFor("document.downloadUrl")).toBeNull();
    expect(rateLimitFor("homework.list")).toBeNull();
  });
});

describe("checkRateLimit", () => {
  it("allows up to the limit, then blocks, then recovers after the window", () => {
    const key = `test-${Math.random()}`;
    const t0 = 1_000;
    // 3 allowed within the window...
    expect(checkRateLimit(key, 3, 1000, t0)).toBe(true);
    expect(checkRateLimit(key, 3, 1000, t0 + 100)).toBe(true);
    expect(checkRateLimit(key, 3, 1000, t0 + 200)).toBe(true);
    // ...4th blocked.
    expect(checkRateLimit(key, 3, 1000, t0 + 300)).toBe(false);
    // After the window resets, allowed again.
    expect(checkRateLimit(key, 3, 1000, t0 + 1000)).toBe(true);
  });

  it("tracks keys independently", () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    expect(checkRateLimit(a, 1, 1000, 0)).toBe(true);
    expect(checkRateLimit(a, 1, 1000, 0)).toBe(false);
    expect(checkRateLimit(b, 1, 1000, 0)).toBe(true); // b unaffected by a
  });
});
