"use client";
import dynamic from "next/dynamic";
import {
  Component,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  ArrowRight,
  Box,
  Focus,
  List,
  Network,
  SlidersHorizontal,
} from "lucide-react";
import { useKnowledge } from "@/lib/store";
import { CATEGORIES } from "@/lib/types";
import { visibleEntities } from "@/lib/graph-utils";
import { FlatGraph } from "./flat-graph";
const Universe = dynamic(() => import("./universe"), {
  ssr: false,
  loading: () => (
    <div className="scene-skeleton" role="status">
      <span className="spinner" />
      Preparing Explorer
    </div>
  ),
});
const subscribe = (callback: () => void) => {
  const media = window.matchMedia("(min-width: 800px)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
};
class CanvasBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
export function Explorer() {
  const s = useKnowledge();
  const desktop = useSyncExternalStore(
    subscribe,
    () => window.matchMedia("(min-width: 800px)").matches,
    () => false,
  );
  const nodes = useMemo(
    () =>
      visibleEntities(s.run, s.mode, s.graphFilter, s.year, s.focus, s.hops),
    [s.run, s.mode, s.graphFilter, s.year, s.focus, s.hops],
  );
  const ids = new Set(nodes.map((node) => node.id));
  const edges = s.run.relationships.filter(
    (edge) => ids.has(edge.source) && ids.has(edge.target),
  );
  const isList = s.view === "list" || s.accessibility.screenReader;
  return (
    <section className="explorer" aria-label="Explorer">
      <div className="explorer-heading">
        <h2>Explorer</h2>
        <span className="muted">
          {nodes.length} entities · {edges.length} connections
        </span>
      </div>
      <div className="scene-stage" aria-label="Knowledge graph">
        {isList ? (
          <div className="graph-list">
            {nodes.map((node) => (
              <button key={node.id} onClick={() => s.select(node.id)}>
                <span className="category-dot" />
                <span>
                  {node.label}
                  <small>{CATEGORIES[node.type].label}</small>
                </span>
                <ArrowRight size={16} />
              </button>
            ))}
          </div>
        ) : desktop && s.view === "3d" ? (
          <CanvasBoundary fallback={<FlatGraph nodes={nodes} edges={edges} />}>
            <Universe
              nodes={nodes}
              edges={edges}
              onFailure={() =>
                s.set({
                  view: "2d",
                  toast:
                    "3D unavailable. All records are available in 2D and List.",
                })
              }
            />
          </CanvasBoundary>
        ) : (
          <FlatGraph nodes={nodes} edges={edges} />
        )}
        {!nodes.length && (
          <div className="graph-empty">
            <h3>No connections in this view</h3>
            <p>Clear your filters to see the graph.</p>
            <button className="secondary-button" onClick={s.resetGraph}>
              Reset graph
            </button>
          </div>
        )}
        <div className="graph-corner-label">
          {s.run.demo
            ? "Demo data · Curated sources"
            : "Live evidence · Source-linked"}
        </div>
      </div>
      <div className="graph-tools">
        <div className="graph-tool-group">
          <button
            className="icon-button"
            aria-label="Reset graph"
            onClick={s.resetGraph}
          >
            <Focus size={20} />
          </button>
          <button
            className={`view-button ${s.view === "3d" && desktop ? "active" : ""}`}
            onClick={() => s.set({ view: "3d" })}
            disabled={!desktop || s.accessibility.screenReader}
          >
            <Box size={18} />
            3D
          </button>
          <button
            className={`view-button ${!isList && (s.view === "2d" || !desktop) ? "active" : ""}`}
            onClick={() => s.set({ view: "2d" })}
          >
            <Network size={18} />
            2D
          </button>
          <button
            className={`view-button ${isList ? "active" : ""}`}
            onClick={() => s.set({ view: "list" })}
            aria-label="Graph list view"
          >
            <List size={18} />
            List
          </button>
        </div>
        <button
          className="secondary-button"
          aria-label="Open timeline"
          onClick={() => s.set({ modal: "timeline" })}
        >
          <SlidersHorizontal size={18} />
          Timeline
        </button>
      </div>
      <p className="explorer-caption">
        Solid: source-linked · Dashed: inferred association
      </p>
    </section>
  );
}
