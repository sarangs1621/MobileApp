import type { Principal } from "@repo/business";
import { describe, expect, it } from "vitest";

import { appRouter } from "../root";
import { createCallerFactory } from "../trpc";

const createCaller = createCallerFactory(appRouter);

/**
 * Transport-layer behavior for the M6 homework/submission routers: route protection
 * (protectedProcedure), permission gates that fail in the service BEFORE any
 * repository call, the storageProcedure precondition, and Zod input validation.
 * Business rules, scope, the lifecycle, §7 invariants, and races are unit-tested in
 * @repo/business (homework.services / homework.concurrency).
 */

const superAdmin: Principal = {
  userId: "u-super",
  schoolId: "s-1",
  role: "SUPER_ADMIN",
  status: "ACTIVE",
};
const parent: Principal = { userId: "u-parent", schoolId: "s-1", role: "PARENT", status: "ACTIVE" };
const accountant: Principal = {
  userId: "u-acc",
  schoolId: "s-1",
  role: "ACCOUNTANT",
  status: "ACTIVE",
};
const disabled: Principal = { ...parent, status: "DISABLED" };

describe("homework routers — route protection", () => {
  it("rejects an unauthenticated caller (UNAUTHORIZED)", async () => {
    await expect(createCaller({ user: null }).homework.list({})).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
  it("rejects a DISABLED account (FORBIDDEN)", async () => {
    await expect(createCaller({ user: disabled }).homework.list({})).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("homework routers — permission gates (fail in the service before any repo call)", () => {
  it("a parent cannot create homework (FORBIDDEN)", async () => {
    await expect(
      createCaller({ user: parent }).homework.create({
        subjectId: "sub-1",
        sectionId: "sec-1",
        title: "x",
        dueDate: "2026-08-01",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("an accountant cannot read homework (FORBIDDEN)", async () => {
    await expect(createCaller({ user: accountant }).homework.list({})).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
  it("a parent cannot review a submission (FORBIDDEN)", async () => {
    await expect(
      createCaller({ user: parent }).submission.review({
        submissionId: "sub-1",
        decision: "REVIEWED",
        body: "x",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("homework routers — Zod input validation (BAD_REQUEST, before the resolver)", () => {
  const c = createCaller({ user: superAdmin });

  it("rejects an empty homework title", async () => {
    await expect(
      c.homework.create({
        subjectId: "sub-1",
        sectionId: "sec-1",
        title: "  ",
        dueDate: "2026-08-01",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("rejects an unknown review decision", async () => {
    await expect(
      // @ts-expect-error — invalid enum value is the point of the test
      c.submission.review({ submissionId: "sub-1", decision: "SUBMITTED", body: "x" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("homework routers — storageProcedure precondition", () => {
  it("mint endpoints require a host-wired StoragePort (PRECONDITION_FAILED when absent)", async () => {
    await expect(
      createCaller({ user: superAdmin }).homework.attachmentUploadUrl({
        homeworkId: "hw-1",
        fileName: "a.pdf",
        mimeType: "application/pdf",
        sizeBytes: 10,
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
});
