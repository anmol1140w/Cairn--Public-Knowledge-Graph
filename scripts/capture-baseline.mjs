// Phase 0 baseline: deterministic, offline screenshots for every mode, width and theme.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const url = "http://127.0.0.1:3102";
const widths = [390, 768, 1024, 1440];
const modes = ["Explore", "Scholar", "News", "Jobs", "Patents"];
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3102"],
  { env: { ...process.env, CAIRN_TEST: "1" }, stdio: "ignore" },
);
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (server.exitCode !== null) throw new Error("Baseline screenshot server exited.");
    if (await fetch(url).then((response) => response.ok).catch(() => false)) {
      ready = true;
      break;
    }
    await delay(1000);
  }
  if (!ready) throw new Error("Baseline screenshot server did not become ready.");
  browser = await chromium.launch({ args: ["--enable-unsafe-swiftshader"] });
  for (const theme of ["light", "dark"]) {
    for (const width of widths) {
      const context = await browser.newContext({
        viewport: { width, height: width < 500 ? 844 : 1050 },
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      await page.route("**/api/status", (route) =>
        route.fulfill({ json: { searchConfigured: false } }),
      );
      await page.goto(url);
      const dismiss = page.getByRole("button", {
        name: "Dismiss display preferences introduction",
      });
      if (await dismiss.isVisible().catch(() => false)) await dismiss.click();
      if (theme === "dark")
        await page.getByRole("button", { name: "Use dark theme" }).click();
      for (const mode of modes) {
        if (mode !== "Explore")
          await page.locator(".main-nav").getByRole("button", { name: mode, exact: true }).click();
        await page.locator(".node-label:visible").first().waitFor({ timeout: 15000 });
        await page.waitForFunction(() =>
          [...document.querySelectorAll(".result-row")].every(
            (element) => getComputedStyle(element).opacity === "1",
          ),
        );
        await page.screenshot({
          path: `docs/baseline/screenshots/${theme}-${width}-${mode.toLowerCase()}.png`,
          fullPage: true,
        });
      }
      await context.close();
    }
  }
  console.info(`Captured ${widths.length * modes.length * 2} Phase 0 screenshots.`);
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
