import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LEGAL } from "@/lib/legal";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  connect: vi.fn(),
  setCookie: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/server/storage", () => ({ pool: () => mocks }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: mocks.setCookie }) }));

import { acceptLegalConsent, authorizeGoogleSignIn, consentCsrfToken, hasLegalAcceptance, validConsentCsrf, type ConsentContext } from "@/server/legal-consent";
import { pendingSignInCookie, sessionCookie } from "@/server/auth-cookies";

const context: ConsentContext = { kind: "pending", token: "a".repeat(43), name: "Reader", email: "reader@example.com" };
const profile = { sub: "google-reader", email: "reader@example.com", email_verified: true, name: "Reader" };
const account = { provider: "google", type: "oidc" as const, providerAccountId: profile.sub };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AUTH_SECRET", "test-only-legal-consent-secret");
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("APP_HTTPS", "false");
});

afterEach(() => vi.unstubAllEnvs());

describe("one-time legal acceptance boundary", () => {
  it("requires a complete recorded receipt, while honoring previously accepted versions", () => {
    expect(hasLegalAcceptance({ legalAcceptedAt: new Date() })).toBe(false);
    expect(hasLegalAcceptance({ legalAcceptedAt: new Date(), termsVersion: "older-terms", privacyVersion: "older-privacy" })).toBe(true);
  });

  it("binds CSRF protection to the pending identity or existing session", () => {
    const csrf = consentCsrfToken(context);
    expect(validConsentCsrf(context, csrf)).toBe(true);
    expect(validConsentCsrf({ ...context, token: "b".repeat(43) }, csrf)).toBe(false);
    expect(validConsentCsrf({ kind: "account", token: context.token, userId: "u1", name: context.name, email: context.email, accepted: false }, csrf)).toBe(false);
    expect(validConsentCsrf(context, "invalid")).toBe(false);
  });

  it("rejects missing acceptance, forged CSRF and outdated form versions before database writes", async () => {
    const input = { accepted: true, termsVersion: LEGAL.termsVersion, privacyVersion: LEGAL.privacyVersion, csrf: consentCsrfToken(context) };
    await expect(acceptLegalConsent(context, { ...input, accepted: false })).rejects.toMatchObject({ code: "required" });
    await expect(acceptLegalConsent(context, { ...input, csrf: "0".repeat(64) })).rejects.toMatchObject({ code: "expired" });
    await expect(acceptLegalConsent(context, { ...input, termsVersion: "old" })).rejects.toMatchObject({ code: "updated" });
    expect(mocks.connect).not.toHaveBeenCalled();
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("rejects unverified or mismatched Google identities", async () => {
    expect(await authorizeGoogleSignIn({ account, profile: { ...profile, email_verified: false } })).toBe(false);
    expect(await authorizeGoogleSignIn({ account, profile: { ...profile, sub: "another-user" } })).toBe(false);
    expect(await authorizeGoogleSignIn({ account: { ...account, provider: "unknown" }, profile })).toBe(false);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("lets a returning accepted Google account sign in without a new acceptance request", async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ legalAcceptedAt: new Date(), termsVersion: "accepted-terms", privacyVersion: "accepted-privacy" }] });
    expect(await authorizeGoogleSignIn({ account, profile })).toBe(true);
    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it("protects acceptance and session cookies in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    for (const cookie of [sessionCookie(), pendingSignInCookie()]) {
      expect(cookie.name).toMatch(/^__Secure-/);
      expect(cookie.options).toMatchObject({ secure: true, httpOnly: true, sameSite: "lax", path: "/" });
    }
  });
});
