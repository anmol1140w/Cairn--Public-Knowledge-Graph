import { COPY } from "./copy";
import type { Claim, ClaimState, ConfidenceLevel, Investigation } from "./types";

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  high: "Strong",
  medium: "Moderate",
  low: "Weak",
  // Kept for investigations saved before the explicit Unknown state existed.
  insufficient: "Still unknown",
};

export function claimState(claim: Claim): ClaimState {
  if (claim.state) return claim.state;
  if (claim.confidence === "insufficient") return "unknown";
  if (claim.conflictingEvidenceIds.length) return "conflicted";
  return "supported";
}

export function claimAssessment(claim: Claim) {
  const state = claimState(claim);
  const label =
    state === "unknown"
      ? COPY.assessment.unknown
      : state === "conflicted"
        ? COPY.assessment.conflicted
        : CONFIDENCE_LABELS[claim.confidence];
  const width =
    state === "unknown"
      ? 12
      : state === "conflicted"
        ? 35
        : claim.confidence === "high"
          ? 100
          : claim.confidence === "medium"
            ? 60
            : 25;
  const reasons = (claim.reasonCodes ?? [])
    .map((code) => COPY.reason[code]?.why)
    .filter(Boolean);
  return {
    state,
    label,
    width,
    reason: [claim.rationale, ...reasons].filter(Boolean).join(" "),
    whatWouldRaiseConfidence:
      claim.whatWouldRaiseConfidence ??
      (claim.reasonCodes?.[0]
        ? COPY.reason[claim.reasonCodes[0]].raise
        : "Open the original source and check the surrounding context."),
  };
}

export function evidenceStrength(run: Investigation, evidenceId: string) {
  const claims = run.claims.filter(
    (claim) =>
      claim.evidenceIds.includes(evidenceId) ||
      claim.conflictingEvidenceIds.includes(evidenceId),
  );
  if (!claims.length)
    return {
      label: "Still unknown",
      width: 12,
      reason:
        "No assessed claim has been established from this record. Open its source and excerpt to assess it.",
    };
  const assessments = claims.map(claimAssessment);
  const unknown = assessments.find((assessment) => assessment.state === "unknown");
  if (unknown) return unknown;
  const conflicted = assessments.find(
    (assessment) => assessment.state === "conflicted",
  );
  if (conflicted) return conflicted;
  const weights = { high: 3, medium: 2, low: 1, insufficient: 0 };
  const weakest = claims.reduce(
    (current, claim) =>
      weights[claim.confidence] < weights[current.confidence] ? claim : current,
    claims[0],
  );
  return claimAssessment(weakest);
}
