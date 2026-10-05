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

interface KnowledgeState {
  run: Investigation;
  mode: Mode;
  demo: boolean;
  theme: "light" | "dark";
  view: "3d" | "2d" | "list";
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
  cameraReset: number;
  set: (patch: Partial<KnowledgeState>) => void;
  select: (id: string | null) => void;
  setMode: (mode: Mode) => void;
  toggleSource: (source: SourceEngine) => void;
  resetGraph: () => void;
}
export const useKnowledge = create<KnowledgeState>()(
  persist(
    (set) => ({
      run: DEMO,
      mode: "universe",
      demo: true,
      theme: "light",
      view: "3d",
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
      hasSearched: false,
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
      cameraReset: 0,
      set: (patch) => set(patch),
      select: (id) => set({ selected: id, hovered: null }),
      setMode: (mode) =>
        set({ mode, selected: null, focus: null, graphFilter: "", year: null }),
      toggleSource: (source) =>
        set((s) => ({
          sources: s.sources.includes(source)
            ? s.sources.filter((v) => v !== source)
            : [...s.sources, source],
        })),
      resetGraph: () =>
        set((s) => ({
          selected: null,
          focus: null,
          graphFilter: "",
          year: null,
          highlighted: [],
          cameraReset: s.cameraReset + 1,
        })),
    }),
    {
      name: "pkg-preferences",
      partialize: (s) => ({
        accessibility: s.accessibility,
        skills: s.skills,
        theme: s.theme,
      }),
    },
  ),
);
