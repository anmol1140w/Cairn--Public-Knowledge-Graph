import type { Evidence, Investigation } from "./types";
import type { JobsProfile, Profile } from "./profiles";
export const sourceText = (e: Evidence) =>
  [
    e.title,
    e.snippet ?? "",
    ...(Array.isArray(e.metadata?.highlights)
      ? (e.metadata.highlights as { items?: string[] }[]).flatMap(
          (h) => h.items ?? [],
        )
      : []),
  ].join("\n");
export function quotedSentence(e: Evidence, term: string): string | undefined {
  const text = sourceText(e),
    index = text.toLowerCase().indexOf(term.toLowerCase());
  if (index < 0) return;
  const start =
    Math.max(text.lastIndexOf("\n", index), text.lastIndexOf(". ", index)) + 1;
  const newline = text.indexOf("\n", index),
    end = text.indexOf(". ", index);
  const stop = Math.min(
    ...[newline, end < 0 ? -1 : end + 1, text.length].filter((v) => v >= 0),
  );
  return text.slice(start, stop).trim();
}
export function jobRequirements(e: Evidence, profile: JobsProfile) {
  const highlights = Array.isArray(e.metadata?.highlights)
    ? (e.metadata.highlights as { title?: string; items?: string[] }[])
    : [];
  const qualifications = highlights
    .filter((h) => /qualification|requirement/i.test(h.title ?? ""))
    .flatMap((h) => h.items ?? []);
  const snippetRequirements = (e.snippet ?? "")
    .split(/(?<=[.!?])\s+/)
    .filter((text) =>
      /\brequire[sd]?\b|\bmust\b|\bqualifications\b/i.test(text),
    );
  const requirementText = [...qualifications, ...snippetRequirements];
  const skills = Array.isArray(e.metadata?.skills)
    ? e.metadata.skills.filter((s): s is string => typeof s === "string")
    : [];
  const rows = skills.flatMap((name) => {
    const quote = requirementText.find(
      (text) =>
        text.toLowerCase().includes(name.toLowerCase()) &&
        !/not required|optional|nice to have/i.test(text),
    );
    if (!quote) return [];
    const skill = profile.skills.find(
      (s) => s.name.toLowerCase() === name.toLowerCase(),
    );
    return [
      {
        label: name,
        status:
          skill && skill.level !== "Learning"
            ? "Meets listed skill"
            : skill
              ? "Learning"
              : "Missing skill",
        quote,
        evidenceId: e.id,
      },
    ];
  });
  for (const [index, quote] of requirementText.entries()) {
    if (/not required|optional|nice to have/i.test(quote)) continue;
    const years = quote.match(/(\d+)\s*\+?\s*years?/i);
    if (years)
      rows.push({
        label: `Experience requirement ${index + 1}`,
        status:
          profile.experience >= Number(years[1])
            ? "Meets stated experience"
            : "Experience gap",
        quote,
        evidenceId: e.id,
      });
    if (/degree|bachelor|master|ph\.?d|diploma/i.test(quote)) {
      const normalized = (text: string) =>
        text.toLowerCase().replace(/[’']/g, "");
      rows.push({
        label: `Education requirement ${index + 1}`,
        status:
          profile.qualification &&
          normalized(quote).includes(normalized(profile.qualification))
            ? "Meets stated qualification text"
            : "Qualification not assessed",
        quote,
        evidenceId: e.id,
      });
    }
  }
  const unknowns = [
    "Qualification",
    "Experience",
    "Salary",
    "Deadline",
    "Work authorization",
  ].map((label) => {
    const key = (
      {
        Qualification: "qualification",
        Experience: "experience",
        Salary: "salary",
        Deadline: "deadline",
        "Work authorization": "workAuthorization",
      } as Record<string, string>
    )[label];
    const stated = e.metadata?.[key];
    return {
      label,
      value:
        stated === undefined || stated === null || stated === ""
          ? "Not stated"
          : String(stated),
    };
  });
  return {
    rows,
    unknowns,
    met: rows.filter((r) => r.status.startsWith("Meets")).length,
    missing: rows
      .filter((r) => r.status === "Missing skill" || r.status === "Learning")
      .map((r) => r.label),
  };
}
export function rankEvidence(items: Evidence[], profile?: Profile) {
  if (!profile)
    return [...items].sort((a, b) => b.relevanceScore - a.relevanceScore);
  const filtered = items.filter((e) => {
    const timestamp = e.date ? Date.parse(e.date) : NaN;
    if (profile.mode === "scholar" && e.type === "paper") {
      const year = Number.isNaN(timestamp)
        ? undefined
        : new Date(timestamp).getUTCFullYear();
      if (
        year &&
        ((profile.yearFrom && year < profile.yearFrom) ||
          (profile.yearTo && year > profile.yearTo))
      )
        return false;
      if (
        typeof e.metadata?.citations === "number" &&
        e.metadata.citations < profile.minCitations
      )
        return false;
    }
    if (
      ((profile.mode === "news" && e.type === "news") ||
        (profile.mode === "patents" && e.type === "patent")) &&
      !Number.isNaN(timestamp)
    ) {
      if (
        (profile.dateFrom && timestamp < Date.parse(profile.dateFrom)) ||
        (profile.dateTo && timestamp >= Date.parse(profile.dateTo) + 86400000)
      )
        return false;
    }
    if (profile.mode === "patents" && e.type === "patent") {
      if (
        profile.status !== "Any" &&
        typeof e.metadata?.status === "string" &&
        !e.metadata.status.toLowerCase().includes(profile.status.toLowerCase())
      )
        return false;
      if (
        profile.excludeCompanies.some(
          (c) =>
            typeof e.metadata?.assignee === "string" &&
            e.metadata.assignee.toLowerCase().includes(c.toLowerCase()),
        )
      )
        return false;
    }
    return true;
  });
  const score = (e: Evidence) => {
    let score = e.relevanceScore;
    if (profile.mode === "jobs" && e.type === "job") {
      const requirements = jobRequirements(e, profile);
      score += requirements.met * 0.15;
      const text = sourceText(e).toLowerCase();
      score +=
        profile.roles.filter((r) => text.includes(r.toLowerCase())).length *
        0.1;
      if (
        profile.locations.some((l) =>
          String(e.metadata?.location ?? "")
            .toLowerCase()
            .includes(l.toLowerCase()),
        )
      )
        score += 0.15;
      if (profile.arrangement === "Remote" && e.metadata?.remote === true)
        score += 0.15;
    }
    if (profile.mode === "scholar" && e.type === "paper") {
      if (profile.sort === "Citations")
        score =
          typeof e.metadata?.citations === "number" ? e.metadata.citations : -1;
      else if (profile.sort === "Newest")
        score = e.date ? Date.parse(e.date) || 0 : 0;
      else if (profile.openAccess && e.metadata?.openAccess === true)
        score += 0.2;
    }
    if (
      profile.mode === "news" &&
      profile.sourceTypes.includes("Primary sources") &&
      e.primary
    )
      score += 0.2;
    if (profile.mode === "patents")
      score +=
        profile.keywords.filter((k) =>
          sourceText(e).toLowerCase().includes(k.toLowerCase()),
        ).length * 0.1;
    return score;
  };
  return filtered.sort((a, b) => score(b) - score(a));
}
export function paperSummary(run: Investigation, evidence: Evidence) {
  return (
    run.claims
      .filter((c) => c.evidenceIds.includes(evidence.id))
      .map((c) => c.text)
      .join(" ") ||
    evidence.snippet ||
    "No summary in the retrieved record."
  );
}
export function citation(e: Evidence, style: string) {
  const authors = e.authors?.join(", ") || e.source,
    year =
      e.date && !Number.isNaN(Date.parse(e.date))
        ? new Date(e.date).getUTCFullYear()
        : "n.d.";
  if (style === "BibTeX") {
    const safe = (s: string) => s.replace(/[{}\\]/g, "");
    return `@misc{${e.id.replace(/[^a-zA-Z0-9]/g, "")},\n author={${safe(authors)}},\n title={${safe(e.title)}},\n${year !== "n.d." ? ` year={${year}},\n` : ""} url={${safe(e.url)}}\n}`;
  }
  if (style === "MLA")
    return `${authors}. “${e.title}.” ${e.source}, ${year}. ${e.url}`;
  if (style === "IEEE")
    return `${authors}, “${e.title},” ${e.source}, ${year}. [Online]. Available: ${e.url}`;
  return `${authors} (${year}). ${e.title}. ${e.source}. ${e.url}`;
}
