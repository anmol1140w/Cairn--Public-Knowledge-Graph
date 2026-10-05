"use client";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  ExternalLink,
  FlaskConical,
  GitCompareArrows,
  Hexagon,
  Link2,
  Network,
  Search,
  ShieldCheck,
  BookOpen,
  TrendingUp,
} from "lucide-react";
import { useKnowledge } from "@/lib/store";
import {
  CATEGORIES,
  MODES,
  SOURCE_LABELS,
  type Evidence,
  type SourceEngine,
} from "@/lib/types";
import { formatDate, relevantEvidence, skillMatch } from "@/lib/graph-utils";
import { appendEvidence } from "@/lib/append-evidence";
import { CONFIDENCE_LABELS, evidenceStrength } from "@/lib/confidence";
import { useProfiles } from "@/lib/profile-store";
import { rankEvidence } from "@/lib/personalization";
import { ModeInsights, RequirementChecklist } from "./profile-results";

export function EvidenceCard({
  evidence,
  index,
}: {
  evidence: Evidence;
  index: number;
}) {
  const s = useKnowledge();
  const match = skillMatch(evidence, s.skills);
  const confidence = evidenceStrength(s.run, evidence.id);
  const profile = useProfiles((p) => p.profiles.jobs);
  return (
    <motion.article
      className="result-row"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="result-number">
        {(index + 1).toString().padStart(2, "0")}
      </div>
      <div className="result-body">
        <div
          className="result-type"
          style={{ color: CATEGORIES[evidence.type].color }}
        >
          <span
            className="category-dot"
            style={{ background: CATEGORIES[evidence.type].color }}
          />
          {CATEGORIES[evidence.type].label}
          {evidence.metadata?.illustrative === true && (
            <span className="illustrative-label">Illustrative role</span>
          )}
        </div>
        <h3>
          <a href={evidence.url} target="_blank" rel="noopener noreferrer">
            {evidence.title}
          </a>
        </h3>
        <p>
          {evidence.snippet ?? "Open the original source for more context."}
        </p>
        <p className="result-reason">
          {evidence.primary ? "Primary source record" : "Source record"}{" "}
          retrieved for this investigation.
        </p>
        <div className="result-meta">
          <span>{evidence.source}</span>
          <span>·</span>
          <span>{formatDate(evidence.date)}</span>
          {typeof evidence.metadata?.location === "string" && (
            <>
              <span>·</span>
              <span>{evidence.metadata.location}</span>
            </>
          )}
        </div>
        <div className="result-actions">
          <a href={evidence.url} target="_blank" rel="noopener noreferrer">
            Open source <ExternalLink size={12} />
          </a>
          <button
            onClick={() => {
              s.set({
                selected: evidence.id,
                focus: null,
                graphFilter: "",
                year: null,
              });
              window.scrollTo({
                top: 280,
                behavior: s.accessibility.reducedMotion ? "instant" : "smooth",
              });
            }}
          >
            Explore on graph <Network size={12} />
          </button>
          <button
            onClick={() => s.set({ evidenceClaim: `entity:${evidence.id}` })}
          >
            View evidence <ShieldCheck size={12} />
          </button>
        </div>
        {evidence.type === "job" && profile?.mode === "jobs" && (
          <RequirementChecklist evidence={evidence} profile={profile} />
        )}
      </div>
      <div className="result-relevance">
        <span>Evidence confidence</span>
        <strong>{confidence.label}</strong>
        <div className="relevance-track">
          <span
            style={{
              width: `${confidence.width}%`,
              background: CATEGORIES[evidence.type].color,
            }}
          />
        </div>
        <small>
          {match
            ? `${match.matches.length} of ${match.matches.length + match.missing.length} listed skills`
            : "Claim support, not a truth score"}
        </small>
        <details className="confidence-why">
          <summary>Why?</summary>
          <p>{confidence.reason}</p>
        </details>
      </div>
    </motion.article>
  );
}

