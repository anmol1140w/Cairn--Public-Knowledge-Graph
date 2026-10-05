import { createHash } from "node:crypto";
import type { EntityType, Evidence, SourceEngine } from "@/lib/types";

type RecordValue = Record<string, unknown>;
export const record = (value: unknown): RecordValue =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : {};
export const records = (value: unknown): RecordValue[] =>
  Array.isArray(value)
    ? value.map(record).filter((r) => Object.keys(r).length)
    : [];
const string = (value: unknown): string =>
  typeof value === "string" ? value : "";
export function sourceUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol)) return null;
    if (url.hostname === "serpapi.com" || url.hostname === "mcp.serpapi.com")
      return null;
    url.searchParams.delete("api_key");
    return url.toString();
  } catch {
    return null;
  }
}
export function canonicalUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  for (const key of [...url.searchParams.keys()])
    if (/^(utm_|fbclid|gclid)/i.test(key)) url.searchParams.delete(key);
  if (url.hostname.includes("arxiv.org")) {
    url.pathname = url.pathname
      .replace(/\/pdf\//, "/abs/")
      .replace(/\.pdf$/, "")
      .replace(/v\d+$/, "");
  }
  return url.toString().replace(/\/$/, "");
}
export function evidenceId(type: string, url: string): string {
  return `${type}-${createHash("sha256").update(canonicalUrl(url)).digest("hex").slice(0, 16)}`;
}
export function relevance(
  query: string,
  title: string,
  snippet: string,
  position: number,
): number {
  const stop = new Set([
    "what",
    "which",
    "who",
    "where",
    "when",
    "with",
    "that",
    "this",
    "have",
    "from",
    "about",
    "find",
    "latest",
    "research",
    "happening",
    "show",
    "papers",
  ]);
  const words = [
    ...new Set(
      query
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((word) => word.length > 2 && !stop.has(word)),
    ),
  ];
  const text = `${title} ${snippet}`.toLowerCase();
  const overlap =
    words.filter((word) => text.includes(word)).length /
    Math.max(words.length, 1);
  return (
    Math.round(
      Math.min(
        0.98,
        0.3 + overlap * 0.53 + Math.max(0, 0.14 - position * 0.008),
      ) * 100,
    ) / 100
  );
}
const recognizedSkills = [
  "Python",
  "PyTorch",
  "TensorFlow",
  "CUDA",
  "JavaScript",
  "TypeScript",
  "SQL",
  "Computer Vision",
  "Machine Learning",
  "Research",
  "C++",
  "Java",
  "NLP",
  "Statistics",
];
export function normalizeResults(
  source: SourceEngine,
  payload: RecordValue,
  query: string,
  retrievedAt: string,
): Evidence[] {
  let items: RecordValue[];
  if (source === "jobs") items = records(payload.jobs_results);
  else if (source === "news")
    items = records(payload.news_results).flatMap((item) => {
      const stories = records(item.stories);
      return stories.length ? stories : [item];
    });
  else items = records(payload.organic_results);
  const output: Evidence[] = [];
  for (const [index, item] of items
    .slice(0, source === "web" ? 8 : 10)
    .entries()) {
    const publisher = record(item.source);
    const publication = record(item.publication_info);
    const inline = record(item.inline_links);
    const detected = record(item.detected_extensions);
    const applies = records(item.apply_options);
    const authors = records(publication.authors);
    const url = sourceUrl(
      source === "jobs"
        ? (applies.find((option) => sourceUrl(option.link))?.link ??
            item.share_link)
        : source === "patents"
          ? item.patent_link
          : item.link,
    );
    const title = string(item.title);
    if (!url || !title) continue;
    const snippet = string(
      source === "jobs" ? item.description : item.snippet,
    ).slice(0, 7000);
    const type: EntityType =
      source === "scholar"
        ? "paper"
        : source === "jobs"
          ? "job"
          : source === "news"
            ? "news"
            : source === "patents"
              ? "patent"
              : "web";
    let hostname = "";
    try {
      hostname = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      /* already validated */
    }
    const publisherName =
      source === "scholar"
        ? string(publication.summary) || "Google Scholar"
        : source === "jobs"
          ? string(item.via) || string(item.company_name) || "Google Jobs"
          : source === "news"
            ? string(publisher.name) || string(item.source) || hostname
            : source === "patents"
              ? `Google Patents · ${string(item.publication_number)}`
              : hostname;
    const year = string(publication.summary).match(/\b(19|20)\d{2}\b/)?.[0];
    const date =
      source === "patents"
        ? string(item.publication_date) || undefined
        : source === "scholar"
          ? string(item.publication_date) || year
          : source === "jobs"
            ? undefined
            : string(item.iso_date) || string(item.date) || undefined;
    const authorNames =
      source === "scholar"
        ? authors.map((a) => string(a.name)).filter(Boolean)
        : source === "news"
          ? Array.isArray(publisher.authors)
            ? publisher.authors.filter(
                (a): a is string => typeof a === "string",
              )
            : []
          : source === "patents"
            ? Array.isArray(item.inventor)
              ? item.inventor.map(String)
              : string(item.inventor)
                ? [string(item.inventor)]
                : []
            : [];
    const metadata: RecordValue =
      source === "scholar"
        ? {
            resultId: item.result_id,
            authors: authors.map((a) => ({
              name: a.name,
              authorId: a.author_id,
              url: sourceUrl(a.link),
            })),
            citations: record(inline.cited_by).total,
            citesId: record(inline.cited_by).cites_id,
            publicationInfo: publication.summary,
          }
        : source === "jobs"
          ? {
              company: item.company_name,
              location: item.location,
              jobId: item.job_id,
              schedule: detected.schedule_type,
              postedAt: detected.posted_at,
              salary: detected.salary,
              remote:
                detected.work_from_home === true ||
                /\b(remote|work from home)\b/i.test(
                  [
                    string(item.location),
                    ...(Array.isArray(item.extensions)
                      ? item.extensions.filter(
                          (v): v is string => typeof v === "string",
                        )
                      : []),
                  ].join(" "),
                ),
              skills: recognizedSkills.filter((skill) =>
                new RegExp(
                  `(?<![A-Za-z0-9])${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z])`,
                  "i",
                ).test(`${title} ${snippet}`),
              ),
              applyOptions: applies
                .map((option) => ({
                  title: option.title,
                  url: sourceUrl(option.link),
                }))
                .filter((option) => option.url),
              highlights: item.job_highlights,
              filters: payload.filters,
              nextPageToken: record(payload.serpapi_pagination).next_page_token,
            }
          : source === "patents"
            ? {
                patentId: item.patent_id,
                publicationNumber: item.publication_number,
                assignee: item.assignee,
                priorityDate: item.priority_date,
                filingDate: item.filing_date,
                pdf: sourceUrl(item.pdf),
                inventor: item.inventor,
              }
            : source === "news"
              ? { storyToken: item.story_token, originalDate: item.date }
              : {
                  relatedQuestions: records(payload.related_questions)
                    .map((question) => ({
                      question: question.question,
                      nextPageToken: question.next_page_token,
                      url: sourceUrl(
                        record(question.source).link ?? question.link,
                      ),
                    }))
                    .slice(0, 5),
                };
    metadata.searchQuery = string(record(payload.search_parameters).q) || query;
    metadata.searchOptions = Object.fromEntries(
      Object.entries(record(payload.search_parameters)).filter(([key]) =>
        [
          "hl",
          "gl",
          "location",
          "uds",
          "tbs",
          "as_ylo",
          "as_yhi",
          "sort",
        ].includes(key),
      ),
    );
    const pagination = record(payload.serpapi_pagination);
    if (source === "jobs" && pagination.next_page_token)
      metadata.pagination = { cursor: pagination.next_page_token };
    else if (source !== "news" && pagination.next) {
      try {
        const next = new URL(String(pagination.next));
        const cursor = Number(
          next.searchParams.get(source === "patents" ? "page" : "start"),
        );
        if (Number.isFinite(cursor) && cursor > 0)
          metadata.pagination = { cursor };
      } catch {
        /* Missing cursor is not invented. */
      }
    }
    if (source === "scholar" && record(payload.search_parameters).cites)
      metadata.citationSearchId = record(payload.search_parameters).cites;
    output.push({
      id: evidenceId(type, url),
      type,
      title,
      source: publisherName,
      url,
      date,
      authors: authorNames.length ? authorNames : undefined,
      snippet: snippet || undefined,
      relevanceScore: relevance(query, title, snippet, index),
      engine: source,
      retrievedAt,
      primary: source === "patents" ? true : undefined,
      metadata,
    });
  }
  if (source === "web") {
    const knowledge = record(payload.knowledge_graph);
    const website = sourceUrl(
      record(knowledge.website).link ??
        knowledge.website ??
        knowledge.knowledge_graph_search_link,
    );
    if (knowledge.title && website) {
      const rawType = string(knowledge.type);
      const type: EntityType = /university|institution|college/i.test(rawType)
        ? "institution"
        : /company|corporation|business/i.test(rawType)
          ? "company"
          : /researcher|professor|scientist|person/i.test(rawType)
            ? "person"
            : "technology";
      output.push({
        id: evidenceId(type, website),
        type,
        title: string(knowledge.title),
        source: "Google knowledge panel",
        url: website,
        snippet: string(knowledge.description),
        relevanceScore: relevance(
          query,
          string(knowledge.title),
          string(knowledge.description),
          0,
        ),
        engine: "web",
        retrievedAt,
        metadata: {
          descriptionSource: record(knowledge.description_source).name,
        },
      });
    }
  }
  return deduplicateEvidence(output);
}
export function deduplicateEvidence(items: Evidence[]): Evidence[] {
  const map = new Map<string, Evidence>();
  const priority: Record<EntityType, number> = {
    paper: 4,
    patent: 4,
    job: 4,
    news: 3,
    person: 3,
    institution: 3,
    company: 3,
    technology: 2,
    web: 1,
    topic: 0,
  };
  for (const item of items) {
    const key = canonicalUrl(item.url);
    const current = map.get(key);
    if (
      !current ||
      priority[item.type] > priority[current.type] ||
      (priority[item.type] === priority[current.type] &&
        item.relevanceScore > current.relevanceScore)
    )
      map.set(key, item);
  }
  return [...map.values()].sort((a, b) => b.relevanceScore - a.relevanceScore);
}
