export const COPY = {
  promise: "Follow every answer back to its evidence — and see what remains unknown.",
  evidence: {
    strong: "Strong: independent primary sources directly support this claim and the conflict check was clean.",
    moderate: "Moderate: a primary source or related sources directly support this claim, but independent confirmation is limited.",
    weak: "Weak: this is a limited source, association or interpretation. Open the quote before relying on it.",
    unknown: "Still unknown: the available records do not provide a valid, verified basis for this statement.",
  },
  privacy: {
    browser: "Details stay in this browser tab unless you choose to save them with an investigation.",
    providers: "Only the question and the profile options you selected are sent to live providers for this investigation.",
    saved: "Saved investigations are stored on the server under your account and can be deleted from your account controls.",
  },
  reason: {
    SINGLE_SOURCE: { why: "Only one source supports this statement.", raise: "Find an independent primary source." },
    METADATA_ONLY: { why: "This comes from metadata rather than a directly stated passage.", raise: "Open a source excerpt that states the point." },
    ASSOCIATION: { why: "The relationship is an inferred association, not a source-stated fact.", raise: "Find a source that explicitly describes the relationship." },
    INCOMPLETE_EXCERPT: { why: "The available excerpt may omit important context.", raise: "Retrieve a fuller source passage." },
    INDEPENDENCE_UNCLEAR: { why: "The sources may share an author, publisher or underlying report.", raise: "Confirm independent primary sources." },
    ILLUSTRATIVE: { why: "This is a curated or illustrative record, not a current verified result.", raise: "Retrieve a current source record." },
    HISTORICAL: { why: "This record describes a historical event or publication.", raise: "Find a current record if current status matters." },
    NO_CONFIRMATION: { why: "Independent confirmation was not found in this investigation.", raise: "Search another relevant primary source family." },
    CONFLICT_FOUND: { why: "A source conflicts with this claim or its context.", raise: "Resolve the conflict with clearer primary evidence." },
    NOT_RUN_CONFLICT_CHECK: { why: "A conflict check did not complete.", raise: "Run the conflict check before considering Strong." },
  },
} as const;
