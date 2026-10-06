import { expect, test } from "@playwright/test";
import { loginAs } from "../helpers/browser";
test("job details validate inline, stay in tab storage, and can be cleared", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page
    .locator(".main-nav")
    .getByRole("button", { name: "Jobs", exact: true })
    .click();
  await page
    .locator(".workspace-sidebar")
    .getByRole("button", { name: "Add your details" })
    .click();
  await page
    .getByLabel("Roles (up to 3)", { exact: true })
    .fill("One, Two, Three, Four");
  await page.getByLabel("Roles (up to 3)", { exact: true }).press("Enter");
  await expect(page.locator(".field-error")).toBeVisible();
  await page.getByRole("button", { name: "Remove Four", exact: true }).click();
  await page.getByLabel("Add a skill", { exact: true }).fill("Python");
  await page.getByLabel("Add a skill", { exact: true }).press("Enter");
  await page
    .getByRole("button", { name: "Apply details", exact: true })
    .click();
  await expect(page.locator(".profile-summary")).toContainText("Python");
  expect(
    await page.evaluate(() => localStorage.getItem("pkg-preferences")),
  ).not.toContain("Python");
  expect(
    await page.evaluate(() => sessionStorage.getItem("cairn-session-details")),
  ).toContain("Python");
  await page.reload();
  await page
    .locator(".main-nav")
    .getByRole("button", { name: "Jobs", exact: true })
    .click();
  await expect(page.locator(".profile-summary")).toContainText("Python");
  const separateTab = await context.newPage();
  await separateTab.goto("/");
  expect(
    await separateTab.evaluate(() =>
      sessionStorage.getItem("cairn-session-details"),
    ),
  ).toBeNull();
  await separateTab.close();
  await page
    .locator(".workspace-sidebar")
    .getByRole("button", { name: "Clear my details", exact: true })
    .click();
  expect(
    await page.evaluate(() => sessionStorage.getItem("cairn-session-details")),
  ).not.toContain("Python");
});

test("mode profiles reach one search request", async ({ page }) => {
  await loginAs(page);
  await page.route("**/api/status", (route) =>
    route.fulfill({ json: { searchConfigured: true } }),
  );
  let searches = 0;
  let body: Record<string, unknown> = {};
  await page.route("**/api/search", async (route) => {
    searches++;
    body = route.request().postDataJSON();
    await route.fulfill({
      status: 503,
      json: { error: "Offline profile request captured" },
    });
  });
  await page.goto("/");
  await page
    .locator(".main-nav")
    .getByRole("button", { name: "Scholar", exact: true })
    .click();
  await page
    .locator(".workspace-sidebar")
    .getByRole("button", { name: "Add your details" })
    .click();
  await page
    .getByLabel("Research field", { exact: true })
    .fill("Computer science");
  await page.getByText("Add more detail", { exact: true }).click();
  await page.getByLabel("From year", { exact: true }).fill("2026");
  await page.getByLabel("To year", { exact: true }).fill("2020");
  await expect(page.locator(".field-error")).toContainText("End year");
  await page.getByLabel("To year", { exact: true }).fill("2026");
  await page
    .getByRole("button", { name: "Apply details", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Switch to live search", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Search public knowledge" })
    .fill("efficient inference");
  await page
    .getByRole("button", { name: "Explore knowledge", exact: true })
    .click();
  await expect(page.locator(".search-error")).toContainText("captured");
  expect(searches).toBe(1);
  expect(body.profile).toMatchObject({
    mode: "scholar",
    field: "Computer science",
    yearFrom: 2026,
  });
  expect(body.saveProfile).toBe(false);
});
test("résumé import stays local and only reviewed skills are applied", async ({
  page,
}) => {
  const posts: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") posts.push(request.url());
  });
  await page.goto("/");
  await page
    .locator(".main-nav")
    .getByRole("button", { name: "Jobs", exact: true })
    .click();
  await page
    .locator(".workspace-sidebar")
    .getByRole("button", { name: "Add your details" })
    .click();
  await page.getByText("Add more detail", { exact: true }).click();
  await page
    .getByLabel("Optional local résumé (.txt)", { exact: true })
    .setInputFiles({
      name: "resume.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Confidential résumé personal-identifier Python SQL"),
    });
  await expect(
    page
      .locator(".local-resume")
      .getByRole("button", { name: "Add Python", exact: true }),
  ).toBeVisible();
  await page
    .locator(".local-resume")
    .getByRole("button", { name: "Add Python", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Apply details", exact: true })
    .click();
  const storage = await page.evaluate(() =>
    sessionStorage.getItem("cairn-session-details"),
  );
  expect(storage).toContain("Python");
  expect(storage).not.toContain("personal-identifier");
  expect(posts).toEqual([]);
});
