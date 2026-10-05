"use client";
import dynamic from "next/dynamic";
import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
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
  Maximize2,
  Minimize2,
  Plus,
  Minus,
  RotateCcw,
  Pause,
  Play,
} from "lucide-react";
import { useKnowledge } from "@/lib/store";
import { CATEGORIES } from "@/lib/types";
import { visibleEntities } from "@/lib/graph-utils";
import { useExplorer } from "@/lib/explorer-store";
import { FlatGraph } from "./flat-graph";
import { layoutGraph, type Point } from "@/lib/graph-layout";
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
const subscribeMotion = (callback: () => void) => { const media = window.matchMedia("(prefers-reduced-motion: reduce)"); media.addEventListener("change", callback); return () => media.removeEventListener("change", callback); };
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
  const viewer = useExplorer();
  const stage = useRef<HTMLDivElement>(null);
  const layoutCache = useMemo(() => ({ investigationId: s.run.id, positions: new Map<string, Point>() }), [s.run.id]);
  const layout = useMemo(
    () => layoutGraph(s.run.entities, s.run.relationships, layoutCache.positions),
    [s.run.entities, s.run.relationships, layoutCache],
  );
  const [limit, setLimit] = useState(1000);
  const desktop = useSyncExternalStore(
    subscribe,
    () => window.matchMedia("(min-width: 800px)").matches,
    () => false,
  );
  const reducedOS = useSyncExternalStore(subscribeMotion, () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => false);
  const nodes = useMemo(
    () =>
      visibleEntities(
        { ...s.run, entities: layout },
        s.mode,
        s.graphFilter,
        s.year,
        s.focus,
        s.hops,
      ),
    [s.run, layout, s.mode, s.graphFilter, s.year, s.focus, s.hops],
  );
  const renderedNodes = useMemo(() => nodes.slice(0, limit), [nodes, limit]);
  const edges = useMemo(() => {
    const ids = new Set(renderedNodes.map((node) => node.id));
    return s.run.relationships.filter(
      (edge) => ids.has(edge.source) && ids.has(edge.target),
    );
  }, [s.run.relationships, renderedNodes]);
  const request = viewer.request;
  useEffect(() => {
    request("fit");
  }, [nodes, request]);
  const isList = s.view === "list" || s.accessibility.screenReader;
  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      if (
        !useExplorer.getState().active ||
        useKnowledge.getState().view === "list" ||
        useKnowledge.getState().accessibility.screenReader
      )
        return;
      event.preventDefault();
      useExplorer.getState().request(event.deltaY < 0 ? "zoom-in" : "zoom-out");
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const v = useExplorer.getState();
      if (!v.active && !v.fullscreen) return;
      if (
        ["INPUT", "TEXTAREA", "SELECT"].includes(
          (event.target as HTMLElement).tagName,
        ) ||
        useKnowledge.getState().modal ||
        useKnowledge.getState().evidenceClaim
      )
        return;
      const keys = {
        "+": "zoom-in",
        "=": "zoom-in",
        "-": "zoom-out",
        "0": "fit",
        ArrowLeft: "pan-left",
        ArrowRight: "pan-right",
        ArrowUp: "pan-up",
        ArrowDown: "pan-down",
      } as const;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        v.set({ active: false, fullscreen: false });
        stage.current?.blur();
        return;
      }
      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        v.set({ fullscreen: !v.fullscreen });
        return;
      }
      if (event.key in keys) {
        event.preventDefault();
        v.request(keys[event.key as keyof typeof keys]);
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, []);
  useEffect(() => {
    if (!viewer.fullscreen) return;
    const y = window.scrollY,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    stage.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = overflow;
      window.scrollTo({ top: y, behavior: "instant" });
    };
  }, [viewer.fullscreen]);
  useEffect(() => {
    const release = (event: PointerEvent) => {
      if (!(event.target as HTMLElement).closest(".explorer"))
        useExplorer.getState().set({ active: false });
    };
    document.addEventListener("pointerdown", release);
    return () => document.removeEventListener("pointerdown", release);
  }, []);
  return (
    <section
      className={`explorer explorer-${viewer.preset} ${viewer.fullscreen ? "explorer-fullscreen" : ""}`}
      aria-label="Explorer"
    >
      <div className="explorer-heading">
        <h2>Explorer</h2>
        <span className="muted">
          {nodes.length} entities · {edges.length} connections
        </span>
      </div>
      <div
        ref={stage}
        className={`scene-stage ${viewer.active ? "viewer-active" : ""}`}
        aria-label="Knowledge graph"
        tabIndex={0}
        onPointerEnter={() => viewer.set({ hovering: true })}
        onPointerLeave={() => {
          viewer.set({ hovering: false, dragging: false });
          viewer.interact();
        }}
        onPointerDownCapture={() => {
          viewer.set({ active: true });
          viewer.interact();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            viewer.set({ active: true });
          }
        }}
        onContextMenu={(event) => {
          if (viewer.active) event.preventDefault();
        }}
      >
        {isList ? (
          <div className="graph-list">
            {renderedNodes.map((node) => (
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
          <CanvasBoundary
            fallback={<FlatGraph nodes={renderedNodes} edges={edges} />}
          >
            <Universe
              nodes={renderedNodes}
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
          <FlatGraph nodes={renderedNodes} edges={edges} />
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
        {nodes.length > limit && (
          <button
            className="secondary-button"
            onClick={() => setLimit((n) => n + 1000)}
          >
            Show more ({nodes.length - limit} remaining)
          </button>
        )}
        <div className="graph-tool-group">
          <button
            className="icon-button"
            aria-label="Zoom in"
            onClick={() => viewer.request("zoom-in")}
          >
            <Plus size={20} />
          </button>
          <button
            className="icon-button"
            aria-label="Zoom out"
            onClick={() => viewer.request("zoom-out")}
          >
            <Minus size={20} />
          </button>
          <span className="zoom-readout" aria-live="polite">
            {Math.round(viewer.zoom * 100)}%
          </span>
          <button className="view-button" onClick={() => viewer.request("fit")}>
            <Focus size={18} />
            Fit to view
          </button>
        </div>
        <div className="graph-tool-group">
          <button
            className="icon-button"
            aria-label="Reset graph"
            onClick={() => {
              s.resetGraph();
              viewer.request("reset");
            }}
          >
            <RotateCcw size={20} />
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
        <div className="graph-tool-group">
          <button
            className="view-button"
            aria-label="Auto-rotate"
            aria-pressed={viewer.autoRotate && !s.accessibility.reducedMotion && !reducedOS}
            disabled={s.accessibility.reducedMotion || reducedOS || !desktop || isList}
            onClick={() => viewer.set({ autoRotate: !viewer.autoRotate })}
          >
            {viewer.autoRotate ? <Pause size={18} /> : <Play size={18} />}Rotate
          </button>
          <button
            className="view-button"
            aria-label={
              viewer.fullscreen ? "Exit fullscreen" : "Fullscreen Explorer"
            }
            onClick={() =>
              viewer.set({ fullscreen: !viewer.fullscreen, active: true })
            }
          >
            {viewer.fullscreen ? (
              <Minimize2 size={18} />
            ) : (
              <Maximize2 size={18} />
            )}
            {viewer.fullscreen ? "Close" : "Fullscreen"}
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
      <div className="viewer-options">
        <label>
          Viewer size
          <select
            value={viewer.preset}
            onChange={(event) =>
              viewer.set({ preset: event.target.value as typeof viewer.preset })
            }
          >
            <option value="compact">Compact</option>
            <option value="large">Large</option>
            <option value="full">Full</option>
          </select>
        </label>
        <button
          className="text-button"
          onClick={() => {
            viewer.set({ active: !viewer.active });
            stage.current?.focus({ preventScroll: true });
          }}
        >
          {viewer.active ? "Release viewer focus" : "Activate viewer"}
        </button>
      </div>
      <p className="explorer-caption">
        {viewer.active
          ? "Viewer active. Wheel to zoom. Esc releases focus."
          : "Click the viewer to enable zoom. Scroll the page normally until then."}{" "}
        Drag to rotate in 3D or pan in 2D; right-drag pans. +/− zoom · 0 fit · F
        fullscreen · arrows pan.
      </p>
      <p className="explorer-caption">
        Solid: source-linked · Dashed: inferred association
      </p>
    </section>
  );
}
