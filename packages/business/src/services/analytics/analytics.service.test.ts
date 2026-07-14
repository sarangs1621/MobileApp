import type { Repositories } from "@repo/db";
import { createNotificationService } from "@repo/notifications";
import { describe, expect, it } from "vitest";

import type { Principal } from "../../authorization";
import type { ServiceContext } from "../../context";

import { atRiskStudents, feeCollection } from "./analytics.service";

const admin: Principal = {
  userId: "u-admin",
  schoolId: "s-1",
  role: "OFFICE_ADMIN",
  status: "ACTIVE",
};

function makeCtx(repos: Record<string, unknown>): ServiceContext {
  const repositories = repos as unknown as Repositories;
  return {
    user: admin,
    repositories,
    notifications: createNotificationService([]),
    withTransaction: (<T>(fn: (r: Repositories) => Promise<T>) => fn(repositories)) as never,
  };
}

const enr = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  studentId: `st-${id}`,
  schoolId: "s-1",
  academicYearId: "y1",
  classId: "c1",
  sectionId: "sec1",
  status: "ACTIVE",
  ...over,
});

const att = (status: string) => ({ status, session: { date: new Date("2026-06-01") } });

describe("atRiskStudents — attendance weighting + threshold classification (ADR-022 §6)", () => {
  // e1: 33% attendance (< 75) but strong GPA → at-risk via ATTENDANCE
  // e2: 100% attendance + strong GPA → NOT at-risk
  // e3: 100% attendance but GPA 2 (< 4) → at-risk via GPA
  const enrollments = [enr("e1"), enr("e2"), enr("e3")];
  const attendance: Record<string, ReturnType<typeof att>[]> = {
    e1: [att("ABSENT"), att("ABSENT"), att("PRESENT")], // 1/3 = 33.3%
    e2: [att("PRESENT"), att("PRESENT"), att("LEAVE")], // 2/2 countable = 100%
    e3: [att("PRESENT"), att("PRESENT")], // 100%
  };
  const marks: Record<string, { gradePointSnapshot: number }[]> = {
    e1: [{ gradePointSnapshot: 9 }],
    e2: [{ gradePointSnapshot: 9 }],
    e3: [{ gradePointSnapshot: 2 }],
  };

  const ctx = makeCtx({
    academicYears: { findActive: async () => ({ id: "y1", schoolId: "s-1" }) },
    enrollments: {
      listByYear: async () => enrollments,
      findById: async (id: string) => enrollments.find((e) => e.id === id) ?? null,
    },
    // Same fixtures, batch surface (perf rewrite): counts derived from the identical
    // attendance rows the old per-enrollment mock served — expectations unchanged.
    attendanceRecords: {
      statusCountsByEnrollment: async ({ enrollmentIds }: { enrollmentIds: string[] }) =>
        enrollmentIds.flatMap((id) => {
          const byStatus = new Map<string, number>();
          for (const r of attendance[id] ?? []) {
            byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
          }
          return [...byStatus.entries()].map(([status, count]) => ({
            enrollmentId: id,
            status,
            count,
          }));
        }),
    },
    marks: {
      listByEnrollments: async (_schoolId: string, ids: string[]) =>
        ids.flatMap((id) => (marks[id] ?? []).map((m) => ({ ...m, enrollmentId: id }))),
    },
  });

  it("flags only the low-attendance and low-GPA students", async () => {
    const rows = await atRiskStudents(ctx);
    const flagged = rows.map((r) => r.enrollmentId).sort();
    expect(flagged).toEqual(["e1", "e3"]);
  });

  it("computes the weighted attendance % on the flagged rows", async () => {
    const rows = await atRiskStudents(ctx);
    const e1 = rows.find((r) => r.enrollmentId === "e1");
    expect(e1?.attendancePercentage).toBe(33.3); // 1 attended / 3 countable (LEAVE excluded)
  });
});

describe("feeCollection — monthly payment bucketing (ADR-022 §5)", () => {
  const ctx = makeCtx({
    academicYears: { findActive: async () => ({ id: "y1", schoolId: "s-1" }) },
    invoices: {
      aggregateForSchool: async () => ({
        totalBilled: 1000,
        totalCollected: 700,
        totalOutstanding: 300,
        count: 2,
        byStatus: { PAID: 1, PARTIAL: 1 },
      }),
    },
    payments: {
      // Bucketing now happens in SQL (perf rewrite) — the repo contract is pinned by the
      // empirical psql proof in the ADR; here we pin the service passthrough + call shape.
      monthlyTotals: async (schoolId: string, from: Date, to: Date) => {
        expect(schoolId).toBe("s-1");
        expect(from.getTime()).toBeLessThan(to.getTime());
        return [
          { month: "2026-05", collected: 500 },
          { month: "2026-06", collected: 200 },
        ];
      },
    },
  });

  it("sums payments into sorted YYYY-MM buckets", async () => {
    const res = await feeCollection(ctx, {});
    expect(res.monthly).toEqual([
      { month: "2026-05", collected: 500 },
      { month: "2026-06", collected: 200 },
    ]);
    expect(res.totalCollected).toBe(700); // passthrough of the aggregate
  });
});
