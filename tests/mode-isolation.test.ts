import { describe, expect, it } from "vitest";
import { DEMO } from "@/lib/demo";
import { useKnowledge } from "@/lib/store";

describe("Phase 0 mode-isolation characterization", () => {
  it.fails("switching Explore to News must not carry the Explore evidence run", () => {
    const original = useKnowledge.getState();
    try {
      useKnowledge.getState().set({ run: DEMO, mode: "universe", selected: null });
      useKnowledge.getState().setMode("news");
      expect(useKnowledge.getState().run.evidence).toEqual([]);
    } finally {
      useKnowledge.getState().set({
        run: original.run,
        mode: original.mode,
        selected: original.selected,
        focus: original.focus,
        graphFilter: original.graphFilter,
        year: original.year,
      });
    }
  });
});
