import type { Profile } from "./profiles";
export type SourceEngine = "scholar" | "jobs" | "news" | "patents" | "web";
export type EntityType =
  | "paper"
  | "person"
  | "institution"
  | "job"
  | "news"
  | "patent"
  | "company"
  | "topic"
  | "technology"
  | "web";
export type Mode = "universe" | "scholar" | "news" | "jobs" | "patents";
export type ConfidenceLevel = "high" | "medium" | "low" | "insufficient";
export type Confidence = "strong" | "moderate" | "weak" | "unknown";
export type ReasonCode = keyof typeof import("./copy").COPY.reason;
export type Edge = Relationship;
export interface Source {
  id: string;
  label: string;
  domain?: string;
  kind: "primary" | "secondary" | "official" | "illustrative";
  publicationDate?: string;
  retrievedAt?: string;
  freshness?: "current" | "historical" | "unknown";
  independenceGroup?: string;
}

export interface Evidence {
  id: string;
  type: EntityType;
  title: string;
  source: string;
  url: string;
  date?: string;
  authors?: string[];
  snippet?: string;
  relevanceScore: number;
  engine?: SourceEngine;
  retrievedAt?: string;
  primary?: boolean;
  metadata?: Record<string, unknown>;
}

export interface GraphEntity {
  id: string;
  type: EntityType;
  title: string;
  label: string;
  subtitle: string;
  position: [number, number, number];
  evidenceIds: string[];
  metadata?: Record<string, unknown>;
}

export type RelationType =
  | "authored"
  | "cited"
  | "works_at"
  | "related_to"
  | "patented"
  | "reported_by"
  | "hiring_for"
  | "assigned_to"
  | "supports"
  | "disputes";
export interface Relationship {
  id: string;
  source: string;
  target: string;
  type: RelationType;
  evidenceIds: string[];
  inferred?: boolean;
  explanation?: string;
}

export interface Claim {
  id: string;
  text: string;
  evidenceIds: string[];
  conflictingEvidenceIds: string[];
  confidence: ConfidenceLevel;
  rationale: string;
  supportingQuotes?: { evidenceId: string; text: string }[];
  conflictingQuotes?: { evidenceId: string; text: string }[];
}

export interface SourceStatus {
  source: SourceEngine;
  state: "pending" | "running" | "success" | "error" | "skipped";
  count?: number;
  cached?: boolean;
  message?: string;
}

export interface Investigation {
  profile?: Profile;
  sessionOnly?: boolean;
  id: string;
  query: string;
  demo: boolean;
  evidence: Evidence[];
  entities: GraphEntity[];
  relationships: Relationship[];
  claims: Claim[];
  summary: string;
  whyItMatters: string;
  sources: SourceStatus[];
  createdAt: string;
  warnings: string[];
}

export interface ProgressEvent {
  kind: "stage" | "source" | "result" | "error";
  stage?: string;
  state?: "running" | "complete" | "skipped" | "error";
  source?: SourceStatus;
  result?: Investigation;
  message?: string;
}

export interface AccessibilitySettings {
  highContrast: boolean;
  largeText: boolean;
  reducedMotion: boolean;
  screenReader: boolean;
  simplifiedLanguage: boolean;
  keyboardNavigation: boolean;
}

export const CATEGORIES: Record<
  EntityType,
  { label: string; plural: string; color: string }
> = {
  paper: { label: "Research", plural: "Papers", color: "#7da9ff" },
  person: { label: "Researcher", plural: "Researchers", color: "#5bced9" },
  institution: {
    label: "Institution",
    plural: "Institutions",
    color: "#d2d8e8",
  },
  job: { label: "Opportunity", plural: "Opportunities", color: "#7bd6a4" },
  news: { label: "News", plural: "News", color: "#e7bb72" },
  patent: { label: "Patent", plural: "Patents", color: "#b79af1" },
  company: { label: "Company", plural: "Companies", color: "#bac9ed" },
  topic: { label: "Topic", plural: "Topics", color: "#cba1ca" },
  technology: { label: "Technology", plural: "Technologies", color: "#cc95c7" },
  web: { label: "Web source", plural: "Web sources", color: "#98a8c8" },
};

export const SOURCE_LABELS: Record<SourceEngine, string> = {
  scholar: "Scholar",
  jobs: "Jobs",
  news: "News",
  patents: "Patents",
  web: "Web",
};
export const MODES: {
  id: Mode;
  label: string;
  name: string;
  description: string;
}[] = [
  {
    id: "universe",
    label: "Explore",
    name: "Explore",
    description: "Research, people, organisations and source records.",
  },
  {
    id: "scholar",
    label: "Scholar",
    name: "Research papers",
    description: "Find papers, authors and citations.",
  },
  {
    id: "news",
    label: "News",
    name: "News and claims",
    description: "Check reporting against its sources.",
  },
  {
    id: "jobs",
    label: "Jobs",
    name: "Jobs and internships",
    description: "Compare your skills with listed requirements.",
  },
  {
    id: "patents",
    label: "Patents",
    name: "Patents",
    description: "Find related inventions and inspect their references.",
  },
];
