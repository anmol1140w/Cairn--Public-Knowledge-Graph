import type { ConfidenceLevel, Investigation } from "./types";

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  high: "Strong",
  medium: "Moderate",
  low: "Weak",
  insufficient: "Weak",
};
export function evidenceStrength(run: Investigation, evidenceId: string) {
  const claims = run.claims.filter(
    (claim) =>
      claim.evidenceIds.includes(evidenceId) ||
      claim.conflictingEvidenceIds.includes(evidenceId),
  );
  const weights = { high: 3, medium: 2, low: 1, insufficient: 0 };
  const level = claims.length
    ? claims.reduce(
        (weakest, claim) =>
          weights[claim.confidence] < weights[weakest]
            ? claim.confidence
            : weakest,
        claims[0].confidence,
      )
    : "insufficient";
  return {
    label: CONFIDENCE_LABELS[level],
    width: level === "high" ? 100 : level === "medium" ? 60 : 25,
    reason: claims.length
      ? claims.map((claim) => claim.rationale).join(" ")
      : "No claim has been established from this record. Open its source and excerpt to assess it.",
  };
}
