<!-- brand:start -->
# Cairn

**Follow the evidence.**

Search research, jobs, news and patents. See the source behind every answer.
<!-- brand:end -->

Working-name status: `cairn.com` is occupied, and Cairn.info is a related academic platform. The user selected Cairn as a hackathon working name after reviewing this concern. See [the naming check](docs/name-check.md). Change `src/lib/brand.ts` and run `npm run brand:sync` to update generated branding.

An interactive, evidence-first application connecting research, researchers, institutions, news, patents, technologies, and opportunities. The homepage opens into a real React Three Fiber knowledge universe; the same records remain usable through a keyboard-accessible 2D graph and list.

## Run locally

Requirements: Node.js 22+, npm, and Docker (or a separately configured PostgreSQL instance).

```bash
npm install
# Configure .env.local using .env.example. Keep both API keys server-side.
npm run db:up
npm run db:migrate
npm run dev
```

Open **http://localhost:3000**. The application starts in clearly labelled demo mode. Use **Demo mode → Live search** to retrieve actual evidence.

The Docker database is isolated on `127.0.0.1:15432`, with a persistent volume. `npm run db:up` reads database configuration from `.env.local`; it does not send the search or model keys into the database container.

Production:

```bash
npm run build
npm start
```

Deploy with a Node-runtime host that supports streamed requests lasting up to five minutes. Configure `APP_HTTPS=true` for secure session cookies behind HTTPS. Run database migrations before accepting live searches.

## Exploration tools

- **Universe:** orbit, zoom, pan, hover, camera focus, spatial details, source highlighting, graph search, and connection isolation.
- **Scholar Space:** research timeline, topic clusters, author information, citation formatting, on-demand cited-by expansion, and research-gap investigations.
- **News Lens:** claim-specific supporting/conflicting/context labels and interpretation-based event deduplication.
- **Opportunity Radar:** role, location, remote, skill, experience, and available-deadline filters. Skill overlap is calculated only after the user enters their own skills.
- **Patent Explorer:** hexagonal nodes, inventors, assignees, date distinctions, patent details, and source-returned non-patent citations.
- **Timeline and comparison:** filters update the graph; comparison counts are explicitly scoped to the retrieved sample.
- **Evidence drawer:** source excerpts, URLs, dates, confidence explanations, conflicting records, and graph highlighting.
- **Accessibility:** high contrast, large text, reduced motion, structured screen-reader view, simplified-language live synthesis, and keyboard navigation. Mobile uses a reduced, readable 2D graph.
- **Recent investigations:** reopen PostgreSQL snapshots through the command center without making another search request. Records are scoped to an HTTP-only anonymous browser-session cookie.
- **Export:** Markdown, linked PDF, complete JSON, a ZIP of evidence/relationship/entity/claim CSVs, and source-linked citation lists.

Keyboard shortcuts: `/` search, `Cmd/Ctrl K` command center, `G` universe, `S` Scholar, `N` news, `J` opportunities, `P` patents, `T` timeline, `?` shortcuts, `Esc` close.

## Live architecture

```text
Next.js client + Zustand
       │ POST /api/search; streamed progress
       ▼
LangGraph (TypeScript)
Query Analyzer → Intent Router → Search Planner
       │
       ├─ Scholar ─┐
       ├─ Jobs ────┤  Official SerpApi MCP
       ├─ News ────┤  https://mcp.serpapi.com/mcp
       ├─ Patents ─┤  Server-side bearer authentication
       └─ Web ─────┘
       │
Normalizer → Entity Resolver → Relationship Extractor
       │
Evidence Ranker → Contradiction Candidates → Graph Builder
       │
Answer Generator → Quote / ID Validation → PostgreSQL
```

Query planning, extraction, and synthesis use Ollama Cloud. Normalization, deduplication, source identifiers, direct authorship/employer/assignee links, graph placement, and confidence caps use deterministic code.

### Model routing

| Environment variable | Default | Purpose |
|---|---|---|
| `OLLAMA_ROUTER_MODEL` | `nemotron-3-nano:30b` | Intent and source planning |
| `OLLAMA_EXTRACT_MODEL` | `gpt-oss:20b` | Source-grounded extraction |
| `OLLAMA_SYNTHESIS_MODEL` | `gpt-oss:120b` | Evidence-backed synthesis |
| `OLLAMA_COMPARE_MODEL` | `nemotron-3-super` | Comparison / conflict investigations |
| `OLLAMA_DEEP_MODEL` | `nemotron-3-ultra` | Explicitly requested deep investigations |
| `OLLAMA_SIMPLE_MODEL` | `gemma4:31b` | Simplified-language synthesis |

The cloud base URL is `https://ollama.com`. Cloud structured-output enforcement is currently unavailable, so the adapter uses JSON instructions, Zod validation, and at most one repair attempt. Validated model responses are cached for one hour. GPT-OSS requests use low reasoning effort.

