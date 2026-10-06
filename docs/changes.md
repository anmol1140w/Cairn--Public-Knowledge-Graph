# Cairn renovation change list

The renovation phases cover branding, readability, professional themes/layout, focus-safe controls, graph behaviour/performance, optional profiles/privacy, offline examples/verification/documentation, and account authentication/ownership.

## Branding and project configuration

- `src/lib/brand.ts`
- `src/components/brand-mark.tsx`
- `src/app/icon.svg`
- `scripts/brand-sync.mjs`
- `docs/name-check.md`
- `package.json`
- `package-lock.json`
- `eslint.config.mjs`
- `next.config.ts`
- `playwright.config.ts`
- `tsconfig.json`
- `.gitignore`

## Workspace, typography and evidence presentation

- `src/app/layout.tsx`
- `src/app/globals.css`
- `src/components/knowledge-app.tsx`
- `src/components/results.tsx`
- `src/components/panels.tsx`
- `src/components/modals.tsx`
- `src/lib/confidence.ts`
- `src/lib/store.ts`
- `src/lib/types.ts`

## Explorer controls, layout and renderers

- `src/components/graph/explorer.tsx`
- `src/components/graph/flat-graph.tsx`
- `src/components/graph/universe.tsx`
- `src/lib/explorer-store.ts`
- `src/lib/graph-layout.ts`

## Optional profiles, query planning and persistence

- `src/components/profile-form.tsx`
- `src/components/profile-results.tsx`
- `src/lib/profiles.ts`
- `src/lib/profile-fields.ts`
- `src/lib/profile-store.ts`
- `src/lib/personalization.ts`
- `src/lib/use-search.ts`
- `src/server/agent.ts`
- `src/server/planner.ts`
- `src/server/validation.ts`
- `src/server/ollama.ts`
- `src/server/serpapi.ts`
- `src/server/storage.ts`
- `src/server/export.ts`
- `src/app/api/search/route.ts`
- `src/app/api/details/route.ts`
- `src/app/api/more/route.ts`
- `src/app/api/export/route.ts`

## Examples, documentation and screenshots

- `src/lib/demo.ts`
- `src/lib/examples.ts`
- `README.md`
- `docs/demo-sources.md`
- `docs/changes.md`
- `scripts/capture.mjs`
- `docs/screenshots/cairn-1440-light.png`
- `docs/screenshots/cairn-1440-dark.png`
- `docs/screenshots/cairn-390-light.png`
- `docs/screenshots/cairn-390-profile.png`
- `docs/screenshots/cairn-evidence.png`

## Authentication and account ownership

- `auth.ts`
- `src/server/auth.ts`
- `src/server/auth-redirect.ts`
- `src/server/schema.ts`
- `src/server/storage.ts`
- `src/components/account-control.tsx`
- `src/app/api/auth/[...nextauth]/route.ts`
- `src/app/api/me/route.ts`
- `src/app/api/investigations/route.ts`
- `src/app/api/investigations/[id]/route.ts`
- `migrations/0002_auth_accounts.sql`
- `docs/phase2-authentication.md`
- `tests/auth.test.ts`
- `tests/api-auth-boundary.test.ts`

## Verification

Public deployment policies and registration acceptance:
`src/app/privacy/page.tsx`, `src/app/terms/page.tsx`,
`src/app/signin/`, `src/app/auth/consent/page.tsx`,
`src/app/api/account/accept/route.ts`, `src/components/public-page.tsx`,
`src/components/consent-form.tsx`, `src/lib/legal.ts`,
`src/server/legal-consent.ts`, `src/server/auth-cookies.ts`,
`migrations/0003_legal_acceptance.sql` and `docs/legal-registration.md`.
Tests: `tests/legal-consent.test.ts`,
`tests/legal-consent.integration.test.ts`, `tests/e2e/legal.spec.ts` and
`tests/e2e/legal-consent-db.spec.ts`.

- `tests/evidence.test.ts`
- `tests/graph-layout.test.ts`
- `tests/profiles.test.ts`
- `tests/profile-privacy.test.ts`
- `tests/examples.test.ts`
- `tests/e2e/workspace.spec.ts`
- `tests/e2e/readability.spec.ts`
- `tests/e2e/theme.spec.ts`
- `tests/e2e/explorer.spec.ts`
- `tests/e2e/profiles.spec.ts`
- `tests/e2e/acceptance.spec.ts`

Phase 1 foundations: `scripts/check-contrast.mjs`, `src/lib/copy.ts`, `tests/helpers/browser.ts`, `docs/phase1-foundations.md`, and the added design tokens/shared contracts in `src/app/globals.css` and `src/lib/types.ts`.

Phase 2 authentication: Google OAuth/Auth.js database sessions, PKCE/state/nonce checks, redirect allowlists, account-owned live investigations, per-investigation/account deletion, protected history/enrichment/export APIs, and demo-compatible signed-out behavior are documented in `docs/phase2-authentication.md`.

Phase 3 workspaces: `docs/phase3-workspaces.md` covers per-mode state, stale-response guards, and the explicit mobile viewer activation boundary.

Phase 4 assessment: `docs/phase4-evidence-assessment.md` covers structured source metadata, quote-only grounding, independence/conflict reason codes, and the separate Still unknown state.

Phase 5 live resilience: `docs/phase5-live-resilience.md` covers source timing/cache metadata, stale-cache fallback, partial provider failures, and visible daily usage.

Phase 6 hardening: `docs/phase6-experience-hardening.md` covers the six-step onboarding guide, privacy boundaries, deletion/export behavior, and deferred sharing.

Checks include brand synchronization, ESLint, TypeScript, offline unit/integration and Chromium browser tests, WCAG AA automated audits, a production build, browser-asset secret scanning and screenshot generation. Browser tests use port 3100 and `.next-tests`; screenshots use port 3101. Both use preloaded/mock data and make no paid search/model requests. The mode-isolation characterization is now passing rather than expected-failing.

## Remaining limits

- Cairn remains an accepted working name. Official trademark clearance is unresolved.
- Missing evidence stays missing: actual job eligibility, unreturned patent status/differences, full-paper summaries and glossary definitions are not invented.
- Local résumé import supports `.txt`; PDF/DOCX parsing and cloud résumé upload are not implemented.
- Automated browser verification uses Chromium, including emulated touch. Firefox, Safari and physical multi-touch/GPU devices need their own validation.
- The renovation has not made a new paid live-provider smoke request. The manual `npm run test:live` command remains available separately.
