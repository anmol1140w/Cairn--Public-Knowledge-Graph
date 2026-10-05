import { z } from "zod";
export const entityTypeSchema = z.enum([
  "paper",
  "person",
  "institution",
  "job",
  "news",
  "patent",
  "company",
  "topic",
  "technology",
  "web",
]);
export const sourceSchema = z.enum([
  "scholar",
  "jobs",
  "news",
  "patents",
  "web",
]);
export const safeUrlSchema = z
  .string()
  .max(4000)
  .url()
  .refine(
    (v) => /^https?:\/\//i.test(v),
    "Only HTTP source URLs are supported.",
  );
export const evidenceSchema = z.object({
  id: z.string().max(200),
  type: entityTypeSchema,
  title: z.string().max(3000),
  source: z.string().max(500),
  url: safeUrlSchema,
  date: z.string().max(120).optional(),
  authors: z.array(z.string().max(300)).max(100).optional(),
  snippet: z.string().max(30000).optional(),
  relevanceScore: z.number().min(0).max(1),
  engine: sourceSchema.optional(),
  retrievedAt: z.string().optional(),
  primary: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export const searchSchema = z.object({
  query: z
    .string()
    .trim()
    .min(2, "Ask a question with at least two characters.")
    .max(600),
  sources: z
    .array(sourceSchema)
    .max(5)
    .default([])
    .transform((v) => [...new Set(v)]),
  mode: z
    .enum(["universe", "scholar", "news", "jobs", "patents"])
    .default("universe"),
  simplified: z.boolean().default(false),
});
export type SearchInput = z.infer<typeof searchSchema>;
export const relationshipSchema = z.object({
  id: z.string().max(250),
  source: z.string().max(200),
  target: z.string().max(200),
  type: z.enum([
    "authored",
    "cited",
    "works_at",
    "related_to",
    "patented",
    "reported_by",
    "hiring_for",
    "assigned_to",
    "supports",
    "disputes",
  ]),
  evidenceIds: z.array(z.string().max(200)).max(30),
  inferred: z.boolean().optional(),
  explanation: z.string().max(1500).optional(),
});
export const claimSchema = z.object({
  id: z.string().max(100),
  text: z.string().max(3000),
  evidenceIds: z.array(z.string().max(200)).min(1).max(30),
  conflictingEvidenceIds: z.array(z.string().max(200)).max(30).default([]),
  confidence: z.enum(["high", "medium", "low", "insufficient"]),
  rationale: z.string().min(15).max(3000),
  supportingQuotes: z
    .array(
      z.object({ evidenceId: z.string().max(200), text: z.string().max(3000) }),
    )
    .max(30)
    .optional(),
  conflictingQuotes: z
    .array(
      z.object({ evidenceId: z.string().max(200), text: z.string().max(3000) }),
    )
    .max(30)
    .optional(),
});
export const investigationSchema = z.object({
  id: z.string().max(200),
  query: z.string().max(600),
  demo: z.boolean(),
  evidence: z.array(evidenceSchema).max(200),
  entities: z
    .array(
      z.object({
        id: z.string().max(200),
        type: entityTypeSchema,
        title: z.string().max(3000),
        label: z.string().max(3000),
        subtitle: z.string().max(500),
        position: z.tuple([z.number(), z.number(), z.number()]),
        evidenceIds: z.array(z.string().max(200)).max(200),
        metadata: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .max(300),
  relationships: z.array(relationshipSchema).max(1000),
  claims: z.array(claimSchema).max(50),
  summary: z.string().max(20000),
  whyItMatters: z.string().max(10000),
  sources: z
    .array(
      z.object({
        source: sourceSchema,
        state: z.enum(["pending", "running", "success", "error", "skipped"]),
        count: z.number().optional(),
        cached: z.boolean().optional(),
        message: z.string().optional(),
      }),
    )
    .max(5),
  createdAt: z.string().max(100),
  warnings: z.array(z.string().max(1000)).max(50),
});
