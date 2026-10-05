// Explicit manual integration check. Never runs as part of the offline test suite.
// At most two primary SerpApi requests; identical reruns reuse the app cache.
const base = process.env.APP_URL ?? "http://localhost:3000";
const beforeResponse = await fetch(`${base}/api/status`);
const before = await beforeResponse.json();
const cookie = beforeResponse.headers.get("set-cookie")?.split(";")[0] ?? "";
if (!before.searchConfigured || !before.databaseReady)
  throw new Error(
    "Live integration is not configured or PostgreSQL is unavailable.",
  );
console.info("Starting capped live check: Scholar + News.");
const response = await fetch(`${base}/api/search`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: cookie },
  body: JSON.stringify({
    query: "efficient LLM inference PagedAttention FlashAttention",
    sources: ["scholar", "news"],
    mode: "universe",
    simplified: false,
  }),
  signal: AbortSignal.timeout(295000),
});
if (!response.ok)
  throw new Error((await response.json()).error ?? "Live search failed.");
const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = "";
let result;
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const frames = buffer.split("\n\n");
  buffer = frames.pop() ?? "";
  for (const frame of frames) {
    const line = frame.split("\n").find((v) => v.startsWith("data: "));
    if (!line) continue;
    const event = JSON.parse(line.slice(6));
    if (event.kind === "stage" && event.state === "complete")
      console.info(`✓ ${event.stage}`);
    if (
      event.kind === "source" &&
      ["success", "error"].includes(event.source.state)
    )
      console.info(
        `${event.source.source}: ${event.source.state}, ${event.source.count ?? 0} records${event.source.cached ? " (cached)" : ""}${event.source.message ? ` — ${event.source.message}` : ""}`,
      );
    if (event.kind === "error") throw new Error(event.message);
    if (event.kind === "result") result = event.result;
  }
}
if (!result) throw new Error("The stream ended without an investigation.");
if (result.demo || !result.evidence.length)
  throw new Error("Expected genuine retrieved evidence.");
const ids = new Set(result.evidence.map((e) => e.id));
if (result.claims.some((c) => !c.evidenceIds.every((id) => ids.has(id))))
  throw new Error("A claim references unavailable evidence.");
if (result.relationships.some((r) => !r.evidenceIds.every((id) => ids.has(id))))
  throw new Error("A relationship references unavailable evidence.");
const after = await (
  await fetch(`${base}/api/status`, { headers: { Cookie: cookie } })
).json();
const attempted = after.dailyUsage - before.dailyUsage;
if (attempted > 2)
  throw new Error(`Budget exceeded: ${attempted} search attempts.`);
console.info(
  JSON.stringify(
    {
      evidence: result.evidence.length,
      entities: result.entities.length,
      relationships: result.relationships.length,
      groundedClaims: result.claims.length,
      searchAttempts: attempted,
      warnings: result.warnings,
    },
    null,
    2,
  ),
);
