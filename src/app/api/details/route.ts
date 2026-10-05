import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { evidenceSchema } from "@/server/validation";
import { ENGINES, serpapiSearch } from "@/server/serpapi";
import { assertStorage } from "@/server/storage";
import { bodyJson, sameOrigin, session, sessionCookie } from "@/server/http";
import { publicError } from "@/server/config";
import {
  normalizeResults,
  record,
  records,
  sourceUrl,
} from "@/server/normalize";

export const runtime = "nodejs";
export const maxDuration = 70;
const detailsSchema = z.object({
  ephemeral: z.boolean().optional(),
  evidence: evidenceSchema.optional(),
  kind: z
    .enum(["auto", "cites", "trends", "related", "listing"])
    .default("auto"),
  query: z.string().min(2).max(600).optional(),
  token: z.string().max(12000).optional(),
});
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const input = detailsSchema.parse(await bodyJson(request));
    await assertStorage();
    const user = session(request);
    const e = input.evidence;
    const meta = e?.metadata ?? {};
    let params: Record<string, unknown>;
    let metadata: Record<string, unknown>;
    if (input.kind === "trends") {
      if (!input.query)
        throw new Error("A topic is required for search interest.");
      params = {
        engine: ENGINES.trends,
        q: input.query,
        data_type: "TIMESERIES",
        date: "today 12-m",
      };
    } else if (input.kind === "related") {
      if (!input.token)
        throw new Error(
          "Use the next-page token returned by a Google related-question result.",
        );
      params = { engine: ENGINES.related, next_page_token: input.token };
    } else if (input.kind === "cites") {
      if (!meta.citesId || !/^\d+$/.test(String(meta.citesId)))
        throw new Error(
          "This source did not provide a Scholar citation-network identifier.",
        );
      params = {
        engine: ENGINES.scholar,
        cites: String(meta.citesId),
        num: 8,
        hl: "en",
      };
    } else if (input.kind === "listing") {
      if (!meta.jobId)
        throw new Error(
          "This source did not provide a Google Jobs identifier.",
        );
      params = {
        engine: ENGINES.listing,
        q: String(meta.jobId).slice(0, 12000),
      };
    } else if (meta.authorId) {
      if (!/^[A-Za-z0-9_-]{3,120}$/.test(String(meta.authorId)))
        throw new Error("Invalid Scholar author identifier.");
      params = {
        engine: ENGINES.author,
        author_id: String(meta.authorId),
        hl: "en",
      };
    } else if (meta.patentId) {
      if (!/^(patent|scholar)\/[A-Za-z0-9.\-/]+$/.test(String(meta.patentId)))
        throw new Error("Invalid Google Patents identifier.");
      params = {
        engine: ENGINES.patentDetails,
        patent_id: String(meta.patentId),
      };
    } else if (meta.resultId) {
      if (!/^[A-Za-z0-9_=-]{3,160}$/.test(String(meta.resultId)))
        throw new Error("Invalid Scholar result identifier.");
      params = { engine: ENGINES.cite, q: String(meta.resultId), hl: "en" };
    } else
      throw new Error(
        "This source did not return an enrichment identifier. Open its original URL for details.",
      );
    const result = await serpapiSearch(params, {
      sessionId: user.id,
      runId: null,
      signal: request.signal,
      ephemeral: input.ephemeral,
    });
    const data = result.payload;
    if (params.engine === ENGINES.author) {
      const author = record(data.author);
      const citationRows = records(record(data.cited_by).table);
      metadata = {
        affiliations: author.affiliations,
        authorName: author.name,
        citations: record(citationRows[0]?.citations).all,
        citationTable: citationRows,
        articles: records(data.articles).slice(0, 10),
        coauthors: records(data.co_authors).map((coauthor) => ({
          name: coauthor.name,
          authorId: coauthor.author_id,
        })),
      };
    } else if (params.engine === ENGINES.patentDetails)
      metadata = {
        abstract: data.abstract,
        assignee: Array.isArray(data.assignees)
          ? data.assignees.join(", ")
          : data.assignees,
        inventors: records(data.inventors).map((v) => v.name),
        priorityDate: data.priority_date,
        filingDate: data.filing_date,
        publicationNumber: data.publication_number,
        claims: data.claims,
        patentCitations: data.patent_citations,
        nonPatentCitations: data.non_patent_citations,
        classifications: data.classifications,
        citations: records(record(data.cited_by).original).length,
      };
    else if (params.engine === ENGINES.cite)
      metadata = {
        citationsFormatted: records(data.citations),
        citationFormats: records(data.links).map((v) => ({
          title: v.name,
          url: sourceUrl(v.link),
        })),
      };
    else if (input.kind === "cites")
      metadata = {
        relatedEvidence: normalizeResults(
          "scholar",
          data,
          e?.title ?? "",
          result.retrievedAt,
        ),
        relationType: "cited",
      };
    else if (input.kind === "trends")
      metadata = {
        trends: records(record(data.interest_over_time).timeline_data).map(
          (point) => ({
            date: point.date,
            values: records(point.values).map((v) => ({
              query: v.query,
              value: v.extracted_value,
            })),
          }),
        ),
      };
    else if (input.kind === "related")
      metadata = {
        relatedQuestions: records(data.related_questions).map((v) => ({
          question: v.question,
          snippet: v.snippet,
          nextPageToken: v.next_page_token,
          url: sourceUrl(record(v.source).link ?? v.link),
        })),
      };
    else metadata = { ratings: data.ratings };
    const response = NextResponse.json({
      metadata,
      cached: result.cached,
      retrievedAt: result.retrievedAt,
    });
    if (user.fresh) sessionCookie(response, user.id);
    return response;
  } catch (error) {
    return NextResponse.json({ error: publicError(error) }, { status: 400 });
  }
}
