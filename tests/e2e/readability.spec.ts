import { expect, test } from "@playwright/test";

test("readable minimum font sizes and 25% larger text", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Graph list view" }).click();
  const smallText = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".knowledge-app *"))
      .filter(
        (el) =>
          el.getClientRects().length &&
          getComputedStyle(el).visibility !== "hidden" &&
          Array.from(el.childNodes).some(
            (node) =>
              node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
          ),
      )
      .map((el) => ({
        text: el.textContent?.slice(0, 50),
        size: parseFloat(getComputedStyle(el).fontSize),
      }))
      .filter((el) => el.size < 14),
  );
  expect(smallText).toEqual([]);
  const paragraph = page.locator(".hero-subtitle");
  const normalSize = await paragraph.evaluate((el) =>
    parseFloat(getComputedStyle(el).fontSize),
  );
  expect(normalSize).toBeGreaterThanOrEqual(16);
  await page
    .getByRole("button", { name: "Accessibility settings", exact: true })
    .click();
  await page.getByRole("switch", { name: /Large text/ }).click();
  await page.getByRole("button", { name: "Close dialog" }).click();
  expect(
    await paragraph.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
  ).toBeCloseTo(normalSize * 1.25, 1);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
