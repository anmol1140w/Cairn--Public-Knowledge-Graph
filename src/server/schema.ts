import {
  boolean,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const appUsers = pgTable("app_users", {
  id: uuid("id").primaryKey(),
  skills: jsonb("skills").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const queries = pgTable("queries", {
  id: uuid("id").primaryKey(),
  sessionId: uuid("session_id").notNull(),
  query: text("query").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const searchRuns = pgTable("search_runs", {
  id: uuid("id")
    .primaryKey()
    .references(() => queries.id),
  sessionId: uuid("session_id").notNull(),
  status: text("status").notNull(),
  investigation: jsonb("investigation"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const sourceSnapshots = pgTable("source_snapshots", {
  cacheKey: text("cache_key").primaryKey(),
  engine: text("engine").notNull(),
  parameters: jsonb("parameters").notNull(),
  payload: jsonb("payload").notNull(),
  retrievedAt: timestamp("retrieved_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
export const entities = pgTable("entities", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  attributes: jsonb("attributes").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const evidence = pgTable("evidence", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  source: text("source").notNull(),
  url: text("url").notNull(),
  record: jsonb("record").notNull(),
  retrievedAt: timestamp("retrieved_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const relationships = pgTable("relationships", {
  runId: uuid("run_id").notNull(),
  id: text("id").notNull(),
  sourceId: text("source_id").notNull(),
  targetId: text("target_id").notNull(),
  type: text("type").notNull(),
  evidenceIds: jsonb("evidence_ids").notNull(),
  inferred: boolean("inferred").default(false).notNull(),
});
