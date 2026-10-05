"use client";
import { useState } from "react";
import { CATEGORIES, type GraphEntity, type Relationship } from "@/lib/types";
import { useKnowledge } from "@/lib/store";

export function FlatGraph({
  nodes,
  edges,
}: {
  nodes: GraphEntity[];
  edges: Relationship[];
  compact?: boolean;
}) {
  const s = useKnowledge();
  const [zoom, setZoom] = useState(1);
  const map = new Map(nodes.map((node) => [node.id, node]));
  const point = (node: GraphEntity) => [
    50 + node.position[0] * 5.5,
    50 - node.position[1] * 8,
  ];
  return (
    <div className="flat-graph" aria-label="Interactive 2D knowledge graph">
      <div className="flat-transform" style={{ transform: `scale(${zoom})` }}>
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
                strokeWidth="0.2"
                strokeDasharray={edge.inferred ? "0.8 0.8" : undefined}
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
              onClick={() => s.select(node.id)}
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
      <div className="flat-zoom">
        <button
          onClick={() => setZoom((v) => Math.min(2, v + 0.2))}
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          onClick={() => setZoom((v) => Math.max(0.5, v - 0.2))}
          aria-label="Zoom out"
        >
          −
        </button>
      </div>
    </div>
  );
}
