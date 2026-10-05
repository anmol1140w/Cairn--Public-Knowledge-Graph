"use client";
import { useId, useState } from "react";
import { CATEGORIES, type GraphEntity, type Relationship } from "@/lib/types";
import { useKnowledge } from "@/lib/store";

export function FlatGraph({
  nodes,
  edges,
  compact = false,
}: {
  nodes: GraphEntity[];
  edges: Relationship[];
  compact?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const select = useKnowledge((s) => s.select);
  const selected = useKnowledge((s) => s.selected);
  const highlighted = useKnowledge((s) => s.highlighted);
  const set = useKnowledge((s) => s.set);
  const [zoom, setZoom] = useState(1);
  const map = new Map(nodes.map((node) => [node.id, node]));
  const xy = (node: GraphEntity) => [
    500 + node.position[0] * 55,
    245 - node.position[1] * 45,
  ];
  return (
    <div className="flat-graph">
      <svg
        viewBox="0 0 1000 490"
        role="group"
        aria-label="Interactive 2D knowledge graph"
        onWheel={(event) => {
          if (event.ctrlKey)
            setZoom((z) =>
              Math.max(0.6, Math.min(2, z - event.deltaY * 0.001)),
            );
        }}
      >
        <defs>
          <filter id={`${id}-glow`}>
            <feGaussianBlur stdDeviation="5" />
          </filter>
          <radialGradient id={`${id}-sphere`}>
            <stop stopColor="#3d5a9e" />
            <stop offset="0.7" stopColor="#121f3a" />
            <stop offset="1" stopColor="#759add" />
          </radialGradient>
        </defs>
        <g transform={`translate(500 245) scale(${zoom}) translate(-500 -245)`}>
          {edges.map((edge) => {
            const a = map.get(edge.source);
            const b = map.get(edge.target);
            if (!a || !b) return null;
            const [x1, y1] = xy(a);
            const [x2, y2] = xy(b);
            const active = highlighted.length
              ? edge.evidenceIds.some((e) => highlighted.includes(e))
              : edge.source === selected || edge.target === selected;
            return (
              <path
                key={edge.id}
                d={`M${x1},${y1} Q${(x1 + x2) / 2},${(y1 + y2) / 2 - 18} ${x2},${y2}`}
                stroke={active ? "#b0c7ff" : "#384760"}
                strokeWidth={active ? 1.8 : 0.8}
                strokeDasharray={edge.inferred ? "4 5" : undefined}
                fill="none"
                opacity={highlighted.length && !active ? 0.12 : 0.7}
              />
            );
          })}
          {nodes.map((node) => {
            const [x, y] = xy(node);
            const color = CATEGORIES[node.type].color;
            const dimmed =
              highlighted.length > 0 &&
              !node.evidenceIds.some((e) => highlighted.includes(e));
            const radius = node.type === "topic" ? 32 : 6;
            return (
              <g
                key={node.id}
                transform={`translate(${x},${y})`}
                role="button"
                tabIndex={0}
                aria-label={`Explore ${node.title}`}
                onClick={() => select(node.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    select(node.id);
                  }
                }}
                onMouseEnter={() => set({ hovered: node.id })}
                onMouseLeave={() => set({ hovered: null })}
                style={{ cursor: "pointer", opacity: dimmed ? 0.2 : 1 }}
              >
                <circle
                  r={radius * 2}
                  fill={color}
                  opacity="0.12"
                  filter={`url(#${id}-glow)`}
                />
                {node.type === "patent" ? (
                  <polygon points="0,-9 8,-5 8,5 0,9 -8,5 -8,-5" fill={color} />
                ) : node.type === "company" ||
                  node.type === "news" ||
                  node.type === "job" ? (
                  <rect
                    x="-6"
                    y="-6"
                    width={node.type === "news" ? 17 : 12}
                    height="12"
                    rx="1"
                    fill={color}
                  />
                ) : (
                  <circle
                    r={radius}
                    fill={node.type === "topic" ? `url(#${id}-sphere)` : color}
                  />
                )}
                {node.type === "topic" && (
                  <>
                    <ellipse
                      rx="43"
                      ry="12"
                      fill="none"
                      stroke="#7c9cd9"
                      opacity="0.6"
                      transform="rotate(-25)"
                    />
                    <circle
                      r="49"
                      fill="none"
                      stroke="#35476c"
                      strokeDasharray="2 6"
                    />
                  </>
                )}
                {selected === node.id && (
                  <circle
                    r={radius + 7}
                    fill="none"
                    stroke={color}
                    opacity="0.6"
                  />
                )}
                <text
                  y={radius + (compact ? 30 : 21)}
                  textAnchor="middle"
                  fill="#dce2f2"
                  fontSize={
                    compact
                      ? node.type === "topic"
                        ? 26
                        : 21
                      : node.type === "topic"
                        ? 15
                        : 11
                  }
                  fontFamily="var(--font-geist-sans)"
                >
                  {node.label}
                </text>
                <text
                  y={radius + (compact ? 50 : 35)}
                  textAnchor="middle"
                  fill={color}
                  fontSize={compact ? 11 : 6.7}
                  letterSpacing="1.2"
                  opacity="0.8"
                >
                  {CATEGORIES[node.type].label.toUpperCase()}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      <div className="flat-zoom">
        <button
          onClick={() => setZoom((v) => Math.min(2, v + 0.2))}
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          onClick={() => setZoom((v) => Math.max(0.6, v - 0.2))}
          aria-label="Zoom out"
        >
          −
        </button>
      </div>
    </div>
  );
}
