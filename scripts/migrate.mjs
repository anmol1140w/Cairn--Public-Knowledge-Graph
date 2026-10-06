import { readdir, readFile } from "node:fs/promises";
import pg from "pg";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

if (!process.env.DATABASE_URL)
  throw new Error("Set DATABASE_URL before running migrations.");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const migrationDir = new URL("../migrations/", import.meta.url);
  const migrations = (await readdir(migrationDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const migration of migrations)
    await pool.query(await readFile(new URL(migration, migrationDir), "utf8"));
  const saver = new PostgresSaver(pool);
  await saver.setup();
  console.info("Evidence schema and LangGraph checkpoints are ready.");
} finally {
  await pool.end();
}
