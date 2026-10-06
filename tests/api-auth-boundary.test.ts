import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { GET as listInvestigations } from "@/app/api/investigations/route";

describe("protected API boundary", () => {
  it("does not expose account history when authentication is unavailable", async () => {
    vi.stubEnv("AUTH_SECRET", "");
    vi.stubEnv("AUTH_GOOGLE_ID", "");
    vi.stubEnv("AUTH_GOOGLE_SECRET", "");
    const response = await listInvestigations();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "AUTH_UNAVAILABLE" });
  });
});
