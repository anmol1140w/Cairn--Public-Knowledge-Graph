import { createHash, randomBytes, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import pg from "pg";
import { LEGAL } from "../../src/lib/legal";

// Run only against the explicitly configured local/dedicated test database.
test.skip(!process.env.CAIRN_TEST_DATABASE_URL, "Set CAIRN_TEST_DATABASE_URL to exercise real acceptance persistence.");
let pool: pg.Pool;
let providerId: string;
let pendingHash: string;

test.beforeAll(() => {
  pool = new pg.Pool({ connectionString: process.env.CAIRN_TEST_DATABASE_URL });
});

test.beforeEach(async ({ context }) => {
  providerId = `consent-browser-${randomUUID()}`;
  const token = randomBytes(32).toString("base64url");
  pendingHash = createHash("sha256").update(token).digest("hex");
  await pool.query(
    "INSERT INTO pending_google_signins(token_hash,provider_account_id,name,email,expires_at) VALUES($1,$2,'Acceptance Reader',$3,now()+interval '10 minutes')",
    [pendingHash, providerId, `${providerId}@example.com`],
  );
  const secure = process.env.APP_HTTPS === "true";
  await context.addCookies([{ name: `${secure ? "__Secure-" : ""}cairn.pending-signin`, value: token, url: "http://localhost:3100", httpOnly: true, secure, sameSite: "Lax" }]);
});

test.afterEach(async () => {
  if (!pool) return;
  await pool.query("DELETE FROM auth_users WHERE id IN (SELECT user_id FROM auth_accounts WHERE provider='google' AND provider_account_id=$1)", [providerId]);
  await pool.query("DELETE FROM pending_google_signins WHERE token_hash=$1", [pendingHash]);
});

test.afterAll(async () => { await pool?.end(); });

test("explicit acceptance creates the account and is remembered by the signed-in session", async ({ page }) => {
  await page.goto("/auth/consent");
  await expect(page.getByRole("heading", { name: "Review and accept" })).toBeVisible();
  const button = page.getByRole("button", { name: "Accept and continue" });
  await expect(button).toBeDisabled();
  const before = await pool.query("SELECT user_id FROM auth_accounts WHERE provider='google' AND provider_account_id=$1", [providerId]);
  expect(before.rowCount).toBe(0);
  for (const policy of [{ name: "Terms of Service", href: "/terms" }, { name: "Privacy Policy", href: "/privacy" }]) {
    const link = page.locator(".consent-check").getByRole("link", { name: policy.name });
    await expect(link).toHaveAttribute("href", policy.href);
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveCSS("font-weight", "700");
  }
  const audit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(audit.violations.map((violation) => violation.id)).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("checkbox").check();
  await expect(button).toBeEnabled();
  await button.click();
  await expect(page).toHaveURL("/");
  await expect(page.locator(".account-button")).toHaveText("Acceptance Reader");
  const receipt = (await pool.query("SELECT u.legal_accepted_at,u.terms_version,u.privacy_version FROM auth_users u JOIN auth_accounts a ON a.user_id=u.id WHERE a.provider='google' AND a.provider_account_id=$1", [providerId])).rows[0];
  expect(receipt.legal_accepted_at).toBeInstanceOf(Date);
  expect(receipt).toMatchObject({ terms_version: LEGAL.termsVersion, privacy_version: LEGAL.privacyVersion });
  await page.goto("/auth/consent");
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("checkbox")).toHaveCount(0);
});

test("cancelling leaves Demo available and creates no account", async ({ page }) => {
  await page.goto("/auth/consent");
  await page.getByRole("button", { name: "Cancel and use Demo" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.locator(".data-mode")).toHaveText("Demo data");
  expect((await pool.query("SELECT user_id FROM auth_accounts WHERE provider='google' AND provider_account_id=$1", [providerId])).rowCount).toBe(0);
  expect((await pool.query("SELECT token_hash FROM pending_google_signins WHERE token_hash=$1", [pendingHash])).rowCount).toBe(0);
});
