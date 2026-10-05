"use client";
import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  ExternalLink,
  GitCompareArrows,
  Link2,
  Network,
  ShieldCheck,
  X,
} from "lucide-react";
import { useKnowledge } from "@/lib/store";
import {
  CATEGORIES,
  type Claim,
  type Evidence,
  type GraphEntity,
  type Relationship,
  type SourceEngine,
} from "@/lib/types";
import { formatDate, skillMatch } from "@/lib/graph-utils";
import { useDialog } from "./use-dialog";
import { CONFIDENCE_LABELS } from "@/lib/confidence";

export function Confidence({ claim }: { claim: Claim }) {
  const bars = { high: 10, medium: 6, low: 3, insufficient: 1 };
  return (
    <div className={`confidence-block ${claim.confidence}`}>
      <div className="confidence-top">
        <span>
          <ShieldCheck size={16} /> Evidence confidence
        </span>
        <strong>{CONFIDENCE_LABELS[claim.confidence]}</strong>
      </div>
      <div className="confidence-meter">
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            className={i < bars[claim.confidence] ? "filled" : ""}
          />
        ))}
      </div>
      <p>{claim.rationale}</p>
      <small>A qualitative assessment, not a probability of truth.</small>
    </div>
  );
}

export function EntityPanel({
  onSearch,
}: {
  onSearch: (query?: string, sources?: SourceEngine[]) => Promise<void>;
}) {
  const s = useKnowledge();
  const node = s.run.entities.find((item) => item.id === s.selected);
  const [tab, setTab] = useState("overview");
  const [detailState, setDetailState] = useState<
    "idle" | "running" | "success" | "error"
  >("idle");
  const [details, setDetails] = useState<Record<string, unknown> | null>(null);
  const [detailError, setDetailError] = useState("");
  const [detailKind, setDetailKind] = useState("auto");
  if (!node) return null;
  const evidence = s.run.evidence.filter((e) =>
    node.evidenceIds.includes(e.id),
  );
  const edges = s.run.relationships.filter(
    (edge) => edge.source === node.id || edge.target === node.id,
  );
  const neighbors = edges
    .map((edge) => ({
      edge,
      node: s.run.entities.find(
        (n) => n.id === (edge.source === node.id ? edge.target : edge.source),
      ),
    }))
    .filter((item) => item.node);
  const main = evidence[0];
  const metadata = { ...node.metadata, ...main?.metadata, ...details };
  const match = main ? skillMatch(main, s.skills) : null;
  const questions = [
    ...s.run.evidence.flatMap((e) =>
      Array.isArray(e.metadata?.relatedQuestions)
        ? (e.metadata.relatedQuestions as {
            question: string;
            nextPageToken?: string;
          }[])
        : [],
    ),
    ...(Array.isArray(details?.relatedQuestions)
      ? (details.relatedQuestions as {
          question: string;
          nextPageToken?: string;
        }[])
      : []),
  ];
  const loadDetails = async (
    kind: "auto" | "cites" | "trends" | "related" | "listing" = "auto",
  ) => {
    if (!main && kind !== "trends") return;
    setDetailState("running");
    setDetailKind(kind);
    try {
      const response = await fetch("/api/details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evidence: main ? { ...main, metadata } : undefined,
          kind,
          query: node.title,
          token: questions.find((q) => q.nextPageToken)?.nextPageToken,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Details could not be retrieved.");
      setDetails((current) => ({ ...current, ...result.metadata }));
      setDetailState("success");
      if (kind === "auto" && main) {
        const current = useKnowledge.getState().run;
        s.set({
          run: {
            ...current,
            entities: current.entities.map((entity) =>
              entity.id === node.id
                ? {
                    ...entity,
                    metadata: { ...entity.metadata, ...result.metadata },
                  }
                : entity,
            ),
            evidence: current.evidence.map((item) =>
              item.id === main.id && node.id === main.id
                ? {
                    ...item,
                    metadata: { ...item.metadata, ...result.metadata },
                  }
                : item,
            ),
          },
        });
      }
      if (
        kind === "cites" &&
        main &&
        Array.isArray(result.metadata.relatedEvidence)
      ) {
        const current = useKnowledge.getState().run;
        const retrieved = (
          result.metadata.relatedEvidence as Evidence[]
        ).filter((e) => !current.evidence.some((known) => known.id === e.id));
        const newNodes: GraphEntity[] = retrieved.map((e, i) => ({
          id: e.id,
          type: e.type,
          title: e.title,
          label: e.title.length > 30 ? e.title.slice(0, 28) + "…" : e.title,
          subtitle: e.source,
          position: [
            node.position[0] + Math.cos(i * 0.85) * 2,
            node.position[1] + Math.sin(i * 0.85) * 1.5,
            node.position[2] - 0.3,
          ],
          evidenceIds: [e.id],
          metadata: e.metadata,
        }));
        const newEdges: Relationship[] = retrieved.map((e) => ({
          id: `citation-${e.id}-${main.id}`,
          source: e.id,
          target: main.id,
          type: "cited",
          evidenceIds: [e.id, main.id],
          inferred: false,
          explanation:
            "Returned by a Google Scholar cited-by search for this paper.",
        }));
        s.set({
          run: {
            ...current,
            evidence: [...current.evidence, ...retrieved],
            entities: [...current.entities, ...newNodes],
            relationships: [...current.relationships, ...newEdges],
          },
          toast: `${retrieved.length} citing papers added to the graph.`,
        });
      }
    } catch (error) {
      setDetailError(
        error instanceof Error ? error.message : "Source interrupted.",
      );
      setDetailState("error");
    }
  };
  const detailRows = [
    ["Source", main?.source],
    ["Publication date", main?.date ? formatDate(main.date) : undefined],
    ["Retrieved", main?.retrievedAt ? formatDate(main.retrievedAt) : undefined],
    [
      "Authors / inventors",
      Array.isArray(metadata.inventors)
        ? metadata.inventors.join(", ")
        : main?.authors?.join(", "),
    ],
    ["Assignee", metadata.assignee],
    [
      "Priority date",
      metadata.priorityDate
        ? formatDate(String(metadata.priorityDate))
        : undefined,
    ],
    ["Patent number", metadata.publicationNumber],
    ["Employer", metadata.company],
    ["Location", metadata.location],
    ["Schedule", metadata.schedule],
    ["Posted at retrieval", metadata.postedAt],
    ["Deadline", metadata.deadline],
    ["Affiliation", metadata.affiliations],
    ["Citations", metadata.citations],
    ["Technology cluster", metadata.cluster],
  ].filter(([, value]) => value !== undefined && value !== null);
  return (
    <motion.aside
      className="entity-panel spatial-panel"
      initial={{ opacity: 0, x: 35 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 35 }}
      transition={{ duration: 0.25 }}
      aria-label={`Information about ${node.title}`}
    >
      <div className="panel-topline">
        <span style={{ color: CATEGORIES[node.type].color }}>
          <span
            className="category-dot"
            style={{ background: CATEGORIES[node.type].color }}
          />{" "}
          {CATEGORIES[node.type].label}
        </span>
        <button
          className="icon-button"
          aria-label="Close entity panel"
          onClick={() => s.select(null)}
        >
          <X size={17} />
        </button>
      </div>
      <h2>{node.title}</h2>
      <p className="panel-subtitle">{node.subtitle}</p>
      <div className="panel-data-label">
        {s.run.demo ? "Demo data" : "Live evidence"}
        {metadata.illustrative === true && (
          <span>Illustrative · Not a live vacancy</span>
        )}
      </div>
      <div className="panel-tabs">
        {["overview", "connections", "evidence"].map((name) => (
          <button
            className={tab === name ? "active" : ""}
            onClick={() => setTab(name)}
            key={name}
          >
            {name}
            {name === "connections" && <small>{edges.length}</small>}
          </button>
        ))}
      </div>
      <div className="panel-content">
        {tab === "overview" && (
          <>
            <p className="entity-description">
              {node.type === "topic"
                ? s.run.summary
                : (main?.snippet ??
                  "Explore the source-linked relationships for this entity.")}
            </p>
            <div className="entity-metrics">
              <div>
                <strong>{edges.length.toString().padStart(2, "0")}</strong>
                <span>Mapped connections</span>
              </div>
              <div>
                <strong>{evidence.length.toString().padStart(2, "0")}</strong>
                <span>Source references</span>
              </div>
            </div>
            {detailRows.length > 0 && (
              <dl className="detail-rows">
                {detailRows.map(([label, value]) => (
                  <div key={String(label)}>
                    <dt>{String(label)}</dt>
                    <dd>
                      {Array.isArray(value) ? value.join(", ") : String(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {match && (
              <div className="skill-match">
                <div>
                  <span>Your skill overlap</span>
                  <strong>{match.score}%</strong>
                </div>
                <div className="relevance-track">
                  <span style={{ width: `${match.score}%` }} />
                </div>
                <p>Matched: {match.matches.join(", ") || "None yet"}</p>
                {match.missing.length > 0 && (
                  <small>Explore next: {match.missing.join(", ")}</small>
                )}
              </div>
            )}
            {node.type === "job" && !s.skills.length && (
              <button
                className="profile-prompt"
                onClick={() => s.set({ modal: "profile" })}
              >
                <BookOpen size={17} />
                <span>
                  Add your skills
                  <small>See an explainable skill overlap.</small>
                </span>
                <ChevronRight size={14} />
              </button>
            )}
            {node.type === "topic" && (
              <div className="why-panel">
                <span className="eyebrow">WHY THIS MATTERS</span>
                <p>{s.run.whyItMatters}</p>
                <button
                  className="text-button"
                  onClick={() =>
                    s.set({
                      evidenceClaim:
                        s.run.claims.find((claim) => claim.id === "impact")
                          ?.id ?? `entity:${node.id}`,
                    })
                  }
                >
                  Follow the evidence <ArrowRight size={12} />
                </button>
              </div>
            )}
            {!s.run.demo &&
              main &&
              (metadata.authorId || metadata.patentId || metadata.resultId) && (
                <button
                  className="secondary-button full-width"
                  onClick={() => void loadDetails()}
                  disabled={detailState === "running"}
                >
                  {detailState === "running" && detailKind === "auto" ? (
                    <>
                      <span className="spinner" /> Retrieving source details
                    </>
                  ) : detailState === "success" && detailKind === "auto" ? (
                    <>
                      <Check size={13} /> Source details retrieved
                    </>
                  ) : (
                    <>
                      <Link2 size={13} /> Retrieve source details
                    </>
                  )}
                </button>
              )}
            {!s.run.demo && node.type === "paper" && metadata.citesId && (
              <button
                className="secondary-button full-width"
                onClick={() => void loadDetails("cites")}
                disabled={detailState === "running"}
              >
                {detailState === "running" && detailKind === "cites" ? (
                  <>
                    <span className="spinner" /> Retrieving citing papers
                  </>
                ) : (
                  <>
                    <Network size={13} /> Expand citation network
                  </>
                )}
              </button>
            )}
            {!s.run.demo && node.type === "job" && metadata.jobId && (
              <button
                className="secondary-button full-width"
                onClick={() => void loadDetails("listing")}
                disabled={detailState === "running"}
              >
                <ShieldCheck size={13} /> Retrieve employer ratings
              </button>
            )}
            {!s.run.demo && node.type === "topic" && (
              <div className="topic-context">
                <button
                  className="secondary-button full-width"
                  onClick={() => void loadDetails("trends")}
                  disabled={detailState === "running"}
                >
                  {detailState === "running" && detailKind === "trends" ? (
                    <>
                      <span className="spinner" /> Retrieving search interest
                    </>
                  ) : (
                    <>
                      <Network size={13} /> Explore search interest
                    </>
                  )}
                </button>
                {questions.length > 0 && (
                  <div className="topic-questions">
                    <span className="eyebrow">RELATED QUESTIONS</span>
                    {questions.slice(0, 8).map((question, i) => (
                      <button
                        key={`${question.question}-${i}`}
                        onClick={() => {
                          s.select(null);
                          void onSearch(question.question);
                        }}
                      >
                        {question.question}
                        <ArrowRight size={11} />
                      </button>
                    ))}
                    {questions.some((q) => q.nextPageToken) && (
                      <button
                        className="text-button"
                        onClick={() => void loadDetails("related")}
                        disabled={detailState === "running"}
                      >
                        Expand related questions <ArrowRight size={12} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            {detailState === "error" && (
              <p className="inline-error" role="alert">
                {detailError}
              </p>
            )}
            {details?.abstract && (
              <p className="detail-abstract">{String(details.abstract)}</p>
            )}
            {Array.isArray(details?.citationsFormatted) && (
              <div className="formatted-citations">
                {(
                  details.citationsFormatted as {
                    title: string;
                    snippet: string;
                  }[]
                ).map((citation) => (
                  <p key={citation.title}>
                    <strong>{citation.title}</strong>
                    {citation.snippet}
                  </p>
                ))}
              </div>
            )}
            {Array.isArray(details?.trends) && (
              <TrendsSparkline
                points={
                  details.trends as {
                    date: string;
                    values: { value: number }[];
                  }[]
                }
              />
            )}
            {Array.isArray(details?.nonPatentCitations) &&
              details.nonPatentCitations.length > 0 && (
                <div className="patent-citation-list">
                  <span className="eyebrow">RESEARCH → PATENT REFERENCES</span>
                  {(details.nonPatentCitations as { title?: string }[])
                    .slice(0, 8)
                    .map((citation, i) => (
                      <p key={i}>
                        <span>{(i + 1).toString().padStart(2, "0")}</span>
                        {citation.title ?? "Citation text not provided"}
                      </p>
                    ))}
                  <small>
                    References returned by the patent details source. Identity
                    matching to research papers requires corroboration.
                  </small>
                </div>
              )}
            {Array.isArray(details?.ratings) && (
              <div className="formatted-citations">
                {(
                  details.ratings as {
                    source?: string;
                    rating?: number;
                    reviews?: number;
                  }[]
                ).map((rating, i) => (
                  <p key={i}>
                    <strong>{rating.source ?? "Employer rating source"}</strong>
                    {rating.rating ?? "Rating not provided"}
                    {rating.reviews ? ` · ${rating.reviews} reviews` : ""}
                  </p>
                ))}
              </div>
            )}
          </>
        )}
        {tab === "connections" && (
          <>
            <p className="panel-helper">
              Every line has a reason. Select a connection to keep exploring.
            </p>
            <div className="connection-list">
              {neighbors.map(({ node: neighbor, edge }) => (
                <button key={edge.id} onClick={() => s.select(neighbor!.id)}>
                  <span
                    className="category-dot"
                    style={{ background: CATEGORIES[neighbor!.type].color }}
                  />
                  <span>
                    <strong>{neighbor!.label}</strong>
                    <small>
                      {edge.type.replaceAll("_", " ")}
                      {edge.inferred && " · inferred association"}
                    </small>
                  </span>
                  <ArrowRight size={14} />
                </button>
              ))}
            </div>
            {!neighbors.length && (
              <div className="empty-state">
                <Network size={24} />
                <h3>No connections mapped yet</h3>
                <p>Explore more sources to find related entities.</p>
              </div>
            )}
            <p className="panel-helper">
              Dashed lines represent inferred associations. Demo opportunity
              links are illustrative.
            </p>
          </>
        )}
        {tab === "evidence" && (
          <>
            <p className="panel-helper">
              Source records supporting this entity. Open the original to verify
              the context.
            </p>
            {evidence.map((item, index) => (
              <div className="panel-evidence" key={item.id}>
                <span className="evidence-index">
                  {(index + 1).toString().padStart(2, "0")}
                </span>
                <div>
                  <span className="eyebrow">{item.source}</span>
                  <h4>{item.title}</h4>
                  <p>{item.snippet}</p>
                  <small>{formatDate(item.date)}</small>
                  <a href={item.url} target="_blank" rel="noopener noreferrer">
                    Open original <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            ))}
            <button
              className="secondary-button full-width"
              onClick={() =>
                s.set({
                  highlighted: node.evidenceIds,
                  toast: "Supporting source nodes are highlighted.",
                })
              }
            >
              <Network size={14} /> Show on graph
            </button>
          </>
        )}
      </div>
      <div className="panel-actions">
        <button
          className="primary-button"
          onClick={() => {
            s.set({ focus: node.id, hops: 1, selected: null, graphFilter: "" });
          }}
        >
          Explore connections <ArrowRight size={14} />
        </button>
        <div className="hop-actions">
          <button
            onClick={() =>
              s.set({
                focus: node.id,
                hops: 1,
                selected: null,
                graphFilter: "",
              })
            }
          >
            1 hop
          </button>
          <button
            onClick={() =>
              s.set({
                focus: node.id,
                hops: 2,
                selected: null,
                graphFilter: "",
              })
            }
          >
            2 hops
          </button>
          <button
            onClick={() =>
              s.set({ focus: null, selected: null, graphFilter: "" })
            }
          >
            Expand all
          </button>
          <button
            title="Compare entities"
            aria-label="Compare this entity"
            onClick={() => s.set({ modal: "compare" })}
          >
            <GitCompareArrows size={14} />
          </button>
        </div>
        {!s.run.demo && (
          <button
            className="text-button"
            onClick={() => {
              s.select(null);
              void onSearch(`${node.title} research and connections`);
            }}
          >
            Find more evidence <SearchIcon />{" "}
          </button>
        )}
        {main && (
          <a
            className="source-external"
            href={
              typeof metadata.profileUrl === "string"
                ? metadata.profileUrl
                : main.url
            }
            target="_blank"
            rel="noopener noreferrer"
          >
            Open{" "}
            {node.type === "patent"
              ? "patent"
              : node.type === "job"
                ? "opportunity source"
                : "original source"}
            <ExternalLink size={13} />
          </a>
        )}
      </div>
    </motion.aside>
  );
}
function SearchIcon() {
  return <ArrowRight size={12} />;
}

function TrendsSparkline({
  points,
}: {
  points: { date: string; values: { value: number }[] }[];
}) {
  const values = points
    .map((p) => Number(p.values[0]?.value ?? 0))
    .filter((v) => Number.isFinite(v));
  if (!values.length)
    return (
      <p className="panel-helper">
        The Trends source returned no interest-over-time series for this topic.
      </p>
    );
  const path = values
    .map(
      (v, i) =>
        `${i === 0 ? "M" : "L"}${10 + (i / Math.max(values.length - 1, 1)) * 270},${90 - Math.max(0, Math.min(v, 100)) * 0.75}`,
    )
    .join(" ");
  return (
    <div className="trends-sparkline">
      <span className="eyebrow">GOOGLE SEARCH INTEREST</span>
      <svg
        viewBox="0 0 290 105"
        role="img"
        aria-label={`Relative search-interest index across ${values.length} time periods`}
      >
        <path d="M10 90H280" stroke="#344663" />
        <path d={path} fill="none" stroke="#94b6f2" strokeWidth="1.5" />
      </svg>
      <div>
        <span>{points[0].date}</span>
        <span>{points[points.length - 1].date}</span>
      </div>
      <small>
        Relative index (0–100). Search interest is not research output or
        evidence of a claim.
      </small>
    </div>
  );
}

export function EvidenceDrawer() {
  const s = useKnowledge();
  const set = s.set;
  const close = useCallback(() => set({ evidenceClaim: null }), [set]);
  const ref = useDialog(close);
  const claim = s.run.claims.find((c) => c.id === s.evidenceClaim);
  const entity = s.evidenceClaim?.startsWith("entity:")
    ? s.run.entities.find((e) => e.id === s.evidenceClaim?.slice(7))
    : undefined;
  const ids = claim?.evidenceIds ?? entity?.evidenceIds ?? [];
  const evidence = s.run.evidence.filter((e) => ids.includes(e.id));
  const conflicting = s.run.evidence.filter((e) =>
    claim?.conflictingEvidenceIds.includes(e.id),
  );
  return (
    <>
      <motion.div
        className="drawer-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={close}
      />
      <motion.div
        ref={ref}
        tabIndex={-1}
        className="evidence-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="evidence-drawer-title"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ duration: 0.2 }}
      >
        <div className="drawer-heading">
          <div>
            <span className="eyebrow">
              <ShieldCheck size={13} /> THE EVIDENCE TRAIL
            </span>
            <h2 id="evidence-drawer-title">Why do we believe this?</h2>
          </div>
          <button
            className="icon-button"
            onClick={close}
            aria-label="Close evidence drawer"
          >
            <X size={19} />
          </button>
        </div>
        <div className="drawer-data-label">
          {s.run.demo
            ? "DEMO DATA · CURATED HISTORICAL SOURCES"
            : "LIVE · RETRIEVED SOURCE RECORDS"}
        </div>
        <div className="claim-quote">
          <span className="eyebrow">{claim ? "CLAIM" : "ENTITY"}</span>
          <p>{claim?.text ?? entity?.title ?? "Source evidence"}</p>
        </div>
        <div className="drawer-section-title">
          <h3>Supporting sources</h3>
          <span>{evidence.length.toString().padStart(2, "0")}</span>
        </div>
        {claim?.supportingQuotes?.length && (
          <div className="exact-quotes">
            <span className="eyebrow">VERBATIM SOURCE EXCERPTS</span>
            {claim.supportingQuotes.map((quote, i) => (
              <blockquote key={i}>
                <p>“{quote.text}”</p>
                <cite>
                  {s.run.evidence.find((e) => e.id === quote.evidenceId)
                    ?.source ?? quote.evidenceId}
                </cite>
              </blockquote>
            ))}
          </div>
        )}
        {evidence.map((item, i) => (
          <div key={item.id} className="drawer-source">
            <span className="evidence-index">
              {(i + 1).toString().padStart(2, "0")}
            </span>
            <div>
              <div className="source-heading">
                <span style={{ color: CATEGORIES[item.type].color }}>
                  {CATEGORIES[item.type].label}
                </span>
                <span>{item.primary ? "PRIMARY SOURCE" : "SOURCE RECORD"}</span>
              </div>
              <h4>{item.title}</h4>
              <p>
                {item.snippet ?? "No excerpt provided by the search source."}
              </p>
              <div className="source-meta">
                {item.source}
                <span>·</span>
                {formatDate(item.date)}
              </div>
              {item.authors?.length && (
                <small className="source-authors">
                  {item.authors.join(", ")}
                </small>
              )}
              <a href={item.url} target="_blank" rel="noopener noreferrer">
                Read original source <ExternalLink size={12} />
              </a>
            </div>
          </div>
        ))}
        {!evidence.length && (
          <div className="empty-state">
            <ShieldCheck size={24} />
            <h3>No supporting evidence attached</h3>
            <p>
              This information has not been established by the retrieved
              sources.
            </p>
          </div>
        )}
        {conflicting.length > 0 && (
          <>
            <div className="drawer-section-title">
              <h3>Conflicting evidence</h3>
              <span>{conflicting.length}</span>
            </div>
            {conflicting.map((item) => (
              <div className="conflicting-source" key={item.id}>
                <h4>{item.title}</h4>
                <p>{item.snippet}</p>
                <a href={item.url} target="_blank" rel="noopener noreferrer">
                  Review source <ExternalLink size={12} />
                </a>
              </div>
            ))}
          </>
        )}
        {claim && <Confidence claim={claim} />}
        <button
          className="primary-button full-width"
          onClick={() => {
            s.set({
              highlighted: [...ids, ...conflicting.map((e) => e.id)],
              evidenceClaim: null,
              selected: null,
              focus: null,
            });
            window.scrollTo({
              top: 350,
              behavior: s.accessibility.reducedMotion ? "instant" : "smooth",
            });
          }}
        >
          <Network size={15} /> Show supporting nodes on graph{" "}
          <ArrowRight size={15} />
        </button>
        <p className="drawer-note">
          Source counts reflect this investigation. Related articles may share
          an underlying source; agreement alone does not establish independence.{" "}
          {s.run.demo
            ? "This is a curated demo, not a fresh search."
            : `Investigation retrieved ${formatDate(s.run.createdAt)}.`}
        </p>
      </motion.div>
    </>
  );
}
