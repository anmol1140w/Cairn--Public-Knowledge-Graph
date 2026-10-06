import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import * as schema from "@/server/schema";
import { LEGAL } from "@/lib/legal";

const fixture = vi.hoisted(() => ({ pool: null as pg.Pool | null, cookies: new Map<string, string>() }));
vi.mock("server-only", () => ({}));
vi.mock("@/server/storage", () => ({
  pool: () => fixture.pool!,
  db: () => drizzle(fixture.pool!, { schema }),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => fixture.cookies.has(name) ? { value: fixture.cookies.get(name)! } : undefined,
    set: (name: string, value: string) => fixture.cookies.set(name, value),
  }),
  headers: async () => new Headers({ host: "cairn.test", "x-forwarded-proto": "https", cookie: Array.from(fixture.cookies, ([name, value]) => `${name}=${value}`).join("; ") }),
}));

import { acceptLegalConsent, authorizeGoogleSignIn, consentCsrfToken, getConsentContext, type ConsentContext } from "@/server/legal-consent";
import { sessionCookie } from "@/server/auth-cookies";
import { POST as submitConsent } from "@/app/api/account/accept/route";

const googleProfile = { sub: "google-reader", email: "reader@example.com", email_verified: true, name: "Evidence Reader" };
const googleAccount = { provider: "google", type: "oidc" as const, providerAccountId: googleProfile.sub };
const testSchema = `cairn_consent_test_${randomUUID().replaceAll("-", "")}`;
let admin: pg.Pool;

async function newPendingIdentity() {
  expect(await authorizeGoogleSignIn({ account: googleAccount, profile: googleProfile })).toBe("/auth/consent");
  const context = await getConsentContext();
  expect(context?.kind).toBe("pending");
  return context!;
}

function acceptance(context: ConsentContext) {
  return { accepted: true, csrf: consentCsrfToken(context), termsVersion: LEGAL.termsVersion, privacyVersion: LEGAL.privacyVersion };
}

async function counts() {
  const result = await fixture.pool!.query("SELECT (SELECT count(*)::int FROM auth_users) AS users,(SELECT count(*)::int FROM app_users) AS accounts,(SELECT count(*)::int FROM auth_sessions) AS sessions");
  return result.rows[0];
}

