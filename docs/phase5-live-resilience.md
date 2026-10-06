# Phase 5 live resilience and source visibility

Live source progress remains real SSE. Each source status now records provider,
retrieval time, elapsed time, record count, cache state and stale-cache state.
The workspace exposes source health for every mode and shows the daily source
attempt budget for live investigations.

When a provider fails after a matching cached snapshot has expired, Cairn may
show that snapshot as **stale cache** rather than presenting it as current. The
source status and investigation warning explicitly say that freshness must be
checked at the original URL. Aborted requests never use the stale fallback.

Provider failures without a fallback remain partial source errors. Model
planning, extraction and synthesis failures retain deterministic fallback
behavior and preserve original source records. Search reservations still count
attempts against the configured maximum and UTC daily budget.
