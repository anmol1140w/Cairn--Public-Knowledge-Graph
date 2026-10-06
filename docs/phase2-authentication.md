# Phase 2 authentication and account storage

Phase 2 replaces the anonymous UUID cookie with Google OAuth through Auth.js
and makes persisted investigations account-owned.

## Authentication boundary

- Auth.js v5 uses the PostgreSQL database session strategy and Google as the
  only provider.
- PKCE, state and nonce checks are enabled for the OAuth flow. Auth.js keeps
  the short-lived verification values in protected cookies.
- `AUTH_URL` is the canonical application origin. The redirect callback accepts
  only that origin plus origins explicitly listed in
  `AUTH_ALLOWED_REDIRECT_ORIGINS`.
- `AUTH_SECRET`, `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` are server-only.
  Production must use secure cookies; `AUTH_TRUST_HOST=true` is required only
  when a deployment proxy is trusted to provide the host headers.
- `/api/me` reports the current account without exposing provider tokens.
  Auth.js handles session rotation and `/api/auth/signout` handles logout.
- `DELETE /api/me` removes the application account, its Auth.js user and its
  account-owned investigations. `DELETE /api/investigations/:id` removes one
  owned investigation. Shared source snapshots and global evidence records are
  retained because they are provider/cache records rather than profile data.
- There is no automatic destructive retention job in P0. Account owners have
  explicit per-investigation and whole-account deletion controls; legacy
  anonymous rows remain orphaned rather than being silently reassigned or
  deleted.

## Storage migration

`migrations/0002_auth_accounts.sql` adds Auth.js tables and nullable
`account_id` columns to queries, runs and search requests. Existing rows keep
their anonymous `session_id` and remain orphaned; the application never
reassigns them to a newly authenticated account. New live work requires a
signed-in account and writes only `account_id` ownership.

Run all migrations in order with:

```bash
npm run db:migrate
```

Google’s OAuth callback URL is:

```text
http://localhost:3000/api/auth/callback/google
```

Use the production origin for deployed environments. Keep OAuth credentials
and `AUTH_SECRET` in the ignored `.env.local` or the deployment secret store.

## API ownership rules

- Live search, details, pagination, history and non-demo exports require an
  authenticated account.
- A saved investigation is read or exported only when its `account_id` matches
  the current application account.
- Demo exports remain available without sign-in and make no provider calls.
- Profile-shaped runs without explicit save consent still avoid persistent
  investigation snapshots and caches; the account boundary does not change
  that privacy rule.

Verification includes redirect allowlist tests, a protected-history test,
profile persistence tests updated with an explicit auth fixture, the existing
unit/browser suites, the production build and the server-secret scan.
