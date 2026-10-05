import { readFile, writeFile } from "node:fs/promises";
import { BRAND } from "../src/lib/brand.ts";

const check = process.argv.includes("--check");
const packagePath = new URL("../package.json", import.meta.url);
const lockPath = new URL("../package-lock.json", import.meta.url);
const readmePath = new URL("../README.md", import.meta.url);
const iconPath = new URL("../src/app/icon.svg", import.meta.url);
const pkg = JSON.parse(await readFile(packagePath, "utf8"));
const lock = JSON.parse(await readFile(lockPath, "utf8"));
const readme = await readFile(readmePath, "utf8");
const header = `<!-- brand:start -->\n# ${BRAND.name}\n\n**${BRAND.tagline}**\n\n${BRAND.description}\n<!-- brand:end -->`;
const icon = BRAND.mark.replace('fill="currentColor"', 'fill="#185f59"');
if (check) {
  if (
    pkg.name !== BRAND.slug ||
    lock.name !== BRAND.slug ||
    lock.packages[""].name !== BRAND.slug ||
    !readme.includes(header) ||
    (await readFile(iconPath, "utf8")).trim() !== icon
  )
    throw new Error(
      "Generated branding is out of date. Run npm run brand:sync.",
    );
  console.info(
    "Brand name, README, package names and icon match src/lib/brand.ts.",
  );
} else {
  pkg.name = BRAND.slug;
  lock.name = BRAND.slug;
  lock.packages[""].name = BRAND.slug;
  await writeFile(packagePath, JSON.stringify(pkg, null, 2) + "\n");
  await writeFile(lockPath, JSON.stringify(lock, null, 2) + "\n");
  await writeFile(
    readmePath,
    readme.replace(/<!-- brand:start -->[\s\S]*?<!-- brand:end -->/, header),
  );
  await writeFile(iconPath, icon + "\n");
  console.info("Generated branding from src/lib/brand.ts.");
}
