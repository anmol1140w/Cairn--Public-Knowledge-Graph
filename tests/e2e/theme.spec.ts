import { expect, test } from "@playwright/test";

test("light theme is the default and dark theme survives reload", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".knowledge-app")).not.toHaveClass(/dark-theme/);
  await expect(page.locator(".knowledge-app")).toHaveCSS("background-color", "rgb(246, 245, 241)");
  await page.getByRole("button", { name: "Use dark theme" }).click();
  await expect(page.locator(".knowledge-app")).toHaveCSS("background-color", "rgb(21, 28, 33)");
  await page.reload();
  await expect(page.locator(".knowledge-app")).toHaveClass(/dark-theme/);
  await page.getByRole("button", { name: "Use light theme" }).click();
  await page.locator(".confidence-why").first().getByText("Why?", { exact: true }).click();
  await expect(page.locator(".confidence-why").first().locator("p")).toBeVisible();
});
