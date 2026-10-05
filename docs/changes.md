# Cairn renovation change list

The seven phases cover branding, readability, professional themes/layout, focus-safe controls, graph behaviour/performance, optional profiles/privacy, and offline examples/verification/documentation.

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

## Verification

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

Checks include brand synchronization, ESLint, TypeScript, offline unit/integration and Chromium browser tests, WCAG AA automated audits, a production build, browser-asset secret scanning and screenshot generation. Browser tests use port 3100 and `.next-tests`; screenshots use port 3101. Both use preloaded/mock data and make no paid search/model requests.

## Remaining limits

- Cairn remains an accepted working name. Official trademark clearance is unresolved.
- Missing evidence stays missing: actual job eligibility, unreturned patent status/differences, full-paper summaries and glossary definitions are not invented.
- Local résumé import supports `.txt`; PDF/DOCX parsing and cloud résumé upload are not implemented.
- Automated browser verification uses Chromium, including emulated touch. Firefox, Safari and physical multi-touch/GPU devices need their own validation.
- The renovation has not made a new paid live-provider smoke request. The manual `npm run test:live` command remains available separately.
