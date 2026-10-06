"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEMO } from "./demo";
import type {
  AccessibilitySettings,
  Investigation,
  Mode,
  SourceEngine,
  SourceStatus,
} from "./types";

export interface WorkspaceState {
  run: Investigation;
  demo: boolean;
  query: string;
  sources: SourceEngine[];
  selected: string | null;
  hovered: string | null;
  highlighted: string[];
  focus: string | null;
  hops: number;
  graphFilter: string;
  year: number | null;
  searching: boolean;
  stages: Record<string, string>;
  sourceStatuses: SourceStatus[];
  error: string | null;
  hasSearched: boolean;
  cameraReset: number;
}

const MODES: Mode[] = ["universe", "scholar", "news", "jobs", "patents"];

function cloneRun(run: Investigation): Investigation {
  return {
    ...run,
    evidence: run.evidence.map((item) => ({
      ...item,
      authors: item.authors ? [...item.authors] : undefined,
      metadata: item.metadata ? { ...item.metadata } : undefined,
    })),
    entities: run.entities.map((entity) => ({
      ...entity,
      evidenceIds: [...entity.evidenceIds],
      metadata: entity.metadata ? { ...entity.metadata } : undefined,
    })),
    relationships: run.relationships.map((edge) => ({
      ...edge,
      evidenceIds: [...edge.evidenceIds],
    })),
    claims: run.claims.map((claim) => ({
      ...claim,
      evidenceIds: [...claim.evidenceIds],
      conflictingEvidenceIds: [...claim.conflictingEvidenceIds],
      supportingQuotes: claim.supportingQuotes
        ? claim.supportingQuotes.map((quote) => ({ ...quote }))
        : undefined,
      conflictingQuotes: claim.conflictingQuotes
        ? claim.conflictingQuotes.map((quote) => ({ ...quote }))
        : undefined,
    })),
    sources: run.sources.map((source) => ({ ...source })),
    warnings: [...run.warnings],
  };
}

function emptyRun(mode: Mode): Investigation {
  return {
    id: `empty-${mode}`,
    query: "",
    demo: true,
    evidence: [],
    entities: [],
    relationships: [],
    claims: [],
    summary: "",
    whyItMatters: "",
    sources: [],
    createdAt: new Date(0).toISOString(),
    warnings: [],
  };
}

function starterWorkspace(mode: Mode): WorkspaceState {
  return {
    run: mode === "universe" ? cloneRun(DEMO) : emptyRun(mode),
    demo: true,
    query: "",
    sources: [],
    selected: null,
    hovered: null,
    highlighted: [],
    focus: null,
    hops: 1,
    graphFilter: "",
    year: null,
    searching: false,
    stages: {},
    sourceStatuses: [],
    error: null,
    hasSearched: mode === "universe",
    cameraReset: 0,
  };
}

function initialWorkspaces(): Record<Mode, WorkspaceState> {
  return Object.fromEntries(
    MODES.map((mode) => [mode, starterWorkspace(mode)]),
  ) as Record<Mode, WorkspaceState>;
}

const WORKSPACE_KEYS: (keyof WorkspaceState)[] = [
  "run",
  "demo",
  "query",
  "sources",
  "selected",
  "hovered",
  "highlighted",
  "focus",
  "hops",
  "graphFilter",
  "year",
  "searching",
  "stages",
  "sourceStatuses",
  "error",
  "hasSearched",
  "cameraReset",
];

function workspaceFromState(state: KnowledgeState): WorkspaceState {
  const workspace = {} as WorkspaceState;
  for (const key of WORKSPACE_KEYS)
    (workspace as unknown as Record<string, unknown>)[key] = state[key];
  return workspace;
}

