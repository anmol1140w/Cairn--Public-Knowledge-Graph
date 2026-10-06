import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "./src/server/storage";
import {
  authAccounts,
  authSessions,
  authUsers,
  authVerificationTokens,
} from "./src/server/schema";
import { safeRedirectUrl } from "./src/server/auth-redirect";
import { authorizeGoogleSignIn, hasLegalAcceptance } from "./src/server/legal-consent";
import { secureAuthCookies, sessionCookie, SESSION_MAX_AGE } from "./src/server/auth-cookies";

export function safeRedirect(url: string, baseUrl: string) {
  return safeRedirectUrl(
    url,
    baseUrl,
    process.env.AUTH_URL ?? process.env.NEXTAUTH_URL,
    (process.env.AUTH_ALLOWED_REDIRECT_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

const authConfig = (): NextAuthConfig => ({
  adapter: {
    ...DrizzleAdapter(db(), {
      usersTable: authUsers,
      accountsTable: authAccounts,
      sessionsTable: authSessions,
      verificationTokensTable: authVerificationTokens,
    }),
    // New accounts are created atomically by the explicit acceptance endpoint.
    // Auth.js retains responsibility for returning-user OAuth and sessions.
    async createUser() {
      throw new Error("Complete policy acceptance before creating an account.");
    },
  },
  pages: { signIn: "/signin", error: "/signin" },
  providers: [
    Google({
      // Auth.js validates these OAuth checks and stores the short-lived
      // state, nonce, and PKCE verifier in protected cookies.
      checks: ["pkce", "state", "nonce"],
    }),
  ],
  session: {
    strategy: "database",
    maxAge: SESSION_MAX_AGE,
    updateAge: 60 * 60 * 24,
  },
  useSecureCookies: secureAuthCookies(),
  cookies: { sessionToken: sessionCookie() },
  trustHost:
    process.env.AUTH_TRUST_HOST === "true" || process.env.NODE_ENV !== "production",
  callbacks: {
    signIn: authorizeGoogleSignIn,
    async redirect({ url, baseUrl }) {
      return safeRedirect(url, baseUrl);
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.legalAccepted = hasLegalAcceptance(user);
      }
      return session;
    },
  },
});

// Keep the database adapter out of module initialization so demo builds do
// not need a live PostgreSQL connection. It is created only for an Auth.js
// request, where the database is required anyway.
export const { handlers, auth, signIn, signOut } = NextAuth(() => authConfig());
