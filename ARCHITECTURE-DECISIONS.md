# Cairn architecture decisions

**Status:** Phase 0 proposal — approval required before Phase 2 authentication.

Promise protected by every decision: **Follow every answer back to its evidence — and see what remains unknown.**

| ID | Decision | Phase 0 proposal | Status / consequence |
| --- | --- | --- | --- |
| D1 | Sign-in | OAuth/OIDC through a trusted provider/library using PKCE, state and nonce protection. Do not implement passwords. Provider choice remains open: Google, GitHub or an organization-hosted OIDC provider. | **Needs approval and provider selection.** Blocks authentication. |
| D2 | Investigation storage | Browser-owned investigation state for P0. Keep server-side provider cache, transactional usage accounting and short-lived LangGraph execution state as infrastructure; do not make server history the product source of truth until sharing is designed. | **Needs approval.** This is a migration from the current anonymous PostgreSQL history. Existing rows must remain readable during migration and must not be overwritten. |
| D3 | Live progress | Server-sent events. The current live route already streams stage/source/result events; client timers remain demo-only and must not represent live progress. | **Proposed default; no gate blocker.** |
| D4 | Mode tabs | Clean investigation workspace per mode: Explore, Scholar, News, Jobs and Patents. Auto is a source-selection strategy, not a sixth mode. Existing evidence is not filtered into another mode. | **Proposed default; blocks mode-isolation implementation.** |
| D5 | Mobile graph gestures | Tap Activate viewer, then one-finger rotate/pan; page scrolling remains normal before activation; Esc/Done releases focus. List is always one action away. | **Proposed default; current implementation is close and will be hardened.** |
| D6 | Unknown | Unknown is a state, not a confidence rank. Claims with invalid evidence/quotes go to Still unknown and are not presented as Weak. | **Proposed default; blocks confidence-engine refactor.** |
| D7 | Onboarding | Six skippable steps: ask, choose sources, follow evidence, inspect a claim, understand uncertainty, decide next action. | **Proposed default.** |
| D8 | Theme | Light on first use, then remember the user’s choice; retain dark theme and accessibility settings. | **Already implemented locally; account-scoped persistence waits for auth.** |
| D9 | Sharing | Logged-in users only for P0. Sharing is deferred until storage/auth decisions are approved; any future link must be read-only, consented, unguessable, expiring/revocable, noindex and profile-free. | **Deferred / needs approval when sharing starts.** |

## Hackathon wedge

Scholar and News are the primary public-interest demo journey: question → sources → evidence graph → claim → exact quote → confidence → unknowns → export. Jobs and Patents remain extensions of the same evidence system. The preloaded examples remain offline and historical/curated.

## Approval requested

Before Phase 2, please confirm:

1. D1 provider: Google, GitHub, or a specific hosted/OIDC provider.
2. D2: browser-owned investigations for P0, with PostgreSQL limited to infrastructure and legacy compatibility; or server-owned investigations with ownership checks.
3. The proposed defaults for D3–D9.
