# Public policies and one-time registration acceptance

## Public pages

- Privacy Policy: `https://cairn-pkg.vercel.app/privacy`
- Terms of Service: `https://cairn-pkg.vercel.app/terms`
- Google sign-in entry: `/signin`
- Verified registration review: `/auth/consent`

The policy pages are public, statically rendered and linked from the workspace
footer. They describe the implemented account, provider, optional-profile,
retention and export behavior. `src/lib/legal.ts` owns the published versions,
update date and project contact link.

## New accounts

1. Google OAuth runs through Auth.js with its existing PKCE, state and nonce
   verification.
2. The `signIn` callback checks the linked Google identity's database receipt.
   An already-accepted account proceeds through normal Auth.js sign-in.
3. An unaccepted identity receives a ten-minute pending request and a protected,
   HTTP-only cookie. Its basic verified profile is temporarily stored in
   `pending_google_signins`. This creates no Auth.js user, application account
   or authenticated session, and stores no Google access/refresh tokens.
4. `/auth/consent` shows the verified account and an unchecked acceptance box,
   with bold links opening both documents in a new tab. Accept is disabled until
   checked; Cancel discards the pending request and returns to Demo.
5. A same-origin, CSRF-bound POST to `/api/account/accept` verifies explicit
   acceptance and the displayed versions. One transaction creates the user,
   Google account link, application account, receipt and Auth.js-compatible
   database session, then consumes the pending request.

Pending tokens are stored hashed, expire after ten minutes, and are consumed
once. Expired rows are removed when a new pending Google sign-in starts.
Concurrent attempts for the same Google identity are serialized. Matching email
addresses alone never link distinct Google identities. Auth.js adapter user
creation is blocked so a direct OAuth route cannot bypass the acceptance step.

## Stored receipt and returning users

`migrations/0003_legal_acceptance.sql` adds these columns to `auth_users`:

- `legal_accepted_at` — timestamp for the explicit combined agreement and
  privacy acknowledgement.
- `terms_version` — accepted Terms of Service version.
- `privacy_version` — acknowledged Privacy Policy version.

The receipt is account-owned and persists across sign-out, cleared browser data
and other devices. Later sign-ins do not overwrite it or repeat the prompt.
Updating published policy versions does not automatically require all existing
accounts to accept again; a form opened against an older current version must
be refreshed before a first acceptance can complete.

Legacy accounts are not silently marked accepted. Their next Google sign-in or
existing session can complete the same one-time step without replacing their
account or investigations. A legacy session without a receipt receives
`CONSENT_REQUIRED` from protected APIs, and the header links to **Complete
sign-in**. Application-account creation and Live access require recorded
acceptance. Account deletion removes the receipt with the Auth.js user.

## Deployment and verification

Apply all migrations to the deployment database **before** deploying this code:

```bash
npm run db:migrate
```

Keep the production `AUTH_URL` set to `https://cairn-pkg.vercel.app` and Google's
authorized callback set to
`https://cairn-pkg.vercel.app/api/auth/callback/google`.

Ordinary tests remain database-independent. Database integration and real-form
browser checks are opt-in with `CAIRN_TEST_DATABASE_URL`, using synthetic
Google-verified identity fixtures rather than contacting Google or paid search
and AI providers. The integration suite uses a disposable schema; browser tests
use unique fixture rows and delete them afterward. For the browser suite, point
the app's `DATABASE_URL` and the test URL at the same local/dedicated database,
apply migrations, and use `AUTH_URL=http://localhost:3100`, configured test OAuth
values and `APP_HTTPS=false` for its HTTP server.

```bash
npx vitest run tests/legal-consent.test.ts
npx vitest run tests/legal-consent.integration.test.ts
npx playwright test tests/e2e/legal.spec.ts tests/e2e/legal-consent-db.spec.ts
```

Coverage includes no account before acceptance, missing consent, forged CSRF,
expired/consumed requests, concurrent signup, identity-link conflicts, stored
versions/timestamps, compatible Auth.js sessions, legacy accounts, returning
users on another device, cancellation, bold policy links and accessibility.
