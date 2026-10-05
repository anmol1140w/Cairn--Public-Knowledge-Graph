import { NextRequest, NextResponse } from "next/server";
import { config } from "@/server/config";
import { dailyUsage } from "@/server/storage";
import { session, sessionCookie } from "@/server/http";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  let usage: number | null = null;
  let databaseReady = false;
  try {
    usage = await dailyUsage();
    databaseReady = true;
  } catch {
    /* Demo mode remains usable without storage. */
  }
  const response = NextResponse.json(
    {
      searchConfigured: Boolean(config.serpapiKey()),
      modelsConfigured: Boolean(config.ollamaKey()),
      databaseReady,
      dailyUsage: usage,
      dailyBudget: config.dailyBudget(),
      maxRequestsPerQuery: config.maxSearches(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
  const user = session(request);
  if (user.fresh) sessionCookie(response, user.id);
  return response;
}
