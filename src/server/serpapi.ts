import "server-only";
import { createHash } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { cleanSnapshot, config } from "./config";
import { finishRequest, readCache, reserveSearch, writeCache } from "./storage";
import { ENGINES } from "./engines";
import { BRAND } from "@/lib/brand";
export { ENGINES } from "./engines";
export interface ToolResult {
  payload: Record<string, unknown>;
  cached: boolean;
  retrievedAt: string;
}
export interface SearchContext {
  sessionId: string;
  runId: string | null;
  signal?: AbortSignal;
  ephemeral?: boolean;
}
const inFlight = new Map<string, Promise<ToolResult>>();
let active = 0;
const queue: (() => void)[] = [];

async function withSearchSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= 2) await new Promise<void>((resolve) => queue.push(resolve));
  else active++;
  try {
    return await fn();
  } finally {
    const next = queue.shift();
    if (next) next();
    else active--;
  }
}
export function parameterKey(params: Record<string, unknown>): string {
  return createHash("sha256")
    .update(
      JSON.stringify(
        Object.fromEntries(
          Object.entries(params).sort(([a], [b]) => a.localeCompare(b)),
        ),
      ),
    )
    .digest("hex");
}
export async function serpapiSearch(
  params: Record<string, unknown>,
  context: SearchContext,
): Promise<ToolResult> {
  if (!config.serpapiKey())
    throw new Error("Live search needs a server-side SERPAPI_API_KEY.");
  const engine = String(params.engine);
  if (!(Object.values(ENGINES) as string[]).includes(engine))
    throw new Error(
      "This search engine is not supported by the evidence adapter.",
    );
  const safeParams = { ...params, no_cache: false };
  const key = parameterKey(safeParams);
  const cached = await readCache(key);
  if (cached)
    return {
      payload: cached.payload,
      cached: true,
      retrievedAt: cached.retrievedAt,
    };
  const existing = inFlight.get(key);
  if (existing) return existing.then((result) => ({ ...result, cached: true }));
  const promise = withSearchSlot(async () => {
    context.signal?.throwIfAborted();
    const reserved = await reserveSearch(
      context.sessionId,
      context.runId,
      engine,
      key,
    );
    const client = new Client({ name: BRAND.slug, version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(
      new URL("https://mcp.serpapi.com/mcp"),
      {
        requestInit: {
          headers: { Authorization: `Bearer ${config.serpapiKey()}` },
        },
        reconnectionOptions: {
          maxRetries: 0,
          initialReconnectionDelay: 1000,
          maxReconnectionDelay: 1000,
          reconnectionDelayGrowFactor: 1,
        },
      },
    );
    try {
      await client.connect(transport, {
        timeout: 15000,
        signal: context.signal,
      });
      const response = await client.callTool(
        { name: "search", arguments: { params: safeParams, mode: "complete" } },
        undefined,
        { timeout: 55000, signal: context.signal },
      );
      const structured = response.structuredContent as
        { result?: unknown } | undefined;
      const content = Array.isArray(response.content)
        ? (response.content as { type: string; text?: string }[])
        : [];
      const raw =
        structured?.result ??
        content
          .filter((item) => item.type === "text")
          .map((item) => item.text ?? "")
          .join("\n");
      if (response.isError)
        throw new Error(
          typeof raw === "string"
            ? raw
            : "SerpApi could not retrieve this source.",
        );
      const payload = cleanSnapshot(
        typeof raw === "string" ? JSON.parse(raw) : raw,
      ) as Record<string, unknown>;
      if (!payload || typeof payload !== "object")
        throw new Error("SerpApi returned an unsupported response format.");
      if (payload.error) throw new Error(String(payload.error));
      const ttl =
        engine === "google_news" || engine === "google_jobs" ? 900 : 3600;
      if (!context.ephemeral)
        await writeCache(key, engine, safeParams, payload, ttl);
      await finishRequest(reserved, "success");
      return { payload, cached: false, retrievedAt: new Date().toISOString() };
    } catch (error) {
      await finishRequest(
        reserved,
        context.signal?.aborted ? "cancelled" : "error",
      );
      throw error;
    } finally {
      await client.close().catch(() => {});
    }
  });
  inFlight.set(key, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(key);
  }
}
