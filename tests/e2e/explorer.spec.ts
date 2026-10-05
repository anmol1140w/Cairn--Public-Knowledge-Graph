import { expect, test } from "@playwright/test";

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
