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
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import {
  Accessibility,
  ArrowDownToLine,
  ArrowRight,
  Box,
  Check,
  ChevronDown,
  Command,
  Compass,
  Focus,
  Globe2,
  GraduationCap,
  Hexagon,
  List,
  Maximize2,
  Network,
  Newspaper,
  Orbit,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useKnowledge } from "@/lib/store";
import {
  CATEGORIES,
  MODES,
  SOURCE_LABELS,
  type SourceEngine,
} from "@/lib/types";
import { PROMPTS } from "@/lib/demo";
import { visibleEntities } from "@/lib/graph-utils";
import { STAGES, useSearch } from "@/lib/use-search";
import { FlatGraph } from "./graph/flat-graph";
import { EntityPanel, EvidenceDrawer } from "./panels";
import { ResultsSection, DiscoverySection } from "./results";
import { AppModals } from "./modals";
import { BRAND } from "@/lib/brand";
import { BrandMark } from "./brand-mark";

const Universe = dynamic(() => import("./graph/universe"), {
  ssr: false,
  loading: () => (
    <div className="scene-skeleton">
      <Orbit size={28} />
      <span>Preparing your universe</span>
    </div>
  ),
});
const sourceIcons = {
  scholar: GraduationCap,
  jobs: Compass,
  news: Newspaper,
  patents: Hexagon,
  web: Globe2,
};
const subscribeViewport = (callback: () => void) => {
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

export function KnowledgeApp() {
  const s = useKnowledge();
  const set = s.set;
  const desktop = useSyncExternalStore(
    subscribeViewport,
    () => window.matchMedia("(min-width: 800px)").matches,
    () => false,
  );
  const { search, cancel } = useSearch();
  const [promptIndex, setPromptIndex] = useState(0);
  const [liveReady, setLiveReady] = useState<boolean | null>(null);
  const [graphSearchOpen, setGraphSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const nodes = useMemo(() => {
    const all = visibleEntities(
      s.run,
      s.mode,
      s.graphFilter,
      s.year,
      s.focus,
      s.hops,
    );
    if (desktop || s.view === "list" || s.accessibility.screenReader)
      return all;
    const limits = {
      topic: 1,
      paper: 2,
      person: 1,
      institution: 1,
      company: 1,
      job: 1,
      news: 1,
      patent: 1,
      technology: 0,
      web: 1,
    };
    const slots: Record<string, [number, number][]> = {
      topic: [[500, 245]],
      paper: [
        [290, 150],
        [715, 155],
      ],
      person: [[115, 255]],
      institution: [[230, 370]],
      company: [[790, 370]],
      job: [[900, 255]],
      news: [[830, 70]],
      patent: [[495, 410]],
      web: [[185, 70]],
    };
    const counts: Record<string, number> = {};
    return all
      .filter((node) => {
        const n = counts[node.type] ?? 0;
        counts[node.type] = n + 1;
        return n < limits[node.type];
      })
      .map((node, index, selected) => {
        const sameTypeIndex = selected
          .slice(0, index)
          .filter((n) => n.type === node.type).length;
        const point = slots[node.type]?.[sameTypeIndex] ?? [500, 245];
        return {
          ...node,
          position: [(point[0] - 500) / 55, (245 - point[1]) / 45, 0] as [
            number,
            number,
            number,
          ],
        };
      });
  }, [
    s.run,
    s.mode,
    s.graphFilter,
    s.year,
    s.focus,
    s.hops,
    desktop,
    s.view,
    s.accessibility.screenReader,
  ]);
  const nodeIds = useMemo(() => new Set(nodes.map((node) => node.id)), [nodes]);
  const edges = useMemo(
    () =>
      s.run.relationships.filter(
        (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target),
      ),
    [s.run.relationships, nodeIds],
  );
  const activeMode = MODES.find((mode) => mode.id === s.mode)!;
  const is3d = desktop && s.view === "3d" && !s.accessibility.screenReader;
  const hoverNode = s.run.entities.find((node) => node.id === s.hovered);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((data) => setLiveReady(data.searchConfigured))
      .catch(() => setLiveReady(false));
  }, []);
  useEffect(() => {
    if (s.accessibility.reducedMotion) return;
    const timer = setInterval(
      () => setPromptIndex((n) => (n + 1) % PROMPTS.length),
      6000,
    );
    return () => clearInterval(timer);
  }, [s.accessibility.reducedMotion]);
  useEffect(() => {
    if (!s.toast) return;
    const timer = setTimeout(() => set({ toast: null }), 5000);
    return () => clearTimeout(timer);
  }, [s.toast, set]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing =
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
        target.isContentEditable;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        s.set({ modal: s.modal === "commands" ? null : "commands" });
        return;
      }
      if (event.key === "Escape") {
        s.set({
          modal: null,
          selected: null,
          evidenceClaim: null,
          hovered: null,
        });
        return;
      }
      if (
        typing ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        s.modal ||
        !s.accessibility.keyboardNavigation
      )
        return;
      if (event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      const shortcuts = {
        g: "universe",
        n: "news",
        s: "scholar",
        j: "jobs",
        p: "patents",
      } as const;
      if (event.key.toLowerCase() in shortcuts)
        s.setMode(shortcuts[event.key.toLowerCase() as keyof typeof shortcuts]);
      if (event.key.toLowerCase() === "t") s.set({ modal: "timeline" });
      if (event.key === "?") s.set({ modal: "shortcuts" });
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [s]);
  const toggleLive = () => {
    if (s.searching) return;
    if (s.demo && !liveReady) {
      s.set({
        toast:
          "Live search needs a server-side SERPAPI_API_KEY. The demo is ready to explore.",
      });
      return;
    }
    const demo = !s.demo;
    s.set({
      demo,
      error: null,
      toast: demo
        ? "Demo mode · curated historical evidence."
        : "Live mode · your next search will retrieve real evidence.",
    });
  };

  return (
    <MotionConfig
      reducedMotion={s.accessibility.reducedMotion ? "always" : "user"}
    >
      <div
        className={`knowledge-app ${s.accessibility.highContrast ? "high-contrast" : ""} ${s.accessibility.largeText ? "large-text" : ""} ${s.accessibility.reducedMotion ? "reduced-motion" : ""} ${s.accessibility.keyboardNavigation ? "keyboard-navigation" : ""}`}
      >
        <a className="skip-link" href="#results">
          Skip to accessible evidence
        </a>
        <header className="topbar" inert={Boolean(s.modal || s.evidenceClaim)}>
          <button
            className="brand"
            onClick={() => {
              s.setMode("universe");
              s.resetGraph();
              window.scrollTo({
                top: 0,
                behavior: s.accessibility.reducedMotion ? "instant" : "smooth",
              });
            }}
            aria-label={`${BRAND.name} home`}
          >
            <BrandMark />
            <span>
              {BRAND.name}<span className="brand-secondary">{BRAND.tagline}</span>
            </span>
          </button>
          <nav className="main-nav" aria-label="Investigation modes">
            {MODES.map((mode) => (
              <button
                key={mode.id}
                className={s.mode === mode.id ? "active" : ""}
                onClick={() => s.setMode(mode.id)}
              >
                {mode.label}
                {s.mode === mode.id && <span className="nav-active-dot" />}
              </button>
            ))}
          </nav>
          <div className="header-actions">
            <button
              className={`data-mode ${s.demo ? "demo" : "live"}`}
              onClick={toggleLive}
              aria-label={
                s.demo ? "Switch to live search" : "Switch to demo mode"
              }
              disabled={s.searching}
            >
              <span className="status-dot" />
              {s.demo ? "Demo mode" : "Live search"}
              <ChevronDown size={12} />
            </button>
            <button
              className="icon-button"
              aria-label="Accessibility settings"
              onClick={() => s.set({ modal: "accessibility" })}
            >
              <Accessibility size={18} />
            </button>
            <button
              className="command-key"
              onClick={() => s.set({ modal: "commands" })}
              aria-label="Open command center"
            >
              <Command size={12} /> K
            </button>
          </div>
        </header>

        <main inert={Boolean(s.modal || s.evidenceClaim)}>
          <section
            className="universe-hero"
            aria-label="Knowledge exploration workspace"
          >
            <div
              className={`hero-intro ${s.mode !== "universe" ? "mode-intro" : ""}`}
            >
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65 }}
              >
                <h1>
                  {s.mode === "universe" ? (
                    <>
                      Search research, jobs,<br />news and patents.
                    </>
                  ) : (
                    <>
                      {activeMode.name}
                      <br />
                      <span>{activeMode.description}</span>
                    </>
                  )}
                </h1>
                <p className="hero-subtitle">
                  See the source behind every answer.
                </p>
              </motion.div>
              <motion.div
                className="search-area"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.6 }}
              >
                <form
                  className={`search-command ${s.searching ? "busy" : ""}`}
                  onSubmit={(event) => {
                    event.preventDefault();
                    void search();
                  }}
                >
                  <Search size={22} strokeWidth={1.5} />
                  <input
                    ref={searchRef}
                    id="knowledge-search"
                    value={s.query}
                    onChange={(event) => s.set({ query: event.target.value })}
                    placeholder="Enter a topic or question"
                    autoComplete="off"
                    aria-label="Search public knowledge"
                    maxLength={600}
                    disabled={s.searching}
                  />
                  <kbd className="search-key">/</kbd>
                  <button
                    type={s.searching ? "button" : "submit"}
                    onClick={s.searching ? cancel : undefined}
                    className="search-submit"
                    aria-label={
                      s.searching ? "Cancel investigation" : "Explore knowledge"
                    }
                  >
                    {s.searching ? <X size={20} /> : <ArrowRight size={21} />}
                  </button>
                </form>
                <div className="source-select">
                  <span className="source-label">LOOK ACROSS</span>
                  {(Object.keys(SOURCE_LABELS) as SourceEngine[]).map(
                    (source) => {
                      const Icon = sourceIcons[source];
                      return (
                        <button
                          key={source}
                          className={`source-chip ${s.sources.includes(source) ? "selected" : ""}`}
                          aria-pressed={s.sources.includes(source)}
                          onClick={() => s.toggleSource(source)}
                          disabled={s.searching}
                        >
                          <Icon size={12} />
                          {SOURCE_LABELS[source]}
                          {s.sources.includes(source) && <Check size={10} />}
                        </button>
                      );
                    },
                  )}
                  <button
                    className={`source-auto ${!s.sources.length ? "active" : ""}`}
                    onClick={() => s.set({ sources: [] })}
                    title="Automatically select relevant sources"
                    disabled={s.searching}
                  >
                    Auto
                  </button>
                </div>
                <div className="suggested-query">
                  <span>Try exploring</span>
                  <button
                    onClick={() => {
                      s.set({ query: PROMPTS[promptIndex] });
                      void search(PROMPTS[promptIndex]);
                    }}
                    disabled={s.searching}
                  >
                    {PROMPTS[promptIndex]} <ArrowRight size={12} />
                  </button>
                </div>
              </motion.div>
            </div>

            <div
              className="scene-stage"
              aria-label={
                is3d
                  ? "3D knowledge universe. Rotate by dragging; scroll to zoom. A list view is available in graph controls."
                  : "Knowledge graph"
              }
            >
              <div className="scene-grid" />
              {s.view === "list" || s.accessibility.screenReader ? (
                <div className="graph-list">
                  {nodes.map((node) => (
                    <button key={node.id} onClick={() => s.select(node.id)}>
                      <span
                        className="category-dot"
                        style={{ background: CATEGORIES[node.type].color }}
                      />
                      <span>
                        {node.label}
                        <small>{CATEGORIES[node.type].label}</small>
                      </span>
                      <ArrowRight size={14} />
                    </button>
                  ))}
                </div>
              ) : is3d ? (
                <CanvasBoundary
                  fallback={<FlatGraph nodes={nodes} edges={edges} />}
                >
                  <Universe
                    nodes={nodes}
                    edges={edges}
                    onFailure={() =>
                      s.set({
                        view: "2d",
                        toast:
                          "2D graph activated. All evidence and connections are available.",
                      })
                    }
                  />
                </CanvasBoundary>
              ) : (
                <FlatGraph nodes={nodes} edges={edges} compact={!desktop} />
              )}
              <div className="scene-vignette" />
              {!nodes.length && (
                <div className="graph-empty">
                  <Search size={24} />
                  <h3>No connections in this view</h3>
                  <p>Try another filter or expand your exploration.</p>
                  <button className="text-button" onClick={s.resetGraph}>
                    Reset graph <RotateCcw size={12} />
                  </button>
                </div>
              )}
              <div className="graph-corner-label">
                <span className="little-cross">+</span>{" "}
                {s.run.demo
                  ? "DEMO DATA · CURATED SOURCES"
                  : "LIVE EVIDENCE · SOURCE-LINKED"}
              </div>
              <AnimatePresence>
                {hoverNode && !s.selected && (
                  <motion.div
                    className="node-hover"
                    key={hoverNode.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    <span style={{ color: CATEGORIES[hoverNode.type].color }}>
                      {CATEGORIES[hoverNode.type].label.toUpperCase()}
                    </span>
                    <strong>{hoverNode.label}</strong>
                    <small>
                      {
                        s.run.relationships.filter(
                          (e) =>
                            e.source === hoverNode.id ||
                            e.target === hoverNode.id,
                        ).length
                      }{" "}
                      mapped connections · {hoverNode.evidenceIds.length} source
                      references
                    </small>
                    <button onClick={() => s.select(hoverNode.id)}>
                      Explore entity <ArrowRight size={13} />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="graph-tools">
              <div className="graph-tool-group">
                <button
                  className="icon-button"
                  title="Reset graph"
                  aria-label="Reset graph"
                  onClick={s.resetGraph}
                >
                  <Focus size={17} />
                </button>
                <span className="tool-divider" />
                <button
                  className={`view-button ${s.view === "3d" && desktop ? "active" : ""}`}
                  onClick={() => s.set({ view: "3d" })}
                  disabled={!desktop || s.accessibility.screenReader}
                >
                  <Box size={14} />
                  3D
                </button>
                <button
                  className={`view-button ${s.view !== "list" && (s.view === "2d" || !desktop) ? "active" : ""}`}
                  onClick={() => s.set({ view: "2d" })}
                >
                  <Network size={14} />
                  2D
                </button>
                <button
                  className={`view-button ${s.view === "list" ? "active" : ""}`}
                  onClick={() => s.set({ view: "list" })}
                  aria-label="Graph list view"
                >
                  <List size={15} />
                </button>
              </div>
              <div className="graph-tool-group">
                {graphSearchOpen && (
                  <input
                    className="graph-filter-input"
                    aria-label="Search within graph"
                    placeholder="Find an entity…"
                    value={s.graphFilter}
                    onChange={(e) => s.set({ graphFilter: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setGraphSearchOpen(false);
                        s.set({ graphFilter: "" });
                      }
                    }}
                    autoFocus
                  />
                )}
                <button
                  className="icon-button"
                  aria-label="Search graph"
                  title="Search graph"
                  onClick={() => {
                    setGraphSearchOpen(!graphSearchOpen);
                    if (graphSearchOpen) s.set({ graphFilter: "" });
                  }}
                >
                  <Search size={15} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Open timeline"
                  title="Timeline"
                  onClick={() => s.set({ modal: "timeline" })}
                >
                  <SlidersHorizontal size={16} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Export evidence"
                  title="Export evidence"
                  onClick={() => s.set({ modal: "export" })}
                >
                  <ArrowDownToLine size={16} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Expand all retrieved connections"
                  title="Expand all retrieved connections"
                  onClick={() =>
                    s.set({
                      focus: null,
                      hops: 20,
                      cameraReset: s.cameraReset + 1,
                    })
                  }
                >
                  <Maximize2 size={15} />
                </button>
              </div>
            </div>
            <div className="graph-bottom">
              <div className="graph-legend">
                {(
                  [
                    "paper",
                    "person",
                    "institution",
                    "job",
                    "news",
                    "patent",
                  ] as const
                ).map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      s.set({ view: "list", graphFilter: "" });
                      s.setMode(
                        type === "paper" ||
                          type === "person" ||
                          type === "institution"
                          ? "scholar"
                          : type === "job"
                            ? "jobs"
                            : type === "news"
                              ? "news"
                              : "patents",
                      );
                    }}
                  >
                    <span style={{ background: CATEGORIES[type].color }} />
                    {CATEGORIES[type].plural}
                  </button>
                ))}
              </div>
              <div className="graph-count">
                <span>{nodes.length} entities</span>
                <span className="separator-dot">·</span>
                <span>{edges.length} connections</span>
                <span className="graph-help">
                  Drag to explore <span>↔</span>
                </span>
              </div>
            </div>
            <div className="hero-footer">
              <span>
                <ShieldCheck size={14} /> Built on sources. Connected by
                evidence.
              </span>
              <button
                onClick={() =>
                  document
                    .getElementById("results")
                    ?.scrollIntoView({
                      behavior: s.accessibility.reducedMotion
                        ? "instant"
                        : "smooth",
                    })
                }
              >
                View source records <ArrowRight size={13} />
              </button>
            </div>
            <AnimatePresence>
              {s.searching && (
                <motion.div
                  className="progress-overlay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div
                    className="progress-panel"
                    role="status"
                    aria-live="polite"
                  >
                    <div className="progress-header">
                      <span className="live-orbit">
                        <Orbit size={20} />
                      </span>
                      <div>
                        <span className="eyebrow">
                          {s.demo ? "DEMO EXPLORATION" : "SEARCHING KNOWLEDGE"}
                        </span>
                        <h3>Searching and checking sources</h3>
                      </div>
                      <button
                        className="icon-button"
                        aria-label="Cancel search"
                        onClick={cancel}
                      >
                        <X size={17} />
                      </button>
                    </div>
                    <div className="progress-stages">
                      {STAGES.map((stage) => (
                        <div
                          key={stage}
                          className={s.stages[stage] ?? "pending"}
                        >
                          {s.stages[stage] === "complete" ? (
                            <Check size={14} />
                          ) : s.stages[stage] === "running" ? (
                            <span className="spinner" />
                          ) : (
                            <span className="stage-dot" />
                          )}
                          <span>{stage}</span>
                          {s.stages[stage] === "skipped" && (
                            <small>Not needed</small>
                          )}
                        </div>
                      ))}
                    </div>
                    <p>
                      {s.demo
                        ? "Playing the curated efficient-inference example."
                        : "Following relevant sources, one connection at a time."}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {s.error && (
                <motion.div
                  className="search-error"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  role="alert"
                >
                  <div>
                    <span className="eyebrow">SEARCH INTERRUPTED</span>
                    <p>{s.error}</p>
                    {s.sourceStatuses.length > 0 && (
                      <div className="error-sources">
                        {s.sourceStatuses.map((source) => (
                          <span key={source.source}>
                            {source.state === "success"
                              ? "✓"
                              : source.state === "error"
                                ? "✕"
                                : "○"}{" "}
                            {SOURCE_LABELS[source.source]}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => void search()}
                    className="secondary-button"
                  >
                    Try again <RotateCcw size={13} />
                  </button>
                  <button
                    className="icon-button"
                    onClick={() => s.set({ error: null })}
                    aria-label="Dismiss error"
                  >
                    <X size={15} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          <section id="results" className="results-section">
            <ResultsSection onSearch={search} />
          </section>
          {s.mode === "universe" && <DiscoverySection />}
          <footer className="site-footer">
            <div className="footer-brand">
              <BrandMark /> {BRAND.name}
            </div>
            <span>{BRAND.tagline}</span>
            <div>
              <button onClick={() => s.set({ modal: "accessibility" })}>
                Accessibility
              </button>
              <button onClick={() => s.set({ modal: "shortcuts" })}>
                Keyboard shortcuts
              </button>
              <button onClick={() => s.set({ modal: "export" })}>
                Export evidence <ArrowRight size={12} />
              </button>
            </div>
          </footer>
        </main>
        <AnimatePresence>
          {s.selected && <EntityPanel key={s.selected} onSearch={search} />}
        </AnimatePresence>
        <AnimatePresence>
          {s.evidenceClaim && <EvidenceDrawer key={s.evidenceClaim} />}
        </AnimatePresence>
        <AppModals onSearch={search} />
        <AnimatePresence>
          {s.toast && (
            <motion.div
              className="toast"
              role="status"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
            >
              <Check size={15} />
              <span>{s.toast}</span>
              <button
                onClick={() => s.set({ toast: null })}
                aria-label="Dismiss notification"
              >
                <X size={13} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
