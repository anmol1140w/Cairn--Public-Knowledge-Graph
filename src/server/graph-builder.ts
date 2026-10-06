import { createHash } from "node:crypto";
import type {
  Claim,
  ClaimState,
  ConflictCheckState,
  EntityType,
  Evidence,
  GraphEntity,
  ReasonCode,
  Relationship,
} from "@/lib/types";
import { COPY } from "@/lib/copy";

export interface ExtractedEntity {
  key: string;
  name: string;
  type: EntityType;
  evidenceIds: string[];
  mention: string;
  description: string;
}
export interface ExtractedRelation {
  sourceKey: string;
  targetKey: string;
  type: Relationship["type"];
  evidenceIds: string[];
  inferred: boolean;
  supportingQuote: string;
}
export interface Extraction {
  entities: ExtractedEntity[];
  relationships: ExtractedRelation[];
  clusters: { name: string; evidenceIds: string[] }[];
  newsEvents: { name: string; evidenceIds: string[] }[];
}
export type GroundedClaim = Claim & {
  supportingQuotes: { evidenceId: string; text: string }[];
  conflictingQuotes?: { evidenceId: string; text: string }[];
};
export const shortHash = (value: string) =>
  createHash("sha256").update(value).digest("hex").slice(0, 12);
const folded = (text: string) => text.replace(/\s+/g, " ").trim().toLowerCase();
export function evidenceText(item: Evidence): string {
  return [
    item.title,
    item.snippet,
    item.source,
    item.authors?.join(" "),
    JSON.stringify(item.metadata ?? {}),
  ]
    .filter(Boolean)
    .join("\n");
}
export function quoteText(item: Evidence): string {
  return item.excerpt ?? item.snippet ?? "";
}
export function quotedInEvidence(quote: string, item: Evidence): boolean {
  return (
    quote.trim().length >= 12 &&
    folded(quoteText(item)).includes(folded(quote))
  );
}
export function sourceFamily(item: Evidence): string {
  if (item.metadata?.event)
    return `event:${folded(String(item.metadata.event))}`;
  if (item.type === "paper" && item.authors?.length)
    return `research:${folded(item.authors[0])}`;
  if (item.type === "job" && item.metadata?.company)
    return `employer:${folded(String(item.metadata.company))}`;
  if (item.sourceRecord?.independenceGroup)
    return `source:${folded(item.sourceRecord.independenceGroup)}`;
  return new URL(item.url).hostname.replace(/^www\./, "");
}

export interface GroundingOptions {
  conflictCheck?: ConflictCheckState;
}

const legacyConfidence = (confidence: Claim["confidence"]) =>
  confidence === "insufficient" ? "low" : confidence;

function reasonRaise(reasonCodes: ReasonCode[]) {
  if (!reasonCodes.length)
    return "Continue checking the original sources and surrounding context.";
  return (
    COPY.reason[reasonCodes[0] ?? "NO_CONFIRMATION"]?.raise ??
    COPY.reason.NO_CONFIRMATION.raise
  );
}

