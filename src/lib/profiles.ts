import { z } from "zod";
import type { Mode, SourceEngine } from "./types";
const text = (max = 150) => z.string().trim().max(max).default("");
const tags = (max = 10) =>
  z.array(z.string().trim().min(1).max(100)).max(max).default([]);
const year = z.number().int().min(1900).max(2100).optional();
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date.")
  .refine(
    (s) =>
      !Number.isNaN(Date.parse(s)) &&
      new Date(s).toISOString().slice(0, 10) === s,
    "Choose a valid date.",
  )
  .optional();
export const skillSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    level: z.enum(["Strong", "Working", "Learning"]).default("Working"),
    mustHave: z.boolean().default(false),
  })
  .strict();
export const jobsProfileSchema = z
  .object({
    mode: z.literal("jobs"),
    roles: tags(3),
    jobType: z
      .enum([
        "Any",
        "Full-time",
        "Part-time",
        "Internship",
        "Research internship",
        "Contract",
      ])
      .default("Any"),
    experience: z.number().min(0).max(40).default(0),
    qualification: text(),
    field: text(),
    graduationYear: year,
    marks: text(30),
    skills: z.array(skillSchema).max(30).default([]),
    locations: tags(8),
    relocation: z.enum(["Not specified", "Yes", "No"]).default("Not specified"),
    arrangement: z.enum(["Any", "On-site", "Hybrid", "Remote"]).default("Any"),
    salaryMin: z.number().min(0).max(1e9).optional(),
    salaryMax: z.number().min(0).max(1e9).optional(),
    currency: z.enum(["USD", "INR", "EUR", "GBP"]).default("USD"),
    payPeriod: z.enum(["Year", "Month", "Hour"]).default("Year"),
    joiningDate: date,
    languages: tags(),
    certifications: tags(),
    workAuthorization: text(),
  })
  .strict()
  .superRefine((p, ctx) => {
    if (
      p.salaryMin !== undefined &&
      p.salaryMax !== undefined &&
      p.salaryMin > p.salaryMax
    )
      ctx.addIssue({
        code: "custom",
        path: ["salaryMax"],
        message: "Maximum salary must be at least the minimum.",
      });
  });
export const scholarProfileSchema = z
  .object({
    mode: z.literal("scholar"),
    goal: z
      .enum([
        "Explore",
        "Understand a topic",
        "Literature review",
        "Find a research gap",
        "Choose a project",
      ])
      .default("Explore"),
    level: z
      .enum([
        "Not specified",
        "School",
        "Undergraduate",
        "Postgraduate",
        "Researcher",
      ])
      .default("Not specified"),
    field: text(),
    subfield: text(),
    yearFrom: year,
    yearTo: year,
    paperType: z
      .enum(["Any", "Review", "Empirical", "Theoretical", "Preprint"])
      .default("Any"),
    openAccess: z.boolean().default(false),
    minCitations: z.number().int().min(0).max(1e7).default(0),
    sort: z.enum(["Relevance", "Newest", "Citations"]).default("Relevance"),
    readingLevel: z.enum(["Simple", "Technical"]).default("Simple"),
    citationStyle: z.enum(["APA", "MLA", "IEEE", "BibTeX"]).default("APA"),
  })
  .strict()
  .superRefine((p, ctx) => {
    if (p.yearFrom && p.yearTo && p.yearFrom > p.yearTo)
      ctx.addIssue({
        code: "custom",
        path: ["yearTo"],
        message: "End year must follow start year.",
      });
  });
export const newsProfileSchema = z
  .object({
    mode: z.literal("news"),
    goal: z
      .enum([
        "Understand an event",
        "Check a claim",
        "Compare sources",
        "Follow a topic",
      ])
      .default("Understand an event"),
    claim: text(2000),
    topic: text(300),
    region: text(),
    timeWindow: z
      .enum(["Any time", "Past day", "Past week", "Past month", "Custom"])
      .default("Any time"),
    dateFrom: date,
    dateTo: date,
    sourceTypes: tags(6),
    language: z
      .enum(["English", "Hindi", "Spanish", "French", "German"])
      .default("English"),
    readingLevel: z.enum(["Simple", "Technical"]).default("Simple"),
  })
  .strict()
  .superRefine((p, ctx) => {
    if (p.dateFrom && p.dateTo && p.dateFrom > p.dateTo)
      ctx.addIssue({
        code: "custom",
        path: ["dateTo"],
        message: "End date must follow start date.",
      });
  });
