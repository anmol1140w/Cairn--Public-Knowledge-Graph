import { readFile } from "node:fs/promises";
import pg from "pg";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

if (!process.env.DATABASE_URL)
  throw new Error("Set DATABASE_URL before running migrations.");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const sql = await readFile(
    new URL("../migrations/0001_evidence.sql", import.meta.url),
    "utf8",
  );
  await pool.query(sql);
  const saver = new PostgresSaver(pool);
  await saver.setup();
  console.info("Evidence schema and LangGraph checkpoints are ready.");
} finally {
  await pool.end();
}
