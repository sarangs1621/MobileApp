import type { Enrollment, RankScope, ReportCardKind } from "@repo/db";

import type { ServiceContext } from "../../context";
import { attendanceSummary } from "../attendance";
import { gpaForEnrollment } from "../exam";

/**
 * The values frozen onto a card at APPROVE (ADR-014 §3). rank is ALL-OR-NOTHING:
 * without a computable GPA there is no metric to rank on, so rank/rankScope/cohortSize
 * are ALL null together — never a partial rank (mandatory). attendance is compute-on-read
 * (ADR-011) so it MUST be snapshotted; GPA is copied from Mark snapshots (already
 * immutable, ADR-012). cgpa is null for now (no cross-year CGPA service yet).
 */
export interface CardSnapshot {
  rank: number | null;
  rankScope: RankScope | null;
  cohortSize: number | null;
  attendancePercentage: number | null;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  halfDayCount: number;
  leaveCount: number;
  workingDays: number;
  gpaSnapshot: number | null;
  cgpaSnapshot: number | null;
}

/**
 * PURE cohort ranking (competition ranking, GPA desc). If the target has no GPA it
 * cannot be ranked → {null, null} (the mandatory "never a partial rank" rule). Peers
 * without a GPA are excluded from the cohort size. Ties share a rank (two 8.0s are
 * both 2nd; the next is 4th). No I/O — the one unit-tested piece (snapshot.test.ts).
 */
export function computeRank(
  peers: readonly { id: string; gpa: number | null }[],
  targetId: string,
): { rank: number | null; cohortSize: number | null } {
  const target = peers.find((p) => p.id === targetId);
  if (!target || target.gpa === null) {
    return { rank: null, cohortSize: null };
  }
  const ranked = peers.filter((p): p is { id: string; gpa: number } => p.gpa !== null);
  const higher = ranked.filter((p) => p.gpa > target.gpa!).length;
  return { rank: higher + 1, cohortSize: ranked.length };
}

/** The attendance window a card's kind summarizes: TERM → the term; ANNUAL/EXAM → the year. */
async function attendanceWindow(
  ctx: ServiceContext,
  enrollment: Enrollment,
  kind: ReportCardKind,
  termId: string | null,
): Promise<{ from: Date; to: Date } | null> {
  if (kind === "TERM" && termId) {
    const term = await ctx.repositories.academicTerms.findById(termId);
    return term ? { from: term.startDate, to: term.endDate } : null;
  }
  const year = await ctx.repositories.academicYears.findById(enrollment.academicYearId);
  return year ? { from: year.startDate, to: year.endDate } : null;
}

/**
 * Assemble the snapshot at approve: attendance % + counts over the card's window,
 * GPA from Mark snapshots, and cohort rank by section GPA. Uses the canonical
 * attendance/GPA services — never re-derives the ADR-011/012 math.
 *
 * ponytail: rank recomputes each section peer's GPA at approve — O(cohort) service
 * calls (fine for section-size cohorts; batch the GPA read if a cohort ever grows large).
 * rankScope is SECTION (R2 left section-vs-class open; CLASS is the reserved alternative).
 * Cohort = the section's enrollments this year that HAVE a computable GPA.
 */
export async function assembleSnapshot(
  ctx: ServiceContext,
  enrollment: Enrollment,
  kind: ReportCardKind,
  termId: string | null,
): Promise<CardSnapshot> {
  const window = await attendanceWindow(ctx, enrollment, kind, termId);
  const att = window
    ? await attendanceSummary(ctx, {
        enrollmentId: enrollment.id,
        from: window.from,
        to: window.to,
      })
    : null;

  const gpa = await gpaForEnrollment(ctx, enrollment.id);

  let rank: number | null = null;
  let rankScope: RankScope | null = null;
  let cohortSize: number | null = null;
  if (gpa !== null && enrollment.sectionId) {
    const peers = await ctx.repositories.enrollments.listBySection(
      enrollment.academicYearId,
      enrollment.sectionId,
    );
    const peerGpas = await Promise.all(
      peers.map(async (p) => ({ id: p.id, gpa: await gpaForEnrollment(ctx, p.id) })),
    );
    const r = computeRank(peerGpas, enrollment.id);
    rank = r.rank;
    cohortSize = r.cohortSize;
    rankScope = rank !== null ? "SECTION" : null;
  }

  return {
    rank,
    rankScope,
    cohortSize,
    attendancePercentage: att?.percentage ?? null,
    presentCount: att?.present ?? 0,
    absentCount: att?.absent ?? 0,
    lateCount: att?.late ?? 0,
    halfDayCount: att?.halfDay ?? 0,
    leaveCount: att?.leave ?? 0,
    workingDays: att?.countableDays ?? 0,
    gpaSnapshot: gpa,
    cgpaSnapshot: null,
  };
}
