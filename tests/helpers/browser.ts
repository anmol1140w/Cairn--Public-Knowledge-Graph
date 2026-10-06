import type { Page } from "@playwright/test";

export interface TestUser { id: string; email?: string; name?: string }

/** Browser auth tests use this until a real OAuth provider fixture is configured. */
export async function loginAs(page: Page, user: TestUser = { id: "test-user" }) {
  await page.route("**/api/me", (route) =>
    route.fulfill({
      status: 200,
      json: { authenticated: true, authConfigured: true, user },
    }),
  );
}

export async function useRecordedProviderResponses(page: Page, responses: Record<string, unknown>) {
  for (const [pattern, body] of Object.entries(responses))
    await page.route(pattern, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) }));
}

export async function disableWebGL(page: Page) {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext as unknown as (this: HTMLCanvasElement, type: string, ...args: unknown[]) => RenderingContext | null;
    const patched = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (type === "webgl" || type === "webgl2" || type === "experimental-webgl") return null;
      return original.call(this, type, ...args as []);
    } as unknown as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = patched;
  });
}

export async function freezeClock(page: Page, timestamp = "2026-10-06T00:00:00.000Z") {
  await page.addInitScript((value) => {
    const fixed = new Date(value).valueOf();
    const OriginalDate = Date;
    // @ts-expect-error test helper constructor shape
    globalThis.Date = class extends OriginalDate { constructor(...args: ConstructorParameters<typeof Date>) { super(...(args.length ? args : [fixed])); } static now() { return fixed; } };
  }, timestamp);
}
