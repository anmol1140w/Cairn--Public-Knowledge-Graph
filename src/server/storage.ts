import "server-only";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import * as schema from "./schema";
import { cleanSnapshot, config } from "./config";
import type { Investigation, UsageSummary } from "@/lib/types";

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
  allowExpired = false,
): Promise<{
  payload: Record<string, unknown>;
  retrievedAt: string;
  stale: boolean;
} | null> {
  const result = await pool().query(
    "SELECT payload, retrieved_at, expires_at FROM source_snapshots WHERE cache_key=$1 AND ($2::boolean OR expires_at > now())",
    [key, allowExpired],
  );
  return result.rows[0]
    ? {
        payload: result.rows[0].payload,
        retrievedAt: new Date(result.rows[0].retrieved_at).toISOString(),
        stale: new Date(result.rows[0].expires_at).valueOf() <= Date.now(),
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
  owner: { accountId: string },
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
      "INSERT INTO search_requests(id,account_id,session_id,run_id,engine,cache_key) VALUES($1,$2,$3,$4,$5,$6)",
      [id, owner.accountId, null, runId, engine, cacheKey],
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
export async function usageSnapshot(): Promise<UsageSummary> {
  return {
    dailyUsed: await dailyUsage(),
    dailyBudget: config.dailyBudget(),
    maxRequestsPerQuery: config.maxSearches(),
  };
}
export async function beginRun(id: string, accountId: string, query: string) {
  const recent = await pool().query(
    "SELECT count(*)::int AS n FROM search_runs WHERE account_id=$1 AND created_at > now()-interval '1 minute'",
    [accountId],
  );
  if (recent.rows[0].n >= 3)
    throw new Error(
      "Please give your current investigations a moment before starting another.",
    );
  await db().insert(schema.queries).values({ id, accountId, query });
  await db()
    .insert(schema.searchRuns)
    .values({ id, accountId, status: "running" });
}
export async function saveInvestigation(run: Investigation, accountId: string) {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const updated = await client.query(
      "UPDATE search_runs SET status=$3,investigation=$4 WHERE id=$1 AND account_id=$2",
      [
        run.id,
        accountId,
        run.evidence.length ? "complete" : "empty",
        JSON.stringify(run),
      ],
    );
    if (!updated.rowCount) throw new Error("Investigation ownership changed.");
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
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function failRun(id: string, accountId: string) {
  await pool().query(
    "UPDATE search_runs SET status='interrupted' WHERE id=$1 AND account_id=$2",
    [id, accountId],
  );
}
export async function finishSessionOnlyRun(id: string, accountId: string) {
  await pool().query(
    "UPDATE search_runs SET status='session-only' WHERE id=$1 AND account_id=$2",
    [id, accountId],
  );
}

export async function ensureApplicationAccount(input: {
  authUserId: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}) {
  const id = randomUUID();
  const result = await pool().query(
    `INSERT INTO app_users(id,auth_user_id,name,email,image)
     VALUES($1,$2,$3,$4,$5)
     ON CONFLICT (auth_user_id) DO UPDATE SET
       name=EXCLUDED.name,
       email=EXCLUDED.email,
       image=EXCLUDED.image
     RETURNING id,auth_user_id,name,email,image`,
    [
      id,
      input.authUserId,
      input.name ?? null,
      input.email ?? null,
      input.image ?? null,
    ],
  );
  if (!result.rows[0])
    throw new Error("The application account could not be created.");
  return result.rows[0] as {
    id: string;
    auth_user_id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
}

export async function ownsInvestigation(runId: string, accountId: string) {
  const result = await pool().query(
    "SELECT 1 FROM search_runs WHERE id=$1 AND account_id=$2",
    [runId, accountId],
  );
  return Boolean(result.rowCount);
}

export async function deleteInvestigation(runId: string, accountId: string) {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const owned = await client.query(
      "SELECT id FROM search_runs WHERE id=$1 AND account_id=$2 FOR UPDATE",
      [runId, accountId],
    );
    if (!owned.rowCount) {
      await client.query("ROLLBACK");
      return false;
    }
    await client.query("DELETE FROM claim_evidence WHERE run_id=$1", [runId]);
    await client.query("DELETE FROM claims WHERE run_id=$1", [runId]);
    await client.query("DELETE FROM relationships WHERE run_id=$1", [runId]);
    await client.query("DELETE FROM search_requests WHERE run_id=$1", [runId]);
    await client.query(
      "DELETE FROM search_runs WHERE id=$1 AND account_id=$2",
      [runId, accountId],
    );
    await client.query("DELETE FROM queries WHERE id=$1 AND account_id=$2", [
      runId,
      accountId,
    ]);
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteAccount(accountId: string, authUserId: string) {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const account = await client.query(
      "SELECT id FROM app_users WHERE id=$1 AND auth_user_id=$2 FOR UPDATE",
      [accountId, authUserId],
    );
    if (!account.rowCount) throw new Error("Application account not found.");
    await client.query(
      "DELETE FROM claim_evidence WHERE run_id IN (SELECT id FROM search_runs WHERE account_id=$1)",
      [accountId],
    );
    await client.query(
      "DELETE FROM claims WHERE run_id IN (SELECT id FROM search_runs WHERE account_id=$1)",
      [accountId],
    );
    await client.query(
      "DELETE FROM relationships WHERE run_id IN (SELECT id FROM search_runs WHERE account_id=$1)",
      [accountId],
    );
    await client.query("DELETE FROM search_requests WHERE account_id=$1", [
      accountId,
    ]);
    await client.query("DELETE FROM search_runs WHERE account_id=$1", [
      accountId,
    ]);
    await client.query("DELETE FROM queries WHERE account_id=$1", [accountId]);
    await client.query("DELETE FROM auth_users WHERE id=$1", [authUserId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
