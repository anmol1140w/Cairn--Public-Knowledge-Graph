"use client";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Accessibility,
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  FileJson,
  FileText,
  GitCompareArrows,
  GraduationCap,
  Hexagon,
  Keyboard,
  Layers,
  Network,
  Newspaper,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useKnowledge } from "@/lib/store";
import {
  CATEGORIES,
  type AccessibilitySettings,
  type EntityType,
  type SourceEngine,
} from "@/lib/types";
import { formatDate } from "@/lib/graph-utils";
import { useDialog } from "./use-dialog";
import { ModeProfileForm } from "./profile-form";
import { PROFILE_TITLES } from "@/lib/profile-fields";
import { profileSchema } from "@/lib/profiles";
import { useProfiles } from "@/lib/profile-store";

function ModalShell({
  title,
  eyebrow,
  children,
  className = "",
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
  className?: string;
}) {
  const set = useKnowledge((s) => s.set);
  const close = useCallback(() => set({ modal: null }), [set]);
  const ref = useDialog(close);
  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        className={`modal ${className}`}
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 15, scale: 0.98 }}
        transition={{ duration: 0.2 }}
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">{eyebrow}</span>
            <h2 id="modal-title">{title}</h2>
          </div>
          <button
            className="icon-button"
            onClick={close}
            aria-label="Close dialog"
          >
            <X size={19} />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

function AccessibilityModal() {
  const s = useKnowledge();
  const settings: {
    id: keyof AccessibilitySettings;
    title: string;
    description: string;
  }[] = [
    {
      id: "highContrast",
      title: "High contrast",
      description: "Stronger text and border contrast.",
    },
    {
      id: "largeText",
      title: "Large text",
      description: "More room for reading and interacting.",
    },
    {
      id: "reducedMotion",
      title: "Reduced motion",
      description: "Calm transitions and a stationary Explorer.",
    },
    {
      id: "screenReader",
      title: "Screen reader view",
      description: "A structured, keyboard-accessible list.",
    },
    {
      id: "simplifiedLanguage",
      title: "Simplified language",
      description: "Ask the live agent for clearer explanations.",
    },
    {
      id: "keyboardNavigation",
      title: "Keyboard navigation",
      description: "Visible focus indicators and quick commands.",
    },
  ];
  return (
    <ModalShell title="Display preferences" eyebrow="Settings">
      <p className="modal-description">
        Make this space work for you. Every source and connection is available
        beyond the 3D graph.
      </p>
      <button
        className="standard-mode"
        onClick={() =>
          s.set({
            accessibility: {
              highContrast: false,
              largeText: false,
              reducedMotion: false,
              screenReader: false,
              simplifiedLanguage: false,
              keyboardNavigation: true,
            },
            view: "3d",
          })
        }
      >
        <span>Standard experience</span>
        <span>
          Reset preferences <ArrowRight size={13} />
        </span>
      </button>
      <div className="accessibility-options">
        {settings.map((setting) => (
          <button
            key={setting.id}
            role="switch"
            aria-checked={s.accessibility[setting.id]}
            onClick={() =>
              s.set({
                accessibility: {
                  ...s.accessibility,
                  [setting.id]: !s.accessibility[setting.id],
                },
                ...(setting.id === "screenReader" &&
                !s.accessibility.screenReader
                  ? { view: "list" as const }
                  : {}),
              })
            }
          >
            <span>
              <strong>{setting.title}</strong>
              <small>{setting.description}</small>
            </span>
            <span
              className={`toggle-switch ${s.accessibility[setting.id] ? "on" : ""}`}
            >
              <span />
            </span>
          </button>
        ))}
      </div>
      <div className="modal-footnote">
        <Accessibility size={15} /> Preferences are saved on this device.
      </div>
      <button
        className="primary-button full-width"
        onClick={() => s.set({ preferencesSeen: true, modal: null })}
      >
        Done
      </button>
    </ModalShell>
  );
}

