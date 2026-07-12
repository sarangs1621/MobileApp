import type { Principal } from "@repo/business";
import { describe, expect, it } from "vitest";

import { appRouter } from "../root";
import { createCallerFactory } from "../trpc";

const createCaller = createCallerFactory(appRouter);

/**
 * Transport-layer behaviour for the M17 system ops procedures (ADR-025 §9). Only
 * the paths that short-circuit BEFORE any DB call are exercised: the `system:manage`
 * gate (SUPER_ADMIN only) fails in the business layer before diagnostics/audit read.
 * The ops logic + gating is unit-tested in @repo/business (system-ops.test).
 */
const superAdmin: Principal = {
  userId: "u-s",
  schoolId: "s-1",
  role: "SUPER_ADMIN",
  status: "ACTIVE",
};
const officeAdmin: Principal = {
  userId: "u-o",
  schoolId: "s-1",
  role: "OFFICE_ADMIN",
  status: "ACTIVE",
};
const teacher: Principal = { userId: "u-t", schoolId: "s-1", role: "TEACHER", status: "ACTIVE" };

describe("system ops — route protection", () => {
  it("rejects an unauthenticated caller (UNAUTHORIZED)", async () => {
    await expect(createCaller({ user: null }).system.diagnostics()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

describe("system ops — system:manage is SUPER_ADMIN only (before any DB call)", () => {
  it("rejects OFFICE_ADMIN even though it holds settings:manage (FORBIDDEN)", async () => {
    const caller = createCaller({ user: officeAdmin });
    await expect(caller.system.diagnostics()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.system.auditExport({ limit: 10 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(caller.system.cacheClear()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects a TEACHER (FORBIDDEN)", async () => {
    await expect(
      createCaller({ user: teacher }).system.auditExport({ limit: 10 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("liveness/readiness stay public (no auth needed)", async () => {
    const res = await createCaller({ user: null }).system.live();
    expect(res.status).toBe("ok");
  });

  // SUPER_ADMIN happy-path (diagnostics/audit read) hits the DB and is covered
  // in @repo/business system-ops.test, not here (no live repo in transport tests).
  void superAdmin;
});
