# Cairn architecture decisions

**Status:** Approved on 6 October 2026; implementation may proceed.

Promise protected by every decision: **Follow every answer back to its evidence — and see what remains unknown.**

| ID | Decision | Phase 0 proposal | Status / consequence |
| --- | --- | --- | --- |
| D1 | Sign-in | Google OAuth through Auth.js. Do not implement passwords. Use PKCE, callback allowlists, state/nonce protection, server-only client secrets and secure production cookies. | **Approved. Blocks authentication implementation details only.** |
| D2 | Investigation storage | Server-owned PostgreSQL investigations scoped to the authenticated account. Existing anonymous session rows are legacy data and must not be overwritten; migration must preserve or explicitly orphan them. | **Approved. Requires ownership checks, account deletion and retention/deletion policy.** |
| D3 | Live progress | Server-sent events. The current live route already streams stage/source/result events; client timers remain demo-only and must not represent live progress. | **Approved.** |
| D4 | Mode tabs | Clean investigation workspace per mode: Explore, Scholar, News, Jobs and Patents. Auto is a source-selection strategy, not a sixth mode. Existing evidence is not filtered into another mode. | **Approved.** |
| D5 | Mobile graph gestures | Tap Activate viewer, then one-finger rotate/pan; page scrolling remains normal before activation; Esc/Done releases focus. List is always one action away. | **Approved.** |
| D6 | Unknown | Unknown is a state, not a confidence rank. Claims with invalid evidence/quotes go to Still unknown and are not presented as Weak. | **Approved.** |
| D7 | Onboarding | Six skippable steps: ask, choose sources, follow evidence, inspect a claim, understand uncertainty, decide next action. | **Approved.** |
| D8 | Theme | Light on first use, then remember the user’s choice; retain dark theme and accessibility settings. | **Approved.** |
| D9 | Sharing | Logged-in users only for P0. Sharing is deferred; any future link must be read-only, consented, unguessable, expiring/revocable, noindex and profile-free. | **Approved direction; sharing remains deferred.** |

## Hackathon wedge

Scholar and News are the primary public-interest demo journey: question → sources → evidence graph → claim → exact quote → confidence → unknowns → export. Jobs and Patents remain extensions of the same evidence system. The preloaded examples remain offline and historical/curated.

## Approval record

The user approved Google OAuth via Auth.js, server-owned per-account investigations, and the proposed D3–D9 defaults on 6 October 2026.
