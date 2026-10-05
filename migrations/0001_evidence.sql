CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY,
  skills jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS queries (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL,
  query text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS search_runs (
  id uuid PRIMARY KEY REFERENCES queries(id),
  session_id uuid NOT NULL,
  status text NOT NULL,
  investigation jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS search_runs_session_idx ON search_runs(session_id, created_at);
CREATE TABLE IF NOT EXISTS source_snapshots (
  cache_key text PRIMARY KEY,
  engine text NOT NULL,
  parameters jsonb NOT NULL,
  payload jsonb NOT NULL,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS search_requests (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL,
  run_id uuid,
  engine text NOT NULL,
  cache_key text NOT NULL,
  state text NOT NULL DEFAULT 'reserved',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS search_requests_date_idx ON search_requests(created_at);
CREATE TABLE IF NOT EXISTS entities (
  id text PRIMARY KEY,
  type text NOT NULL,
  title text NOT NULL,
  attributes jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS evidence (
  id text PRIMARY KEY,
  type text NOT NULL,
  title text NOT NULL,
  source text NOT NULL,
  url text NOT NULL,
  record jsonb NOT NULL,
  retrieved_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS relationships (
  run_id uuid NOT NULL REFERENCES search_runs(id),
  id text NOT NULL,
  source_id text NOT NULL,
  target_id text NOT NULL,
  type text NOT NULL,
  evidence_ids jsonb NOT NULL,
  inferred boolean NOT NULL DEFAULT false,
  PRIMARY KEY (run_id, id)
);
CREATE TABLE IF NOT EXISTS claims (
  run_id uuid NOT NULL REFERENCES search_runs(id),
  id text NOT NULL,
  text text NOT NULL,
  confidence text NOT NULL,
  rationale text NOT NULL,
  PRIMARY KEY (run_id, id)
);
CREATE TABLE IF NOT EXISTS claim_evidence (
  run_id uuid NOT NULL,
  claim_id text NOT NULL,
  evidence_id text NOT NULL,
  stance text NOT NULL,
  PRIMARY KEY (run_id, claim_id, evidence_id),
  FOREIGN KEY (run_id, claim_id) REFERENCES claims(run_id, id)
);
