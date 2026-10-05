import type { SourceEngine } from "@/lib/types";
import type { SearchInput } from "./validation";
import { ENGINES } from "./engines";
import { profileQuery, type Profile } from "@/lib/profiles";

export interface PlannedSearch {
  source: SourceEngine;
  query: string;
  reason: string;
}
export interface SearchPlan {
  intent: string;
  searches: PlannedSearch[];
  complex: boolean;
  deep: boolean;
}
export function fallbackPlan(input: SearchInput): SearchPlan {
  const q = input.query.toLowerCase();
  const set = new Set<SourceEngine>();
  if (input.sources.length) input.sources.forEach((s) => set.add(s));
  else if (input.mode !== "universe") set.add(input.mode as SourceEngine);
  else {
    if (
      /paper|research|scient|scholar|efficient|inference|medical|quantum|climate|transformer|neural|model|lab\b/i.test(
        q,
      )
    )
      set.add("scholar");
    if (
      /job|intern|hiring|career|opportunit|work with|where can i work/i.test(q)
    )
      set.add("jobs");
    if (
      /news|happening|changed|latest|recent|this (week|month)|regulation|current|event/i.test(
        q,
      )
    )
      set.add("news");
    if (/patent|invent|innovation|intellectual property/i.test(q))
      set.add("patents");
    set.add("web");
  }
  return {
    intent: input.query,
    searches: [...set].map((source) => ({
      source,
      query:
        source === "jobs" && !/job|intern|hiring|career/i.test(q)
          ? profileQuery(`${input.query} research jobs`, source, input.profile)
          : profileQuery(input.query, source, input.profile),
      reason: input.sources.length
        ? "Selected by the user."
        : `Relevant to the query’s ${source} intent.`,
    })),
    complex: /compare|versus|contradict|disput|conflict|\bvs\b/i.test(q),
    deep: /\b(deep investigation|deep research|comprehensive investigation)\b/i.test(
      q,
    ),
  };
}
export function engineParameters(
  search: PlannedSearch,
  profile?: Profile,
): Record<string, unknown> {
  const params: Record<string, unknown> = {
    engine: ENGINES[search.source],
    q: search.query,
    hl: "en",
  };
  if (search.source === "scholar") {
    params.num = 8;
    if (/latest|recent|this year/i.test(search.query))
      params.as_ylo = new Date().getFullYear() - 1;
    if (profile?.mode === "scholar") {
      if (profile.yearFrom) params.as_ylo = profile.yearFrom;
      if (profile.yearTo) params.as_yhi = profile.yearTo;
      if (profile.sort === "Newest") params.scisbd = 1;
    }
  }
  if (search.source === "patents") {
    delete params.hl;
    params.num = 10;
    if (/latest|recent|newest/i.test(search.query)) params.sort = "new";
  }
  if (search.source === "jobs") {
    if (/\bindia\b/i.test(search.query)) params.gl = "in";
  }
  if (search.source === "news") {
    if (/this week|past week|last week/i.test(search.query))
      params.q += " when:7d";
    else if (/this month|past month/i.test(search.query))
      params.q += " when:30d";
  }
  if (search.source === "web") {
    if (/this week|past week/i.test(search.query)) params.tbs = "qdr:w";
    else if (/this month|past month/i.test(search.query)) params.tbs = "qdr:m";
  }
  if (profile?.mode === "news" && search.source === "news")
    params.hl = {
      English: "en",
      Hindi: "hi",
      Spanish: "es",
      French: "fr",
      German: "de",
    }[profile.language];
  return params;
}