function ProfileModal() {
  const s = useKnowledge();
  return (
    <ModalShell
      title={PROFILE_TITLES[s.mode]}
      eyebrow="Optional details"
      className="profile-modal"
    >
      <ModeProfileForm />
    </ModalShell>
  );
}

function ExportModal() {
  const s = useKnowledge();
  const [format, setFormat] = useState("markdown");
  const [state, setState] = useState<"idle" | "running" | "error" | "success">(
    "idle",
  );
  const [error, setError] = useState("");
  const options = [
    { id: "markdown", label: "Markdown", extension: ".md", icon: FileText },
    {
      id: "pdf",
      label: "PDF evidence report",
      extension: ".pdf",
      icon: FileText,
    },
    {
      id: "json",
      label: "Complete evidence graph",
      extension: ".json",
      icon: FileJson,
    },
    {
      id: "csv",
      label: "Evidence + relationships",
      extension: ".zip / CSV",
      icon: Layers,
    },
    {
      id: "citations",
      label: "Citation list",
      extension: ".txt",
      icon: BookOpen,
    },
  ];
  const download = async () => {
    setState("running");
    setError("");
    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, investigation: s.run }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Export could not be prepared.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        response.headers
          .get("Content-Disposition")
          ?.match(/filename="([^"]+)"/)?.[1] ?? "evidence-export";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setState("success");
    } catch (error) {
      setState("error");
      setError(error instanceof Error ? error.message : "Export interrupted.");
    }
  };
  return (
    <ModalShell title="Export evidence" eyebrow="EXPORT INVESTIGATION">
      <p className="modal-description">
        Source URLs, dates, claim references, and graph relationships stay
        connected in your export.
      </p>
      <div className="export-context">
        <Network size={20} />
        <div>
          <strong>{s.run.query}</strong>
          <small>
            {s.run.evidence.length} source records ·{" "}
            {s.run.relationships.length} relationships ·{" "}
            {s.run.demo ? "Demo data" : "Live evidence"}
          </small>
        </div>
      </div>
      <div className="export-options">
        {options.map((option) => (
          <label
            key={option.id}
            className={format === option.id ? "selected" : ""}
          >
            <input
              type="radio"
              name="format"
              value={option.id}
              checked={format === option.id}
              onChange={() => {
                setFormat(option.id);
                setState("idle");
              }}
            />
            <option.icon size={17} />
            <span>{option.label}</span>
            <small>{option.extension}</small>
          </label>
        ))}
      </div>
      {state === "error" && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <button
        className="primary-button full-width"
        onClick={download}
        disabled={state === "running"}
      >
        {state === "running" ? (
          <>
            <span className="spinner" /> Preparing evidence report
          </>
        ) : state === "success" ? (
          <>
            <Check size={16} /> Download again
          </>
        ) : (
          <>
            <ArrowDownToLine size={16} /> Export evidence
          </>
        )}
      </button>
      {state === "success" && (
        <p className="export-success" role="status">
          Your source-linked export is ready.
        </p>
      )}
    </ModalShell>
  );
}

