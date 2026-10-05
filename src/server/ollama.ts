import "server-only";
import { Ollama } from "ollama";
import { z } from "zod";
import { createHash } from "node:crypto";
import { config } from "./config";
import { readCache, writeCache } from "./storage";

let active = 0;
const queue: (() => void)[] = [];
async function modelSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= 2) await new Promise<void>((resolve) => queue.push(resolve));
  else active++;
  try {
    return await fn();
  } finally {
    const next = queue.shift();
    if (next) next();
    else active--;
  }
}
export function extractJson(value: string): unknown {
  const cleaned = value
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start)
      return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("The model did not return a valid evidence object.");
  }
}
export async function modelJson<T>(
  model: string,
  system: string,
  prompt: string,
  schema: z.ZodType<T>,
  signal?: AbortSignal,
  maxTokens = 2800,
): Promise<T> {
  if (!config.ollamaKey())
    throw new Error(
      "AI synthesis needs a server-side OLLAMA_API_KEY. Retrieved search evidence remains available.",
    );
  const schemaText = JSON.stringify(z.toJSONSchema(schema));
  const cacheKey = `model-${createHash("sha256").update(JSON.stringify({ model, system, prompt, schemaText })).digest("hex")}`;
  const cached = await readCache(cacheKey).catch(() => null);
  if (cached) {
    const parsed = schema.safeParse(cached.payload.value);
    if (parsed.success) return parsed.data;
  }
  return modelSlot(async () => {
    signal?.throwIfAborted();
    const timeout = AbortSignal.timeout(100000);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    const client = new Ollama({
      host: config.ollamaHost(),
      headers: { Authorization: `Bearer ${config.ollamaKey()}` },
      fetch: (input, init) => fetch(input, { ...init, signal: combined }),
    });
    const messages = [
      {
        role: "system",
        content: `${system}\nReturn ONLY a JSON object matching this schema. No markdown or private reasoning.\n${schemaText}`,
      },
      { role: "user", content: prompt.slice(0, 70000) },
    ];
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      combined.throwIfAborted();
      const response = await client.chat({
        model,
        messages,
        stream: false,
        think: model.startsWith("gpt-oss") ? "low" : false,
        options: { temperature: 0.1, num_predict: maxTokens },
      });
      try {
        const parsed = schema.parse(extractJson(response.message.content));
        await writeCache(
          cacheKey,
          `ollama:${model}`,
          { model },
          { value: parsed },
          3600,
        ).catch(() => {});
        return parsed;
      } catch (error) {
        lastError = error;
        if (attempt === 0)
          messages.push(
            {
              role: "assistant",
              content: response.message.content.slice(0, 14000),
            },
            {
              role: "user",
              content: `The output failed validation: ${error instanceof Error ? error.message.slice(0, 1000) : "Invalid JSON"}. Return a corrected, concise JSON object. Use only the supplied source IDs.`,
            },
          );
      }
    }
    throw new Error(
      `The model response could not be validated: ${lastError instanceof Error ? lastError.message.slice(0, 150) : "invalid structured content"}`,
    );
  });
}
