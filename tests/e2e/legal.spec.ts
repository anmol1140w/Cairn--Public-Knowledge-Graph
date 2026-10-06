import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("public policies are readable, accessible and linked from the workspace", async ({ page }) => {
  const providerRequests: string[] = [];
  page.on("request", (request) => {
    if (/\/api\/(search|details|more)|ollama\.com|serpapi\.com/.test(request.url())) providerRequests.push(request.url());
  });
  await page.goto("/");
  await page.locator(".site-footer").getByRole("link", { name: "Privacy", exact: true }).click();
  for (const policy of [{ path: "/privacy", title: "Privacy Policy" }, { path: "/terms", title: "Terms of Service" }]) {
    const response = await page.goto(policy.path);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(`${policy.title} — Cairn`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(policy.title);
    await expect(page.locator("link[rel='canonical']")).toHaveAttribute("href", `https://cairn-pkg.vercel.app${policy.path}`);
    const audit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(audit.violations.map((violation) => violation.id)).toEqual([]);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.setViewportSize({ width: 1440, height: 1050 });
  }
  expect(providerRequests).toEqual([]);
});

test("sign-in shows bold policy links and incomplete registration cannot skip acceptance", async ({ page }) => {
  await page.goto("/signin");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Welcome to Cairn");
  for (const label of ["Terms of Service", "Privacy Policy"]) {
    await expect(page.locator(".policy-reference").getByRole("link", { name: label })).toHaveCSS("font-weight", "700");
  }
  await page.goto("/auth/consent");
  await expect(page).toHaveURL(/\/signin/);
  await expect(page.getByRole("checkbox")).toHaveCount(0);
});
