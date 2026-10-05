"use client";
import { useKnowledge } from "@/lib/store";
import type { Evidence } from "@/lib/types";
import type { JobsProfile, Profile } from "@/lib/profiles";
import { defaultProfile } from "@/lib/profiles";
import {
  citation,
  jobRequirements,
  paperSummary,
  quotedSentence,
  sourceText,
} from "@/lib/personalization";

export function RequirementChecklist({
  evidence,
  profile,
}: {
  evidence: Evidence;
  profile: JobsProfile;
}) {
  const report = jobRequirements(evidence, profile);
  return (
    <details className="requirement-checklist">
      <summary>Requirement checklist</summary>
      {evidence.metadata?.illustrative === true && (
        <p>
          Illustrative career example. These records do not establish actual
          vacancy requirements.
        </p>
      )}
      <p>
        {report.rows.length
          ? `You meet ${report.met} of ${report.rows.length} listed requirements.`
          : "No quoted requirements available to assess."}
      </p>
      <small>
        Counts compare quoted requirements with self-reported details.
        Qualification text matching does not establish equivalency or hiring
        eligibility.
      </small>
      <ul>
        {report.rows.map((row) => (
          <li key={row.label}>
            <strong>
              {row.label} · {row.status}
            </strong>
            <blockquote>“{row.quote}”</blockquote>
            <button
              className="text-button"
              onClick={() =>
                useKnowledge
                  .getState()
                  .set({ evidenceClaim: `entity:${row.evidenceId}` })
              }
            >
              View requirement source
            </button>
          </li>
        ))}
      </ul>
      <dl className="detail-rows">
        {report.unknowns.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      {report.missing.length > 0 && (
        <p>Missing / learn next: {report.missing.join(", ")}</p>
      )}
    </details>
  );
}
export function ModeInsights({
  items,
  profile,
}: {
  items: Evidence[];
  profile?: Profile;
}) {
  const s = useKnowledge();
  if (s.mode === "scholar") {
    const preferences =
      profile?.mode === "scholar"
        ? profile
        : (defaultProfile("scholar") as Extract<Profile, { mode: "scholar" }>);
    const order = [...items].sort(
      (a, b) =>
        Number(/review|survey/i.test(b.title)) -
          Number(/review|survey/i.test(a.title)) ||
        (a.date ?? "9999").localeCompare(b.date ?? "9999"),
    );
    const definitions = [
      ...items.flatMap((e) =>
        Array.isArray(e.metadata?.glossary)
          ? (e.metadata.glossary as { term: string; quote: string }[])
              .filter((definition) =>
                (e.snippet ?? "").includes(definition.quote),
              )
              .map((definition) => ({ ...definition, id: e.id }))
          : [],
      ),
      ...items.flatMap((e) =>
        [
          ...(e.snippet ?? "").matchAll(
            /([A-Za-z][A-Za-z -]{2,40}) (?:is defined as|refers to|means) ([^.]+\.)/g,
          ),
        ].map((match) => ({ term: match[1], quote: match[0], id: e.id })),
      ),
    ];
    return (
      <section className="mode-insights" aria-label="Reading guide">
        <h3>Reading order</h3>
        <p>
          Reviews first, then dated work from earlier to later. This is a
          reading aid based on returned titles and dates.
        </p>
        <ol>
          {order.map((e) => (
            <li key={e.id}>
              <strong>{e.title}</strong>
              <details>
                <summary>
                  {preferences.readingLevel === "Simple"
                    ? "Plain summary and citation"
                    : "Summary and citation"}
                </summary>
                <p>{paperSummary(s.run, e)}</p>
                <small>
                  {s.run.claims.some((c) => c.evidenceIds.includes(e.id))
                    ? "Based on assessed claims for this record."
                    : "Original source excerpt; a separate plain-language paraphrase was not established."}
                </small>
                <pre className="citation-text">
                  {citation(e, preferences.citationStyle)}
                </pre>
                <button
                  className="text-button"
                  onClick={() => s.set({ evidenceClaim: `entity:${e.id}` })}
                >
                  View source and quotes
                </button>
              </details>
            </li>
          ))}
        </ol>
        <h3>Glossary from source text</h3>
        {definitions.length ? (
          definitions.slice(0, 6).map((d) => (
            <blockquote key={`${d.id}-${d.term}`}>
              <strong>{d.term}</strong>
              <p>“{d.quote}”</p>
              <button
                className="text-button"
                onClick={() => s.set({ evidenceClaim: `entity:${d.id}` })}
              >
                Definition source
              </button>
            </blockquote>
          ))
        ) : (
          <p>
            No explicit definitions in these excerpts. Full paper text may
            contain a more complete glossary.
          </p>
        )}
      </section>
    );
  }
  if (s.mode === "news")
    return (
      <section className="mode-insights" aria-label="Event timeline">
        <h3>Event timeline</h3>
        <ol>
          {[...items]
            .sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"))
            .map((e) => (
              <li key={e.id}>
                <time>{e.date || "Date not stated"}</time>
                <strong>{e.title}</strong>
                <span>{e.source}</span>
                <button
                  className="text-button"
                  onClick={() => s.set({ evidenceClaim: `entity:${e.id}` })}
                >
                  Read source excerpt
                </button>
              </li>
            ))}
        </ol>
        <h3>What is unknown?</h3>
        <p>
          These excerpts cannot establish an event’s full context or resolve
          unreported facts. Source agreement is shown only against a specific
          assessed claim; missing conflicting evidence is not confirmation.
        </p>
      </section>
    );
  if (s.mode === "patents")
    return (
      <section className="mode-insights" aria-label="Patent comparison">
        <h3>Quoted similarities and differences</h3>
        <p>
          This is a starting search, not legal advice or a full novelty search.
        </p>
        {items.map((e) => {
          const terms = profile?.mode === "patents" ? profile.keywords : [];
          const quotes = terms
            .map((term) => ({ term, quote: quotedSentence(e, term) }))
            .filter((q) => q.quote);
          return (
            <details key={e.id}>
              <summary>{e.title}</summary>
              <h4>Similarity in returned text</h4>
              {quotes.length ? (
                quotes.map((q) => (
                  <blockquote key={q.term}>
                    <strong>{q.term}</strong>
                    <p>“{q.quote}”</p>
                  </blockquote>
                ))
              ) : (
                <p>
                  No user keyword similarity established. Source excerpt: “
                  {e.snippet || "Not stated"}”
                </p>
              )}
              <h4>Differences</h4>
              <p>
                No comparative differences established by the returned excerpt.
                Keyword overlap does not establish the scope of claims.
              </p>
              <p>
                Status:{" "}
                {typeof e.metadata?.status === "string"
                  ? e.metadata.status
                  : "Not stated"}
              </p>
              <small>
                Comparison uses returned text only ({sourceText(e).length}{" "}
                characters), not full claims or legal status records.
              </small>
              <button
                className="text-button"
                onClick={() => s.set({ evidenceClaim: `entity:${e.id}` })}
              >
                View patent source
              </button>
            </details>
          );
        })}
      </section>
    );
  return null;
}