### Actual SerpApi engines

- `google`, `google_scholar`, `google_jobs`, `google_news`, `google_patents` for initial search.
- `google_scholar_author` for author details.
- `google_scholar_cite` for bibliographic formatting, **not** citation-network discovery.
- `google_scholar` with a returned `cites` ID for cited-by expansion.
- `google_patents_details` with a returned patent ID for details and citations.
- `google_jobs_listing` only for its currently available employer ratings. Job descriptions and application links come from `google_jobs`.
- `google_trends` for explicitly requested relative search-interest context.
- `google_related_questions` with an actual returned next-page token for question expansion.

Jobs pagination uses `next_page_token`; deprecated `start`, `chips`, and remote-filter parameters are not sent. Additional pages are requested only by the user. Trends is labelled search interest, not research output.

### Evidence rules

- Generated claims require known source IDs **and a verbatim quotation for every supporting source**.
- Unmentioned entities, invalid quotations, unsupported URLs, and dangling relationships are rejected.
- High confidence is capped when independent **primary** confirmation is not established. Multiple secondary descriptions are not independent experimental validation. Confidence is qualitative, not a probability.
- AI-extracted associations use dashed edges and are distinguished from deterministically parsed authorship, employer, assignee, and returned citation relationships. Extracted entity mentions are labelled as such.
- Undated records stay undated. Publication year precision is preserved; a year is not rendered as an invented January 1 date.
- Repeated news events and papers sharing the same lead author are not automatically counted as independent confirmations.
- Summaries are assembled from validated claims. If synthesis fails, the source records remain available without substituted demo content.
- Missing affiliations, current vacancy status, deadlines, and methodology remain unestablished.
- Demo opportunities are explicitly illustrative and point to official opportunity portals, not fabricated vacancy URLs.

## Cost and credential controls

Both `SERPAPI_API_KEY` and `OLLAMA_API_KEY` live in the ignored `.env.local` file. Neither uses a `NEXT_PUBLIC_` prefix. MCP authentication uses headers; keys are redacted from diagnostic messages and cached snapshots.

Defaults:

- At most **5 initial search requests** per investigation, one per relevant/selected source family.
- At most **2 concurrent SerpApi requests** and **2 concurrent model calls**.
- **25 SerpApi attempts per UTC day**, enforced transactionally in PostgreSQL. Configure `SERPAPI_DAILY_BUDGET` for your subscription and deployment.
- News/jobs cache for 15 minutes; other source responses for one hour. SerpApi’s own cache is also enabled.
- In-flight identical search requests are deduplicated within the application process.
- Three new investigations per browser session per minute.
- Cancellation, upstream timeouts, partial-source errors, and server-only same-origin mutation endpoints.

SerpApi attempts are reserved before execution, so failed attempts conservatively count toward the application budget. This counter is not a claim about the provider’s exact billing. Normal automated tests make **no paid search requests**.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run verify:secrets
```

Unit tests cover normalization contracts, date precision, canonical source deduplication, provenance rejection, confidence caps, selective planning, and evidence-preserving exports. Browser tests cover the 3D/list transition, source panels, evidence highlighting, commands, exports, investigation modes, user-entered skill matching, mobile accessibility, timeline, comparison, empty states, and source failures.

An optional, explicitly manual live check:

```bash
# Requires the application to be running and both API keys configured.
npm run test:live
```

It selects only Scholar and News, permits at most two primary SerpApi attempts, validates the resulting graph references, and prints record/relationship/claim counts without printing credentials. It is excluded from the normal test suite.

## Main files

```text
src/components/knowledge-app.tsx    Immersive workspace and search states
src/components/graph/              3D universe and accessible SVG graph
src/components/results.tsx         Investigation modes and source records
src/components/panels.tsx          Spatial detail and evidence panels
src/components/modals.tsx          Commands, accessibility, exports, history
src/lib/                          Shared contracts, demo, state, graph helpers
src/server/agent.ts                LangGraph orchestration
src/server/serpapi.ts              Official MCP adapter and request budgets
src/server/ollama.ts               Cloud-model validation and caching
src/server/normalize.ts            Engine-specific normalization
src/server/graph-builder.ts        Provenance-aware entity/relationship graph
src/server/storage.ts              PostgreSQL caching and persistence
src/server/export.ts               Source-preserving report formats
src/app/api/                       Search, enrichment, pagination, history, export
migrations/                       Application evidence schema
```

Official references: [SerpApi MCP](https://serpapi.com/mcp), [SerpApi engines](https://serpapi.com/search-engine-apis), [Ollama Cloud](https://docs.ollama.com/cloud), [LangGraph](https://docs.langchain.com/oss/javascript/langgraph/overview).
