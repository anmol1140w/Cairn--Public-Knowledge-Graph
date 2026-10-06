import { describe, expect, it } from "vitest";
import { safeRedirectUrl } from "@/server/auth-redirect";

describe("authentication redirect boundary", () => {
  it("keeps relative and canonical redirects on the configured origin", () => {
    expect(
      safeRedirectUrl("/account", "https://cairn.example", "https://cairn.example"),
    ).toBe("https://cairn.example/account");
  });

  it("rejects cross-origin callback targets", () => {
    expect(
      safeRedirectUrl(
        "https://evil.example/steal",
        "https://cairn.example",
        "https://cairn.example",
      ),
    ).toBe("https://cairn.example/");
  });

  it("allows explicitly configured preview origins", () => {
    expect(
      safeRedirectUrl(
        "https://preview.cairn.example/",
        "https://cairn.example",
        "https://cairn.example",
        ["https://preview.cairn.example"],
      ),
    ).toBe("https://preview.cairn.example/");
  });
});
