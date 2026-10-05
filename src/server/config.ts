import "server-only";

export const config = {
  serpapiKey: () => process.env.SERPAPI_API_KEY ?? "",
  ollamaKey: () => process.env.OLLAMA_API_KEY ?? "",
  ollamaHost: () => process.env.OLLAMA_HOST ?? "https://ollama.com",
  maxSearches: () =>
    Math.min(
      5,
      Math.max(1, Number(process.env.SERPAPI_MAX_REQUESTS_PER_QUERY) || 5),
    ),
  dailyBudget: () =>
    Math.max(1, Number(process.env.SERPAPI_DAILY_BUDGET) || 25),
  models: () => ({
    router: process.env.OLLAMA_ROUTER_MODEL ?? "nemotron-3-nano:30b",
    extract: process.env.OLLAMA_EXTRACT_MODEL ?? "gpt-oss:20b",
    synthesis: process.env.OLLAMA_SYNTHESIS_MODEL ?? "gpt-oss:120b",
    compare: process.env.OLLAMA_COMPARE_MODEL ?? "nemotron-3-super",
    deep: process.env.OLLAMA_DEEP_MODEL ?? "nemotron-3-ultra",
    simple: process.env.OLLAMA_SIMPLE_MODEL ?? "gemma4:31b",
  }),
};

export function redact(value: string): string {
  let result = value;
  for (const key of [
    config.serpapiKey(),
    config.ollamaKey(),
    process.env.DATABASE_URL ?? "",
  ])
    if (key) result = result.split(key).join("[REDACTED]");
  return result
    .replace(/([?&]api_key=)[^&\s"']+/gi, "$1[REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]");
}
export function cleanSnapshot<T>(value: T): T {
  return JSON.parse(
    redact(
      JSON.stringify(value, (key, item) =>
        ["api_key", "Authorization", "authorization"].includes(key)
          ? undefined
          : item,
      ),
    ),
  ) as T;
}
export function publicError(error: unknown): string {
  const text = redact(error instanceof Error ? error.message : String(error));
  if (/401|403|unauthorized|invalid.*key/i.test(text))
    return "The source rejected its server-side credentials. Check the configured API key.";
  if (/429|rate.?limit|quota|exhausted/i.test(text))
    return "The source’s usage limit was reached. Available evidence is preserved.";
  if (/timeout|timed out|abort/i.test(text))
    return "This source took too long to respond. Try again or continue with available evidence.";
  return text.slice(0, 260);
}