function ResearchTimeline({ items }: { items: Evidence[] }) {
  const s = useKnowledge();
  const data = useMemo(() => {
    const counts = new Map<number, number>();
    items.forEach((item) => {
      if (!item.date) return;
      const year = new Date(item.date).getFullYear();
      if (!Number.isNaN(year)) counts.set(year, (counts.get(year) ?? 0) + 1);
    });
    return Array.from(counts)
      .sort(([a], [b]) => a - b)
      .map(([year, papers]) => ({ year, papers }));
  }, [items]);
  if (!data.length) return null;
  const clusters = new Map<string, number>();
  items.forEach((e) => {
    const cluster = String(e.metadata?.cluster ?? "Related research");
    clusters.set(cluster, (clusters.get(cluster) ?? 0) + 1);
  });
  return (
    <div className="scholar-insights">
      <div className="research-timeline">
        <div className="section-mini-heading">
          <span>
            <TrendingUp size={13} /> Research timeline
          </span>
          <small>
            Retrieved papers · {s.run.demo ? "demo" : "this investigation"}
          </small>
        </div>
        <div className="timeline-chart">
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart
              data={data}
              margin={{ top: 15, right: 15, left: -25, bottom: 0 }}
            >
              <defs>
                <linearGradient id="paperGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--accent)"
                    stopOpacity={0.2}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--accent)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="year"
                tick={{ fill: "var(--muted)", fontSize: 14 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: "var(--muted)", fontSize: 14 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                  fontSize: 14,
                }}
              />
              <Area
                type="monotone"
                dataKey="papers"
                stroke="var(--accent)"
                strokeWidth={2}
                fill="url(#paperGradient)"
                isAnimationActive={!s.accessibility.reducedMotion}
                dot={{
                  r: 4,
                  fill: "var(--accent)",
                  stroke: "var(--surface)",
                  strokeWidth: 3,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="research-clusters">
        <div className="section-mini-heading">
          <span>
            <Network size={13} /> Research clusters
          </span>
        </div>
        {Array.from(clusters).map(([name, count]) => (
          <button
            key={name}
            onClick={() => {
              s.set({
                view: "list",
                graphFilter: "",
                highlighted: items
                  .filter(
                    (e) => (e.metadata?.cluster ?? "Related research") === name,
                  )
                  .map((e) => e.id),
              });
              window.scrollTo({
                top: 330,
                behavior: s.accessibility.reducedMotion ? "instant" : "smooth",
              });
            }}
          >
            <span className="cluster-dot" />
            <span>{name}</span>
            <small>
              {count} {count === 1 ? "paper" : "papers"}
            </small>
            <ChevronRight size={12} />
          </button>
        ))}
      </div>
    </div>
  );
}

function NewsInsights({ items }: { items: Evidence[] }) {
  const s = useKnowledge();
  const events = new Map<string, Evidence[]>();
  items.forEach((item) => {
    const key = String(item.metadata?.event ?? item.title);
    events.set(key, [...(events.get(key) ?? []), item]);
  });
  const repeated = Array.from(events.values()).filter(
    (items) => items.length > 1,
  );
  const displayedClaim = s.run.claims.find((claim) =>
    [...claim.evidenceIds, ...claim.conflictingEvidenceIds].some((id) =>
      items.some((item) => item.id === id),
    ),
  );
  return (
    <div className="news-insights">
      <div className="news-claim-map">
        <span className="eyebrow">Claim and source perspectives</span>
        <h3>
          {displayedClaim?.text ??
            "What do the retrieved sources actually establish?"}
        </h3>
        <div className="claim-map-lines">
          <span />
        </div>
        <div className="stance-sources">
          {items.slice(0, 3).map((item) => {
            const stance = displayedClaim?.conflictingEvidenceIds.includes(
              item.id,
            )
              ? "conflicts"
              : displayedClaim?.evidenceIds.includes(item.id)
                ? "supports"
                : "context";
            return (
              <button
                key={item.id}
                onClick={() => s.set({ evidenceClaim: `entity:${item.id}` })}
              >
                <span className="news-source-dot" />
                <strong>{item.source}</strong>
                <span className={`stance ${stance}`}>
                  {stance === "conflicts"
                    ? "Conflicting evidence"
                    : stance === "supports"
                      ? "Supporting evidence"
                      : "Context · Not assessed"}
                </span>
                <small>
                  {item.primary ? "Primary source" : "Source record"}
                </small>
              </button>
            );
          })}
        </div>
      </div>
      <div className="novelty-panel">
        <span className="eyebrow">
          <BookOpen size={16} /> Events in these sources
        </span>
        <h3>
          {events.size} underlying {events.size === 1 ? "event" : "events"}{" "}
          identified
        </h3>
        <p>
          {repeated.length
            ? `${repeated.reduce((sum, group) => sum + group.length, 0)} articles appear to share ${repeated.length} underlying events. Repeated coverage is grouped rather than treated as independent confirmation.`
            : "These retrieved items describe different events. No repeated-event groups were established in this sample."}
        </p>
        <div className="novelty-events">
          {Array.from(events)
            .slice(0, 3)
            .map(([event, group]) => (
              <div key={event}>
                <span
                  className="category-dot"
                  style={{ background: "#e7bb72" }}
                />
                <span>{event}</span>
                <small>
                  {group.length} {group.length === 1 ? "source" : "sources"}
                </small>
              </div>
            ))}
        </div>
        <small className="muted">
          Event grouping is an interpretation of available titles and excerpts.
        </small>
      </div>
    </div>
  );
}

export function ResultsSection({
  onSearch,
}: {
  onSearch: (query?: string, sources?: SourceEngine[]) => Promise<void>;
}) {
  const s = useKnowledge();
  const [category, setCategory] = useState("all");
  const profile = useProfiles((p) => p.profiles[s.mode]);
  const [filter, setFilter] = useState("");
  const [jobType, setJobType] = useState("all");
  const [remote, setRemote] = useState(false);
  const [location, setLocation] = useState("");
  const [experience, setExperience] = useState("");
  const [skill, setSkill] = useState("");
  const [deadline, setDeadline] = useState("");
  const [paging, setPaging] = useState<string | null>(null);
  const [pageError, setPageError] = useState("");
  const [exhausted, setExhausted] = useState<string[]>([]);
  const current = MODES.find((m) => m.id === s.mode)!;
  const overviewHeading = "What the sources say";
  const relevant = rankEvidence(relevantEvidence(s.run, s.mode), profile);
  const items = relevant.filter((item) => {
    if (s.mode === "universe" && category !== "all" && item.type !== category)
      return false;
    if (
      filter &&
      !`${item.title} ${item.snippet} ${item.source}`
        .toLowerCase()
        .includes(filter.toLowerCase())
    )
      return false;
    if (s.mode === "jobs") {
      if (
        jobType !== "all" &&
        !String(item.metadata?.schedule ?? "")
          .toLowerCase()
          .includes(jobType)
      )
        return false;
      if (remote && item.metadata?.remote !== true) return false;
      if (
        location &&
        !String(item.metadata?.location ?? "")
          .toLowerCase()
          .includes(location.toLowerCase())
      )
        return false;
      if (
        experience &&
        !`${item.metadata?.experience ?? ""} ${item.snippet ?? ""}`
          .toLowerCase()
          .includes(experience.toLowerCase())
      )
        return false;
      if (
        skill &&
        !`${(item.metadata?.skills as string[] | undefined)?.join(" ")} ${item.snippet ?? ""}`
          .toLowerCase()
          .includes(skill.toLowerCase())
      )
        return false;
      if (
        deadline &&
        (!item.metadata?.deadline || String(item.metadata.deadline) > deadline)
      )
        return false;
    }
    return true;
  });
  const resetFilters = () => {
    setCategory("all");
    setFilter("");
    setJobType("all");
    setRemote(false);
    setLocation("");
    setExperience("");
    setSkill("");
    setDeadline("");
  };
  const pages = [
    ...new Map(
      relevant
        .filter(
          (e) => e.engine && e.engine !== "news" && e.metadata?.pagination,
        )
        .map((e) => [e.engine!, e]),
    ).entries(),
  ].filter(
    ([source, item]) =>
      !exhausted.includes(
        `${s.run.id}:${source}:${String((item.metadata?.pagination as { cursor: unknown }).cursor)}`,
      ),
  );
  const more = async (source: SourceEngine, item: Evidence) => {
    setPaging(source);
    setPageError("");
    try {
      const cursor = (item.metadata?.pagination as { cursor: string | number })
        .cursor;
      const response = await fetch("/api/more", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          ephemeral: s.run.sessionOnly,
          query: String(item.metadata?.searchQuery ?? s.run.query).slice(
            0,
            600,
          ),
          cursor,
          citesId: item.metadata?.citationSearchId,
          options: item.metadata?.searchOptions,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error ?? "This source page could not be retrieved.",
        );
      const current = useKnowledge.getState().run;
      const added = (result.evidence as Evidence[]).filter(
        (e) => !current.evidence.some((known) => known.id === e.id),
      );
      s.set({
        run: appendEvidence(current, result.evidence),
        toast: added.length
          ? `${added.length} additional source records mapped. Existing claims keep their original evidence.`
          : "No additional source records on this page.",
      });
      setExhausted((current) => [
        ...current,
        `${s.run.id}:${source}:${String(cursor)}`,
      ]);
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "The source page was interrupted.",
      );
    } finally {
      setPaging(null);
    }
  };
  return (
    <>
      <div className="results-heading">
        <div>
          <span className="eyebrow">
            <span className="blue-dash" />
            {s.mode === "universe" ? "FOLLOW THE EVIDENCE" : current.name}
          </span>
          <h2>
            {s.mode === "universe"
              ? "Evidence and sources"
              : current.description}
          </h2>
          <p>{s.run.demo ? `Curated example: ${s.run.query}` : s.run.query}</p>
        </div>
        <div className="results-heading-actions">
          <span className={`data-badge ${s.run.demo ? "" : "live"}`}>
            <span className="status-dot" />
            {s.run.demo ? "Demo data" : "Live evidence"}
          </span>
          <button
            className="icon-button"
            onClick={() => s.set({ modal: "compare" })}
            aria-label="Compare entities"
          >
            <GitCompareArrows size={17} />
          </button>
          <button
            className="secondary-button"
            onClick={() => s.set({ modal: "export" })}
          >
            Export <ArrowRight size={13} />
          </button>
        </div>
      </div>
      {s.run.warnings.length > 0 && (
        <div className="partial-notice" role="status">
          <ShieldCheck size={17} />
          <div>
            <strong>Continue with available evidence</strong>
            {s.run.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        </div>
      )}
      {s.mode === "universe" && (
        <div className="answer-overview">
          <div className="answer-story">
            <span className="eyebrow">
              <Network size={13} /> THE BIG PICTURE
            </span>
            <h3>{overviewHeading}</h3>
            <p>
              {s.run.summary ||
                "Your sources are ready to explore. Select an entity to follow its evidence."}
            </p>
            <div className="source-health">
              {s.run.sources
                .filter((source) => source.state !== "skipped")
                .map((source) => (
                  <span
                    key={source.source}
                    className={source.state === "error" ? "source-failed" : ""}
                  >
                    {source.state === "success" ? (
                      <Check size={12} />
                    ) : (
                      <XMark />
                    )}
                    {SOURCE_LABELS[source.source]}
                  </span>
                ))}
            </div>
          </div>
          <div className="claim-list">
            {s.run.claims.slice(0, 3).map((claim, i) => (
              <button
                className="claim-row"
                key={claim.id}
                onClick={() => s.set({ evidenceClaim: claim.id })}
              >
                <span className="evidence-index">
                  {(i + 1).toString().padStart(2, "0")}
                </span>
                <span>
                  <strong>{claim.text}</strong>
                  <small>
                    <span className={`confidence-dot ${claim.confidence}`} />
                    {CONFIDENCE_LABELS[claim.confidence]} confidence{" "}
                    <span>·</span>
                    {claim.evidenceIds.length} supporting records
                  </small>
                </span>
                <ArrowRight size={16} />
              </button>
            ))}
            {!s.run.claims.length && (
              <div className="empty-state">
                <ShieldCheck size={24} />
                <h3>No claims established yet</h3>
                <p>
                  Explore the source records below. Synthesis requires
                  sufficient evidence.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      {s.mode === "scholar" && <ResearchTimeline items={relevant} />}
      {s.mode !== "universe" && s.mode !== "jobs" && (
        <ModeInsights items={items} profile={profile} />
      )}
      {s.mode === "news" && relevant.length > 0 && (
        <NewsInsights items={relevant} />
      )}
      {s.mode === "jobs" && (
        <div className="opportunity-controls">
          <div className="opportunity-profile">
            <BriefcaseBusiness size={21} />
            <div>
              <h3>Match your skills to listed requirements</h3>
              <p>
                {s.skills.length
                  ? `Your skills: ${s.skills.join(" · ")}`
                  : "Add your skills to discover where you fit."}
              </p>
            </div>
            <button
              className="secondary-button"
              onClick={() => s.set({ modal: "profile" })}
            >
              {s.skills.length ? "Edit profile" : "Add your skills"}{" "}
              <ArrowRight size={13} />
            </button>
          </div>
          <div className="job-filters">
            <label>
              Opportunity
              <select
                value={jobType}
                onChange={(e) => setJobType(e.target.value)}
              >
                <option value="all">All types</option>
                <option value="internship">Internships</option>
                <option value="research">Research internships</option>
                <option value="full-time">Full-time</option>
              </select>
            </label>
            <label>
              Country / city
              <input
                placeholder="Anywhere"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </label>
            <label>
              Skill
              <input
                placeholder="e.g. Python"
                value={skill}
                onChange={(e) => setSkill(e.target.value)}
              />
            </label>
            <label>
              Experience
              <input
                placeholder="e.g. Entry level"
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
              />
            </label>
            <label>
              Deadline before
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </label>
            <label className="remote-filter">
              <input
                type="checkbox"
                checked={remote}
                onChange={(e) => setRemote(e.target.checked)}
              />
              Remote only
            </label>
          </div>
          <p className="filter-note">
            Filters use available source metadata. Missing deadlines and
            eligibility remain unknown.
          </p>
        </div>
      )}
      {s.mode === "patents" && (
        <div className="patent-bridge">
          <div>
            <span className="eyebrow">
              <Hexagon size={13} /> RESEARCH → INNOVATION
            </span>
            <h3>Research and patent references</h3>
            <p>
              Patent citations establish a link to prior work. Topic similarity
              is shown as an inferred association.
            </p>
          </div>
          <div className="bridge-steps">
            {["Research", "Idea", "Patent", "Company"].map((step, i) => (
              <span key={step}>
                <span className={i === 2 ? "bridge-hex" : "bridge-node"}>
                  {i === 0 ? (
                    <FlaskConical size={18} />
                  ) : i === 2 ? (
                    <Hexagon size={21} />
                  ) : i === 3 ? (
                    <BriefcaseBusiness size={18} />
                  ) : (
                    <BookOpen size={17} />
                  )}
                </span>
                <small>{step}</small>
                {i < 3 && <ArrowRight size={13} className="bridge-arrow" />}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="evidence-toolbar">
        <div className="evidence-tabs">
          {s.mode === "universe" ? (
            [
              { id: "all", label: "All evidence" },
              { id: "paper", label: "Research" },
              { id: "person", label: "People" },
              { id: "institution", label: "Institutions" },
              { id: "news", label: "News" },
              { id: "patent", label: "Patents" },
              { id: "job", label: "Opportunities" },
            ].map((tab) => (
              <button
                key={tab.id}
                className={category === tab.id ? "active" : ""}
                onClick={() => setCategory(tab.id)}
              >
                {tab.label}
                <span>
                  {
                    relevant.filter(
                      (e) => tab.id === "all" || e.type === tab.id,
                    ).length
                  }
                </span>
              </button>
            ))
          ) : (
            <span className="evidence-list-label">
              {
                CATEGORIES[
                  s.mode === "scholar"
                    ? "paper"
                    : s.mode === "news"
                      ? "news"
                      : s.mode === "jobs"
                        ? "job"
                        : "patent"
                ].plural
              }{" "}
              <small>{items.length}</small>
            </span>
          )}
        </div>
        <label className="filter-search">
          <Search size={13} />
          <input
            placeholder="Filter evidence"
            aria-label="Filter evidence"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </label>
      </div>
      <div className="evidence-results" aria-live="polite">
        {items.map((item, index) => (
          <EvidenceCard key={item.id} evidence={item} index={index} />
        ))}
        {!items.length && (
          <div className="empty-state">
            <Search size={27} />
            <h3>No matching evidence</h3>
            <p>
              {relevant.length
                ? "Try broadening your filters."
                : "This source has no results in the current investigation. Try a more specific live search."}
            </p>
            <div>
              <button className="secondary-button" onClick={resetFilters}>
                Clear filters
              </button>
              {!s.demo && (
                <button
                  className="primary-button"
                  onClick={() =>
                    void onSearch(
                      s.query || `${s.run.query} ${s.mode}`,
                      s.mode === "universe" ? [] : [s.mode as SourceEngine],
                    )
                  }
                >
                  Search this source <ArrowRight size={13} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      {s.mode === "universe" && (
        <div className="why-matters-strip">
          <span className="why-icon">
            <BookOpen size={19} />
          </span>
          <div>
            <span className="eyebrow">WHY THIS MATTERS</span>
            <p>{s.run.whyItMatters}</p>
          </div>
          <button
            className="text-button"
            onClick={() =>
              s.set({
                evidenceClaim:
                  s.run.claims.find((claim) => claim.id === "impact")?.id ??
                  "entity:topic",
              })
            }
          >
            View evidence <ArrowRight size={13} />
          </button>
        </div>
      )}
      {!s.run.demo && pages.length > 0 && (
        <div className="pagination-controls">
          <span>Explore further, only when you need to.</span>
          <div>
            {pages.map(([source, item]) => (
              <button
                className="secondary-button"
                key={source}
                onClick={() => void more(source, item)}
                disabled={Boolean(paging)}
              >
                {paging === source ? (
                  <>
                    <span className="spinner" /> Retrieving next page
                  </>
                ) : (
                  <>
                    More from {SOURCE_LABELS[source]} <ArrowRight size={12} />
                  </>
                )}
              </button>
            ))}
          </div>
          <small>
            Each uncached page uses one SerpApi request within the app’s daily
            budget.
          </small>
        </div>
      )}
      {pageError && (
        <p className="inline-error" role="alert">
          {pageError}
        </p>
      )}
      {s.mode === "scholar" && (
        <div className="research-next">
          <div>
            <span className="eyebrow">
              <BookOpen size={16} /> Next research question
            </span>
            <h3>Where does the evidence end?</h3>
            <p>
              Research gaps need explicit discussion in primary sources. Follow
              a new question to investigate what the retrieved papers leave
              open.
            </p>
          </div>
          <button
            className="secondary-button"
            onClick={() =>
              void onSearch(
                `${s.run.query.replace(/\?$/, "")} open research problems and limitations`,
                ["scholar", "web"],
              )
            }
          >
            Investigate research gaps <ArrowRight size={13} />
          </button>
        </div>
      )}
    </>
  );
}
function XMark() {
  return <span>×</span>;
}

export function DiscoverySection() {
  const s = useKnowledge();
  const steps = [
    {
      icon: Search,
      title: "Discover",
      text: "Turn one question into a knowledge graph.",
      action: () => document.getElementById("knowledge-search")?.focus(),
    },
    {
      icon: ShieldCheck,
      title: "Verify",
      text: "See exactly why an answer is trustworthy.",
      action: () =>
        s.set({ evidenceClaim: s.run.claims[0]?.id ?? "entity:topic" }),
    },
    {
      icon: Link2,
      title: "Connect",
      text: "Find relationships hidden across disciplines.",
      action: () => {
        s.resetGraph();
        window.scrollTo({ top: 330, behavior: "smooth" });
      },
    },
    {
      icon: CompassIcon,
      title: "Act",
      text: "Turn knowledge into your next opportunity.",
      action: () => {
        s.setMode("jobs");
        window.scrollTo({ top: 0, behavior: "smooth" });
      },
    },
  ];
  return (
    <section className="discovery-section">
      <div className="discovery-title">
        <h2>Use the sources to choose your next step.</h2>
      </div>
      <div className="discovery-steps">
        {steps.map((step, i) => (
          <button onClick={step.action} key={step.title}>
            <span className="step-number">0{i + 1}</span>
            <step.icon size={21} strokeWidth={1.4} />
            <h3>{step.title}</h3>
            <p>{step.text}</p>
            <ArrowRight size={16} className="step-arrow" />
          </button>
        ))}
      </div>
      <div className="curiosity-cta">
        <span>Search across the sources relevant to your question.</span>
        <h3>Search a topic or question</h3>
        <button
          className="primary-button"
          onClick={() => {
            document.getElementById("knowledge-search")?.focus();
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          Start a search <ArrowRight size={16} />
        </button>
      </div>
    </section>
  );
}
function CompassIcon(props: { size: number; strokeWidth: number }) {
  return <Network {...props} />;
}
