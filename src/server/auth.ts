import "server-only";
import { NextResponse } from "next/server";
import { ensureApplicationAccount } from "./storage";

export class AuthRequiredError extends Error {
  constructor() {
    super("Sign in with Google to use saved investigations and live sources.");
    this.name = "AuthRequiredError";
  }
}

export class AuthUnavailableError extends Error {
  constructor(message = "Sign-in is temporarily unavailable.") {
    super(message);
    this.name = "AuthUnavailableError";
  }
}

export class LegalAcceptanceRequiredError extends Error {
  constructor() {
    super("Accept the Privacy Policy and Terms of Service to finish signing in.");
    this.name = "LegalAcceptanceRequiredError";
  }
}

export interface AuthenticatedAccount {
  accountId: string;
  authUserId: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

export function authenticationConfigured() {
  return Boolean(
    process.env.AUTH_SECRET &&
      process.env.AUTH_GOOGLE_ID &&
      process.env.AUTH_GOOGLE_SECRET &&
      (process.env.NODE_ENV !== "production" || process.env.AUTH_URL),
  );
}

export async function currentAccount(): Promise<AuthenticatedAccount | null> {
  if (!authenticationConfigured()) return null;
  let session;
  try {
    // Keep Auth.js out of modules that are imported by offline/demo code until
    // an authenticated request actually reaches this boundary.
    const { auth } = await import("../../auth");
    session = await auth();
  } catch {
    throw new AuthUnavailableError();
  }
  if (!session?.user?.id) return null;
  if (!session.user.legalAccepted) throw new LegalAcceptanceRequiredError();
  try {
    const account = await ensureApplicationAccount({
      authUserId: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image,
    });
    return {
      accountId: account.id,
      authUserId: account.auth_user_id,
      name: account.name,
      email: account.email,
      image: account.image,
    };
  } catch {
    throw new AuthUnavailableError();
  }
}

export async function requireAccount() {
  if (!authenticationConfigured())
    throw new AuthUnavailableError(
      "Sign-in is not configured on this server. A signed-in account is required for live sources.",
    );
  const account = await currentAccount();
  if (!account) throw new AuthRequiredError();
  return account;
}

export function authErrorResponse(error: unknown) {
  if (error instanceof LegalAcceptanceRequiredError)
    return NextResponse.json(
      { error: error.message, code: "CONSENT_REQUIRED", authConfigured: true, consentRequired: true },
      { status: 403 },
    );
  if (error instanceof AuthRequiredError)
    return NextResponse.json(
      { error: error.message, code: "AUTH_REQUIRED" },
      { status: 401 },
    );
  if (error instanceof AuthUnavailableError)
    return NextResponse.json(
      { error: error.message, code: "AUTH_UNAVAILABLE" },
      { status: 503 },
    );
  return null;
}
