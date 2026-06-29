/** @vitest-environment jsdom */
import { cn } from "@repo/ui";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("web test harness", () => {
  it("renders into jsdom (Testing Library + React 19)", () => {
    render(<p>{cn("a", "b")}</p>);
    expect(screen.getByText("a b")).toBeDefined();
  });
});
