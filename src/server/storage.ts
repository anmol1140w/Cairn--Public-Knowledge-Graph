import "server-only";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import * as schema from "./schema";
import { cleanSnapshot, config } from "./config";
import type { Investigation } from "@/lib/types";

const globalDb = globalThis as unknown as {
  pkgPool?: pg.Pool;
  pkgCheckpointer?: PostgresSaver;
};
export function pool() {
  if (!process.env.DATABASE_URL)
    throw new Error(
      "Live search needs DATABASE_URL. Start PostgreSQL and run the evidence migrations.",
    );
  return (globalDb.pkgPool ??= new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 8,
    connectionTimeoutMillis: 4000,
    idleTimeoutMillis: 30000,
  }));
}
export function db() {
  return drizzle(pool(), { schema });
}
export function checkpointer() {
  return (globalDb.pkgCheckpointer ??= new PostgresSaver(pool()));
}
export async function assertStorage() {
  try {
    await pool().query("SELECT 1 FROM source_snapshots LIMIT 1");
  } catch {
    throw new Error(
      "Evidence storage is unavailable. Start PostgreSQL and run npm run db:migrate, then retry live search.",
    );
  }
}
export async function readCache(
  key: string,
): Promise<{ payload: Record<string, unknown>; retrievedAt: string } | null> {
  const result = await pool().query(
    "SELECT payload, retrieved_at FROM source_snapshots WHERE cache_key=$1 AND expires_at > now()",
    [key],
  );
  return result.rows[0]
    ? {
        payload: result.rows[0].payload,
        retrievedAt: new Date(result.rows[0].retrieved_at).toISOString(),
      }
    : null;
}
export async function writeCache(
  key: string,
  engine: string,
  params: Record<string, unknown>,
  payload: Record<string, unknown>,
  ttlSeconds: number,
) {
  await pool().query(
    "INSERT INTO source_snapshots(cache_key,engine,parameters,payload,expires_at) VALUES($1,$2,$3,$4,now()+$5*interval '1 second') ON CONFLICT(cache_key) DO UPDATE SET payload=EXCLUDED.payload, retrieved_at=now(),expires_at=EXCLUDED.expires_at",
    [key, engine, params, cleanSnapshot(payload), ttlSeconds],
  );
}
export async function reserveSearch(
  sessionId: string,
  runId: string | null,
  engine: string,
  cacheKey: string,
): Promise<string> {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(702911)");
    const daily = await client.query(
      "SELECT count(*)::int AS n FROM search_requests WHERE created_at >= date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'",
    );
    if (daily.rows[0].n >= config.dailyBudget())
      throw new Error(
        `The app’s daily search budget (${config.dailyBudget()} requests) has been reached. Cached evidence and demo exploration remain available.`,
      );
    const id = randomUUID();
    await client.query(
      "INSERT INTO search_requests(id,session_id,run_id,engine,cache_key) VALUES($1,$2,$3,$4,$5)",
      [id, sessionId, runId, engine, cacheKey],
    );
    await client.query("COMMIT");
    return id;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function finishRequest(id: string, state: string) {
  await pool().query("UPDATE search_requests SET state=$2 WHERE id=$1", [
    id,
    state,
  ]);
}
export async function dailyUsage() {
  const result = await pool().query(
    "SELECT count(*)::int AS n FROM search_requests WHERE created_at >= date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'",
  );
  return Number(result.rows[0].n);
}
export async function beginRun(id: string, sessionId: string, query: string) {
  const recent = await pool().query(
    "SELECT count(*)::int AS n FROM search_runs WHERE session_id=$1 AND created_at > now()-interval '1 minute'",
    [sessionId],
  );
  if (recent.rows[0].n >= 3)
    throw new Error(
      "Please give your current investigations a moment before starting another.",
    );
  await db().insert(schema.queries).values({ id, sessionId, query });
  await db()
    .insert(schema.searchRuns)
    .values({ id, sessionId, status: "running" });
}
export async function saveInvestigation(run: Investigation, sessionId: string) {
  await db()
    .update(schema.searchRuns)
    .set({
      status: run.evidence.length ? "complete" : "empty",
      investigation: run,
    })
    .where(eq(schema.searchRuns.id, run.id));
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    for (const entity of run.entities)
      await client.query(
        "INSERT INTO entities(id,type,title,attributes) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET attributes=EXCLUDED.attributes,updated_at=now()",
        [entity.id, entity.type, entity.title, entity],
      );
    for (const item of run.evidence)
      await client.query(
        "INSERT INTO evidence(id,type,title,source,url,record) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET record=EXCLUDED.record,retrieved_at=now()",
        [item.id, item.type, item.title, item.source, item.url, item],
      );
    for (const edge of run.relationships)
      await client.query(
        "INSERT INTO relationships(run_id,id,source_id,target_id,type,evidence_ids,inferred) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING",
        [
          run.id,
          edge.id,
          edge.source,
          edge.target,
          edge.type,
          JSON.stringify(edge.evidenceIds),
          edge.inferred ?? false,
        ],
      );
    for (const claim of run.claims) {
      await client.query(
        "INSERT INTO claims(run_id,id,text,confidence,rationale) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
        [run.id, claim.id, claim.text, claim.confidence, claim.rationale],
      );
      for (const [stance, ids] of [
        ["supports", claim.evidenceIds],
        ["conflicts", claim.conflictingEvidenceIds],
      ] as const)
        for (const evidenceId of ids)
          await client.query(
            "INSERT INTO claim_evidence(run_id,claim_id,evidence_id,stance) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
            [run.id, claim.id, evidenceId, stance],
          );
    }
    await client.query(
      "INSERT INTO app_users(id) VALUES($1) ON CONFLICT DO NOTHING",
      [sessionId],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function failRun(id: string) {
  await pool().query(
    "UPDATE search_runs SET status='interrupted' WHERE id=$1",
    [id],
  );
}
export async function finishSessionOnlyRun(id: string) {
  await pool().query(
    "UPDATE search_runs SET status='session-only' WHERE id=$1",
    [id],
  );
}
