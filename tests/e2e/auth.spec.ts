import { expect, test } from "@playwright/test";
import { loginAs } from "../helpers/browser";

test("signed-in account controls expose account lifecycle actions", async ({
  page,
}) => {
  await loginAs(page, {
    id: "google-user-1",
    name: "Evidence Reader",
    email: "reader@example.com",
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Evidence Reader", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Evidence Reader", exact: true }).click();
  await expect(page.getByRole("menu")).toContainText("reader@example.com");
  await expect(page.getByRole("menuitem", { name: "Sign out" })).toBeVisible();
  await expect(
    page.getByRole("menuitem", { name: "Delete account" }),
  ).toBeVisible();
});
