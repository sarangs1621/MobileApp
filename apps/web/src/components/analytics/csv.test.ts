import { describe, expect, it } from "vitest";

import { toCsv } from "./csv";

describe("toCsv (M14 analytics export)", () => {
  it("joins rows with CRLF and cells with commas", () => {
    expect(
      toCsv(
        ["Month", "Collected"],
        [
          ["2026-05", 500],
          ["2026-06", 200],
        ],
      ),
    ).toBe("Month,Collected\r\n2026-05,500\r\n2026-06,200");
  });

  it("RFC-4180 quotes cells containing comma, quote, or newline", () => {
    expect(toCsv(["H"], [["a,b"], ['he said "hi"'], ["line\nbreak"]])).toBe(
      'H\r\n"a,b"\r\n"he said ""hi"""\r\n"line\nbreak"',
    );
  });
});
