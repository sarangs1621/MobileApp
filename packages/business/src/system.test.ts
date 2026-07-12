import { beforeEach, describe, expect, it, vi } from "vitest";

// Isolated to this file: replace @repo/db so no real Prisma client is created.
const pingDatabase = vi.fn<() => Promise<boolean>>();
vi.mock("@repo/db", () => ({ pingDatabase: () => pingDatabase() }));

import { checkReadiness } from "./system";

describe("checkReadiness", () => {
  beforeEach(() => pingDatabase.mockReset());

  it("reports DB-only readiness when no storage ping is injected", async () => {
    pingDatabase.mockResolvedValue(true);
    const r = await checkReadiness();
    expect(r).toEqual({ ready: true, checks: { database: true } });
    expect(r.checks).not.toHaveProperty("storage");
  });

  it("is not ready when the database is down", async () => {
    pingDatabase.mockResolvedValue(false);
    expect(await checkReadiness()).toEqual({ ready: false, checks: { database: false } });
  });

  it("includes storage and requires both when a storage ping is injected", async () => {
    pingDatabase.mockResolvedValue(true);
    expect(await checkReadiness(async () => true)).toEqual({
      ready: true,
      checks: { database: true, storage: true },
    });
    expect(await checkReadiness(async () => false)).toEqual({
      ready: false,
      checks: { database: true, storage: false },
    });
  });
});
