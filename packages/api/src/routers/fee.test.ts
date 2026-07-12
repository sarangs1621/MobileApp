import type { Principal } from "@repo/business";
import { describe, expect, it } from "vitest";

import { appRouter } from "../root";
import { createCallerFactory } from "../trpc";

const createCaller = createCallerFactory(appRouter);

/**
 * Transport-layer behaviour for the M13 fee router (ADR-021): route protection and the
 * permission gates that fail in the service BEFORE any repository call (assertCan(fee:*)
 * → FORBIDDEN), plus Zod input validation (BAD_REQUEST, before the resolver). Lifecycle,
 * scope, snapshot, audit and notifications are unit-tested in @repo/business (fee.service).
 */
const admin: Principal = { userId: "u-a", schoolId: "s-1", role: "OFFICE_ADMIN", status: "ACTIVE" };
const teacher: Principal = { userId: "u-t", schoolId: "s-1", role: "TEACHER", status: "ACTIVE" };
const parent: Principal = { userId: "u-p", schoolId: "s-1", role: "PARENT", status: "ACTIVE" };
const disabled: Principal = { ...admin, status: "DISABLED" };

const validStructure = {
  academicYearId: "y-1",
  name: "Term 1",
  components: [{ name: "Tuition", amount: 100000, order: 0, mandatory: true }],
};

describe("fee router — route protection", () => {
  it("rejects an unauthenticated caller (UNAUTHORIZED)", async () => {
    await expect(createCaller({ user: null }).fee.listStructures({})).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
  it("rejects a DISABLED account (FORBIDDEN)", async () => {
    await expect(createCaller({ user: disabled }).fee.listStructures({})).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("fee router — permission gates (before any repo call)", () => {
  it("a PARENT cannot create a fee structure (FORBIDDEN)", async () => {
    await expect(
      createCaller({ user: parent }).fee.createStructure(validStructure),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("a TEACHER cannot open the admin invoice console (FORBIDDEN — manage-only)", async () => {
    await expect(createCaller({ user: teacher }).fee.listInvoices({})).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
  it("a TEACHER cannot generate invoices (FORBIDDEN)", async () => {
    await expect(
      createCaller({ user: teacher }).fee.generateInvoices({
        feeStructureId: "fs-1",
        sectionId: "sec-1",
        dueDate: "2030-06-30",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("fee router — Zod validation (BAD_REQUEST, before the resolver)", () => {
  it("rejects a structure with no components", async () => {
    await expect(
      createCaller({ user: admin }).fee.createStructure({ ...validStructure, components: [] }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("rejects generate with a malformed dueDate", async () => {
    await expect(
      createCaller({ user: admin }).fee.generateInvoices({
        feeStructureId: "fs-1",
        sectionId: "sec-1",
        dueDate: "30-06-2030",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
