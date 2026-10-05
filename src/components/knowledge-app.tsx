"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import {
  Accessibility,
  ArrowDownToLine,
  ArrowRight,
  Check,
  Command,
  Moon,
  Search,
  Sun,
  X,
} from "lucide-react";
import { useKnowledge } from "@/lib/store";
import { MODES, SOURCE_LABELS, type SourceEngine } from "@/lib/types";
import { PROMPTS } from "@/lib/demo";
import { STAGES, useSearch } from "@/lib/use-search";
import { EntityPanel, EvidenceDrawer } from "./panels";
import { ResultsSection } from "./results";
import { AppModals } from "./modals";
import { BRAND } from "@/lib/brand";
import { BrandMark } from "./brand-mark";
import { Explorer } from "./graph/explorer";

export function KnowledgeApp() {
  const s = useKnowledge();
  const set = s.set;
  const { search, cancel } = useSearch();
  const [liveReady, setLiveReady] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const activeMode = MODES.find((mode) => mode.id === s.mode)!;
  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((data) => setLiveReady(data.searchConfigured))
      .catch(() => setLiveReady(false));
  }, []);
  useEffect(() => {
    if (!s.toast) return;
    const timer = setTimeout(() => set({ toast: null }), 5000);
    return () => clearTimeout(timer);
  }, [s.toast, set]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
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
    if (s.demo && !liveReady) {
      s.set({
        toast:
          "Live search is not configured on this server. Demo examples are available.",
      });
      return;
    }
    s.set({
      demo: !s.demo,
      error: null,
      toast: s.demo
        ? "Live selected. The next search retrieves source records; the current demo remains labelled."
        : "Demo selected. Examples use no live search requests.",
    });
  };
  return (
    <MotionConfig
      reducedMotion={s.accessibility.reducedMotion ? "always" : "user"}
      transition={{ duration: 0.2 }}
    >
      <div
        className={`knowledge-app ${s.theme === "dark" ? "dark-theme" : ""} ${s.accessibility.highContrast ? "high-contrast" : ""} ${s.accessibility.largeText ? "large-text" : ""} ${s.accessibility.reducedMotion ? "reduced-motion" : ""}`}
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
              window.scrollTo({ top: 0 });
            }}
            aria-label={`${BRAND.name} home`}
          >
            <BrandMark />
            <span>
              {BRAND.name}
              <span className="brand-secondary">{BRAND.tagline}</span>
            </span>
          </button>
          <nav className="main-nav" aria-label="Investigation modes">
            {MODES.map((mode) => (
              <button
                key={mode.id}
                className={s.mode === mode.id ? "active" : ""}
                aria-current={s.mode === mode.id ? "page" : undefined}
                onClick={() => s.setMode(mode.id)}
              >
                {mode.label}
              </button>
            ))}
          </nav>
          <div className="header-actions">
            <button
              className="data-mode"
              onClick={toggleLive}
              aria-label={
                s.demo ? "Switch to live search" : "Switch to demo mode"
              }
              disabled={s.searching}
            >
              <span className="status-dot" />
              {s.demo ? "Demo data" : "Live"}
            </button>
            <button
              className="icon-button"
              aria-label={
                s.theme === "light" ? "Use dark theme" : "Use light theme"
              }
              onClick={() =>
                s.set({ theme: s.theme === "light" ? "dark" : "light" })
              }
            >
              {s.theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
            </button>
            <button
              className="icon-button"
              aria-label="Accessibility settings"
              onClick={() => s.set({ modal: "accessibility" })}
            >
              <Accessibility size={20} />
            </button>
            <button
              className="command-key"
              onClick={() => s.set({ modal: "commands" })}
              aria-label="Open command center"
            >
              <Command size={16} /> K
            </button>
          </div>
        </header>
        <main inert={Boolean(s.modal || s.evidenceClaim)}>
          <section
            className="universe-hero"
            aria-label="Knowledge exploration workspace"
          >
            <div className="hero-intro">
              <h1>
                {s.mode === "universe" ? (
                  <>
                    Search research, jobs,
                    <br />
                    news and patents.
                  </>
                ) : (
                  activeMode.name
                )}
              </h1>
              <p className="hero-subtitle">
                {s.mode === "universe"
                  ? "See the source behind every answer."
                  : activeMode.description}
              </p>
              <div className="search-area">
                <form
                  className="search-command"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void search();
                  }}
                >
                  <Search size={22} />
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
                <div className="suggested-query">
                  <span>Example</span>
                  <button
                    onClick={() => {
                      s.set({ query: PROMPTS[0] });
                      void search(PROMPTS[0]);
                    }}
                    disabled={s.searching}
                  >
                    {PROMPTS[0]} <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </div>
            <div className="workspace-grid">
              <aside
                className="workspace-sidebar"
                aria-label="About you and filters"
              >
                <h3>About you</h3>
                <p>Optional details help tailor results to your needs.</p>
                <button
                  className="secondary-button full-width"
                  onClick={() => s.set({ modal: "profile" })}
                >
                  {s.skills.length ? "Edit your details" : "Add your details"}
                </button>
                <h3>Sources</h3>
                <p>Choose sources or let the planner select them.</p>
                <div className="source-select">
                  {(Object.keys(SOURCE_LABELS) as SourceEngine[]).map(
                    (source) => (
                      <button
                        key={source}
                        className={`source-chip ${s.sources.includes(source) ? "selected" : ""}`}
                        aria-pressed={s.sources.includes(source)}
                        onClick={() => s.toggleSource(source)}
                        disabled={s.searching}
                      >
                        {SOURCE_LABELS[source]}
                        {s.sources.includes(source) && <Check size={16} />}
                      </button>
                    ),
                  )}
                  <button
                    className={`source-auto ${!s.sources.length ? "active" : ""}`}
                    onClick={() => s.set({ sources: [] })}
                    disabled={s.searching}
                  >
                    Auto
                  </button>
                </div>
                <label className="sidebar-field">
                  Find in Explorer
                  <input
                    aria-label="Search within graph"
                    placeholder="Entity name"
                    value={s.graphFilter}
                    onChange={(event) =>
                      s.set({ graphFilter: event.target.value })
                    }
                  />
                </label>
                <button className="text-button" onClick={s.resetGraph}>
                  Clear graph filters
                </button>
                <small>
                  Solid connections are source-linked. Dashed connections are
                  inferred associations.
                </small>
              </aside>
              <div className="workspace-center">
                <Explorer />
              </div>
              <aside
                className="workspace-details"
                aria-label="Details and evidence"
              >
                {s.selected ? (
                  <EntityPanel key={s.selected} onSearch={search} />
                ) : (
                  <div className="details-placeholder">
                    <h3>Details and evidence</h3>
                    <p>
                      Select an entity to inspect its source records and
                      connections.
                    </p>
                    <h4>This investigation</h4>
                    <p>
                      {s.run.evidence.length} records · {s.run.claims.length}{" "}
                      assessed claims
                    </p>
                    <span className="data-badge">
                      {s.run.demo ? "Demo data" : "Live evidence"}
                    </span>
                    <h4>Check a claim</h4>
                    {s.run.claims.slice(0, 3).map((claim) => (
                      <button
                        className="overview-claim"
                        key={claim.id}
                        onClick={() => s.set({ evidenceClaim: claim.id })}
                      >
                        {claim.text}
                        <ArrowRight size={16} />
                      </button>
                    ))}
                    {!s.run.claims.length && <p>No claims established yet.</p>}
                  </div>
                )}
              </aside>
            </div>
            {s.searching && (
              <div className="progress-overlay">
                <div
                  className="progress-panel"
                  role="status"
                  aria-live="polite"
                >
                  <div className="progress-header">
                    <span className="spinner" />
                    <h3>Searching and checking sources</h3>
                    <button
                      className="icon-button"
                      aria-label="Cancel search"
                      onClick={cancel}
                    >
                      <X size={20} />
                    </button>
                  </div>
                  <div className="progress-stages">
                    {STAGES.map((stage) => (
                      <div key={stage} className={s.stages[stage] ?? "pending"}>
                        {s.stages[stage] === "complete" ? (
                          <Check size={16} />
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
                      ? "Loading a curated example. No live requests."
                      : "Retrieving relevant source records within the search budget."}
                  </p>
                </div>
              </div>
            )}
            {s.error && (
              <div className="search-error" role="alert">
                <div>
                  <h3>Search interrupted</h3>
                  <p>{s.error}</p>
                </div>
                <button
                  onClick={() => void search()}
                  className="secondary-button"
                >
                  Try again
                </button>
                <button
                  className="icon-button"
                  onClick={() => s.set({ error: null })}
                  aria-label="Dismiss error"
                >
                  <X size={20} />
                </button>
              </div>
            )}
          </section>
          <section id="results" className="results-section">
            <ResultsSection onSearch={search} />
          </section>
          <footer className="site-footer">
            <div className="footer-brand">
              <BrandMark />
              {BRAND.name}
            </div>
            <span>{BRAND.tagline}</span>
            <div>
              <button onClick={() => s.set({ modal: "accessibility" })}>
                Display preferences
              </button>
              <button onClick={() => s.set({ modal: "shortcuts" })}>
                Keyboard shortcuts
              </button>
              <button onClick={() => s.set({ modal: "history" })}>
                History
              </button>
              <button onClick={() => s.set({ modal: "export" })}>
                Export evidence <ArrowDownToLine size={16} />
              </button>
            </div>
          </footer>
        </main>
        <AnimatePresence>
          {s.evidenceClaim && <EvidenceDrawer key={s.evidenceClaim} />}
        </AnimatePresence>
        <AppModals onSearch={search} />
        <AnimatePresence>
          {s.toast && (
            <motion.div
              className="toast"
              role="status"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <Check size={16} />
              <span>{s.toast}</span>
              <button
                onClick={() => s.set({ toast: null })}
                aria-label="Dismiss notification"
              >
                <X size={20} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