function applyPatch(
  current: KnowledgeState,
  patch: Partial<KnowledgeState>,
): KnowledgeState {
  const targetMode = patch.mode ?? current.mode;
  const currentWorkspace = workspaceFromState(current);
  const targetWorkspace =
    targetMode === current.mode
      ? currentWorkspace
      : current.modeWorkspaces[targetMode] ?? starterWorkspace(targetMode);
  const nextWorkspace = { ...targetWorkspace };
  const workspacePatch = patch as Partial<WorkspaceState>;
  for (const key of WORKSPACE_KEYS) {
    if (workspacePatch[key] !== undefined)
      (nextWorkspace as unknown as Record<string, unknown>)[key] =
        workspacePatch[key];
  }
  const modeWorkspaces = {
    ...current.modeWorkspaces,
    [current.mode]: currentWorkspace,
    [targetMode]: nextWorkspace,
  };
  return {
    ...current,
    ...patch,
    ...nextWorkspace,
    mode: targetMode,
    modeWorkspaces,
    searchGeneration:
      patch.searchGeneration ??
      (targetMode !== current.mode
        ? current.searchGeneration + 1
        : current.searchGeneration),
  };
}

interface KnowledgeState extends WorkspaceState {
  mode: Mode;
  modeWorkspaces: Record<Mode, WorkspaceState>;
  searchGeneration: number;
  theme: "light" | "dark";
  preferencesSeen: boolean;
  onboardingStep: number;
  view: "3d" | "2d" | "list";
  modal:
    | "commands"
    | "accessibility"
    | "export"
    | "compare"
    | "profile"
    | "shortcuts"
    | "timeline"
    | "history"
    | null;
  evidenceClaim: string | null;
  skills: string[];
  accessibility: AccessibilitySettings;
  toast: string | null;
  set: (patch: Partial<KnowledgeState>) => void;
  select: (id: string | null) => void;
  setMode: (mode: Mode) => void;
  toggleSource: (source: SourceEngine) => void;
  resetGraph: () => void;
}

const initial = initialWorkspaces();

export const useKnowledge = create<KnowledgeState>()(
  persist(
    (set) => {
      const update = (patch: Partial<KnowledgeState>) =>
        set((current) => applyPatch(current, patch));
      return {
        ...initial.universe,
        mode: "universe",
        modeWorkspaces: initial,
        searchGeneration: 0,
        theme: "light",
        preferencesSeen: false,
        onboardingStep: 0,
        view: "3d",
        modal: null,
        evidenceClaim: null,
        skills: [],
        accessibility: {
          highContrast: false,
          largeText: false,
          reducedMotion: false,
          screenReader: false,
          simplifiedLanguage: false,
          keyboardNavigation: true,
        },
        toast: null,
        set: update,
        select: (id) => set((current) => applyPatch(current, { selected: id, hovered: null })),
        setMode: (mode) =>
          set((current) =>
            applyPatch(current, { mode, evidenceClaim: null, modal: null }),
          ),
        toggleSource: (source) =>
          set((current) =>
            applyPatch(current, {
              sources: current.sources.includes(source)
                ? current.sources.filter((value) => value !== source)
                : [...current.sources, source],
            }),
          ),
        resetGraph: () =>
          set((current) =>
            applyPatch(current, {
              selected: null,
              focus: null,
              graphFilter: "",
              year: null,
              highlighted: [],
              cameraReset: current.cameraReset + 1,
            }),
          ),
      };
    },
    {
      name: "pkg-preferences",
      version: 2,
      migrate: (persisted) => {
        const old = persisted as {
          accessibility?: AccessibilitySettings;
          theme?: "light" | "dark";
        };
        return {
          accessibility: old.accessibility ?? {
            highContrast: false,
            largeText: false,
            reducedMotion: false,
            screenReader: false,
            simplifiedLanguage: false,
            keyboardNavigation: true,
          },
          theme: old.theme ?? "light",
          preferencesSeen: false,
          onboardingStep: 0,
        };
      },
      partialize: (state) => ({
        accessibility: state.accessibility,
        preferencesSeen: state.preferencesSeen,
        onboardingStep: state.onboardingStep,
        theme: state.theme,
      }),
    },
  ),
);
