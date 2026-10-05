/** Single source of truth. Run `npm run brand:sync` after changing this file. */
export const BRAND = {
  name: "Cairn",
  slug: "cairn",
  tagline: "Follow the evidence.",
  description:
    "Search research, jobs, news and patents. See the source behind every answer.",
  mark: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><g fill="currentColor"><ellipse cx="20" cy="10" rx="6" ry="4"/><ellipse cx="20" cy="20" rx="10" ry="4"/><ellipse cx="20" cy="30" rx="15" ry="5"/></g></svg>',
};

export function exportFilename(demo: boolean, extension: string): string {
  return `${demo ? "demo-" : ""}${BRAND.slug}-evidence.${extension}`;
}
