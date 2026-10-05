"use client";
import { useRef } from "react";
import { CATEGORIES, type GraphEntity, type Relationship } from "@/lib/types";
import { useKnowledge } from "@/lib/store";
import { useExplorer } from "@/lib/explorer-store";

export function FlatGraph({
  nodes,
  edges,
}: {
  nodes: GraphEntity[];
  edges: Relationship[];
}) {
  const s = useKnowledge(),
    v = useExplorer();
  const pointers = useRef(new Map<number, { x: number; y: number }>()),
    moved = useRef(false);
  const map = new Map(nodes.map((node) => [node.id, node]));
  const point = (node: GraphEntity) => [
    50 + node.position[0] * 5.5,
    50 - node.position[1] * 8,
  ];
  return (
    <div
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
          )?.[1];
        const dx = next.x - previous.x,
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
      <div
        className="flat-transform"
        style={{
          transform: `translate(${v.pan[0]}px, ${v.pan[1]}px) scale(${v.zoom})`,
        }}
      >
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
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
                strokeWidth=".2"
                strokeDasharray={edge.inferred ? ".8 .8" : undefined}
              />
            );
          })}
        </svg>
        {nodes.map((node) => {
          const [x, y] = point(node);
          return (
            <button
              className={`flat-node node-label ${s.selected === node.id ? "selected" : ""}`}
              key={node.id}
              style={{ left: `${x}%`, top: `${y}%` }}
              onClick={() => {
                if (!moved.current) s.select(node.id);
              }}
              onDoubleClick={(event) => {
                const bounds = event.currentTarget.closest(".flat-graph")!.getBoundingClientRect();
                v.set({ zoom: 2, pan: [(50 - x) / 100 * bounds.width * 2, (50 - y) / 100 * bounds.height * 2] });
                s.select(node.id);
                v.request("focus");
              }}
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
    </div>
  );
}
