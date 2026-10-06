import { readFile } from "node:fs/promises";

const css = await readFile("src/app/globals.css", "utf8");
const block = (selector) => {
  const start = css.indexOf(selector);
  const end = css.indexOf("}", start);
  return css.slice(start, end);
};
const tokens = (text) => Object.fromEntries([...text.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((match) => [match[1], match[2]]));
const light = tokens(block(":root"));
const dark = tokens(block(".dark-theme"));
const luminance = (hex) => {
  const rgb = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255).map((value) => value <= .03928 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
};
const ratio = (a, b) => { const first = luminance(a), second = luminance(b); return (Math.max(first, second) + .05) / (Math.min(first, second) + .05); };
const pairs = [
  ["foreground", "background", 4.5], ["foreground", "surface", 4.5], ["muted", "background", 4.5], ["muted", "surface", 4.5],
  ["accent", "background", 4.5], ["accent", "surface", 4.5], ["accent-ink", "accent", 4.5], ["foreground", "accent-soft", 4.5],
  ["color-inferred", "background", 4.5], ["color-warning", "background", 4.5], ["color-error", "background", 4.5], ["color-success", "background", 4.5],
];
const failures = [];
for (const [name, values] of Object.entries({ light, dark })) for (const [foreground, background, minimum] of pairs) {
  const result = ratio(values[foreground], values[background]);
  if (!values[foreground] || !values[background] || result < minimum) failures.push(`${name}: ${foreground}/${background} = ${result.toFixed(2)} (required ${minimum})`);
}
if (failures.length) { console.error(`Contrast check failed:\n${failures.join("\n")}`); process.exit(1); }
console.log(`Contrast check passed: ${pairs.length} token pairs across light and dark themes.`);
