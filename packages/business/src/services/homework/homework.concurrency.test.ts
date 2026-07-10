import { ConflictError } from "@repo/core";
import type { Repositories } from "@repo/db";
import { createNotificationService } from "@repo/notifications";
import { describe, expect, it, vi } from "vitest";

import type { Principal } from "../../authorization";
import type { ServiceContext } from "../../context";

import { reviewSubmission } from "./feedback.service";
import { closeHomework, publishHomework } from "./homework.service";
import { resubmitHomework } from "./submission.service";

/**
 * REAL review-vs-resubmit concurrency (ADR-013 R2, M4/M5 guarded-transition
 * standard). One SUBMITTED submission (attempt 1); a teacher review and a parent
 * resubmit race with Promise.all against a STATEFUL repo whose `review`/`resubmit`
 * model the DB's guarded `updateMany WHERE status=… AND attempt=<seen>`: the
 * check-and-set runs with NO await between them, so exactly ONE wins and the loser
 * gets null → Conflict — never a silent overwrite.
 */

const teacher: Principal = {
  userId: "u-teacher",
  schoolId: "s-1",
  role: "TEACHER",
  status: "ACTIVE",
};
const parent: Principal = { userId: "u-parent", schoolId: "s-1", role: "PARENT", status: "ACTIVE" };
const stamps = { createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01") };

const published = {
  id: "hw-1",
  schoolId: "s-1",
  academicYearId: "y-1",
  subjectId: "sub-1",
  sectionId: "sec-1",
  status: "PUBLISHED",
  dueDate: new Date("2099-12-31T00:00:00.000Z"),
};
const enrollment = {
  id: "en-1",
  schoolId: "s-1",
  studentId: "st-1",
  academicYearId: "y-1",
  sectionId: "sec-1",
  status: "ACTIVE",
};

function makeStateful(initialStatus: "SUBMITTED" | "RETURNED") {
  const row = {
    id: "sub-1",
    schoolId: "s-1",
    homeworkId: "hw-1",
    enrollmentId: "en-1",
    submittedByParentId: "p-1",
    note: "n" as string | null,
    status: initialStatus as string,
    attempt: 1,
    isLate: false,
    firstSubmittedAt: stamps.createdAt,
    submittedAt: stamps.createdAt,
    reviewedByStaffId: null as string | null,
    reviewedAt: null as Date | null,
    ...stamps,
  };

  const repos = {
    audit: { record: vi.fn(async () => undefined) },
    staff: { findByUserId: async () => ({ id: "sf-1", schoolId: "s-1", userId: "u-teacher" }) },
    parents: { findByUserId: async () => ({ id: "p-1", schoolId: "s-1", userId: "u-parent" }) },
    studentParents: { studentIdsForParent: async () => ["st-1"] },
    teacherAssignments: { findByTriple: async () => ({ id: "ta-1" }) },
    subjects: { findById: async () => ({ id: "sub-1", name: "Math" }) },
    sections: { findById: async () => ({ id: "sec-1", name: "A" }) },
    homework: { findById: async () => published },
    enrollments: { findById: async () => enrollment, listByStudent: async () => [enrollment] },
    submissionAttachments: { createMany: async () => 1 },
    homeworkFeedback: { create: vi.fn(async () => ({ id: "fb-1" })) },
    homeworkSubmissions: {
      // Pre-tx reads yield so both racers observe attempt=1 before either mutates.
      findById: async () => {
        await Promise.resolve();
        return { ...row };
      },
      findByHomeworkEnrollment: async () => {
        await Promise.resolve();
        return { ...row };
      },
      // Guarded review: only from SUBMITTED at the seen attempt (atomic check+set).
      review: async (
        _id: string,
        seenAttempt: number,
        data: { status: string; reviewedByStaffId: string; reviewedAt: Date },
      ) => {
        if (row.status !== "SUBMITTED" || row.attempt !== seenAttempt) return null;
        row.status = data.status;
        row.reviewedByStaffId = data.reviewedByStaffId;
        row.reviewedAt = data.reviewedAt;
        return { ...row };
      },
      // Guarded resubmit: only from SUBMITTED|RETURNED at the seen attempt; attempt++.
      resubmit: async (
        _id: string,
        seenAttempt: number,
        data: { note: string | null; isLate: boolean },
      ) => {
        if (
          row.attempt !== seenAttempt ||
          (row.status !== "SUBMITTED" && row.status !== "RETURNED")
        )
          return null;
        row.status = "SUBMITTED";
        row.attempt += 1;
        row.note = data.note;
        row.isLate = data.isLate;
        return { ...row };
      },
    },
  };

  const withTransaction = <T>(fn: (r: Repositories) => Promise<T>) =>
    fn(repos as unknown as Repositories);
  const ctxOf = (user: Principal): ServiceContext => ({
    user,
    repositories: repos as unknown as Repositories,
    notifications: createNotificationService([]),
    withTransaction,
  });
  return { row, ctxOf, feedbackCreate: repos.homeworkFeedback.create };
}

const settle = <T>(p: Promise<T>) =>
  p.then(
    (v) => ({ ok: true as const, v }),
    (e) => ({ ok: false as const, e }),
  );

describe("homework — review vs resubmit race (R2)", () => {
  it("a SUBMITTED submission terminally reviewed and resubmitted at once → exactly one wins, the other Conflicts", async () => {
    // REVIEWED is terminal: the two operations are genuinely mutually exclusive at
    // attempt 1 (a RETURNED decision would instead compose with a later resubmit).
    const st = makeStateful("SUBMITTED");
    const [rev, res] = await Promise.all([
      settle(
        reviewSubmission(st.ctxOf(teacher), {
          submissionId: "sub-1",
          decision: "REVIEWED",
          body: "accepted",
        }),
      ),
      settle(
        resubmitHomework(st.ctxOf(parent), {
          homeworkId: "hw-1",
          enrollmentId: "en-1",
          note: "fixed",
          attachments: [],
        }),
      ),
    ]);

    const wins = [rev, res].filter((r) => r.ok).length;
    const conflicts = [rev, res].filter((r) => !r.ok && r.e instanceof ConflictError).length;
    expect(wins).toBe(1);
    expect(conflicts).toBe(1);
    // If review won, the round exists and status is REVIEWED; if resubmit won, attempt is 2 and no round.
    if (rev.ok) {
      expect(st.row.status).toBe("REVIEWED");
      expect(st.feedbackCreate).toHaveBeenCalledTimes(1);
    } else {
      expect(st.row.attempt).toBe(2);
      expect(st.feedbackCreate).not.toHaveBeenCalled();
    }
  });

  it("two concurrent resubmits of a RETURNED submission → one bumps attempt, the other Conflicts", async () => {
    const st = makeStateful("RETURNED");
    const resub = () =>
      settle(
        resubmitHomework(st.ctxOf(parent), {
          homeworkId: "hw-1",
          enrollmentId: "en-1",
          note: "again",
          attachments: [],
        }),
      );
    const [a, b] = await Promise.all([resub(), resub()]);

    expect([a, b].filter((r) => r.ok).length).toBe(1);
    expect([a, b].filter((r) => !r.ok && r.e instanceof ConflictError).length).toBe(1);
    expect(st.row.attempt).toBe(2); // exactly one increment
  });
});

/**
 * REAL lifecycle-transition concurrency (publish, close) against a STATEFUL homework
 * repo whose `transition` models the DB's guarded `updateMany WHERE status=<from>`
 * (atomic check+set, no await between). `findById` yields so both racers observe the
 * same starting status; only the first transition applies, the loser gets null →
 * `Conflict` — exactly one audit, no double-transition.
 */
function makeStatefulHomework(initialStatus: "DRAFT" | "PUBLISHED") {
  const row = {
    id: "hw-1",
    schoolId: "s-1",
    academicYearId: "y-1",
    subjectId: "sub-1",
    sectionId: "sec-1",
    title: "HW",
    dueDate: new Date("2099-12-31T00:00:00.000Z"),
    status: initialStatus as string,
    publishedByStaffId: null as string | null,
    publishedAt: null as Date | null,
    closedByStaffId: null as string | null,
    closedAt: null as Date | null,
  };
  let audits = 0;
  const repos = {
    audit: {
      record: async () => {
        audits += 1;
      },
    },
    staff: { findByUserId: async () => ({ id: "sf-1", schoolId: "s-1", userId: "u-teacher" }) },
    teacherAssignments: { findByTriple: async () => ({ id: "ta-1" }) },
    homework: {
      findById: async () => {
        await Promise.resolve(); // yield → both racers see the same starting status
        return { ...row };
      },
      transition: async (_id: string, from: string, data: Record<string, unknown>) => {
        if (row.status !== from) return null; // guarded: atomic check+set, no await between
        row.status = data.status as string;
        if ("closedByStaffId" in data) row.closedByStaffId = data.closedByStaffId as string | null;
        return { ...row, ...data };
      },
    },
  };
  const withTransaction = <T>(fn: (r: Repositories) => Promise<T>) =>
    fn(repos as unknown as Repositories);
  const ctx: ServiceContext = {
    user: teacher,
    repositories: repos as unknown as Repositories,
    notifications: createNotificationService([]),
    withTransaction,
  };
  return { row, ctx, audits: () => audits };
}

describe("homework — concurrent lifecycle transitions", () => {
  it("two concurrent publishes of a DRAFT → one PUBLISHED (audited once), the other Conflicts", async () => {
    const st = makeStatefulHomework("DRAFT");
    const [a, b] = await Promise.all([
      settle(publishHomework(st.ctx, "hw-1")),
      settle(publishHomework(st.ctx, "hw-1")),
    ]);
    expect([a, b].filter((r) => r.ok).length).toBe(1);
    expect([a, b].filter((r) => !r.ok && r.e instanceof ConflictError).length).toBe(1);
    expect(st.row.status).toBe("PUBLISHED");
    expect(st.audits()).toBe(1); // no double-audit
  });

  it("two concurrent closes of a PUBLISHED → one CLOSED (audited once), the other Conflicts", async () => {
    const st = makeStatefulHomework("PUBLISHED");
    const [a, b] = await Promise.all([
      settle(closeHomework(st.ctx, "hw-1")),
      settle(closeHomework(st.ctx, "hw-1")),
    ]);
    expect([a, b].filter((r) => r.ok).length).toBe(1);
    expect([a, b].filter((r) => !r.ok && r.e instanceof ConflictError).length).toBe(1);
    expect(st.row.status).toBe("CLOSED");
    expect(st.audits()).toBe(1);
  });
});
