// Inspect the real saved live graph without making search/model requests.
import { chromium } from "playwright";
import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const result = await pool.query(
  "SELECT id,session_id FROM search_runs WHERE status='complete' AND investigation IS NOT NULL ORDER BY created_at DESC LIMIT 1",
);
await pool.end();
const browser = await chromium.launch({
  args: ["--enable-unsafe-swiftshader"],
});
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
  });
  if (result.rows[0])
    await context.addCookies([
      {
        name: "pkg-session",
        value: result.rows[0].session_id,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Strict",
      },
    ]);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://localhost:3000");
  await page
    .locator(".projected-node-label")
    .first()
    .waitFor({ state: "visible" });
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll(".result-row")).every(
      (el) => getComputedStyle(el).opacity === "1",
    ),
  );
  await page.screenshot({
    path: "artifacts/universe-desktop.png",
    fullPage: true,
  });
  if (result.rows[0]) {
    await page.keyboard.press("Control+k");
    await page
      .getByRole("textbox", { name: "Search commands" })
      .fill("recent investigations");
    await page.keyboard.press("Enter");
    await page.locator(".history-list button").first().click();
    await page
      .locator(".graph-corner-label")
      .filter({ hasText: "LIVE EVIDENCE" })
      .waitFor();
    await page.screenshot({
      path: "artifacts/universe-live.png",
      fullPage: false,
    });
    await page.locator(".claim-row").first().click();
    await page
      .getByRole("dialog", { name: "Why do we believe this?" })
      .waitFor();
    await page.waitForFunction(() => {
      const el = document.querySelector(".evidence-drawer");
      return el && el.getBoundingClientRect().right <= window.innerWidth + 1;
    });
    await page.screenshot({
      path: "artifacts/live-evidence.png",
      fullPage: false,
    });
  }
  if (errors.length) throw new Error(errors.join("\n"));
  console.info("Visual snapshots captured; no search or model requests made.");
} finally {
  await browser.close();
}