/** Opt-in: use a dedicated/local database URL. Each run has its own disposable schema. */
describe.skipIf(!process.env.CAIRN_TEST_DATABASE_URL)("PostgreSQL account registration and acceptance", () => {
  beforeAll(async () => {
    admin = new pg.Pool({ connectionString: process.env.CAIRN_TEST_DATABASE_URL });
    await admin.query(`CREATE SCHEMA "${testSchema}"`);
    fixture.pool = new pg.Pool({ connectionString: process.env.CAIRN_TEST_DATABASE_URL, options: `-c search_path=${testSchema}` });
    for (const name of ["0001_evidence.sql", "0002_auth_accounts.sql", "0003_legal_acceptance.sql"])
      await fixture.pool.query(await readFile(new URL(`../migrations/${name}`, import.meta.url), "utf8"));
  });

  beforeEach(async () => {
    fixture.cookies.clear();
    vi.stubEnv("AUTH_SECRET", "test-only-postgresql-consent-secret");
    vi.stubEnv("AUTH_GOOGLE_ID", "test-google-id");
    vi.stubEnv("AUTH_GOOGLE_SECRET", "test-google-secret");
    vi.stubEnv("AUTH_URL", "https://cairn.test");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("APP_HTTPS", "false");
    await fixture.pool!.query("TRUNCATE auth_users,app_users,pending_google_signins CASCADE");
  });

  afterEach(() => vi.unstubAllEnvs());

  afterAll(async () => {
    await fixture.pool?.end();
    if (admin) {
      await admin.query(`DROP SCHEMA IF EXISTS "${testSchema}" CASCADE`);
      await admin.end();
    }
  });

  it("does not create any account or session during the first Google callback", async () => {
    await newPendingIdentity();
    expect(await counts()).toEqual({ users: 0, accounts: 0, sessions: 0 });
    const pending = await fixture.pool!.query("SELECT token_hash FROM pending_google_signins");
    expect(pending.rowCount).toBe(1);
    expect(pending.rows[0].token_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("creates an account, policy receipt and compatible Auth.js session only after acceptance", async () => {
    const context = await newPendingIdentity();
    await expect(acceptLegalConsent(context, { ...acceptance(context), accepted: false })).rejects.toMatchObject({ code: "required" });
    expect(await counts()).toEqual({ users: 0, accounts: 0, sessions: 0 });
    const session = await acceptLegalConsent(context, acceptance(context));
    expect(await counts()).toEqual({ users: 1, accounts: 1, sessions: 1 });
    const user = (await fixture.pool!.query("SELECT * FROM auth_users")).rows[0];
    expect(user.legal_accepted_at).toBeInstanceOf(Date);
    expect(user).toMatchObject({ terms_version: LEGAL.termsVersion, privacy_version: LEGAL.privacyVersion });
    fixture.cookies.clear();
    fixture.cookies.set(sessionCookie().name, session!.sessionToken);
    const { auth } = await import("../auth");
    const authenticated = await auth();
    expect(authenticated?.user).toMatchObject({ id: user.id, email: googleProfile.email, legalAccepted: true });
  });

  it("remembers acceptance on another device without overwriting the original receipt", async () => {
    const context = await newPendingIdentity();
    await acceptLegalConsent(context, acceptance(context));
    const before = (await fixture.pool!.query("SELECT legal_accepted_at,terms_version,privacy_version FROM auth_users")).rows[0];
    fixture.cookies.clear();
    expect(await authorizeGoogleSignIn({ account: googleAccount, profile: googleProfile })).toBe(true);
    expect((await fixture.pool!.query("SELECT count(*)::int AS n FROM pending_google_signins")).rows[0].n).toBe(0);
    expect((await fixture.pool!.query("SELECT legal_accepted_at,terms_version,privacy_version FROM auth_users")).rows[0]).toEqual(before);
  });

  it("rejects consumed and expired pending sign-ins without creating another session", async () => {
    const context = await newPendingIdentity();
    await acceptLegalConsent(context, acceptance(context));
    await expect(acceptLegalConsent(context, acceptance(context))).rejects.toMatchObject({ code: "expired" });
    expect(await counts()).toEqual({ users: 1, accounts: 1, sessions: 1 });
    await fixture.pool!.query("TRUNCATE auth_users,app_users,pending_google_signins CASCADE");
    fixture.cookies.clear();
    const expired = await newPendingIdentity();
    await fixture.pool!.query("UPDATE pending_google_signins SET expires_at=now()-interval '1 second'");
    expect(await getConsentContext()).toBeNull();
    await expect(acceptLegalConsent(expired, acceptance(expired))).rejects.toMatchObject({ code: "expired" });
    expect(await counts()).toEqual({ users: 0, accounts: 0, sessions: 0 });
  });

  it("requires legacy accounts to accept once while preserving their identity", async () => {
    await fixture.pool!.query("INSERT INTO auth_users(id,email,name) VALUES('legacy',$1,'Reader')", [googleProfile.email]);
    await fixture.pool!.query("INSERT INTO auth_accounts(user_id,type,provider,provider_account_id) VALUES('legacy','oidc','google',$1)", [googleProfile.sub]);
    await fixture.pool!.query("INSERT INTO auth_sessions(session_token,user_id,expires) VALUES('legacy-session','legacy',now()+interval '1 day')");
    fixture.cookies.set(sessionCookie().name, "legacy-session");
    const context = (await getConsentContext())!;
    expect(context).toMatchObject({ kind: "account", userId: "legacy", accepted: false });
    const { requireAccount, LegalAcceptanceRequiredError } = await import("@/server/auth");
    await expect(requireAccount()).rejects.toBeInstanceOf(LegalAcceptanceRequiredError);
    await acceptLegalConsent(context, acceptance(context));
    expect(await getConsentContext()).toMatchObject({ kind: "account", userId: "legacy", accepted: true });
    expect(await authorizeGoogleSignIn({ account: googleAccount, profile: googleProfile })).toBe(true);
    expect(await counts()).toEqual({ users: 1, accounts: 1, sessions: 1 });
  });

  it("serializes simultaneous registration attempts for one Google identity", async () => {
    const first = await newPendingIdentity();
    fixture.cookies.clear();
    const second = await newPendingIdentity();
    await Promise.all([acceptLegalConsent(first, acceptance(first)), acceptLegalConsent(second, acceptance(second))]);
    expect(await counts()).toEqual({ users: 1, accounts: 1, sessions: 2 });
    expect((await fixture.pool!.query("SELECT count(*)::int AS n FROM auth_accounts")).rows[0].n).toBe(1);
  });

  it("does not link a different Google identity using a matching email address", async () => {
    await fixture.pool!.query("INSERT INTO auth_users(id,email) VALUES('another-identity',$1)", [googleProfile.email]);
    const context = await newPendingIdentity();
    await expect(acceptLegalConsent(context, acceptance(context))).rejects.toMatchObject({ code: "conflict" });
    expect(await counts()).toEqual({ users: 1, accounts: 0, sessions: 0 });
    expect((await fixture.pool!.query("SELECT count(*)::int AS n FROM auth_accounts")).rows[0].n).toBe(0);
  });

  it("rejects cross-origin and forged submissions and lets users cancel without registering", async () => {
    const context = await newPendingIdentity();
    const form = new URLSearchParams({ csrf: consentCsrfToken(context), decision: "cancel" });
    const request = (origin: string, body: URLSearchParams) => new NextRequest("https://cairn.test/api/account/accept", { method: "POST", headers: { origin }, body });
    expect((await submitConsent(request("https://another.test", form))).status).toBe(403);
    expect((await submitConsent(request("https://cairn.test", new URLSearchParams({ csrf: "forged", decision: "accept", accepted: "yes" })))).status).toBe(403);
    const cancelled = await submitConsent(request("https://cairn.test", form));
    expect(cancelled.status).toBe(303);
    expect(cancelled.headers.get("location")).toBe("https://cairn.test/");
    expect(await counts()).toEqual({ users: 0, accounts: 0, sessions: 0 });
    expect((await fixture.pool!.query("SELECT count(*)::int AS n FROM pending_google_signins")).rows[0].n).toBe(0);
  });
});
