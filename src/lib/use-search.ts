"use client";
import { useRef } from "react";
import { DEMO } from "./demo";
import { EXAMPLES, scopeDemo } from "./examples";
import { useKnowledge } from "./store";
import { useProfiles } from "./profile-store";
import type { ProgressEvent, SourceEngine } from "./types";

export const STAGES = [
  "Understanding query",
  "Planning sources",
  "Finding research",
  "Mapping researchers",
  "Checking opportunities",
  "Reviewing recent news",
  "Searching patents",
  "Building evidence graph",
  "Following the evidence",
];
export function useSearch() {
  const controller = useRef<AbortController | null>(null);
  const cancel = () => {
    controller.current?.abort();
    useKnowledge
      .getState()
      .set({
        searching: false,
        error:
          "Investigation cancelled. You can search again whenever you’re ready.",
      });
  };
  const search = async (override?: string, sourceOverride?: SourceEngine[]) => {
    const state = useKnowledge.getState(),
      details = useProfiles.getState(),
      profile = details.profiles[state.mode];
    const saveProfile = Boolean(profile && details.saveWithInvestigation),
      query = (override ?? state.query).trim();
    if (!query) {
      document.getElementById("knowledge-search")?.focus();
      return;
    }
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const set = state.set;
    set({
      query,
      searching: true,
      stages: {},
      sourceStatuses: [],
      error: null,
      selected: null,
      highlighted: [],
      focus: null,
      year: null,
      graphFilter: "",
    });
    try {
      if (state.demo) {
        for (const stage of STAGES.slice(0, 8)) {
          abort.signal.throwIfAborted();
          set({
            stages: { ...useKnowledge.getState().stages, [stage]: "running" },
          });
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(
              resolve,
              state.accessibility.reducedMotion ? 60 : 180,
            );
            abort.signal.addEventListener(
              "abort",
              () => {
                clearTimeout(timer);
                reject(new DOMException("Cancelled", "AbortError"));
              },
              { once: true },
            );
          });
          set({
            stages: { ...useKnowledge.getState().stages, [stage]: "complete" },
          });
        }
        const sample = EXAMPLES.find((e) => e.mode === state.mode)?.run ?? DEMO;
        const run = scopeDemo(sample, sourceOverride ?? state.sources);
        set({
          run: saveProfile ? { ...run, profile } : run,
          searching: false,
          hasSearched: true,
          sourceStatuses: run.sources,
          toast:
            query !== sample.query
              ? "Showing a preloaded example. Choose Live to search your own question."
              : "Your source records are ready.",
        });
        details.consumeConsent();
        return;
      }
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          sources: sourceOverride ?? state.sources,
          mode: state.mode,
          simplified: state.accessibility.simplifiedLanguage,
          profile,
          saveProfile,
        }),
        signal: abort.signal,
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(
          data.error ?? "Search was interrupted. Please try again.",
        );
      }
      if (!response.body)
        throw new Error("The evidence stream could not be opened.");
      const reader = response.body.getReader(),
        decoder = new TextDecoder();
      let buffer = "",
        receivedResult = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          const line = frame.split("\n").find((v) => v.startsWith("data: "));
          if (!line) continue;
          const event = JSON.parse(line.slice(6)) as ProgressEvent;
          if (event.kind === "stage" && event.stage)
            set({
              stages: {
                ...useKnowledge.getState().stages,
                [event.stage]: event.state ?? "running",
              },
            });
          if (event.kind === "source" && event.source)
            set({
              sourceStatuses: [
                ...useKnowledge
                  .getState()
                  .sourceStatuses.filter(
                    (s) => s.source !== event.source!.source,
                  ),
                event.source,
              ],
            });
          if (event.kind === "result" && event.result) {
            receivedResult = true;
            details.consumeConsent();
            set({
              run: event.result,
              searching: false,
              hasSearched: true,
              error: null,
              toast: event.result.evidence.length
                ? "Your source records are ready."
                : "No evidence found. Try a more specific question.",
            });
          }
          if (event.kind === "error")
            throw new Error(event.message ?? "Search interrupted.");
        }
      }
      if (!receivedResult)
        throw new Error(
          "The connection ended before your evidence graph was ready.",
        );
    } catch (error) {
      if (abort.signal.aborted) return;
      set({
        searching: false,
        error:
          error instanceof Error
            ? error.message
            : "Search interrupted. Please try again.",
      });
    }
  };
  return { search, cancel };
}
