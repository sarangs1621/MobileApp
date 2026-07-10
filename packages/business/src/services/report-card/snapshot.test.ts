import { describe, expect, it } from "vitest";

import { computeRank } from "./snapshot";

// Pure cohort-ranking check — the highest-bug-density piece of the snapshot.
describe("computeRank", () => {
  const peers = [
    { id: "a", gpa: 9 },
    { id: "b", gpa: 8 },
    { id: "c", gpa: 8 }, // tie with b
    { id: "d", gpa: null }, // no GPA — excluded from cohort
  ];

  it("ranks by GPA descending, cohort excludes null-GPA peers", () => {
    expect(computeRank(peers, "a")).toEqual({ rank: 1, cohortSize: 3 });
    expect(computeRank(peers, "b")).toEqual({ rank: 2, cohortSize: 3 });
  });

  it("gives tied GPAs the same rank (competition ranking)", () => {
    expect(computeRank(peers, "c")).toEqual({ rank: 2, cohortSize: 3 });
  });

  it("returns null rank/cohort when the target has no GPA (never partial)", () => {
    expect(computeRank(peers, "d")).toEqual({ rank: null, cohortSize: null });
  });

  it("returns null when the target is not in the cohort", () => {
    expect(computeRank(peers, "zzz")).toEqual({ rank: null, cohortSize: null });
  });
});
