import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
const secrets = [
  process.env.SERPAPI_API_KEY,
  process.env.OLLAMA_API_KEY,
].filter(Boolean);
if (!secrets.length)
  throw new Error(
    "Configure server credentials before this explicit bundle check.",
  );
let checked = 0;
async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await inspect(path);
    else if (/\.(js|css|html|json|map)$/.test(entry.name)) {
      const content = await readFile(path, "utf8");
      checked++;
      if (secrets.some((secret) => content.includes(secret)))
        throw new Error(
          `A server credential appeared in a browser asset: ${path}`,
        );
    }
  }
}
await inspect(".next/static");
if (!checked)
  throw new Error("No browser assets found. Build the application first.");
console.info(
  `Checked ${checked} browser assets. No server API keys are included.`,
);