export function assessClaim(
  claim: GroundedClaim,
  evidence: Evidence[],
  options: GroundingOptions = {},
): Claim {
  const map = new Map(evidence.map((item) => [item.id, item]));
  const evidenceIds = [...new Set(claim.evidenceIds.filter((id) => map.has(id)))];
  const conflictingEvidenceIds = [
    ...new Set(claim.conflictingEvidenceIds.filter((id) => map.has(id))),
  ];
  const supportingQuotes = (claim.supportingQuotes ?? []).filter(
    (quote) =>
      evidenceIds.includes(quote.evidenceId) &&
      quotedInEvidence(quote.text, map.get(quote.evidenceId)!),
  );
  const conflictingQuotes = (claim.conflictingQuotes ?? []).filter(
    (quote) =>
      conflictingEvidenceIds.includes(quote.evidenceId) &&
      quotedInEvidence(quote.text, map.get(quote.evidenceId)!),
  );
  const missingEvidence = claim.evidenceIds.some((id) => !map.has(id));
  const missingSupportingQuote = evidenceIds.some(
    (id) => !supportingQuotes.some((quote) => quote.evidenceId === id),
  );
  const missingConflictingQuote = conflictingEvidenceIds.some(
    (id) => !conflictingQuotes.some((quote) => quote.evidenceId === id),
  );
  const supporting = evidenceIds.map((id) => map.get(id)!);
  const families = new Set(supporting.map(sourceFamily));
  const independentFamilies = new Set(
    supporting
      .filter(
        (item) =>
          item.primary === true ||
          item.sourceRecord?.kind === "primary" ||
          item.sourceRecord?.kind === "official",
      )
      .map(sourceFamily),
  );
  const conflictCheck =
    options.conflictCheck ??
    claim.conflictCheck ??
    (conflictingEvidenceIds.length ? "found" : "not_run");
  const reasons = new Set<ReasonCode>(claim.reasonCodes ?? []);
  if (!evidenceIds.length || missingEvidence || missingSupportingQuote) {
    reasons.add("INCOMPLETE_EXCERPT");
    reasons.add("NO_CONFIRMATION");
  }
  if (conflictingEvidenceIds.length && missingConflictingQuote) {
    reasons.add("INCOMPLETE_EXCERPT");
    reasons.add("NO_CONFIRMATION");
  }
  if (families.size <= 1) reasons.add("SINGLE_SOURCE");
  if (independentFamilies.size < 2) reasons.add("INDEPENDENCE_UNCLEAR");
  if (conflictCheck === "not_run") reasons.add("NOT_RUN_CONFLICT_CHECK");
  if (conflictingEvidenceIds.length && !missingConflictingQuote)
    reasons.add("CONFLICT_FOUND");

  let state: ClaimState = claim.state ?? "supported";
  if (
    !evidenceIds.length ||
    missingEvidence ||
    missingSupportingQuote ||
    (conflictingEvidenceIds.length && missingConflictingQuote)
  )
    state = "unknown";
  else if (conflictingEvidenceIds.length && !missingConflictingQuote)
    state = "conflicted";
  const confidence = legacyConfidence(claim.confidence);
  const cappedConfidence =
    state === "unknown"
      ? "low"
      : state === "conflicted" && confidence === "high"
        ? "medium"
        : confidence === "high" &&
            (independentFamilies.size < 2 || conflictCheck !== "passed")
          ? "medium"
          : confidence;
  return {
    ...claim,
    evidenceIds,
    conflictingEvidenceIds,
    confidence: cappedConfidence,
    state,
    reasonCodes: [...reasons],
    sourceFamilyCount: families.size,
    independentSourceCount: independentFamilies.size,
    conflictCheck,
    whatWouldRaiseConfidence: reasonRaise([...reasons]),
    supportingQuotes,
    conflictingQuotes,
  };
}

export function capConfidence(claim: Claim, evidence: Evidence[]): Claim {
  return assessClaim(
    {
      ...claim,
      supportingQuotes: claim.supportingQuotes ?? [],
    },
    evidence,
  );
}
export function groundedClaims(
  claims: GroundedClaim[],
  evidence: Evidence[],
  options: GroundingOptions = {},
): Claim[] {
  return claims.map((claim) => assessClaim(claim, evidence, options));
}

