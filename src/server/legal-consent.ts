import "server-only";
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { Account, Profile } from "next-auth";
import { z } from "zod";
import { LEGAL } from "@/lib/legal";
import { pool } from "./storage";
import { pendingSignInCookie, PENDING_SIGN_IN_MAX_AGE, sessionCookie, SESSION_MAX_AGE } from "./auth-cookies";

interface AcceptanceRecord {
  legalAcceptedAt?: Date | string | null;
  termsVersion?: string | null;
  privacyVersion?: string | null;
}

/** Acceptance is once per account, including after signing in on a new device. */
export function hasLegalAcceptance(record: AcceptanceRecord) {
  return Boolean(record.legalAcceptedAt && record.termsVersion && record.privacyVersion);
}

const googleProfileSchema = z.object({
  sub: z.string().min(1).max(255),
  email: z.email().max(320),
  email_verified: z.literal(true),
  name: z.string().max(300).optional(),
  picture: z.url().max(2000).optional(),
});

interface PendingSignIn {
  provider_account_id: string;
  name: string | null;
  email: string;
  image: string | null;
}

export type ConsentContext =
  | { kind: "pending"; token: string; name: string | null; email: string }
  | { kind: "account"; token: string; userId: string; name: string | null; email: string; accepted: boolean };

export class ConsentError extends Error {
  constructor(public code: "required" | "updated" | "expired" | "conflict") {
    super(`Account acceptance could not be completed: ${code}.`);
    this.name = "ConsentError";
  }
}

const pendingTokenValid = (token: string) => /^[A-Za-z0-9_-]{43}$/.test(token);
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export function consentCsrfToken(context: ConsentContext) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("Sign-in is not configured.");
  return createHmac("sha256", secret)
    .update(`cairn-policy-acceptance:${context.kind}:`)
    .update(context.token)
    .digest("hex");
}

export function validConsentCsrf(context: ConsentContext, value: string) {
  if (!/^[a-f0-9]{64}$/.test(value)) return false;
  return timingSafeEqual(Buffer.from(value, "hex"), Buffer.from(consentCsrfToken(context), "hex"));
}

/** Auth.js calls this only after verifying Google's PKCE, state and nonce. */
export async function authorizeGoogleSignIn({ account, profile }: { account?: Account | null; profile?: Profile }) {
  const parsed = googleProfileSchema.safeParse(profile);
  if (
    account?.provider !== "google" ||
    !["oidc", "oauth"].includes(account.type) ||
    !parsed.success ||
    parsed.data.sub !== account.providerAccountId
  ) return false;

  const existing = await pool().query(
    `SELECT u.legal_accepted_at AS "legalAcceptedAt", u.terms_version AS "termsVersion", u.privacy_version AS "privacyVersion"
     FROM auth_users u JOIN auth_accounts a ON a.user_id=u.id
     WHERE a.provider='google' AND a.provider_account_id=$1`,
    [account.providerAccountId],
  );
  const cookieStore = await cookies();
  const cookie = pendingSignInCookie();
  const previous = cookieStore.get(cookie.name)?.value;
  if (previous) await discardPendingSignIn(previous);

  if (existing.rows[0] && hasLegalAcceptance(existing.rows[0])) {
    cookieStore.set(cookie.name, "", { ...cookie.options, maxAge: 0 });
    return true;
  }

  // Only a temporary verified identity is stored here: no account or session,
  // and no Google access/refresh tokens. Registration happens after acceptance.
  const token = randomBytes(32).toString("base64url");
  await pool().query("DELETE FROM pending_google_signins WHERE expires_at <= now()");
  await pool().query(
    `INSERT INTO pending_google_signins(token_hash,provider_account_id,name,email,image,expires_at)
     VALUES($1,$2,$3,$4,$5,now()+$6*interval '1 second')`,
    [tokenHash(token), parsed.data.sub, parsed.data.name ?? null, parsed.data.email, parsed.data.picture ?? null, PENDING_SIGN_IN_MAX_AGE],
  );
  cookieStore.set(cookie.name, token, { ...cookie.options, maxAge: PENDING_SIGN_IN_MAX_AGE });
  return "/auth/consent";
}

