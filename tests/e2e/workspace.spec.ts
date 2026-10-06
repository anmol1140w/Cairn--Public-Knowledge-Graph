import { expect, test } from "@playwright/test";
import { loginAs } from "../helpers/browser";

test("knowledge universe, spatial evidence, commands, and source-linked export", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Search research, jobs,",
  );
  await expect(page.locator(".data-mode")).toContainText("Demo data");
  await expect(page.locator(".node-label").first()).toBeVisible({
    timeout: 20000,
  });
  await page.screenshot({
    path: testInfo.outputPath("universe-desktop.png"),
    fullPage: false,
  });
  await page
    .getByRole("button", { name: "Graph list view", exact: true })
    .click();
  await page
    .locator(".graph-list button")
    .filter({ hasText: "FlashAttention" })
    .first()
    .click();
  await expect(page.locator(".entity-panel")).toBeVisible();
  await expect(page.locator(".entity-panel h2")).toContainText(
    "FlashAttention",
  );
  await page
    .locator(".panel-tabs")
    .getByRole("button", { name: "evidence", exact: true })
    .click();
  await expect(page.locator(".panel-evidence a")).toHaveAttribute(
    "href",
    "https://arxiv.org/abs/2205.14135",
  );
  await page.getByRole("button", { name: "Close entity panel" }).click();
  await page.locator(".claim-row").first().click();
  await expect(
    page.getByRole("dialog", { name: "Why do we believe this?" }),
  ).toBeVisible();
  await expect(page.locator(".drawer-source")).toHaveCount(3);
  await page
    .getByRole("button", { name: "Show supporting nodes on graph" })
    .click();
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog", { name: "Commands" })).toBeVisible();
  await page.getByRole("textbox", { name: "Search commands" }).fill("export");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "Export evidence" }),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("dialog", { name: "Export evidence" })
    .getByRole("button", { name: "Export evidence", exact: true })
    .click();
  expect((await downloadPromise).suggestedFilename()).toBe(
    "demo-cairn-evidence.md",
  );
  expect(errors).toEqual([]);
});

test("demo progress and meaningful investigation modes", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Search public knowledge" })
    .fill("What is happening in efficient AI inference?");
  await page
    .getByRole("button", { name: "Explore knowledge", exact: true })
    .click();
  await expect(page.locator(".progress-panel")).toBeVisible();
  await expect(page.locator(".progress-panel")).toBeHidden({ timeout: 15000 });
  await page
    .locator(".main-nav")
    .getByRole("button", { name: "Scholar", exact: true })
    .click();
  await page
    .locator(".example-card")
    .filter({ hasText: "Read efficient-inference papers" })
    .click();
  await expect(page.locator(".scholar-insights")).toBeVisible();
  await expect(page.locator(".result-row")).toHaveCount(4);
  await page
    .locator(".main-nav")
    .getByRole("button", { name: "News", exact: true })
    .click();
  await page
    .locator(".example-card")
    .filter({ hasText: "Compare AI announcements" })
    .click();
  await expect(page.locator(".news-insights")).toBeVisible();
  await expect(page.locator(".novelty-panel")).toContainText(
    "2 underlying events",
  );
  await page
    .locator(".main-nav")
    .getByRole("button", { name: "Patents", exact: true })
    .click();
  await expect(page.locator(".patent-bridge")).toBeVisible();
  await page
    .locator(".main-nav")
    .getByRole("button", { name: "Jobs", exact: true })
    .click();
  await page
    .locator(".example-card")
    .filter({ hasText: "Inspect research career examples" })
    .click();
  await expect(page.locator(".illustrative-label")).toHaveCount(2);
  await expect(page.locator(".result-relevance").first()).toContainText(
    "Evidence confidence",
  );
  await page
    .getByRole("button", { name: "Add your skills", exact: true })
    .click();
  await page.getByLabel("Add a skill", { exact: true }).fill("Python, PyTorch");
  await page.getByLabel("Add a skill", { exact: true }).press("Enter");
  await page
    .getByRole("button", { name: "Apply details", exact: true })
    .click();
  await expect(page.locator(".result-relevance").first()).toContainText(
    "listed skills",
  );
  await expect(page.locator(".result-relevance").first()).toContainText(
    "2 of 3",
  );
});

