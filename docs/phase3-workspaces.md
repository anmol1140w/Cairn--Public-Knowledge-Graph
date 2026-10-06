# Phase 3 mode workspaces and race protection

Each Cairn mode now owns a complete workspace snapshot: investigation run,
query, source selection, filters, selection/focus, progress state, errors and
camera reset state. Switching Explore, Scholar, News, Jobs or Patents loads
that mode's workspace instead of filtering or reusing another mode's evidence.

The client also tracks a request token, mode and workspace generation. Search
responses are applied only when all three still match. The guard covers:

- demo progress timers;
- live SSE stage/source/result events;
- source-detail enrichment;
- citation expansion; and
- paginated source records.

Touch scrolling remains page-owned until the explicit Activate viewer control
is used. Mouse/pen graph interaction can still activate the viewer directly.

`tests/mode-isolation.test.ts` now passes as a regression test, and
`tests/request-generation.test.ts` covers stale-token, stale-mode and stale-
generation rejection.