export const patentsProfileSchema = z
  .object({
    mode: z.literal("patents"),
    idea: text(2000),
    purpose: z
      .enum([
        "Explore related inventions",
        "Find prior work",
        "Compare approaches",
        "Understand a patent",
      ])
      .default("Explore related inventions"),
    jurisdictions: tags(8),
    dateFrom: date,
    dateTo: date,
    status: z
      .enum(["Any", "Granted", "Application", "Expired", "Active"])
      .default("Any"),
    keywords: tags(15),
    includeCompanies: tags(),
    excludeCompanies: tags(),
    inventors: tags(),
    userRole: z
      .enum([
        "Not specified",
        "Student",
        "Researcher",
        "Inventor",
        "Business",
        "Patent professional",
      ])
      .default("Not specified"),
  })
  .strict()
  .superRefine((p, ctx) => {
    if (p.dateFrom && p.dateTo && p.dateFrom > p.dateTo)
      ctx.addIssue({
        code: "custom",
        path: ["dateTo"],
        message: "End date must follow start date.",
      });
  });
export const exploreProfileSchema = z
  .object({
    mode: z.literal("universe"),
    goal: text(),
    interests: tags(),
    region: text(),
    readingLevel: z.enum(["Simple", "Technical"]).default("Simple"),
  })
  .strict();
export const profileSchema = z.discriminatedUnion("mode", [
  jobsProfileSchema,
  scholarProfileSchema,
  newsProfileSchema,
  patentsProfileSchema,
  exploreProfileSchema,
]);
export type Profile = z.infer<typeof profileSchema>;
export type JobsProfile = z.infer<typeof jobsProfileSchema>;
export const PROFILE_SCHEMAS = {
  jobs: jobsProfileSchema,
  scholar: scholarProfileSchema,
  news: newsProfileSchema,
  patents: patentsProfileSchema,
  universe: exploreProfileSchema,
};
export const defaultProfile = (mode: Mode): Profile =>
  profileSchema.parse({ mode });
export function profileChips(profile: Profile) {
  return Object.entries(profile)
    .filter(
      ([key, value]) =>
        key !== "mode" &&
        value !== "" &&
        value !== false &&
        value !== undefined &&
        value !== "Any" &&
        value !== "Not specified" &&
        value !== 0 &&
        (!Array.isArray(value) || value.length),
    )
    .map(
      ([key, value]) =>
        `${key.replace(/([A-Z])/g, " $1")}: ${Array.isArray(value) ? value.map((v) => (typeof v === "object" ? v.name : v)).join(", ") : value}`,
    )
    .slice(0, 8);
}
export function profileQuery(
  query: string,
  source: SourceEngine,
  profile?: Profile,
) {
  if (!profile) return query;
  let terms: string[] = [];
  if (profile.mode === "jobs" && source === "jobs")
    terms = [
      ...profile.roles,
      ...(profile.jobType === "Any" ? [] : [profile.jobType]),
      ...profile.locations,
      ...(profile.arrangement === "Any" ? [] : [profile.arrangement]),
      ...profile.skills.filter((s) => s.mustHave).map((s) => s.name),
    ];
  if (profile.mode === "scholar" && source === "scholar")
    terms = [
      profile.field,
      profile.subfield,
      ...(profile.paperType === "Any" ? [] : [profile.paperType]),
      ...(profile.openAccess ? ["open access"] : []),
    ];
  if (profile.mode === "news" && source === "news")
    terms = [
      profile.claim || profile.topic,
      profile.region,
      ...profile.sourceTypes,
      ...(profile.timeWindow === "Past day"
        ? ["when:1d"]
        : profile.timeWindow === "Past week"
          ? ["when:7d"]
          : profile.timeWindow === "Past month"
            ? ["when:30d"]
            : []),
      ...(profile.timeWindow === "Custom"
        ? [
            profile.dateFrom ? `after:${profile.dateFrom}` : "",
            profile.dateTo ? `before:${profile.dateTo}` : "",
          ]
        : []),
    ];
  if (profile.mode === "patents" && source === "patents")
    terms = [
      profile.idea,
      ...profile.keywords,
      ...profile.jurisdictions,
      ...profile.includeCompanies,
      ...profile.inventors,
      ...profile.excludeCompanies.map((c) => `-"${c.replaceAll('"', "")}"`),
    ];
  if (profile.mode === "universe")
    terms = [...profile.interests, profile.region];
  return [
    query,
    ...new Set(
      terms.filter(
        (term) => term && !query.toLowerCase().includes(term.toLowerCase()),
      ),
    ),
  ]
    .join(" ")
    .slice(0, 600);
}
