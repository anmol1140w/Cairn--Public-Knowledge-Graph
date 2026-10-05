import { expect, test } from "@playwright/test";

test("visible labels do not overlap in 3D or 2D and respect reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".three-universe")).toHaveAttribute("data-rotation", "paused");
  await expect(page.getByRole("button", { name: "Auto-rotate", exact: true })).toBeDisabled();
  for (const view of ["3D", "2D"]) {
    if (view === "2D") await page.getByRole("button", { name: view, exact: true }).click();
    await expect(page.locator(".node-label:visible").first()).toBeVisible();
    const labels = await page.locator(".node-label:visible").evaluateAll((elements) => elements.map((element) => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, font: parseFloat(getComputedStyle(element).fontSize) }; }));
    for (let i = 0; i < labels.length; i++) { const a = labels[i]; expect(a.font).toBeGreaterThanOrEqual(13); for (const b of labels.slice(i + 1)) expect(a.x >= b.x + b.width - 1 || a.x + a.width <= b.x + 1 || a.y >= b.y + b.height - 1 || a.y + a.height <= b.y + 1).toBe(true); }
  }
});

test("Explorer leaves wheel scrolling to the page until activated and Escape releases it", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "2D", exact: true }).click();
  const stage = page.locator(".scene-stage");
  await stage.scrollIntoViewIfNeeded();
  const box = (await stage.boundingBox())!;
  await page.mouse.move(box.x + 10, box.y + 100);
  const initialY = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 150);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(initialY);
  await expect(page.locator(".zoom-readout")).toHaveText("100%");
  await page
    .getByRole("button", { name: "Activate viewer", exact: true })
    .click();
  await stage.scrollIntoViewIfNeeded();
  const activeBox = (await stage.boundingBox())!;
  await page.mouse.move(activeBox.x + 10, activeBox.y + 100);
  const activeY = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, -100);
  await expect(page.locator(".zoom-readout")).toHaveText("115%");
  expect(await page.evaluate(() => window.scrollY)).toBe(activeY);
  await page.keyboard.press("Escape");
  await expect(stage).not.toHaveClass(/viewer-active/);
});

test("keyboard controls and fullscreen preserve zoom and page position", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "2D", exact: true }).click();
  await page
    .getByRole("button", { name: "Activate viewer", exact: true })
    .click();
  await page.keyboard.press("+");
  await expect(page.locator(".zoom-readout")).toHaveText("115%");
  const y = await page.evaluate(() => window.scrollY);
  await page.keyboard.press("f");
  await expect(page.locator(".explorer")).toHaveClass(/explorer-fullscreen/);
  await page.keyboard.press("Escape");
  await expect(page.locator(".explorer")).not.toHaveClass(
    /explorer-fullscreen/,
  );
  await expect(page.locator(".zoom-readout")).toHaveText("115%");
  expect(await page.evaluate(() => window.scrollY)).toBe(y);
  await page.getByRole("button", { name: "Fit to view", exact: true }).click();
  await expect(page.locator(".zoom-readout")).toHaveText("100%");
  await page.getByLabel("Viewer size").selectOption("compact");
  await expect(page.locator(".explorer")).toHaveClass(/explorer-compact/);
});
