import { describe, expect, it } from "vitest";
import {
  graphRadius,
  layoutGraph,
  placeLabels,
  type Point,
} from "../src/lib/graph-layout";
import { DEMO } from "../src/lib/demo";
describe("graph layout", () => {
  it("grows with square root density and preserves existing positions on expansion", () => {
    expect(graphRadius(100) - 3).toBeCloseTo((graphRadius(25) - 3) * 2);
    const cache = new Map<string, Point>();
    const initial = layoutGraph(DEMO.entities, DEMO.relationships, cache);
    const added = { ...DEMO.entities[1], id: "added-node" };
    const expanded = layoutGraph(
      [...DEMO.entities, added],
      [
        ...DEMO.relationships,
        {
          id: "new-edge",
          source: added.id,
          target: initial[0].id,
          type: "related_to" as const,
          inferred: true,
          evidenceIds: [],
        },
      ],
      cache,
    );
    expect(expanded.slice(0, initial.length).map((n) => n.position)).toEqual(
      initial.map((n) => n.position),
    );
    expect(expanded.at(-1)?.metadata?.__entry).toEqual(initial[0].position);
  });
  it("never places labels overlapping or outside the frame even at high density", () => {
    const labels = placeLabels(
      Array.from({ length: 100 }, (_, index) => ({
        id: String(index),
        x: 50 + (index % 10) * 65,
        y: 50 + Math.floor(index / 10) * 45,
        width: 150,
        height: 54,
      })),
      800,
      600,
    );
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.length).toBeLessThanOrEqual(12);
    for (const a of labels) {
      expect(a.left).toBeGreaterThanOrEqual(0);
      expect(a.top + a.height).toBeLessThan(600);
      for (const b of labels.filter((b) => b.id !== a.id))
        expect(
          a.left >= b.left + b.width ||
            a.left + a.width <= b.left ||
            a.top >= b.top + b.height ||
            a.top + a.height <= b.top,
        ).toBe(true);
    }
  });
});
