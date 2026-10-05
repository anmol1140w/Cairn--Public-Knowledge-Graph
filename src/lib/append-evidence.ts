import type {
  Evidence,
  GraphEntity,
  Investigation,
  Relationship,
} from "./types";

export function appendEvidence(
  run: Investigation,
  items: Evidence[],
): Investigation {
  const newEvidence = items.filter(
    (item) => !run.evidence.some((known) => known.id === item.id),
  );
  const newNodes: GraphEntity[] = newEvidence.map((item, i) => {
    const angle = i * 0.67 + run.evidence.length * 0.11;
    return {
      id: item.id,
      type: item.type,
      title: item.title,
      label:
        item.title.length > 29 ? item.title.slice(0, 27) + "…" : item.title,
      subtitle: item.source,
      evidenceIds: [item.id],
      metadata: item.metadata,
      position: [Math.cos(angle) * 6.2, Math.sin(angle) * 3.5, -0.5],
    };
  });
  const newEdges: Relationship[] = newEvidence.map((item) => ({
    id: `retrieved-${item.id}`,
    source: "topic",
    target: item.id,
    type: "related_to",
    evidenceIds: [item.id],
    inferred: true,
    explanation:
      "Additional source returned by an explicit pagination request. Not included in the existing answer synthesis.",
  }));
  const all = [...run.evidence, ...newEvidence];
  return {
    ...run,
    evidence: all,
    entities: [
      ...run.entities.map((entity) =>
        entity.id === "topic"
          ? { ...entity, evidenceIds: all.map((e) => e.id) }
          : entity,
      ),
      ...newNodes,
    ],
    relationships: [...run.relationships, ...newEdges],
    sources: run.sources.map((source) => ({
      ...source,
      count: all.filter((e) => e.engine === source.source).length,
    })),
  };
}
