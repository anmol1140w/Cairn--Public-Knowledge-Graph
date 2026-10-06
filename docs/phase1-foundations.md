# Phase 1 foundations

Phase 1 is intentionally additive; it does not change the rendered workspace.

- `src/app/globals.css` now exposes shared spacing, radius, typography, motion, inferred, warning, error and success tokens for both themes.
- `scripts/check-contrast.mjs` checks twelve foreground/background token pairs in light and dark themes. `npm run contrast:check` runs it, and `prebuild` runs it before every production build.
- `src/lib/types.ts` now provides shared `Source`, `Edge`, `Confidence` and `ReasonCode` contracts alongside the existing investigation types.
- `src/lib/copy.ts` centralizes the trust promise, confidence explanations, privacy language and reason-code explanations for later phases.
- `tests/helpers/browser.ts` provides `loginAs`, recorded provider response routing, no-WebGL setup and a frozen clock for deterministic integration/browser tests.

Verification: contrast check, lint, typecheck and unit tests pass; the Phase 0 mode-isolation characterization remains the one expected failure until Phase 3 replaces the shared run state.
