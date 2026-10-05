import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  model: vi.fn(),
  search: vi.fn(),
  checkpoint: vi.fn(),
  save: vi.fn(),
  finish: vi.fn(),
}));
vi.mock("@/server/ollama", () => ({ modelJson: mocks.model }));
vi.mock("@/server/serpapi", () => ({ serpapiSearch: mocks.search }));
vi.mock("@/server/storage", () => ({
  checkpointer: mocks.checkpoint,
  assertStorage: vi.fn(),
  beginRun: vi.fn(),
  failRun: vi.fn(),
  saveInvestigation: mocks.save,
  finishSessionOnlyRun: mocks.finish,
}));
import { POST } from "@/app/api/search/route";
describe("profile persistence boundary", () => {
  it("does not let a profile expand the baseline source families", async () => {
    mocks.model.mockResolvedValueOnce({
      intent: "test",
      searches: ["jobs", "news", "scholar", "patents", "web"].map((source) => ({
        source,
        query: "fixture",
        reason: "model suggestion",
      })),
      complex: false,
      deep: false,
    });
    const response = await POST(
      new NextRequest("http://localhost/api/search", {
        method: "POST",
        headers: { Host: "localhost", "Content-Type": "application/json" },
        body: JSON.stringify({
          query: "research work",
          mode: "jobs",
          profile: { mode: "jobs", roles: ["Research assistant"] },
        }),
      }),
    );
    expect(await response.text()).toContain('"kind":"result"');
    expect(mocks.search).toHaveBeenCalledTimes(1);
    expect(mocks.search.mock.calls[0][0].engine).toBe("google_jobs");
  });
  it("checks the pasted news claim and applies the requested plain-language prompt", async () => {
    mocks.search.mockResolvedValueOnce({
      payload: {
        news_results: [
          {
            title: "A fixture announcement",
            source: { name: "Fixture press" },
            link: "https://example.org/announcement",
            snippet: "A fixture announcement is available.",
          },
        ],
      },
      retrievedAt: "2026-10-06T00:00:00Z",
      cached: false,
    });
    const response = await POST(
      new NextRequest("http://localhost/api/search", {
        method: "POST",
        headers: { Host: "localhost", "Content-Type": "application/json" },
        body: JSON.stringify({
          query: "technology",
          mode: "news",
          profile: {
            mode: "news",
            claim: "The specific pasted claim",
            readingLevel: "Simple",
          },
        }),
      }),
    );
    expect(await response.text()).toContain('"kind":"result"');
    const synthesis = mocks.model.mock.calls.find((call) => call[5] === 4200)!;
    expect(JSON.parse(synthesis[2]).question).toContain(
      "The specific pasted claim",
    );
    expect(synthesis[1]).toContain("Use plain language and short sentences.");
    expect(mocks.search).toHaveBeenCalledTimes(1);
  });
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SERPAPI_API_KEY", "unit-test-key");
    vi.stubEnv("OLLAMA_API_KEY", "unit-test-key");
    mocks.model.mockRejectedValue(
      new Error("Model unavailable in offline test"),
    );
    mocks.search.mockResolvedValue({
      payload: {
        jobs_results: [
          {
            title: "Research assistant",
            company_name: "Fixture employer",
            description: "Requires Python.",
            apply_options: [
              { title: "Fixture", link: "https://example.org/test-job" },
            ],
          },
        ],
      },
      retrievedAt: "2026-10-06T00:00:00Z",
      cached: false,
    });
  });
  for (const saveProfile of [false, true])
    it(
      saveProfile
        ? "persists only with explicit consent"
        : "keeps profile-shaped results out of persistent checkpoints and snapshots",
      async () => {
        const request = new NextRequest("http://localhost/api/search", {
          method: "POST",
          headers: {
            Origin: "http://localhost",
            Host: "localhost",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: "research work",
            mode: "jobs",
            sources: ["jobs"],
            profile: {
              mode: "jobs",
              roles: ["Research assistant"],
              marks: "private-grade",
            },
            saveProfile,
          }),
        });
        const response = await POST(request);
        const stream = await response.text();
        expect(response.status, stream).toBe(200);
        expect(stream).toContain('"kind":"result"');
        expect(mocks.search).toHaveBeenCalledTimes(1);
        expect(mocks.search.mock.calls[0][1].ephemeral).toBe(!saveProfile);
        expect(mocks.search.mock.calls[0][0].q).not.toContain("private-grade");
        for (const call of mocks.model.mock.calls)
          expect(call[6]).toBe(saveProfile);
        expect(mocks.checkpoint).toHaveBeenCalledTimes(saveProfile ? 1 : 0);
        expect(mocks.save).toHaveBeenCalledTimes(saveProfile ? 1 : 0);
        expect(mocks.finish).toHaveBeenCalledTimes(saveProfile ? 0 : 1);
        if (!saveProfile) expect(stream).not.toContain("private-grade");
      },
    );
});
