import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e", timeout: 45000, fullyParallel: false, workers: 1,
  reporter: "list",
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1050 }, launchOptions: { args: ["--enable-unsafe-swiftshader"] } } }],
  webServer: { command: "CAIRN_TEST=1 npm run dev -- --hostname 127.0.0.1 --port 3100", url: "http://localhost:3100", reuseExistingServer: !process.env.CI, timeout: 120000 },
});
