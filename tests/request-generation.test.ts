import { describe, expect, it } from "vitest";
import { isCurrentRequest } from "@/lib/request-generation";

describe("late response request generation", () => {
  const current = {
    token: 2,
    currentToken: 2,
    mode: "news" as const,
    currentMode: "news" as const,
    generation: 4,
    currentGeneration: 4,
  };

  it("accepts only the active request for the active mode", () => {
    expect(isCurrentRequest(current)).toBe(true);
    expect(
      isCurrentRequest({ ...current, token: 1 }),
    ).toBe(false);
    expect(
      isCurrentRequest({ ...current, currentMode: "jobs" }),
    ).toBe(false);
    expect(
      isCurrentRequest({ ...current, currentGeneration: 5 }),
    ).toBe(false);
  });
});
