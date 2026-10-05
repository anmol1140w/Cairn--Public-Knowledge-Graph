import { DEMO } from "./demo";
import type { Investigation, Mode, SourceEngine } from "./types";

export function scopeDemo(
  run: Investigation,
  sources: SourceEngine[],
): Investigation {
  if (!sources.length) return { ...run };
  const evidence = run.evidence.filter(
      (e) => e.engine && sources.includes(e.engine),
    ),
    ids = new Set(evidence.map((e) => e.id));
  const entities = run.entities
    .map((entity) => {
      const relatedIds = run.relationships
        .filter(
          (edge) =>
            (edge.source === entity.id || edge.target === entity.id) &&
            edge.evidenceIds.every((id) => ids.has(id)),
        )
        .flatMap((edge) => edge.evidenceIds);
      return {
        ...entity,
        evidenceIds: [
          ...new Set([
            ...entity.evidenceIds.filter((id) => ids.has(id)),
            ...relatedIds,
          ]),
        ],
      };
    })
    .filter((entity) => entity.type === "topic" || entity.evidenceIds.length);
  const entityIds = new Set(entities.map((e) => e.id));
  const claims = run.claims.filter((claim) =>
    [...claim.evidenceIds, ...claim.conflictingEvidenceIds].every((id) =>
      ids.has(id),
    ),
  );
  return {
    ...run,
    evidence,
    entities,
    claims,
    relationships: run.relationships.filter(
      (edge) =>
        entityIds.has(edge.source) &&
        entityIds.has(edge.target) &&
        edge.evidenceIds.every((id) => ids.has(id)),
    ),
    sources: run.sources.filter((s) => sources.includes(s.source)),
    summary: claims.length
      ? claims
          .slice(0, 2)
          .map((c) => c.text)
          .join(" ")
      : `${evidence.length} selected demo source records are available to explore. This source subset does not establish the research summary.`,
    whyItMatters:
      claims.find((c) => c.id === "impact")?.text ??
      "Inspect the original sources before drawing conclusions.",
  };
}
const example = (
  mode: Mode,
  title: string,
  query: string,
  sources: SourceEngine[],
) => ({
  id: mode,
  mode,
  title,
  run: { ...scopeDemo(DEMO, sources), id: `demo-${mode}`, query },
});
export const EXAMPLES = [
  example(
    "scholar",
    "Read efficient-inference papers",
    "How do efficient-inference papers connect?",
    ["scholar", "web"],
  ),
  example(
    "jobs",
    "Inspect research career examples",
    "What is stated about these illustrative research career examples?",
    ["jobs", "web"],
  ),
  example(
    "news",
    "Compare AI announcements",
    "What do these historical AI announcements establish?",
    ["news"],
  ),
];
