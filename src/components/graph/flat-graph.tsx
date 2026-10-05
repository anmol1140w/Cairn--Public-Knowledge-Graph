"use client";
import { useEffect, useRef, useState } from "react";
import { CATEGORIES, type GraphEntity, type Relationship } from "@/lib/types";
import { useKnowledge } from "@/lib/store";
import { useExplorer } from "@/lib/explorer-store";
import { graphBounds, labelPriority, placeLabels } from "@/lib/graph-layout";
export function FlatGraph({
  nodes,
  edges,
}: {
  nodes: GraphEntity[];
  edges: Relationship[];
}) {
  const s = useKnowledge(),
    v = useExplorer(),
    root = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 600, height: 500 });
  const pointers = useRef(new Map<number, { x: number; y: number }>()),
    moved = useRef(false);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const bounds = graphBounds(nodes),
    scale = Math.max(
      0.1,
      Math.min(
        (size.width - 120) / (bounds.radius * 2),
        (size.height - 120) / (bounds.radius * 2),
      ),
    );
  const point = (node: GraphEntity) => [
    size.width / 2 +
      (node.position[0] - bounds.center[0]) * scale * v.zoom +
      v.pan[0],
    size.height / 2 -
      (node.position[1] - bounds.center[1]) * scale * v.zoom +
      v.pan[1],
  ];
  const map = new Map(nodes.map((node) => [node.id, node])),
    textScale = s.accessibility.largeText ? 1.25 : 1;
  const neighbors = new Set(
    edges
      .filter((e) => e.source === s.selected || e.target === s.selected)
      .flatMap((e) => [e.source, e.target]),
  );
  const candidates = labelPriority(nodes, edges, s.selected, s.hovered).map(
    (node) => {
      const [x, y] = point(node);
      return {
        id: node.id,
        x,
        y,
        width:
          Math.min(220, Math.max(130, node.label.length * 7 + 24)) * textScale,
        height: 54 * textScale,
        required:
          node.id === s.selected ||
          node.id === s.hovered ||
          neighbors.has(node.id),
      };
    },
  );
  const labels = placeLabels(
    candidates,
    size.width,
    size.height,
    Math.ceil(12 * Math.max(1, v.zoom)),
  );
  const focus = (node: GraphEntity) => {
    const [x, y] = point(node);
    v.set({
      zoom: v.zoom * 2,
      pan: [
        v.pan[0] * 2 + (size.width / 2 - x) * 2,
        v.pan[1] * 2 + (size.height / 2 - y) * 2,
      ],
    });
    s.select(node.id);
  };
  return (
    <div
      ref={root}
      className="flat-graph"
      aria-label="Interactive 2D knowledge graph"
      onPointerDown={(event) => {
        if (!useExplorer.getState().active) return;
        moved.current = false;
        pointers.current.set(event.pointerId, {
          x: event.clientX,
          y: event.clientY,
        });
        if (!(event.target as HTMLElement).closest("button"))
          event.currentTarget.setPointerCapture(event.pointerId);
        v.interact();
      }}
      onPointerMove={(event) => {
        const previous = pointers.current.get(event.pointerId);
        if (!previous || !v.active) return;
        const next = { x: event.clientX, y: event.clientY },
          other = [...pointers.current.entries()].find(
            ([id]) => id !== event.pointerId,
          )?.[1],
          dx = next.x - previous.x,
          dy = next.y - previous.y;
        if (Math.hypot(dx, dy) < 2) return;
        if (other) {
          const before = Math.hypot(previous.x - other.x, previous.y - other.y),
            after = Math.hypot(next.x - other.x, next.y - other.y);
          v.set({
            zoom: before
              ? Math.max(0.25, Math.min(5, (v.zoom * after) / before))
              : v.zoom,
            pan: [v.pan[0] + dx / 2, v.pan[1] + dy / 2],
          });
        } else v.set({ pan: [v.pan[0] + dx, v.pan[1] + dy] });
        moved.current = true;
        pointers.current.set(event.pointerId, next);
        v.interact();
      }}
      onPointerUp={(event) => pointers.current.delete(event.pointerId)}
      onPointerCancel={(event) => pointers.current.delete(event.pointerId)}
    >
      <svg width={size.width} height={size.height} aria-hidden="true">
        {edges.map((edge) => {
          const a = map.get(edge.source),
            b = map.get(edge.target);
          if (!a || !b) return null;
          const [x1, y1] = point(a),
            [x2, y2] = point(b);
          return (
            <line
              key={edge.id}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="var(--border)"
              strokeWidth={1}
              strokeDasharray={edge.inferred ? "5 5" : undefined}
            />
          );
        })}
      </svg>
      {nodes.map((node) => {
        const [x, y] = point(node);
        return (
          <button
            className="flat-point"
            key={node.id}
            style={{ left: x - 22, top: y - 22 }}
            tabIndex={-1}
            aria-label={`Select ${node.title}`}
            onClick={() => {
              if (!moved.current) s.select(node.id);
            }}
            onDoubleClick={() => focus(node)}
            onMouseEnter={() => s.set({ hovered: node.id })}
            onMouseLeave={() => s.set({ hovered: null })}
          >
            <span
              style={{
                width: Math.min(
                  18,
                  7 + Number(node.metadata?.__importance ?? 1),
                ),
                height: Math.min(
                  18,
                  7 + Number(node.metadata?.__importance ?? 1),
                ),
              }}
            />
          </button>
        );
      })}
      {labels.map((label) => {
        const node = map.get(label.id)!;
        return (
          <button
            className={`flat-node node-label ${s.selected === node.id ? "selected" : ""}`}
            key={node.id}
            style={{
              left: label.left,
              top: label.top,
              width: label.width,
              height: label.height,
              transform: "none",
              maxWidth: "none",
            }}
            onClick={() => {
              if (!moved.current) s.select(node.id);
            }}
            onDoubleClick={() => focus(node)}
            onMouseEnter={() => s.set({ hovered: node.id })}
            onMouseLeave={() => s.set({ hovered: null })}
            aria-label={`Explore ${node.title}`}
          >
            <span>{node.label}</span>
            <small>{CATEGORIES[node.type].label}</small>
          </button>
        );
      })}
    </div>
  );
}
