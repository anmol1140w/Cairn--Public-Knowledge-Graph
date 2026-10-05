import type { Evidence, GraphEntity, Investigation, Mode } from "./types";

export function visibleEntities(
  run: Investigation,
  mode: Mode,
  filter: string,
  year: number | null,
  focus: string | null,
  hops: number,
): GraphEntity[] {
  const modeTypes: Record<Mode, string[]> = {
    universe: [],
    scholar: ["paper", "person", "institution", "topic", "technology"],
    news: ["news", "company", "topic", "paper"],
    jobs: ["job", "company", "institution", "person", "topic"],
    patents: ["patent", "company", "paper", "person", "technology", "topic"],
  };
  let nodes = run.entities.filter(
    (node) => !modeTypes[mode].length || modeTypes[mode].includes(node.type),
  );
  if (year)
    nodes = nodes.filter(
      (node) =>
        node.type === "topic" ||
        !node.evidenceIds.length ||
        node.evidenceIds.some((id) => {
          const date = run.evidence.find((e) => e.id === id)?.date;
          return date && new Date(date).getFullYear() <= year;
        }),
    );
  if (focus) {
    const visited = new Set([focus]);
    for (let h = 0; h < hops; h++) {
      const next = new Set(visited);
      run.relationships.forEach((edge) => {
        if (visited.has(edge.source)) next.add(edge.target);
        if (visited.has(edge.target)) next.add(edge.source);
      });
      next.forEach((id) => visited.add(id));
    }
    nodes = nodes.filter((n) => visited.has(n.id));
  }
  if (filter)
    nodes = nodes.filter((node) =>
      `${node.title} ${node.subtitle}`
        .toLowerCase()
        .includes(filter.toLowerCase()),
    );
  return nodes;
}

export function formatDate(date?: string): string {
  if (!date) return "Date not provided";
  if (/^\d{4}$/.test(date)) return date;
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      });
}
export function shortTitle(title: string, limit = 32): string {
  return title.length > limit ? `${title.slice(0, limit - 1)}…` : title;
}
export function skillMatch(
  evidence: Evidence,
  skills: string[],
): { score: number; matches: string[]; missing: string[] } | null {
  const required = (evidence.metadata?.skills as string[] | undefined) ?? [];
  if (!skills.length || !required.length) return null;
  const matches = required.filter((r) =>
    skills.some((s) => s.toLowerCase() === r.toLowerCase()),
  );
  return {
    score: Math.round((matches.length / required.length) * 100),
    matches,
    missing: required.filter((r) => !matches.includes(r)),
  };
}
export function relevantEvidence(run: Investigation, mode: Mode): Evidence[] {
  return run.evidence.filter(
    (e) =>
      mode === "universe" ||
      (mode === "scholar" && e.type === "paper") ||
      (mode === "news" && e.type === "news") ||
      (mode === "jobs" && e.type === "job") ||
      (mode === "patents" && e.type === "patent"),
  );
}
