import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const appUsers = pgTable("app_users", {
  id: uuid("id").primaryKey(),
  authUserId: text("auth_user_id").unique(),
  name: text("name"),
  email: text("email"),
  image: text("image"),
  skills: jsonb("skills").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const queries = pgTable("queries", {
  id: uuid("id").primaryKey(),
  accountId: uuid("account_id").references(() => appUsers.id, {
    onDelete: "cascade",
  }),
  sessionId: uuid("session_id"),
  query: text("query").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const searchRuns = pgTable("search_runs", {
  id: uuid("id")
    .primaryKey()
    .references(() => queries.id),
  accountId: uuid("account_id").references(() => appUsers.id, {
    onDelete: "cascade",
  }),
  sessionId: uuid("session_id"),
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

// Auth.js tables use their own text identifiers. app_users remains the
// application account table so legacy anonymous UUID rows can stay orphaned
// without being mistaken for a signed-in account.
export const authUsers = pgTable("auth_users", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  image: text("image"),
  legalAcceptedAt: timestamp("legal_accepted_at", { withTimezone: true }),
  termsVersion: text("terms_version"),
  privacyVersion: text("privacy_version"),
});
export const pendingGoogleSignIns = pgTable("pending_google_signins", {
  tokenHash: text("token_hash").primaryKey(),
  providerAccountId: text("provider_account_id").notNull(),
  name: text("name"),
  email: text("email").notNull(),
  image: text("image"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
export const authAccounts = pgTable(
  "auth_accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compositePk: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  }),
);
export const authSessions = pgTable("auth_sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});
export const authVerificationTokens = pgTable(
  "auth_verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (token) => ({
    compositePk: primaryKey({ columns: [token.identifier, token.token] }),
  }),
);
