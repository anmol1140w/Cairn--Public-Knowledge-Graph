import { describe, expect, it } from "vitest";
import { EXAMPLES, scopeDemo } from "@/lib/examples";
import { DEMO } from "@/lib/demo";
import { investigationSchema } from "@/server/validation";
import { groundedClaims } from "@/server/graph-builder";
describe("preloaded examples", () => {
  it("accepts expanded graph snapshots beyond the initial 1000-node cap for export", () => {
    const run = {
      ...DEMO,
      entities: Array.from({ length: 1100 }, (_, i) => ({
        ...DEMO.entities[1],
        id: `fixture-${i}`,
      })),
    };
    expect(investigationSchema.safeParse(run).success).toBe(true);
  });
  it("provides three scoped examples with valid IDs and verbatim supporting quotes", () => {
    expect(EXAMPLES.map((e) => e.mode)).toEqual(["scholar", "jobs", "news"]);
    for (const example of EXAMPLES) {
      expect(example.run.demo).toBe(true);
      expect(example.run.evidence.length).toBeGreaterThan(0);
      const ids = new Set(example.run.evidence.map((e) => e.id)),
        nodes = new Set(example.run.entities.map((e) => e.id));
      for (const claim of example.run.claims) {
        for (const id of [
          ...claim.evidenceIds,
          ...claim.conflictingEvidenceIds,
        ])
          expect(ids.has(id)).toBe(true);
        for (const quote of claim.supportingQuotes ?? [])
          expect(
            example.run.evidence.find((e) => e.id === quote.evidenceId)
              ?.snippet,
          ).toContain(quote.text);
      }
      for (const edge of example.run.relationships) {
        expect(nodes.has(edge.source) && nodes.has(edge.target)).toBe(true);
        expect(edge.evidenceIds.every((id) => ids.has(id))).toBe(true);
      }
    }
    expect(
      groundedClaims(
        DEMO.claims.map((c) => ({
          ...c,
          supportingQuotes: c.supportingQuotes!,
          conflictingQuotes: [],
        })),
        DEMO.evidence,
      ),
    ).toHaveLength(DEMO.claims.length);
  });
  it("drops claims whose supporting or conflicting records are outside a source subset", () => {
    const run = {
      ...DEMO,
      claims: [{ ...DEMO.claims[0], conflictingEvidenceIds: ["blackwell"] }],
    };
    expect(scopeDemo(run, ["scholar"]).claims).toEqual([]);
  });
});
