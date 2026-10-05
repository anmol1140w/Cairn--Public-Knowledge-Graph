// Reproducible screenshots of preloaded data. No search/model/database requests.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
const url = "http://127.0.0.1:3101";
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3101",
  ],
  { env: { ...process.env, CAIRN_TEST: "1" }, stdio: "ignore" },
);
let browser;
try {
  let ready = false;
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null)
      throw new Error("Screenshot server failed to start on port 3101.");
    if (
      await fetch(url)
        .then((r) => r.ok)
        .catch(() => false)
    ) {
      ready = true;
      break;
    }
    await delay(1000);
  }
  if (!ready) throw new Error("Screenshot server did not become ready.");
  browser = await chromium.launch({ args: ["--enable-unsafe-swiftshader"] });
  const posts = [],
    errors = [];
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 1440 ? 1050 : 844 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await page.route("**/api/status", (route) =>
      route.fulfill({ json: { searchConfigured: false } }),
    );
    page.on("request", (r) => {
      if (r.method() === "POST") posts.push(r.url());
    });
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(url);
    await page.addStyleTag({ content: "nextjs-portal{display:none}" });
    await page
      .getByRole("button", { name: "Dismiss display preferences introduction" })
      .click();
    await page.locator(".node-label:visible").first().waitFor();
    await page.waitForFunction(() =>
      [...document.querySelectorAll(".result-row")].every(
        (e) => getComputedStyle(e).opacity === "1",
      ),
    );
    await page.screenshot({
      path: `docs/screenshots/cairn-${width}-light.png`,
      fullPage: true,
    });
    if (width === 1440) {
      await page.getByRole("button", { name: "Use dark theme" }).click();
      await page.waitForFunction(
        () =>
          getComputedStyle(document.querySelector(".brand")).color ===
          "rgb(241, 244, 242)",
      );
      await page.screenshot({
        path: "docs/screenshots/cairn-1440-dark.png",
        fullPage: true,
      });
      await page.getByRole("button", { name: "Use light theme" }).click();
      await page.locator(".claim-row").first().click();
      await page
        .getByRole("dialog", { name: "Why do we believe this?" })
        .waitFor();
      await page.waitForFunction(
        () =>
          document.querySelector(".evidence-drawer").getBoundingClientRect()
            .right <=
          innerWidth + 1,
      );
      await page.screenshot({ path: "docs/screenshots/cairn-evidence.png" });
    } else {
      await page
        .locator(".main-nav")
        .getByRole("button", { name: "Jobs", exact: true })
        .click();
      await page
        .locator(".workspace-sidebar")
        .getByRole("button", { name: "Add your details" })
        .click();
      await page
        .getByRole("dialog", { name: "Your job preferences" })
        .waitFor();
      await page.waitForFunction(
        () =>
          getComputedStyle(document.querySelector(".modal")).opacity === "1",
      );
      await page.screenshot({ path: "docs/screenshots/cairn-390-profile.png" });
    }
    await context.close();
  }
  if (posts.length || errors.length)
    throw new Error(
      `Screenshot checks failed: ${posts.length} unexpected POST requests; ${errors.join("; ")}`,
    );
  console.info(
    "Captured light/dark 1440px, light/profile 390px and evidence screenshots. Zero search/model requests.",
  );
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
