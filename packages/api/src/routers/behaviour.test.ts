import type { Principal } from "@repo/business";
import { describe, expect, it } from "vitest";

import { appRouter } from "../root";
import { createCallerFactory } from "../trpc";

const createCaller = createCallerFactory(appRouter);

/**
 * Transport-layer behaviour for the M12 behaviour router (ADR-020): route protection,
 * the permission gates that fail in the service BEFORE any repository call
 * (assertCan / coarse record gate → FORBIDDEN), and Zod input validation (BAD_REQUEST,
 * before the resolver). Lifecycle, scope, audit and notification are unit-tested in
 * @repo/business (behaviour.service).
 */
const teacher: Principal = {
  userId: "u-teacher",
  schoolId: "s-1",
  role: "TEACHER",
  status: "ACTIVE",
};
const parent: Principal = { userId: "u-parent", schoolId: "s-1", role: "PARENT", status: "ACTIVE" };
const disabled: Principal = { ...teacher, status: "DISABLED" };

const validCreate = {
  studentId: "st-1",
  category: "DISCIPLINE" as const,
  severity: "LOW" as const,
  title: "t",
  description: "d",
};

describe("behaviour router — route protection", () => {
  it("rejects an unauthenticated caller (UNAUTHORIZED)", async () => {
    await expect(createCaller({ user: null }).behaviour.list({})).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
  it("rejects a DISABLED account (FORBIDDEN)", async () => {
    await expect(createCaller({ user: disabled }).behaviour.list({})).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("behaviour router — permission gates (before any repo call)", () => {
  it("a PARENT cannot record an incident (FORBIDDEN)", async () => {
    await expect(
      createCaller({ user: parent }).behaviour.create(validCreate),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("a TEACHER cannot open the admin console list (FORBIDDEN — manage-only)", async () => {
    await expect(createCaller({ user: teacher }).behaviour.list({})).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("behaviour router — Zod validation (BAD_REQUEST, before the resolver)", () => {
  it("rejects create with an empty title", async () => {
    await expect(
      createCaller({ user: teacher }).behaviour.create({ ...validCreate, title: "" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("rejects an invalid severity", async () => {
    await expect(
      createCaller({ user: teacher }).behaviour.create({
        ...validCreate,
        severity: "SEVERE" as never,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("rejects listByStudent without a studentId", async () => {
    await expect(
      createCaller({ user: parent }).behaviour.listByStudent({} as never),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
