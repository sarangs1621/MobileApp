import { afterEach, describe, expect, it, vi } from "vitest";

import { errorFields, logger } from "./logger";

afterEach(() => vi.restoreAllMocks());

describe("logger", () => {
  it("emits one JSON line with timestamp, level, message, and fields", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logger.error("notify failed", { requestId: "r1", userId: "u1", durationMs: 12 });

    expect(spy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(parsed).toMatchObject({
      level: "error",
      message: "notify failed",
      requestId: "r1",
      userId: "u1",
      durationMs: 12,
    });
    expect(typeof parsed.timestamp).toBe("string");
  });

  it("routes levels to the matching console method", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    logger.info("hi");
    logger.warn("careful");
    expect(log).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe("errorFields", () => {
  it("extracts message + stack from an Error", () => {
    const f = errorFields(new Error("boom"));
    expect(f.error).toBe("boom");
    expect(f.stack).toContain("boom");
  });

  it("stringifies non-Error throwables", () => {
    expect(errorFields("nope")).toEqual({ error: "nope" });
  });
});
