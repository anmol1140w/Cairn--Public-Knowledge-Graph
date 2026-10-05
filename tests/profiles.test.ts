import { describe, expect, it } from "vitest";
import {
  profileSchema,
  jobsProfileSchema,
  scholarProfileSchema,
  newsProfileSchema,
} from "@/lib/profiles";
import { searchSchema } from "@/server/validation";
import { fallbackPlan, engineParameters } from "@/server/planner";
import { jobRequirements, rankEvidence } from "@/lib/personalization";
import type { Evidence } from "@/lib/types";
describe("optional mode profiles", () => {
  it("accepts skipped forms and validates role limits, date ranges, salary and mode", () => {
    for (const mode of ["jobs", "scholar", "news", "patents", "universe"])
      expect(profileSchema.safeParse({ mode }).success).toBe(true);
    expect(
      jobsProfileSchema.safeParse({
        mode: "jobs",
        roles: ["one", "two", "three", "four"],
      }).success,
    ).toBe(false);
    expect(
      jobsProfileSchema.safeParse({
        mode: "jobs",
        salaryMin: 500,
        salaryMax: 200,
      }).success,
    ).toBe(false);
    expect(
      scholarProfileSchema.safeParse({
        mode: "scholar",
        yearFrom: 2026,
        yearTo: 2020,
      }).success,
    ).toBe(false);
    expect(
      newsProfileSchema.safeParse({
        mode: "news",
        dateFrom: "2026-10-02",
        dateTo: "2026-10-01",
      }).success,
    ).toBe(false);
    expect(
      searchSchema.safeParse({
        query: "a question",
        mode: "news",
        profile: { mode: "jobs" },
      }).success,
    ).toBe(false);
  });
  it("shapes existing source queries without adding calls or including personal grades", () => {
    const plain = searchSchema.parse({
      query: "engineering jobs",
      mode: "jobs",
      sources: ["jobs", "web"],
    });
    const input = searchSchema.parse({
      ...plain,
      profile: {
        mode: "jobs",
        roles: ["Research assistant"],
        locations: ["Bengaluru"],
        marks: "private-grade",
        workAuthorization: "private-authorization",
        skills: [{ name: "Python", mustHave: true }],
      },
    });
    const plan = fallbackPlan(input);
    expect(plan.searches.map((s) => s.source)).toEqual(
      fallbackPlan(plain).searches.map((s) => s.source),
    );
    expect(plan.searches[0].query).toContain("Research assistant");
    expect(plan.searches[0].query).toContain("Python");
    expect(plan.searches[0].query).not.toContain("private-");
    const scholar = scholarProfileSchema.parse({
      mode: "scholar",
      yearFrom: 2020,
      yearTo: 2025,
    });
    expect(
      engineParameters(
        { source: "scholar", query: "attention", reason: "test" },
        scholar,
      ),
    ).toMatchObject({ as_ylo: 2020, as_yhi: 2025 });
  });
  it("counts only quoted requirements and distinguishes learning from meeting them", () => {
    const evidence: Evidence = {
      id: "test-job",
      type: "job",
      title: "Test role",
      source: "Test fixture",
      url: "https://example.org/test",
      snippet: "Requires Python and SQL. JavaScript is optional.",
      relevanceScore: 0.8,
      metadata: { skills: ["Python", "SQL", "JavaScript", "CUDA"] },
    };
    const profile = jobsProfileSchema.parse({
      mode: "jobs",
      skills: [
        { name: "Python", level: "Working" },
        { name: "SQL", level: "Learning" },
      ],
    });
    const report = jobRequirements(evidence, profile);
    expect(report.met).toBe(1);
    expect(report.rows).toHaveLength(2);
    expect(report.missing).toEqual(["SQL"]);
    for (const row of report.rows)
      expect(evidence.snippet).toContain(row.quote);
    expect(report.unknowns.every((field) => field.value === "Not stated")).toBe(
      true,
    );
    expect(rankEvidence([evidence], profile)).toHaveLength(1);
  });
});