function CompareModal() {
  const s = useKnowledge();
  const initial =
    s.selected ??
    s.run.entities.find((e) => e.type === "institution")?.id ??
    s.run.entities[0]?.id ??
    "";
  const [a, setA] = useState(initial);
  const [b, setB] = useState(
    s.run.entities.find(
      (e) =>
        e.id !== initial &&
        e.type === s.run.entities.find((n) => n.id === initial)?.type,
    )?.id ??
      s.run.entities.find((e) => e.id !== initial)?.id ??
      "",
  );
  const nodes = [a, b].map((id) => s.run.entities.find((e) => e.id === id));
  const metrics: { label: string; type: EntityType }[] = [
    { label: "Research", type: "paper" },
    { label: "Patents", type: "patent" },
    { label: "Researchers", type: "person" },
    { label: "Recent news", type: "news" },
    { label: "Opportunities", type: "job" },
  ];
  const connected = (id: string) => {
    const ids = s.run.relationships
      .filter((e) => e.source === id || e.target === id)
      .map((e) => (e.source === id ? e.target : e.source));
    return s.run.entities.filter((e) => ids.includes(e.id));
  };
  return (
    <ModalShell
      title="Compare two entities"
      eyebrow="COMPARE ENTITIES"
      className="compare-modal"
    >
      <p className="modal-description">
        Compare what this investigation has retrieved. Counts describe the
        mapped sample, not total institutional output.
      </p>
      <div className="compare-selectors">
        <label>
          First entity
          <select
            aria-label="First entity"
            value={a}
            onChange={(e) => setA(e.target.value)}
          >
            {s.run.entities.map((node) => (
              <option key={node.id} value={node.id}>
                {node.label}
              </option>
            ))}
          </select>
        </label>
        <span>vs</span>
        <label>
          Second entity
          <select
            aria-label="Second entity"
            value={b}
            onChange={(e) => setB(e.target.value)}
          >
            {s.run.entities.map((node) => (
              <option key={node.id} value={node.id}>
                {node.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {a === b && (
        <p className="inline-error">
          Select two different entities to compare.
        </p>
      )}
      <div className="compare-table">
        <div className="compare-table-head">
          <span>Retrieved connections</span>
          {nodes.map((node, i) => (
            <strong key={i}>{node?.label ?? "No entity"}</strong>
          ))}
        </div>
        {metrics.map((metric) => (
          <div key={metric.label}>
            <span>{metric.label}</span>
            {[a, b].map((id, i) => (
              <strong key={i}>
                {connected(id).filter((e) => e.type === metric.type).length}
              </strong>
            ))}
          </div>
        ))}
        <div>
          <span>Source references</span>
          {nodes.map((node, i) => (
            <strong key={i}>{node?.evidenceIds.length ?? 0}</strong>
          ))}
        </div>
        <div>
          <span>Publication date</span>
          {nodes.map((node, i) => (
            <span key={i}>
              {formatDate(
                s.run.evidence.find((e) => node?.evidenceIds.includes(e.id))
                  ?.date,
              )}
            </span>
          ))}
        </div>
        <div>
          <span>Methodology</span>
          {nodes.map((node, i) => (
            <span key={i}>
              {String(
                node?.metadata?.methodology ??
                  "Not established by retrieved metadata",
              )}
            </span>
          ))}
        </div>
      </div>
      <div className="compare-summaries">
        {nodes.map((node, i) => (
          <div key={i}>
            <span className="eyebrow">
              {node ? CATEGORIES[node.type].label : "ENTITY"}
            </span>
            <h3>{node?.label}</h3>
            <p>
              {s.run.evidence.find((e) => node?.evidenceIds.includes(e.id))
                ?.snippet ??
                "Inspect the connected source records for context."}
            </p>
            <button
              className="text-button"
              disabled={!node}
              onClick={() =>
                s.set({ modal: null, evidenceClaim: `entity:${node?.id}` })
              }
            >
              Inspect evidence <ShieldCheck size={12} />
            </button>
          </div>
        ))}
      </div>
      <button
        className="primary-button full-width"
        disabled={a === b}
        onClick={() => {
          s.set({
            modal: null,
            selected: null,
            highlighted: nodes.flatMap((n) => n?.evidenceIds ?? []),
            focus: null,
            graphFilter: "",
          });
          window.scrollTo({ top: 330, behavior: "smooth" });
        }}
      >
        <Network size={14} /> Highlight both on graph <ArrowRight size={14} />
      </button>
    </ModalShell>
  );
}

function TimelineModal() {
  const s = useKnowledge();
  const dated = s.run.evidence
    .filter((e) => e.date && !Number.isNaN(new Date(e.date).getTime()))
    .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime());
  const min = dated.length
    ? new Date(dated[0].date!).getFullYear()
    : new Date().getFullYear() - 3;
  const max = Math.max(
    new Date().getFullYear(),
    ...dated.map((e) => new Date(e.date!).getFullYear()),
  );
  const years = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <ModalShell
      title="Evidence timeline"
      eyebrow="KNOWLEDGE TIMELINE"
      className="timeline-modal"
    >
      <p className="modal-description">
        Drag through time to update the graph. Dates reflect source publication;
        undated records are excluded when a year filter is active.
      </p>
      <div className="timeline-slider-label">
        <span>Show evidence through</span>
        <strong>{s.year ?? "All time"}</strong>
      </div>
      <input
        className="timeline-range"
        aria-label="Evidence through year"
        type="range"
        min={min}
        max={max}
        value={s.year ?? max}
        onChange={(event) => s.set({ year: Number(event.target.value) })}
      />
      <div className="timeline-years">
        {years.map((year) => (
          <button
            key={year}
            onClick={() => s.set({ year })}
            className={s.year === year ? "active" : ""}
          >
            {year}
            <span>
              {dated
                .filter((e) => new Date(e.date!).getFullYear() === year)
                .map((e) => (
                  <span
                    key={e.id}
                    style={{ background: CATEGORIES[e.type].color }}
                  />
                ))}
            </span>
          </button>
        ))}
      </div>
      <div className="timeline-events">
        {dated
          .filter((e) => !s.year || new Date(e.date!).getFullYear() <= s.year)
          .map((item) => (
            <button
              key={item.id}
              onClick={() => s.set({ modal: null, selected: item.id })}
            >
              <span
                className="category-dot"
                style={{ background: CATEGORIES[item.type].color }}
              />
              <span>
                {item.title}
                <small>
                  {formatDate(item.date)} · {CATEGORIES[item.type].label}
                </small>
              </span>
              <ChevronRight size={13} />
            </button>
          ))}
      </div>
      {!dated.length && (
        <div className="empty-state">
          <SlidersHorizontal size={25} />
          <h3>No dated evidence yet</h3>
          <p>
            Sources without publication dates remain available in the all-time
            view.
          </p>
        </div>
      )}
      <button
        className="secondary-button full-width"
        onClick={() => s.set({ year: null })}
      >
        Show all time <Layers size={13} />
      </button>
    </ModalShell>
  );
}

function CommandsModal({
  onSearch,
}: {
  onSearch: (query?: string, sources?: SourceEngine[]) => Promise<void>;
}) {
  const s = useKnowledge();
  const [filter, setFilter] = useState("");
  const [active, setActive] = useState(0);
  const focusSearch = () => {
    s.set({ modal: null });
    document.getElementById("knowledge-search")?.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const commands = [
    {
      title: "Search knowledge",
      detail: "Ask anything worth knowing",
      icon: Search,
      key: "/",
      action: focusSearch,
    },
    {
      title: "Explore researcher",
      detail: "Find people behind the research",
      icon: GraduationCap,
      key: "",
      action: () => {
        s.setMode("scholar");
        s.set({ view: "list", modal: null });
      },
    },
    {
      title: "Explore institution",
      detail: "Follow a university’s connections",
      icon: Network,
      key: "",
      action: () => {
        const entity = s.run.entities.find((e) => e.type === "institution");
        s.set({
          selected: entity?.id ?? null,
          modal: null,
          toast: entity ? null : "Search for an institution to begin.",
        });
      },
    },
    {
      title: "Find jobs",
      detail: "Open Jobs and internships",
      icon: ArrowRight,
      key: "J",
      action: () => {
        s.setMode("jobs");
        s.set({ modal: null });
      },
    },
    {
      title: "Find papers",
      detail: "Open Scholar research papers",
      icon: GraduationCap,
      key: "S",
      action: () => {
        s.setMode("scholar");
        s.set({ modal: null });
      },
    },
    {
      title: "Compare sources",
      detail: "Inspect two entities side by side",
      icon: GitCompareArrows,
      key: "",
      action: () => s.set({ modal: "compare" }),
    },
    {
      title: "Explore news",
      detail: "Look beyond the headline",
      icon: Newspaper,
      key: "N",
      action: () => {
        s.setMode("news");
        s.set({ modal: null });
      },
    },
    {
      title: "Explore patents",
      detail: "Trace ideas into innovation",
      icon: Hexagon,
      key: "P",
      action: () => {
        s.setMode("patents");
        s.set({ modal: null });
      },
    },
    {
      title: "Open timeline",
      detail: "Explore knowledge through time",
      icon: SlidersHorizontal,
      key: "T",
      action: () => s.set({ modal: "timeline" }),
    },
    {
      title: "Toggle 3D",
      detail: "Switch to an equivalent 2D graph",
      icon: Layers,
      key: "",
      action: () => s.set({ view: s.view === "3d" ? "2d" : "3d", modal: null }),
    },
    {
      title: "Toggle accessibility",
      detail: "Make this space work for you",
      icon: Accessibility,
      key: "",
      action: () => s.set({ modal: "accessibility" }),
    },
    {
      title: "Export evidence",
      detail: "Keep sources and relationships connected",
      icon: ArrowDownToLine,
      key: "",
      action: () => s.set({ modal: "export" }),
    },
    {
      title: "Recent investigations",
      detail: "Reopen saved evidence without another search",
      icon: BookOpen,
      key: "",
      action: () => s.set({ modal: "history" }),
    },
  ].filter((command) =>
    `${command.title} ${command.detail}`
      .toLowerCase()
      .includes(filter.toLowerCase()),
  );
  const chosen = Math.min(active, commands.length - 1);
  return (
    <ModalShell
      title="Commands"
      eyebrow="COMMAND CENTER"
      className="command-modal"
    >
      <label className="command-filter">
        <Search size={19} />
        <input
          value={filter}
          placeholder="Search commands or enter a question…"
          onChange={(event) => {
            setFilter(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((i) => Math.min(i + 1, commands.length - 1));
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((i) => Math.max(0, i - 1));
            }
            if (event.key === "Enter") {
              event.preventDefault();
              if (commands[chosen]) commands[chosen].action();
              else {
                s.set({ modal: null });
                void onSearch(filter);
              }
            }
          }}
          aria-label="Search commands"
        />
      </label>
      <div className="commands-list">
        {commands.map((command, i) => (
          <button
            key={command.title}
            className={i === chosen ? "active" : ""}
            onMouseEnter={() => setActive(i)}
            onClick={command.action}
          >
            <command.icon size={17} />
            <span>
              <strong>{command.title}</strong>
              <small>{command.detail}</small>
            </span>
            {command.key ? (
              <kbd>{command.key}</kbd>
            ) : (
              <ChevronRight size={13} />
            )}
          </button>
        ))}
        {!commands.length && (
          <button
            className="command-search-query"
            onClick={() => {
              s.set({ modal: null });
              void onSearch(filter);
            }}
          >
            <Search size={17} />
            <span>Explore “{filter}”</span>
            <ArrowRight size={15} />
          </button>
        )}
      </div>
      <div className="command-footer">
        <span>
          <kbd>↑</kbd>
          <kbd>↓</kbd> navigate
        </span>
        <span>
          <kbd>↵</kbd> select
        </span>
        <span>
          <kbd>esc</kbd> close
        </span>
      </div>
    </ModalShell>
  );
}

function ShortcutsModal() {
  const shortcuts = [
    ["/", "Search knowledge"],
    ["⌘ / Ctrl K", "Command center"],
    ["G", "Explore"],
    ["N", "News"],
    ["S", "Scholar"],
    ["J", "Jobs"],
    ["P", "Patents"],
    ["T", "Evidence timeline"],
    ["+ / −", "Zoom active viewer"],
    ["0", "Fit active viewer"],
    ["F", "Fullscreen active viewer"],
    ["Arrow keys", "Pan active viewer"],
    ["?", "Keyboard shortcuts"],
    ["Esc", "Release viewer focus / close dialogs"],
  ];
  return (
    <ModalShell title="Explore without a mouse." eyebrow="KEYBOARD SHORTCUTS">
      <div className="shortcut-list">
        {shortcuts.map(([key, name]) => (
          <div key={key}>
            <span>{name}</span>
            <kbd>{key}</kbd>
          </div>
        ))}
      </div>
      <div className="modal-footnote">
        <Keyboard size={15} /> Tab and Shift + Tab navigate every interactive
        control.
      </div>
    </ModalShell>
  );
}

function HistoryModal() {
  const set = useKnowledge((s) => s.set);
  const [items, setItems] = useState<
    { id: string; query: string; date: string; evidenceCount: number }[] | null
  >(null);
  const [error, setError] = useState("");
  const [opening, setOpening] = useState<string | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/investigations", { signal: abort.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setItems(data.investigations);
      })
      .catch((error) => {
        if (!abort.signal.aborted)
          setError(error.message ?? "Saved investigations are unavailable.");
      });
    return () => abort.abort();
  }, []);
  const open = async (id: string) => {
    setOpening(id);
    setError("");
    try {
      const response = await fetch(`/api/investigations/${id}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const savedProfile = profileSchema.safeParse(data.investigation.profile);
      if (savedProfile.success)
        useProfiles.getState().apply(savedProfile.data, false);
      set({
        run: data.investigation,
        query: data.investigation.query,
        demo: false,
        mode: savedProfile.success ? savedProfile.data.mode : "universe",
        modal: null,
        selected: null,
        focus: null,
        year: null,
        graphFilter: "",
        highlighted: [],
        hasSearched: true,
        toast: "Saved evidence reopened. No search requests were made.",
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Investigation could not be reopened.",
      );
    } finally {
      setOpening(null);
    }
  };
  return (
    <ModalShell title="Saved investigations" eyebrow="RECENT INVESTIGATIONS">
      <p className="modal-description">
        Saved to your signed-in account. Reopening an investigation reuses its
        source snapshot without making new provider requests.
      </p>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {!items && !error && (
        <div className="empty-state" role="status">
          <span className="spinner" />
          <p>Retrieving your evidence history</p>
        </div>
      )}
      {items?.length === 0 && (
        <div className="empty-state">
          <BookOpen size={25} />
          <h3>No saved investigations yet</h3>
          <p>Completed live investigations will appear here.</p>
        </div>
      )}
      <div className="history-list">
        {items?.map((item) => (
          <button
            key={item.id}
            onClick={() => void open(item.id)}
            disabled={Boolean(opening)}
          >
            <Network size={16} />
            <span>
              <strong>{item.query}</strong>
              <small>
                {formatDate(item.date)} · {item.evidenceCount} source records
              </small>
            </span>
            {opening === item.id ? (
              <span className="spinner" />
            ) : (
              <ArrowRight size={14} />
            )}
          </button>
        ))}
      </div>
      <div className="modal-footnote">
        <ShieldCheck size={14} /> Saved snapshots retain original retrieval
        timestamps.
      </div>
    </ModalShell>
  );
}

export function AppModals({
  onSearch,
}: {
  onSearch: (query?: string, sources?: SourceEngine[]) => Promise<void>;
}) {
  const modal = useKnowledge((s) => s.modal);
  return (
    <AnimatePresence mode="wait">
      {modal === "accessibility" ? (
        <AccessibilityModal key={modal} />
      ) : modal === "profile" ? (
        <ProfileModal key={modal} />
      ) : modal === "export" ? (
        <ExportModal key={modal} />
      ) : modal === "compare" ? (
        <CompareModal key={modal} />
      ) : modal === "timeline" ? (
        <TimelineModal key={modal} />
      ) : modal === "commands" ? (
        <CommandsModal key={modal} onSearch={onSearch} />
      ) : modal === "shortcuts" ? (
        <ShortcutsModal key={modal} />
      ) : modal === "history" ? (
        <HistoryModal key={modal} />
      ) : null}
    </AnimatePresence>
  );
}
