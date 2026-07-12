import type { Principal } from "@repo/business";
import { describe, expect, it } from "vitest";

import { appRouter } from "../root";
import { createCallerFactory } from "../trpc";

const createCaller = createCallerFactory(appRouter);

/**
 * Transport-layer behaviour for the M14 analytics router (ADR-022). Proves the
 * no-new-permission model at the boundary: reads authorize by REUSING the domain read +
 * an admin guard for school-wide panels — the gates that fail in the service BEFORE any
 * repository call (UNAUTHORIZED / FORBIDDEN), plus Zod validation (BAD_REQUEST).
 * Aggregation math + scope are unit-tested in @repo/business (analytics.service).
 */
const admin: Principal = { userId: "u-a", schoolId: "s-1", role: "OFFICE_ADMIN", status: "ACTIVE" };
const teacher: Principal = { userId: "u-t", schoolId: "s-1", role: "TEACHER", status: "ACTIVE" };
const parent: Principal = { userId: "u-p", schoolId: "s-1", role: "PARENT", status: "ACTIVE" };
const disabled: Principal = { ...admin, status: "DISABLED" };

describe("analytics router — route protection", () => {
  it("rejects an unauthenticated caller (UNAUTHORIZED)", async () => {
    await expect(createCaller({ user: null }).analytics.dashboard()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
  it("rejects a DISABLED account (FORBIDDEN)", async () => {
    await expect(createCaller({ user: disabled }).analytics.schoolSummary()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("analytics router — admin-only school panels (FORBIDDEN before any repo call)", () => {
  it("a TEACHER cannot read the school summary", async () => {
    await expect(createCaller({ user: teacher }).analytics.schoolSummary()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
  it("a PARENT cannot read fee collection", async () => {
    await expect(createCaller({ user: parent }).analytics.feeCollection({})).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
  it("a TEACHER cannot read top performers", async () => {
    await expect(createCaller({ user: teacher }).analytics.topPerformers({})).rejects.toMatchObject(
      { code: "FORBIDDEN" },
    );
  });
});

describe("analytics router — Zod validation (BAD_REQUEST, before the resolver)", () => {
  it("studentSummary requires a studentId", async () => {
    await expect(
      // @ts-expect-error — missing required studentId
      createCaller({ user: parent }).analytics.studentSummary({}),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("classPerformance requires a sectionId", async () => {
    await expect(
      // @ts-expect-error — missing required sectionId
      createCaller({ user: teacher }).analytics.classPerformance({}),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