export async function getConsentContext(): Promise<ConsentContext | null> {
  const cookieStore = await cookies();
  const pendingToken = cookieStore.get(pendingSignInCookie().name)?.value;
  if (pendingToken && pendingTokenValid(pendingToken)) {
    const pending = await pool().query<PendingSignIn>(
      "SELECT provider_account_id,name,email,image FROM pending_google_signins WHERE token_hash=$1 AND expires_at>now()",
      [tokenHash(pendingToken)],
    );
    if (pending.rows[0]) return { kind: "pending", token: pendingToken, name: pending.rows[0].name, email: pending.rows[0].email };
  }

  const token = cookieStore.get(sessionCookie().name)?.value;
  if (!token) return null;
  const result = await pool().query(
    `SELECT u.id,u.name,u.email,u.legal_accepted_at AS "legalAcceptedAt",u.terms_version AS "termsVersion",u.privacy_version AS "privacyVersion"
     FROM auth_sessions s JOIN auth_users u ON u.id=s.user_id
     WHERE s.session_token=$1 AND s.expires>now()`,
    [token],
  );
  const user = result.rows[0];
  return user ? { kind: "account", token, userId: user.id, name: user.name, email: user.email, accepted: hasLegalAcceptance(user) } : null;
}

export async function discardPendingSignIn(token: string) {
  if (pendingTokenValid(token)) await pool().query("DELETE FROM pending_google_signins WHERE token_hash=$1", [tokenHash(token)]);
}

export async function acceptLegalConsent(context: ConsentContext, input: { accepted: boolean; termsVersion: string; privacyVersion: string; csrf: string }) {
  if (!validConsentCsrf(context, input.csrf)) throw new ConsentError("expired");
  if (!input.accepted) throw new ConsentError("required");
  if (input.termsVersion !== LEGAL.termsVersion || input.privacyVersion !== LEGAL.privacyVersion) throw new ConsentError("updated");

  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    let userId: string;
    if (context.kind === "pending") {
      const pending = await client.query<PendingSignIn>(
        `SELECT provider_account_id,name,email,image FROM pending_google_signins
         WHERE token_hash=$1 AND expires_at>now() FOR UPDATE`,
        [tokenHash(context.token)],
      );
      const identity = pending.rows[0];
      if (!identity) throw new ConsentError("expired");
      // Serialize different pending attempts for the same Google identity.
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`google:${identity.provider_account_id}`]);
      const linked = await client.query(
        "SELECT user_id FROM auth_accounts WHERE provider='google' AND provider_account_id=$1",
        [identity.provider_account_id],
      );
      if (linked.rows[0]) userId = linked.rows[0].user_id;
      else {
        const emailMatch = await client.query("SELECT id FROM auth_users WHERE email=$1", [identity.email]);
        // Never link different identities merely because their emails match.
        if (emailMatch.rowCount) throw new ConsentError("conflict");
        userId = randomUUID();
        await client.query(
          `INSERT INTO auth_users(id,name,email,image,legal_accepted_at,terms_version,privacy_version)
           VALUES($1,$2,$3,$4,now(),$5,$6)`,
          [userId, identity.name, identity.email, identity.image, LEGAL.termsVersion, LEGAL.privacyVersion],
        );
        await client.query(
          "INSERT INTO auth_accounts(user_id,type,provider,provider_account_id) VALUES($1,'oidc','google',$2)",
          [userId, identity.provider_account_id],
        );
      }
    } else {
      // Recheck the session inside the transaction instead of trusting form data.
      const session = await client.query(
        "SELECT user_id FROM auth_sessions WHERE session_token=$1 AND user_id=$2 AND expires>now() FOR UPDATE",
        [context.token, context.userId],
      );
      if (!session.rows[0]) throw new ConsentError("expired");
      userId = session.rows[0].user_id;
    }
    // Existing acceptance is never overwritten on later sign-ins or submissions.
    await client.query(
      `UPDATE auth_users SET legal_accepted_at=now(),terms_version=$2,privacy_version=$3
       WHERE id=$1 AND (legal_accepted_at IS NULL OR terms_version IS NULL OR privacy_version IS NULL)`,
      [userId, LEGAL.termsVersion, LEGAL.privacyVersion],
    );
    await client.query(
      `INSERT INTO app_users(id,auth_user_id,name,email,image)
       SELECT $1,id,name,email,image FROM auth_users WHERE id=$2
       ON CONFLICT(auth_user_id) DO NOTHING`,
      [randomUUID(), userId],
    );

    let session: { sessionToken: string; expires: Date } | null = null;
    if (context.kind === "pending") {
      session = { sessionToken: randomBytes(32).toString("base64url"), expires: new Date(Date.now() + SESSION_MAX_AGE * 1000) };
      await client.query("INSERT INTO auth_sessions(session_token,user_id,expires) VALUES($1,$2,$3)", [session.sessionToken, userId, session.expires]);
      await client.query("DELETE FROM pending_google_signins WHERE token_hash=$1", [tokenHash(context.token)]);
    }
    await client.query("COMMIT");
    return session;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
