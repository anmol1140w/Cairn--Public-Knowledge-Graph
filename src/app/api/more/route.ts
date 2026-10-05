import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { bodyJson, sameOrigin, session, sessionCookie } from "@/server/http";
import { assertStorage } from "@/server/storage";
import { ENGINES, serpapiSearch } from "@/server/serpapi";
import { normalizeResults } from "@/server/normalize";
import { publicError } from "@/server/config";
export const runtime = "nodejs";
export const maxDuration = 70;
const schema = z.object({
  ephemeral: z.boolean().optional(),
  source: z.enum(["scholar", "jobs", "patents", "web"]),
  query: z.string().min(2).max(600),
  cursor: z.union([
    z.number().int().min(1).max(1000),
    z.string().min(1).max(12000),
  ]),
  citesId: z.string().regex(/^\d+$/).optional(),
  options: z
    .object({
      hl: z
        .string()
        .regex(/^[a-z]{2,3}(-[a-z0-9]{2,3})?$/)
        .optional(),
      gl: z
        .string()
        .regex(/^[a-z]{2}$/)
        .optional(),
      location: z.string().max(250).optional(),
      uds: z.string().max(12000).optional(),
      tbs: z.string().max(200).optional(),
      as_ylo: z.coerce.number().int().min(1900).max(2100).optional(),
      as_yhi: z.coerce.number().int().min(1900).max(2100).optional(),
      sort: z.enum(["new", "old"]).optional(),
    })
    .optional(),
});
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const input = schema.parse(await bodyJson(request, 15000));
    await assertStorage();
    const user = session(request);
    const params: Record<string, unknown> = {
      ...input.options,
      engine: ENGINES[input.source],
      q: input.query,
      hl: input.options?.hl ?? "en",
    };
    if (input.source === "jobs") {
      if (typeof input.cursor !== "string")
        throw new Error(
          "Google Jobs pagination requires a returned next-page token.",
        );
      params.next_page_token = input.cursor;
    } else {
      if (typeof input.cursor !== "number")
        throw new Error("This source requires a numeric pagination cursor.");
      params[input.source === "patents" ? "page" : "start"] = input.cursor;
    }
    if (input.source === "scholar") {
      params.num = 8;
      if (input.citesId) {
        params.cites = input.citesId;
        delete params.q;
      }
    }
    if (input.source === "patents") {
      params.num = 10;
      delete params.hl;
    }
    const result = await serpapiSearch(params, {
      sessionId: user.id,
      runId: null,
      signal: request.signal,
      ephemeral: input.ephemeral,
    });
    const response = NextResponse.json({
      evidence: normalizeResults(
        input.source,
        result.payload,
        input.query,
        result.retrievedAt,
      ),
      cached: result.cached,
    });
    if (user.fresh) sessionCookie(response, user.id);
    return response;
  } catch (error) {
    return NextResponse.json({ error: publicError(error) }, { status: 400 });
  }
}
