import type { GraphEntity, Relationship } from "./types";
export type Point = [number, number, number];
export const graphRadius = (count: number) => 3 + Math.sqrt(count) * 0.65;
export function layoutGraph(
  nodes: GraphEntity[],
  edges: Relationship[],
  cache: Map<string, Point>,
): GraphEntity[] {
  const radius = graphRadius(nodes.length),
    initial = cache.size === 0;
  const degrees = new Map<string, number>();
  for (const edge of edges)
    for (const id of [edge.source, edge.target])
      degrees.set(id, (degrees.get(id) ?? 0) + 1);
  return nodes.map((node, index) => {
    let position = cache.get(node.id),
      entry: Point | undefined;
    if (!position) {
      const angle = index * Math.PI * (3 - Math.sqrt(5));
      const y = 1 - (2 * (index + 0.5)) / Math.max(nodes.length, 1),
        r = Math.sqrt(1 - y * y);
      position =
        node.type === "topic"
          ? [0, 0, 0]
          : [
              Math.cos(angle) * r * radius,
              y * radius * 0.65,
              Math.sin(angle) * r * radius * 0.5,
            ];
      if (!initial) {
        const neighbor = edges.find(
          (e) =>
            (e.source === node.id && cache.has(e.target)) ||
            (e.target === node.id && cache.has(e.source)),
        );
        const anchor =
          neighbor &&
          cache.get(
            neighbor.source === node.id ? neighbor.target : neighbor.source,
          );
        if (anchor) {
          entry = [...anchor];
          position = [
            anchor[0] + Math.cos(angle) * 1.6,
            anchor[1] + Math.sin(angle) * 1.6,
            anchor[2] + 0.5,
          ];
        }
      }
      cache.set(node.id, position);
    }
    const importance =
      1 + Math.log2(1 + (degrees.get(node.id) ?? 0) + node.evidenceIds.length);
    return {
      ...node,
      position,
      metadata: { ...node.metadata, __importance: importance, __entry: entry },
    };
  });
}
export const nodeRadius = (node: GraphEntity) =>
  Math.min(
    0.42,
    Math.max(0.12, 0.09 + Number(node.metadata?.__importance ?? 1) * 0.045),
  );
export function graphBounds(nodes: GraphEntity[]) {
  if (!nodes.length) return { center: [0, 0, 0] as Point, radius: 1 };
  const min: Point = [Infinity, Infinity, Infinity],
    max: Point = [-Infinity, -Infinity, -Infinity];
  for (const node of nodes)
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], node.position[i]);
      max[i] = Math.max(max[i], node.position[i]);
    }
  const center = min.map((v, i) => (v + max[i]) / 2) as Point;
  return {
    center,
    radius: Math.max(
      1,
      ...nodes.map(
        (n) =>
          Math.hypot(...n.position.map((v, i) => v - center[i])) +
          nodeRadius(n),
      ),
    ),
  };
}
export function labelPriority(
  nodes: GraphEntity[],
  edges: Relationship[],
  selected: string | null,
  hovered: string | null,
) {
  const neighbors = new Set(
    edges
      .filter((e) => e.source === selected || e.target === selected)
      .flatMap((e) => [e.source, e.target]),
  );
  const priority = (node: GraphEntity) =>
    node.id === hovered
      ? 10000
      : node.id === selected
        ? 9000
        : neighbors.has(node.id)
          ? 8000
          : node.type === "topic"
            ? 7000
            : Number(node.metadata?.__importance ?? 1);
  return [...nodes].sort((a, b) => priority(b) - priority(a));
}
export interface LabelCandidate {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  required?: boolean;
}
export interface PlacedLabel extends LabelCandidate {
  left: number;
  top: number;
}
export function placeLabels(
  candidates: LabelCandidate[],
  width: number,
  height: number,
  limit = 12,
): PlacedLabel[] {
  const placed: PlacedLabel[] = [],
    margin = 8;
  for (const c of candidates) {
    if (placed.length >= limit && !c.required) continue;
    if (c.x < 0 || c.y < 0 || c.x > width || c.y > height) continue;
    const offsets = [
      [-c.width / 2, 14],
      [-c.width / 2, -c.height - 14],
      [20, -c.height / 2],
      [-c.width - 20, -c.height / 2],
    ];
    for (const [dx, dy] of offsets) {
      const left = c.x + dx,
        top = c.y + dy;
      if (
        left < margin ||
        top < margin ||
        left + c.width > width - margin ||
        top + c.height > height - 40
      )
        continue;
      if (
        placed.some(
          (p) =>
            left < p.left + p.width + margin &&
            left + c.width + margin > p.left &&
            top < p.top + p.height + margin &&
            top + c.height + margin > p.top,
        )
      )
        continue;
      placed.push({ ...c, left, top });
      break;
    }
  }
  return placed;
}
