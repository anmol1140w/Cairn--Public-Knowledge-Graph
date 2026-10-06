CREATE TABLE IF NOT EXISTS auth_users (
  id text PRIMARY KEY,
  name text,
  email text UNIQUE,
  email_verified timestamptz,
  image text
);

CREATE TABLE IF NOT EXISTS auth_accounts (
  user_id text NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  type text NOT NULL,
  provider text NOT NULL,
  provider_account_id text NOT NULL,
  refresh_token text,
  access_token text,
  expires_at integer,
  token_type text,
  scope text,
  id_token text,
  session_state text,
  PRIMARY KEY (provider, provider_account_id)
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  session_token text PRIMARY KEY,
  user_id text NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  expires timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_verification_tokens (
  identifier text NOT NULL,
  token text NOT NULL,
  expires timestamptz NOT NULL,
  PRIMARY KEY (identifier, token)
);

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS auth_user_id text REFERENCES auth_users(id) ON DELETE CASCADE;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS image text;
DROP INDEX IF EXISTS app_users_auth_user_idx;
CREATE UNIQUE INDEX app_users_auth_user_idx ON app_users(auth_user_id);

ALTER TABLE queries ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES app_users(id) ON DELETE CASCADE;
ALTER TABLE queries ALTER COLUMN session_id DROP NOT NULL;
ALTER TABLE search_runs ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES app_users(id) ON DELETE CASCADE;
ALTER TABLE search_runs ALTER COLUMN session_id DROP NOT NULL;
ALTER TABLE search_requests ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES app_users(id) ON DELETE CASCADE;
ALTER TABLE search_requests ALTER COLUMN session_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS queries_account_idx ON queries(account_id, created_at);
CREATE INDEX IF NOT EXISTS search_runs_account_idx ON search_runs(account_id, created_at);
CREATE INDEX IF NOT EXISTS search_requests_account_idx ON search_requests(account_id, created_at);
