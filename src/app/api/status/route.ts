import { NextResponse } from "next/server";
import { config } from "@/server/config";
import { dailyUsage } from "@/server/storage";
import { authenticationConfigured } from "@/server/auth";
export const runtime = "nodejs";
export async function GET() {
  let usage: number | null = null;
  let databaseReady = false;
  try {
    usage = await dailyUsage();
    databaseReady = true;
  } catch {
    /* Demo mode remains usable without storage. */
  }
  return NextResponse.json(
    {
      searchConfigured: Boolean(config.serpapiKey()),
      modelsConfigured: Boolean(config.ollamaKey()),
      authConfigured: authenticationConfigured(),
      databaseReady,
      dailyUsage: usage,
      dailyBudget: config.dailyBudget(),
      maxRequestsPerQuery: config.maxSearches(),
      usage:
        usage === null
          ? null
          : {
              dailyUsed: usage,
              dailyBudget: config.dailyBudget(),
              maxRequestsPerQuery: config.maxSearches(),
            },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