export function buildGraph(
  query: string,
  evidence: Evidence[],
  extraction: Extraction,
): {
  entities: GraphEntity[];
  relationships: Relationship[];
  evidence: Evidence[];
} {
  const evidenceMap = new Map(evidence.map((e) => [e.id, e]));
  const entities: GraphEntity[] = [
    {
      id: "topic",
      type: "topic",
      title: query,
      label: query.length > 47 ? query.slice(0, 44) + "…" : query,
      subtitle: "Your evidence investigation",
      position: [0, 0, 0],
      evidenceIds: evidence.map((e) => e.id),
    },
  ];
  const relationships: Relationship[] = [];
  const keyMap = new Map<string, string>([["topic", "topic"]]);
  const addEdge = (
    source: string,
    target: string,
    type: Relationship["type"],
    evidenceIds: string[],
    inferred: boolean,
    explanation?: string,
  ) => {
    if (
      source === target ||
      !evidenceIds.length ||
      !evidenceIds.every((id) => evidenceMap.has(id))
    )
      return;
    const id = shortHash(`${source}:${target}:${type}`);
    if (!relationships.some((edge) => edge.id === id))
      relationships.push({
        id,
        source,
        target,
        type,
        evidenceIds,
        inferred,
        explanation,
      });
  };
  for (const item of evidence) {
    keyMap.set(item.id, item.id);
    const title = item.title.replace(/\s*\|.*$/, "");
    entities.push({
      id: item.id,
      type: item.type,
      title: item.title,
      label: title.length > 29 ? title.slice(0, 27) + "…" : title,
      subtitle: item.source,
      position: [0, 0, 0],
      evidenceIds: [item.id],
      metadata: item.metadata,
    });
    addEdge(
      "topic",
      item.id,
      "related_to",
      [item.id],
      true,
      "Retrieved for this query; relevance is not proof of a causal relationship.",
    );
    if (item.type === "paper") {
      const authors: { name?: string; authorId?: string; url?: string }[] =
        (item.metadata?.authors as
          { name?: string; authorId?: string; url?: string }[] | undefined) ??
        item.authors?.map((name) => ({ name })) ??
        [];
      for (const author of (authors ?? []).slice(0, 2)) {
        if (!author.name) continue;
        const id = `person-${shortHash(author.authorId ?? `${author.name}:${item.id}`)}`;
        const existing = entities.find((e) => e.id === id);
        if (existing) existing.evidenceIds.push(item.id);
        else
          entities.push({
            id,
            type: "person",
            title: author.name,
            label: author.name,
            subtitle: "Author · affiliation not assumed",
            position: [0, 0, 0],
            evidenceIds: [item.id],
            metadata: { authorId: author.authorId, profileUrl: author.url },
          });
        addEdge(id, item.id, "authored", [item.id], false);
      }
    }
    const organization =
      item.type === "job"
        ? item.metadata?.company
        : item.type === "patent"
          ? item.metadata?.assignee
          : undefined;
    if (organization && typeof organization === "string") {
      const id = `company-${shortHash(organization.toLowerCase())}`;
      const existing = entities.find((e) => e.id === id);
      if (existing) existing.evidenceIds.push(item.id);
      else
        entities.push({
          id,
          type: "company",
          title: organization,
          label: organization,
          subtitle: item.type === "job" ? "Listed employer" : "Patent assignee",
          position: [0, 0, 0],
          evidenceIds: [item.id],
        });
      addEdge(
        item.type === "job" ? id : item.id,
        item.type === "job" ? item.id : id,
        item.type === "job" ? "hiring_for" : "assigned_to",
        [item.id],
        false,
        item.type === "job"
          ? "Employer named in the retrieved listing; current vacancy status should be checked at the source."
          : undefined,
      );
    }
  }
  for (const candidate of extraction.entities.slice(0, 16)) {
    const ids = candidate.evidenceIds.filter((id) => evidenceMap.has(id));
    if (
      !ids.length ||
      !candidate.mention.trim() ||
      !folded(candidate.mention).includes(folded(candidate.name)) ||
      !ids.some((id) =>
        folded(evidenceText(evidenceMap.get(id)!)).includes(
          folded(candidate.mention),
        ),
      )
    )
      continue;
    const existing = entities.find(
      (e) =>
        e.type === candidate.type && folded(e.title) === folded(candidate.name),
    );
    const id =
      existing?.id ??
      `entity-${shortHash(`${candidate.type}:${candidate.name}:${ids.sort().join(",")}`)}`;
    keyMap.set(candidate.key, id);
    if (!existing)
      entities.push({
        id,
        type: candidate.type,
        title: candidate.name,
        label:
          candidate.name.length > 28
            ? candidate.name.slice(0, 26) + "…"
            : candidate.name,
        subtitle: "AI-extracted mention · inspect source",
        position: [0, 0, 0],
        evidenceIds: ids,
        metadata: { inferredEntity: true },
      });
  }
  for (const candidate of extraction.relationships) {
    const source = keyMap.get(candidate.sourceKey);
    const target = keyMap.get(candidate.targetKey);
    if (
      !source ||
      !target ||
      !candidate.evidenceIds.every((id) => evidenceMap.has(id))
    )
      continue;
    if (
      !candidate.evidenceIds.some((id) =>
        quotedInEvidence(candidate.supportingQuote, evidenceMap.get(id)!),
      )
    )
      continue;
    addEdge(
      source,
      target,
      candidate.type,
      candidate.evidenceIds,
      true,
      candidate.supportingQuote,
    );
  }
  // Attach isolated, source-grounded extracted entities to their evidence records.
  for (const entity of entities.filter(
    (e) => e.id !== "topic" && !evidenceMap.has(e.id),
  ))
    if (
      !relationships.some(
        (r) => r.source === entity.id || r.target === entity.id,
      )
    )
      for (const id of entity.evidenceIds.slice(0, 1))
        addEdge(id, entity.id, "related_to", [id], true);
  const updated = evidence.map((item) => {
    const cluster = extraction.clusters.find((c) =>
      c.evidenceIds.includes(item.id),
    );
    const event = extraction.newsEvents.find((c) =>
      c.evidenceIds.includes(item.id),
    );
    return {
      ...item,
      metadata: {
        ...item.metadata,
        ...(cluster ? { cluster: cluster.name } : {}),
        ...(event ? { event: event.name } : {}),
      },
    };
  });
  const counters: Partial<Record<EntityType, number>> = {};
  const angles: Record<EntityType, number> = {
    topic: 0,
    paper: 145,
    person: 178,
    institution: 110,
    company: 315,
    job: 345,
    news: 35,
    patent: 260,
    technology: 80,
    web: 55,
  };
  entities.forEach((entity) => {
    if (entity.type === "topic") return;
    const count = counters[entity.type] ?? 0;
    counters[entity.type] = count + 1;
    const angle =
      ((angles[entity.type] + ((count % 5) - 2) * 15) * Math.PI) / 180;
    const radius =
      2.7 +
      Math.floor(count / 5) * 1.55 +
      (entity.type === "person" || entity.type === "company" ? 1.5 : 0) +
      (count % 2) * 0.55;
    entity.position = [
      Math.cos(angle) * radius * 1.45,
      Math.sin(angle) * radius * 0.78,
      ((count % 3) - 1) * 0.35,
    ];
  });
  return { entities, relationships, evidence: updated };
}
