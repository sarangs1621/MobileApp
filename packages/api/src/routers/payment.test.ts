import type { Principal } from "@repo/business";
import { describe, expect, it } from "vitest";

import { appRouter } from "../root";
import { createCallerFactory } from "../trpc";

const createCaller = createCallerFactory(appRouter);

/**
 * Transport-layer behaviour for the M13 payment router (ADR-021): route protection, the
 * permission gates that fail BEFORE any repository call (assertCan(payment:*) / admin-only
 * log → FORBIDDEN), and Zod validation (BAD_REQUEST). The money state machine, guarded
 * concurrency, receipt numbering and notifications are unit-tested in @repo/business.
 */
const teacher: Principal = { userId: "u-t", schoolId: "s-1", role: "TEACHER", status: "ACTIVE" };
const parent: Principal = { userId: "u-p", schoolId: "s-1", role: "PARENT", status: "ACTIVE" };
const disabled: Principal = { ...teacher, status: "DISABLED" };

const validRecord = { invoiceId: "inv-1", amount: 5000, method: "CASH" as const };

describe("payment router — route protection", () => {
  it("rejects an unauthenticated caller (UNAUTHORIZED)", async () => {
    await expect(createCaller({ user: null }).payment.list({})).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
  it("rejects a DISABLED account (FORBIDDEN)", async () => {
    await expect(createCaller({ user: disabled }).payment.list({})).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("payment router — permission gates (before any repo call)", () => {
  it("a PARENT cannot record a payment (FORBIDDEN — payment:record)", async () => {
    await expect(createCaller({ user: parent }).payment.record(validRecord)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
  it("a PARENT cannot open the school-wide payment log (FORBIDDEN — admin-only)", async () => {
    await expect(createCaller({ user: parent }).payment.list({})).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("payment router — Zod validation (BAD_REQUEST, before the resolver)", () => {
  it("rejects a non-positive amount", async () => {
    await expect(
      createCaller({ user: teacher }).payment.record({ ...validRecord, amount: 0 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("rejects an unknown payment method", async () => {
    await expect(
      createCaller({ user: teacher }).payment.record({
        ...validRecord,
        method: "BITCOIN" as never,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