test("mobile accessibility, timeline, comparison, and empty filters", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".flat-graph")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Explore knowledge", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".search-area")).toHaveCSS("opacity", "1");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("universe-mobile.png"),
    fullPage: false,
  });
  await page
    .getByRole("button", { name: "Accessibility settings", exact: true })
    .click();
  await page.getByRole("switch", { name: /Reduced motion/ }).click();
  await page.getByRole("switch", { name: /High contrast/ }).click();
  await page.getByRole("switch", { name: /Screen reader view/ }).click();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(page.locator(".knowledge-app")).toHaveClass(/high-contrast/);
  await expect(page.locator(".graph-list")).toBeVisible();
  await page
    .getByRole("button", { name: "Open timeline", exact: true })
    .click();
  await page.getByRole("button", { name: "2022", exact: true }).click();
  await expect(page.locator(".timeline-slider-label")).toContainText("2022");
  await page.getByRole("button", { name: "Show all time" }).click();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByRole("button", { name: "Compare entities", exact: true })
    .click();
  await page.getByLabel("First entity").selectOption("mit");
  await page.getByLabel("Second entity").selectOption("stanford");
  await expect(page.locator(".compare-table")).toContainText("MIT");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByRole("textbox", { name: "Filter evidence" })
    .fill("no-match-anywhere");
  await expect(page.locator(".empty-state")).toContainText(
    "No matching evidence",
  );
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
});

test("live error state preserves the labelled demo and supports retry without paid calls", async ({
  page,
}) => {
  await loginAs(page);
  await page.route("**/api/search", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: "The evidence source is temporarily unavailable.",
      }),
    }),
  );
  const status = page.waitForResponse("**/api/status");
  await page.goto("/");
  await status;
  await page.getByRole("button", { name: "Switch to live search" }).click();
  await page
    .getByRole("textbox", { name: "Search public knowledge" })
    .fill("a sourced question");
  await page
    .getByRole("button", { name: "Explore knowledge", exact: true })
    .click();
  await expect(page.locator(".search-error")).toContainText(
    "temporarily unavailable",
  );
  await expect(page.locator(".graph-corner-label")).toContainText("Demo data");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.locator(".search-error")).toBeVisible();
});

test("live mode requires a signed-in account before leaving Demo", async ({
  page,
}) => {
  await page.route("**/api/me", (route) =>
    route.fulfill({
      status: 200,
      json: {
        authenticated: false,
        authConfigured: true,
        user: null,
      },
    }),
  );
  await page.route("**/api/status", (route) =>
    route.fulfill({
      status: 200,
      json: { searchConfigured: true, usage: null },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Switch to live search" }).click();
  await expect(page.locator(".data-mode")).toContainText("Demo data");
  await expect(page.locator(".toast")).toContainText(
    "Sign in with Google before selecting Live search.",
  );
});

test("source selection keeps demo claims scoped to available evidence", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator(".source-select")
    .getByRole("button", { name: "Jobs", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Search public knowledge" })
    .fill("What is happening in efficient AI inference?");
  await page
    .getByRole("button", { name: "Explore knowledge", exact: true })
    .click();
  await expect(page.locator(".progress-panel")).toBeHidden({ timeout: 15000 });
  await expect(page.locator(".claim-list .claim-row")).toHaveCount(0);
  await expect(page.locator(".answer-story")).toContainText(
    "does not establish the research summary",
  );
  await expect(page.locator(".result-row")).toHaveCount(2);
});

test("six-step onboarding is skippable and remembers completion", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Dismiss display preferences introduction" })
    .click();
  await expect(page.locator(".onboarding-guide")).toContainText("1/6");
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.locator(".onboarding-guide")).toContainText("2/6");
  await page.getByRole("button", { name: "Skip tour" }).click();
  await expect(page.locator(".onboarding-guide")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".onboarding-guide")).toHaveCount(0);
});
