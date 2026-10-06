import { describe, expect, it } from "vitest";
import { DEMO } from "@/lib/demo";
import { useKnowledge } from "@/lib/store";
import { EXAMPLES } from "@/lib/examples";

describe("mode-isolated workspaces", () => {
  it("switching Explore to News must not carry the Explore evidence run", () => {
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

  it("keeps each mode's investigation when returning from another mode", () => {
    const original = useKnowledge.getState();
    const news = EXAMPLES.find((example) => example.mode === "news")!.run;
    try {
      useKnowledge.getState().set({
        mode: "universe",
        run: DEMO,
        query: DEMO.query,
        hasSearched: true,
      });
      useKnowledge.getState().setMode("news");
      useKnowledge.getState().set({ run: news, query: news.query, hasSearched: true });
      useKnowledge.getState().setMode("universe");
      expect(useKnowledge.getState().run.id).toBe(DEMO.id);
      useKnowledge.getState().setMode("news");
      expect(useKnowledge.getState().run.id).toBe(news.id);
    } finally {
      useKnowledge.getState().setMode(original.mode);
      useKnowledge.getState().set({
        run: original.run,
        query: original.query,
        selected: original.selected,
        focus: original.focus,
        graphFilter: original.graphFilter,
        year: original.year,
      });
    }
  });
});
