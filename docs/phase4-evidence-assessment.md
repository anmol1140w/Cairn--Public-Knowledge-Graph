# Phase 4 evidence assessment

Claims now carry an explicit assessment state in addition to qualitative
support level:

- `supported` — the available evidence passed grounding checks;
- `conflicted` — valid evidence supports and conflicts with the same claim;
- `unknown` — evidence IDs, exact quotes or required checks were incomplete.

Unknown is not rendered as Weak. Claims with invalid IDs or quotations remain
visible in the **Still unknown** section with the source records that could be
verified and a reason for what would raise confidence.

Assessment metadata records:

- reason codes such as `SINGLE_SOURCE`, `INDEPENDENCE_UNCLEAR`,
  `CONFLICT_FOUND` and `NOT_RUN_CONFLICT_CHECK`;
- source-family and independent-source counts;
- conflict-check state;
- exact supporting/conflicting quotes; and
- the next evidence step that would raise confidence.

Live normalized records now retain a dedicated `excerpt` field and structured
source metadata. Quote validation checks the stored excerpt rather than a
composite title/metadata string. Existing saved investigations are normalized
conservatively when reopened so old claims cannot become stronger silently.
