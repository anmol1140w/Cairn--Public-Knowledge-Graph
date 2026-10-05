import { describe, expect, it } from "vitest";
import {
  normalizeResults,
  deduplicateEvidence,
  canonicalUrl,
  sourceUrl,
} from "@/server/normalize";
import {
  buildGraph,
  capConfidence,
  groundedClaims,
  type GroundedClaim,
} from "@/server/graph-builder";
import { engineParameters, fallbackPlan } from "@/server/planner";
import { formatDate, skillMatch } from "@/lib/graph-utils";
import { DEMO } from "@/lib/demo";
import { csvReport, markdownReport, pdfReport } from "@/server/export";
import { strFromU8, unzipSync } from "fflate";
import { PDFDocument } from "pdf-lib";
import { appendEvidence } from "@/lib/append-evidence";

describe("actual SerpApi response contracts", () => {
  it("preserves Scholar IDs, original source URLs, and year precision", () => {
    const result = normalizeResults(
      "scholar",
      {
        organic_results: [
          {
            title: "FlashAttention",
            link: "https://arxiv.org/abs/2205.14135",
            result_id: "test_result_id",
            snippet: "Attention with IO-awareness",
            publication_info: {
              summary: "T Dao - 2022 - arxiv.org",
              authors: [
                {
                  name: "Tri Dao",
                  author_id: "test_author_id",
                  link: "https://scholar.google.com/citations?user=test_author_id",
                },
              ],
            },
            inline_links: { cited_by: { total: 20, cites_id: "1234" } },
          },
        ],
      },
      "efficient attention",
      "2026-10-05T00:00:00Z",
    );
    expect(result[0].metadata?.citesId).toBe("1234");
    expect(result[0].metadata?.resultId).toBe("test_result_id");
    expect(result[0].date).toBe("2022");
    expect(formatDate(result[0].date)).toBe("2022");
    expect(result[0].url).toContain("arxiv.org");
  });
  it("uses Jobs application URLs and preserves unknown deadlines", () => {
    const results = normalizeResults(
      "jobs",
      {
        jobs_results: [
          {
            title: "Research intern",
            company_name: "Example employer",
            location: "India",
            via: "Employer",
            description: "Python and PyTorch experience",
            apply_options: [
              { title: "Employer", link: "https://example.org/job" },
            ],
            detected_extensions: {
              posted_at: "2 days ago",
              schedule_type: "Internship",
            },
            job_id: "test_job_id",
          },
        ],
        serpapi_pagination: { next_page_token: "test_token" },
      },
      "research internship India",
      "2026-10-05T00:00:00Z",
    );
    expect(results[0].url).toBe("https://example.org/job");
    expect(results[0].metadata?.deadline).toBeUndefined();
    expect(results[0].metadata?.skills).toContain("PyTorch");
    expect(results[0].metadata?.nextPageToken).toBe("test_token");
    expect(skillMatch(results[0], [])).toBeNull();
  });
  it("flattens nested news stories and keeps publisher authors", () => {
    const results = normalizeResults(
      "news",
      {
        news_results: [
          {
            stories: [
              {
                title: "A sourced event",
                source: { name: "Publication", authors: ["Author"] },
                link: "https://example.org/event",
                iso_date: "2026-10-01T12:00:00Z",
              },
            ],
          },
        ],
      },
      "event",
      "2026-10-05T00:00:00Z",
    );
    expect(results[0].source).toBe("Publication");
    expect(results[0].authors).toEqual(["Author"]);
  });
  it("does not conflate JavaScript with Java or negative remote descriptions with remote listings", () => {
    const jobs = normalizeResults(
      "jobs",
      {
        jobs_results: [
          {
            title: "Software internship",
            company_name: "Example employer",
            location: "Bengaluru",
            description:
              "JavaScript and Python3. Remote work is not available.",
            apply_options: [{ link: "https://example.org/internship" }],
          },
        ],
      },
      "software internship",
      "2026-10-05T00:00:00Z",
    );
    expect(jobs[0].metadata?.skills).toContain("JavaScript");
    expect(jobs[0].metadata?.skills).not.toContain("Java");
    expect(jobs[0].metadata?.skills).toContain("Python");
    expect(jobs[0].metadata?.remote).toBe(false);
  });
  it("keeps patent priority and publication dates distinct", () => {
    const results = normalizeResults(
      "patents",
      {
        organic_results: [
          {
            title: "Machine learning-based hardware component monitoring",
            patent_link: "https://patents.google.com/patent/US11734097B1/en",
            patent_id: "patent/US11734097B1/en",
            priority_date: "2018-01-18",
            publication_date: "2023-08-22",
            assignee: "Pure Storage Inc",
          },
        ],
      },
      "hardware monitoring",
      "2026-10-05T00:00:00Z",
    );
    expect(results[0].date).toBe("2023-08-22");
    expect(results[0].metadata?.priorityDate).toBe("2018-01-18");
  });
  it("rejects script URLs and API-internal links; canonicalizes duplicate papers", () => {
    expect(sourceUrl("javascript:alert(1)")).toBeNull();
    expect(sourceUrl("https://serpapi.com/search?api_key=secret")).toBeNull();
    expect(
      canonicalUrl("https://arxiv.org/pdf/2205.14135v2.pdf?utm_source=demo"),
    ).toBe("https://arxiv.org/abs/2205.14135");
    expect(
      deduplicateEvidence([
        DEMO.evidence[0],
        {
          ...DEMO.evidence[0],
          id: "duplicate",
          url: "https://arxiv.org/abs/2205.14135?utm_campaign=test",
        },
      ]),
    ).toHaveLength(1);
  });
  it("prefers a Scholar record over a generic web duplicate and keeps pagination identifiers", () => {
    const paper = DEMO.evidence[0];
    expect(
      deduplicateEvidence([
        { ...paper, type: "web", relevanceScore: 1 },
        paper,
      ])[0].type,
    ).toBe("paper");
    const page = normalizeResults(
      "scholar",
      {
        organic_results: [{ title: "FlashAttention", link: paper.url }],
        search_parameters: { q: "attention", as_ylo: 2022, hl: "en" },
        serpapi_pagination: {
          next: "https://serpapi.com/search.json?engine=google_scholar&start=8&q=attention",
        },
      },
      "attention",
      "2026-10-05T00:00:00Z",
    );
    expect(page[0].metadata?.pagination).toEqual({ cursor: 8 });
    expect(page[0].metadata?.searchOptions).toMatchObject({ as_ylo: 2022 });
  });
});
describe("provenance validation", () => {
  const item = DEMO.evidence[0];
  const claim: GroundedClaim = {
    id: "claim",
    text: "FlashAttention reduces memory traffic.",
    evidenceIds: [item.id],
    conflictingEvidenceIds: [],
    confidence: "high",
    rationale: "The original paper describes reduced memory traffic.",
    supportingQuotes: [
      {
        evidenceId: item.id,
        text: "reduce the number of memory reads/writes between GPU high bandwidth memory (HBM) and GPU on-chip SRAM",
      },
    ],
  };
  it("rejects invented IDs and paraphrases presented as exact evidence", () => {
    expect(
      groundedClaims([{ ...claim, evidenceIds: ["made-up"] }], [item]),
    ).toEqual([]);
    expect(
      groundedClaims(
        [
          {
            ...claim,
            supportingQuotes: [
              {
                evidenceId: item.id,
                text: "An invented quotation that is not in the source",
              },
            ],
          },
        ],
        [item],
      ),
    ).toEqual([]);
  });
  it("caps high confidence when independence is unestablished", () => {
    expect(groundedClaims([claim], [item])[0].confidence).toBe("medium");
  });
  it("does not equate multiple secondary reports with independent primary confirmation", () => {
    const secondary = [
      { ...item, primary: undefined },
      { ...DEMO.evidence[2], primary: undefined },
    ];
    expect(
      capConfidence(
        { ...claim, evidenceIds: secondary.map((e) => e.id) },
        secondary,
      ).confidence,
    ).toBe("medium");
  });
  it("requires actual quotations for conflicting evidence as well", () => {
    expect(
      groundedClaims(
        [{ ...claim, conflictingEvidenceIds: [DEMO.evidence[1].id] }],
        DEMO.evidence,
      ),
    ).toEqual([]);
  });
  it("maps explicit authorship while rejecting unmentioned entities and unsourced edges", () => {
    const graph = buildGraph("attention", [item], {
      entities: [
        {
          key: "invented",
          name: "Invented Institute",
          type: "institution",
          evidenceIds: [item.id],
          mention: "GPU high-bandwidth memory",
          description: "Unsupported",
        },
      ],
      relationships: [],
      clusters: [],
      newsEvents: [],
    });
    expect(graph.entities.some((e) => e.title === "Invented Institute")).toBe(
      false,
    );
    expect(graph.relationships.some((e) => e.type === "authored")).toBe(true);
    expect(
      graph.relationships.every((edge) =>
        edge.evidenceIds.every((id) => graph.evidence.some((e) => e.id === id)),
      ),
    ).toBe(true);
  });
  it("appends additional source records without silently changing existing claim support", () => {
    const added = {
      ...DEMO.evidence[0],
      id: "additional-paper",
      url: "https://example.org/additional-paper",
    };
    const updated = appendEvidence(DEMO, [added, DEMO.evidence[0]]);
    expect(updated.evidence).toHaveLength(DEMO.evidence.length + 1);
    expect(updated.claims).toEqual(DEMO.claims);
    expect(updated.relationships.at(-1)?.inferred).toBe(true);
  });
});
describe("cost-aware engine planning", () => {
  it("routes weekly regulation to news and web without jobs or Scholar", () => {
    const plan = fallbackPlan({
      query: "What happened with AI regulation this week?",
      sources: [],
      mode: "universe",
      simplified: false,
    });
    expect(plan.searches.map((s) => s.source)).toEqual(["news", "web"]);
  });
  it("honors selected sources and avoids deprecated Jobs pagination parameters", () => {
    const plan = fallbackPlan({
      query: "Computer vision internship India",
      sources: ["jobs"],
      mode: "universe",
      simplified: false,
    });
    const params = engineParameters(plan.searches[0]);
    expect(params.engine).toBe("google_jobs");
    expect(params.gl).toBe("in");
    expect(params.start).toBeUndefined();
    expect(params.chips).toBeUndefined();
  });
});
describe("source-preserving exports", () => {
  it("preserves demo labelling, URLs, claim IDs, and relationship provenance", () => {
    const md = markdownReport(DEMO);
    expect(md).toContain("DEMO DATA");
    expect(md).toContain(DEMO.evidence[0].url);
    expect(md).toContain("flash, flash2, paged");
    const archive = unzipSync(csvReport(DEMO));
    expect(strFromU8(archive["relationships.csv"])).toContain("evidenceIds");
    expect(strFromU8(archive["claims.csv"])).toContain("supportingEvidenceIds");
  });
  it("generates an actual multipage PDF report", async () => {
    const document = await PDFDocument.load(await pdfReport(DEMO));
    expect(document.getPageCount()).toBeGreaterThan(1);
    expect(document.getTitle()).toContain("efficient AI inference");
  });
});
