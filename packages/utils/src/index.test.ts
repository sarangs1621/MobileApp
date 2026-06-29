import { describe, expect, it } from "vitest";

import { assertNever, isDefined, toIstDateString } from "./index";

describe("isDefined", () => {
  it("narrows out null and undefined", () => {
    expect(isDefined(0)).toBe(true);
    expect(isDefined("")).toBe(true);
    expect(isDefined(null)).toBe(false);
    expect(isDefined(undefined)).toBe(false);
  });
});

describe("assertNever", () => {
  it("throws when reached", () => {
    expect(() => assertNever("x" as never)).toThrow();
  });
});

describe("toIstDateString", () => {
  it("renders the IST calendar date (guards UTC off-by-one)", () => {
    // 2026-06-28T19:30:00Z is 2026-06-29 01:00 IST → next calendar day in IST.
    expect(toIstDateString(new Date("2026-06-28T19:30:00Z"))).toBe("2026-06-29");
  });
});
