# Phase 0 baseline — 6 October 2026

## Commands

The baseline was run from `/home/anmol/public-knowledge-graph` at `2026-10-06T05:24:43Z`.

| Command | Result |
| --- | --- |
| `npm run brand:check` | Pass — brand, README, package names and icon agree. Node emits the existing module-type warning. |
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| `npm test` | Pass — 30 tests: 29 passing and 1 expected failure. The Phase 0 mode-isolation characterization is an expected failure via `it.fails`. |
| `npm run test:e2e` | Pass — 18 browser tests |
| `npm run build` | Pass — Next.js 16.3.8 production build |
| `npm run verify:secrets` | Pass — 13 browser assets checked; no server keys bundled |

The command run also completed `npm run screenshots:baseline`, producing 40 deterministic screenshots under `docs/baseline/screenshots/`.

## Current architecture map

| Area | Current location | Finding |
| --- | --- | --- |
| Client state | `src/lib/store.ts`, `src/lib/profile-store.ts`, `src/lib/explorer-store.ts` | One persisted Zustand `KnowledgeState` has one `run` for all modes. Theme/accessibility persist in localStorage; optional profiles persist in tab `sessionStorage`. |
| Workspace | `src/components/knowledge-app.tsx` | Single client workspace with shared query, run, selection and filters. Mode changes clear some selection/filter fields but retain the evidence run. |
| Modes | `src/lib/types.ts`, `src/components/results.tsx` | Explore, Scholar, News, Jobs and Patents are UI modes. Auto is represented by an empty source selection, not a separate mode. |
| Search | `src/lib/use-search.ts`, `src/app/api/search/route.ts` | Demo uses bundled examples with a short client sequence; live uses SSE with real server events. An AbortController exists, but no request-generation guard protects against all late responses after mode changes. |
| Orchestration | `src/server/agent.ts` | LangGraph analyzer/router/planner/search/normalization/extraction/ranking/conflict/synthesis pipeline. Five-source initial cap and on-demand enrichment exist. |
| Providers | `src/server/serpapi.ts`, `src/server/ollama.ts` | Official SerpApi MCP and Ollama Cloud adapters. Caching, global concurrency limits and transactional daily search budget exist. |
| Evidence | `src/server/normalize.ts`, `src/server/graph-builder.ts` | IDs, URLs, quotes and relationships are checked. AI entities/associations are marked inferred. Current quote text is primarily title/snippet/metadata, not full-document text. |
| Confidence | `src/server/graph-builder.ts`, `src/lib/confidence.ts` | High is capped when primary source families or conflicts fail simple checks. There is no code-level conflict-check status, independence model, reason-code catalog or Unknown presentation state. |
| Graph | `src/components/graph/universe.tsx`, `flat-graph.tsx`, `explorer.tsx` | 3D, 2D and List are available; focus-safe scrolling, touch, fit, labels, reduced motion and instancing are covered. Actual/requested renderer state is not yet an explicit state machine for every fallback path. |
| Export | `src/app/api/export/route.ts`, `src/server/export.ts` | Markdown/PDF/JSON/CSV/citations exist. The route accepts a client-supplied investigation and has no authenticated ownership check. |
| Storage | `src/server/storage.ts`, `migrations/0001_evidence.sql` | Anonymous UUID cookie scopes PostgreSQL history, runs, cache and usage. There is no account, retention, deletion, backup or rollback policy. Profile-shaped unsaved runs still create a query/search-run row with `session-only` status. |
| API protection | `src/server/http.ts`, `src/app/api/**/route.ts` | Same-origin checks exist on mutation routes, but there is no authentication wrapper. Search, details, pagination, export and status are callable without a signed-in account; history uses a fresh anonymous session rather than 401. |
| Accessibility | `tests/e2e/readability.spec.ts`, `tests/e2e/acceptance.spec.ts` | Font minimum, text scaling, axe WCAG AA, keyboard, reduced motion, touch and mobile no-overflow coverage exist. |

## Route protection audit

Current route behaviour is anonymous-session based:

- `GET /api/status` creates an anonymous HTTP-only session cookie.
- `POST /api/search` accepts a fresh anonymous session and creates server rows when live search runs.
- `POST /api/details` and `POST /api/more` accept a fresh anonymous session and can use provider calls.
- `POST /api/export` does not call `session()` and exports any valid client-supplied investigation payload.
- `GET /api/investigations` returns an empty list for a fresh session rather than `401`.
- `GET /api/investigations/[id]` returns `404` for a fresh session rather than `401`; existing rows are scoped to the anonymous session ID.
- There are no `/api/me`, logout, OAuth callback, account deletion or investigation deletion routes.

This is the main Phase 2 security boundary and is intentionally not changed before D1/D2 approval.

## Confidence measurement

The bundled demo contains **5 claims**:

- Strong/high: **1**
- Moderate/medium: **4**
- Weak/low: **0**
- Unknown/insufficient: **0**

The Strong claim is capped by `capConfidence` using primary source-family count and absence of conflicting IDs. Moderate rationales currently represent single-primary support, related same-team sources, or interpretation/performance limits. There are no five recorded live runs in the repository, so a live Weak-reason distribution is **not measured**. This must be done with recorded provider fixtures or a separately reported manual run before changing thresholds.

Known policy gaps against the new plan:

1. `ConfidenceLevel` has `insufficient`, but the UI maps it to Weak rather than a separate Unknown state.
2. “Strong” does not require an explicit conflict check to have run and passed.
3. Source independence is approximated by hostname/event/first author rather than a structured independent/related/unclear result.
4. Quote verification normalizes whitespace and searches a composite evidence string including metadata; it is not yet restricted to a stored source-text field.
5. Claims do not expose reason codes, independent-source counts, what would raise confidence, or a Still unknown section.

## State-leak reproduction

`tests/mode-isolation.test.ts` contains an expected-failing characterization: put the Explore demo in `run`, switch to News, and assert that News starts with no evidence. It currently fails because `setMode()` changes mode/filters but retains `run`. This is the regression target for Phase 3.

## Screenshot inventory

The baseline matrix contains 40 flattened files:

```text
docs/baseline/screenshots/{light,dark}-{390,768,1024,1440}-{explore,scholar,news,jobs,patents}.png
```

The committed filenames use the flattened form `{theme}-{width}-{mode}.png` for simpler linking. They are generated with `npm run screenshots:baseline`, Chromium, reduced motion and `searchConfigured: false`; no live/provider requests are made.

## Unavailable evidence

- No recorded SerpApi/Ollama fixtures or five recorded live investigations exist in the repository.
- No real-provider call was made for this baseline.
- Browser checks use Chromium/emulated touch; physical multi-touch, Firefox and Safari are not covered.
- The existing user modification to `src/server/config.ts` was preserved; it adds friendly handling for JSON/validation model errors.
