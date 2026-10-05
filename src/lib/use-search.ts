"use client";
import { useRef } from "react";
import { DEMO } from "./demo";
import { useKnowledge } from "./store";
import { useProfiles } from "./profile-store";
import type { Investigation, ProgressEvent, SourceEngine } from "./types";

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
    useKnowledge.getState().set({
      searching: false,
      error:
        "Investigation cancelled. You can search again whenever you’re ready.",
    });
  };
  const search = async (override?: string, sourceOverride?: SourceEngine[]) => {
    const state = useKnowledge.getState();
    const details = useProfiles.getState(),
      profile = details.profiles[state.mode];
    const saveProfile = Boolean(profile && details.saveWithInvestigation);
    const query = (override ?? state.query).trim();
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
          if (abort.signal.aborted) return;
          set({
            stages: { ...useKnowledge.getState().stages, [stage]: "running" },
          });
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(
              resolve,
              state.accessibility.reducedMotion ? 60 : 260,
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
        const selectedSources = sourceOverride ?? state.sources;
        let run: Investigation = { ...DEMO };
        if (selectedSources.length) {
          const evidence = DEMO.evidence.filter(
            (e) => e.engine && selectedSources.includes(e.engine),
          );
          const ids = new Set(evidence.map((e) => e.id));
          const entities = DEMO.entities
            .map((entity) => {
              const supportingIds = DEMO.relationships
                .filter(
                  (edge) =>
                    (edge.source === entity.id || edge.target === entity.id) &&
                    edge.evidenceIds.every((id) => ids.has(id)),
                )
                .flatMap((edge) => edge.evidenceIds);
              return {
                ...entity,
                evidenceIds: [
                  ...new Set([
                    ...entity.evidenceIds.filter((id) => ids.has(id)),
                    ...supportingIds,
                  ]),
                ],
              };
            })
            .filter(
              (entity) =>
                entity.type === "topic" || entity.evidenceIds.length > 0,
            );
          const entityIds = new Set(entities.map((e) => e.id));
          const claims = DEMO.claims.filter((c) =>
            c.evidenceIds.every((id) => ids.has(id)),
          );
          run = {
            ...DEMO,
            evidence,
            entities,
            relationships: DEMO.relationships.filter(
              (e) =>
                entityIds.has(e.source) &&
                entityIds.has(e.target) &&
                e.evidenceIds.every((id) => ids.has(id)),
            ),
            claims,
            sources: DEMO.sources.filter((s) =>
              selectedSources.includes(s.source),
            ),
            summary: claims.length
              ? claims
                  .slice(0, 2)
                  .map((c) => c.text)
                  .join(" ")
              : `${evidence.length} selected demo source records are available to explore. This source subset does not establish the research summary.`,
            whyItMatters:
              claims.find((c) => c.id === "impact")?.text ??
              "Inspect the selected source records before drawing conclusions about this topic.",
          };
        }
        set({
          run,
          ...(saveProfile ? { run: { ...run, profile } } : {}),
          searching: false,
          hasSearched: true,
          sourceStatuses: run.sources,
          toast:
            query !== DEMO.query
              ? "Demo explores efficient AI inference. Switch to Live for your own question."
              : "Your evidence universe is ready.",
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
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let receivedResult = false;
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
                ? "Your evidence universe is ready."
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
