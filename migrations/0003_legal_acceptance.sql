ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS legal_accepted_at timestamptz;
ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS terms_version text;
ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS privacy_version text;

-- Legacy accounts remain unaccepted until the owner explicitly agrees.
-- A pending verified identity is not an account and cannot access Live APIs.
CREATE TABLE IF NOT EXISTS pending_google_signins (
  token_hash text PRIMARY KEY,
  provider_account_id text NOT NULL,
  name text,
  email text NOT NULL,
  image text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pending_google_signins_expiry_idx ON pending_google_signins(expires_at);
