import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { DEMO } from "../../src/lib/demo";

test("preloaded Scholar, Jobs and News examples issue no search or model requests", async ({
  page,
}) => {
  const posts: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST") posts.push(r.url());
  });
  await page.goto("/");
  for (const mode of ["Scholar", "Jobs", "News"]) {
    await page
      .locator(".demo-examples")
      .getByRole("button", { name: new RegExp(`^${mode}`) })
      .click();
    await expect(page.locator(".main-nav button.active")).toHaveText(mode);
    await expect(page.locator(".graph-corner-label")).toContainText(
      "Demo data",
    );
    await expect(page.locator(".result-row").first()).toBeVisible();
  }
  expect(posts).toEqual([]);
});
test("light, dark and mobile profile UI pass WCAG AA automated checks", async ({
  page,
}) => {
  await page.goto("/");
  const audit = async () => {
    if (await page.getByRole("dialog").count())
      await expect(page.locator(".modal")).toHaveCSS("opacity", "1");
    else
      await expect(page.locator(".result-row").first()).toHaveCSS(
        "opacity",
        "1",
      );
    const results = await new AxeBuilder({ page })
      .include(".knowledge-app")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      results.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes
          .slice(0, 2)
          .map((n) => ({ target: n.target, reason: n.failureSummary })),
      })),
    ).toEqual([]);
  };
  await audit();
  for (const mode of ["Scholar", "News", "Jobs", "Patents"]) {
    await page
      .locator(".main-nav")
      .getByRole("button", { name: mode, exact: true })
      .click();
    await audit();
  }
  await page.getByRole("button", { name: "Use dark theme" }).click();
  await audit();
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .locator(".main-nav")
    .getByRole("button", { name: "Jobs", exact: true })
    .click();
  await page
    .locator(".workspace-sidebar")
    .getByRole("button", { name: "Add your details" })
    .click();
  await audit();
});
test("large graph uses instancing and progressively reveals the initial 1000-node cap", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/status", (route) =>
    route.fulfill({ json: { searchConfigured: true } }),
  );
  const entities = Array.from({ length: 1100 }, (_, i) => ({
    ...DEMO.entities[1],
    id: `fixture-${i}`,
    title: `Offline fixture node ${i}`,
    label: `Fixture ${i}`,
  }));
  const run = {
    ...DEMO,
    id: "offline-large-fixture",
    entities: [DEMO.entities[0], ...entities],
    relationships: entities.map((e) => ({
      id: `edge-${e.id}`,
      source: "topic",
      target: e.id,
      type: "related_to",
      inferred: true,
      evidenceIds: ["flash"],
    })),
    claims: [],
  };
  await page.route("**/api/search", (route) =>
    route.fulfill({
      contentType: "text/event-stream",
      body: `data: ${JSON.stringify({ kind: "result", result: run })}\n\n`,
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Switch to live search" }).click();
  await page
    .getByRole("textbox", { name: "Search public knowledge" })
    .fill("offline fixture");
  await page
    .getByRole("button", { name: "Explore knowledge", exact: true })
    .click();
  await expect(page.locator(".three-universe")).toHaveAttribute(
    "data-renderer",
    "instanced",
  );
  await expect(page.locator(".explorer-heading")).toContainText("1000 of 1101");
  await page.getByRole("button", { name: /Show more/ }).click();
  await expect(page.locator(".explorer-heading")).toContainText("1101 of 1101");
  await expect(page.locator(".node-label:visible").first()).toBeVisible();
});
test("touch pinch zoom works in the mobile 2D viewer", async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: "http://localhost:3100",
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto("/");
  const stage = page.locator(".scene-stage");
  await stage.scrollIntoViewIfNeeded();
  await page
    .getByRole("button", { name: "Activate viewer", exact: true })
    .click();
  await stage.scrollIntoViewIfNeeded();
  const bounds = (await stage.boundingBox())!,
    y = Math.max(50, bounds.y + bounds.height / 2),
    center = bounds.x + bounds.width / 2;
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { id: 1, x: center - 30, y },
      { id: 2, x: center + 30, y },
    ],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      { id: 1, x: center - 60, y },
      { id: 2, x: center + 60, y },
    ],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(page.locator(".zoom-readout")).not.toHaveText("100%");
  await context.close();
});
