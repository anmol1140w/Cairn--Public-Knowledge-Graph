import { PDFDocument, PDFName, PDFString, StandardFonts, rgb } from "pdf-lib";
import { strToU8, zipSync } from "fflate";
import type { Investigation } from "@/lib/types";
import { BRAND } from "@/lib/brand";

export function markdownReport(run: Investigation): string {
  const lines = [
    `# ${BRAND.name}`,
    "",
    BRAND.tagline,
    "",
    `**${run.demo ? "DEMO DATA — curated historical sources and labelled illustrative opportunities" : "LIVE EVIDENCE"}**`,
    "",
    `## ${run.query}`,
    "",
    `Created: ${run.createdAt}`,
    "",
    "## Overview",
    "",
    run.summary,
    "",
    "## Evidence-backed claims",
    "",
  ];
  for (const claim of run.claims) {
    lines.push(
      `### ${claim.id}: ${claim.text}`,
      "",
      `Confidence: **${claim.confidence.toUpperCase()}** (qualitative)`,
      claim.rationale,
      `Supporting evidence: ${claim.evidenceIds.join(", ")}`,
      `Conflicting evidence: ${claim.conflictingEvidenceIds.join(", ") || "None established"}`,
      "",
    );
    for (const quote of claim.supportingQuotes ?? [])
      lines.push(`> ${quote.text}`, `Source ID: ${quote.evidenceId}`, "");
  }
  lines.push("## Why this matters", "", run.whyItMatters, "", "## Sources", "");
  for (const item of run.evidence)
    lines.push(
      `### [${item.title}](${item.url})`,
      `ID: ${item.id}`,
      `Type: ${item.type} · Source: ${item.source} · Date: ${item.date ?? "Not provided"}`,
      ...(item.authors?.length ? [`Authors: ${item.authors.join(", ")}`] : []),
      `URL: ${item.url}`,
      ...(item.metadata?.illustrative
        ? ["**ILLUSTRATIVE — not a live vacancy**"]
        : []),
      "",
      item.snippet ?? "No excerpt provided.",
      "",
    );
  lines.push(
    "## Evidence relationships",
    "",
    "| Source entity | Relationship | Target entity | Evidence IDs | Inferred |",
    "|---|---|---|---|---|",
  );
  for (const edge of run.relationships)
    lines.push(
      `| ${edge.source} | ${edge.type} | ${edge.target} | ${edge.evidenceIds.join(", ")} | ${edge.inferred ? "Yes" : "No"} |`,
    );
  lines.push("", "## Entity index", "");
  for (const entity of run.entities)
    lines.push(
      `- ${entity.id}: ${entity.title} (${entity.type}); sources: ${entity.evidenceIds.join(", ")}`,
    );
  if (run.warnings.length)
    lines.push(
      "",
      "## Source limitations",
      "",
      ...run.warnings.map((v) => `- ${v}`),
    );
  return lines.join("\n");
}
function csvCell(value: unknown): string {
  const text =
    value === undefined || value === null
      ? ""
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  const safe = /^[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function csvReport(run: Investigation): Uint8Array {
  const make = (rows: unknown[][]) =>
    rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  return zipSync({
    "evidence.csv": strToU8(
      make([
        [
          "mode",
          "id",
          "type",
          "title",
          "source",
          "url",
          "date",
          "authors",
          "snippet",
          "relevance",
          "metadata",
        ],
        ...run.evidence.map((e) => [
          run.demo ? "DEMO DATA" : "LIVE EVIDENCE",
          e.id,
          e.type,
          e.title,
          e.source,
          e.url,
          e.date,
          e.authors,
          e.snippet,
          e.relevanceScore,
          e.metadata,
        ]),
      ]),
    ),
    "relationships.csv": strToU8(
      make([
        ["source", "target", "type", "evidenceIds", "inferred", "explanation"],
        ...run.relationships.map((e) => [
          e.source,
          e.target,
          e.type,
          e.evidenceIds,
          e.inferred,
          e.explanation,
        ]),
      ]),
    ),
    "entities.csv": strToU8(
      make([
        ["id", "type", "title", "evidenceIds"],
        ...run.entities.map((e) => [e.id, e.type, e.title, e.evidenceIds]),
      ]),
    ),
    "claims.csv": strToU8(
      make([
        [
          "id",
          "claim",
          "supportingEvidenceIds",
          "conflictingEvidenceIds",
          "confidence",
          "rationale",
          "supportingQuotes",
          "conflictingQuotes",
        ],
        ...run.claims.map((c) => [
          c.id,
          c.text,
          c.evidenceIds,
          c.conflictingEvidenceIds,
          c.confidence,
          c.rationale,
          c.supportingQuotes,
          c.conflictingQuotes,
        ]),
      ]),
    ),
    "README.md": strToU8(markdownReport(run)),
  });
}
export function citationReport(run: Investigation): string {
  const citations = run.evidence.map((e) => {
    const formats = Array.isArray(e.metadata?.citationsFormatted)
      ? (e.metadata.citationsFormatted as {
          title?: string;
          snippet?: string;
        }[])
      : [];
    const formatted = formats.find((f) => f.title === "APA")?.snippet;
    return `[${e.id}] ${formatted ?? `${e.authors?.length ? e.authors.join(", ") + ". " : ""}${e.date ? `(${e.date}). ` : ""}${e.title}. ${e.source}.`}\n${e.url}${e.metadata?.illustrative ? "\nILLUSTRATIVE OPPORTUNITY — not an active vacancy" : ""}`;
  });
  return [
    `${BRAND.name} — ${run.demo ? "DEMO DATA" : "LIVE EVIDENCE"}`,
    BRAND.tagline,
    run.query,
    "",
    "Source-linked citation list. Missing bibliographic fields are omitted, not inferred. Retrieved Scholar APA citations are reused when available.",
    "",
    ...citations,
    "",
    "Claim reference",
    ...run.claims.map(
      (claim) =>
        `${claim.id}: ${claim.text}\nSupporting sources: ${claim.evidenceIds.join(", ")}`,
    ),
    "",
    "Relationship reference",
    ...run.relationships.map(
      (r) =>
        `${r.source} --${r.type}--> ${r.target}; evidence: ${r.evidenceIds.join(", ")}`,
    ),
  ].join("\n\n");
}
export async function pdfReport(run: Investigation): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  pdf.setTitle(`${BRAND.name}: ${run.query}`);
  pdf.setAuthor(BRAND.name);
  pdf.setSubject(run.demo ? "DEMO DATA" : "Evidence investigation");
  let page = pdf.addPage([595, 842]);
  let y = 790;
  const safe = (text: string) =>
    text
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[–—→]/g, "-")
      .replace(/…/g, "...")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[^\x20-\x7E\n]/g, " ");
  const draw = (text: string, size = 10, heavy = false, link?: string) => {
    size = Math.max(12, size);
    const font = heavy ? bold : regular;
    const words = safe(text).split(/\s+/);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) > 493 && line) {
        lines.push(line);
        line = word;
      } else line = test;
    }
    if (line) lines.push(line);
    for (const line of lines) {
      if (y < 55) {
        page = pdf.addPage([595, 842]);
        y = 790;
      }
      page.drawText(line, {
        x: 50,
        y,
        size,
        font,
        color: link ? rgb(0.2, 0.35, 0.58) : rgb(0.12, 0.15, 0.2),
      });
      if (link) {
        const annotation = pdf.context.obj({
          Type: PDFName.of("Annot"),
          Subtype: PDFName.of("Link"),
          Rect: [
            50,
            y - 2,
            Math.min(545, 50 + font.widthOfTextAtSize(line, size)),
            y + size + 2,
          ],
          Border: [0, 0, 0],
          A: {
            Type: PDFName.of("Action"),
            S: PDFName.of("URI"),
            URI: PDFString.of(link),
          },
        });
        const existing = page.node.Annots();
        if (existing) existing.push(pdf.context.register(annotation));
        else
          page.node.set(
            PDFName.of("Annots"),
            pdf.context.obj([pdf.context.register(annotation)]),
          );
      }
      y -= size * 1.5;
    }
    y -= 6;
  };
  draw(BRAND.name, 16, true);
  draw(BRAND.tagline, 12);
  draw(
    run.demo
      ? "DEMO DATA - curated historical evidence; illustrative opportunities are labelled"
      : "LIVE EVIDENCE",
    12,
    true,
  );
  y -= 12;
  draw(run.query, 22, true);
  draw(`Created: ${run.createdAt}`, 8);
  y -= 10;
  draw("Overview", 14, true);
  draw(run.summary);
  draw("Evidence-backed claims", 14, true);
  for (const claim of run.claims) {
    draw(claim.text, 11, true);
    draw(
      `Confidence: ${claim.confidence.toUpperCase()} (qualitative). ${claim.rationale}`,
      9,
    );
    draw(`Supporting source IDs: ${claim.evidenceIds.join(", ")}`, 8);
    for (const quote of claim.supportingQuotes ?? [])
      draw(`"${quote.text}" [${quote.evidenceId}]`, 8);
    if (claim.conflictingEvidenceIds.length)
      draw(
        `Conflicting source IDs: ${claim.conflictingEvidenceIds.join(", ")}`,
        8,
      );
  }
  draw("Why this matters", 14, true);
  draw(run.whyItMatters);
  draw("Source records", 14, true);
  for (const e of run.evidence) {
    draw(`[${e.id}] ${e.title}`, 11, true);
    draw(`${e.type} | ${e.source} | ${e.date ?? "Date not provided"}`, 8);
    if (e.authors?.length) draw(`Authors: ${e.authors.join(", ")}`, 8);
    if (e.metadata?.illustrative)
      draw("ILLUSTRATIVE ROLE - not a live vacancy", 8, true);
    if (e.snippet) draw(e.snippet, 9);
    draw(e.url, 8, false, e.url);
  }
  draw("Relationship appendix", 14, true);
  for (const r of run.relationships)
    draw(
      `${r.source} -- ${r.type} --> ${r.target}. Evidence: ${r.evidenceIds.join(", ")}. ${r.inferred ? "Inferred association." : "Source-explicit relationship."}`,
      8,
    );
  draw("Entity index", 14, true);
  for (const e of run.entities) draw(`${e.id}: ${e.title} (${e.type})`, 8);
  if (run.warnings.length) {
    draw("Limitations", 14, true);
    run.warnings.forEach((w) => draw(w, 9));
  }
  return pdf.save();
}
