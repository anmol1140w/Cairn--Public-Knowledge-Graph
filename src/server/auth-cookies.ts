import "server-only";

export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
export const PENDING_SIGN_IN_MAX_AGE = 60 * 10;

export function secureAuthCookies() {
  return process.env.NODE_ENV === "production" || process.env.APP_HTTPS === "true";
}

function protectedCookie(name: string) {
  const secure = secureAuthCookies();
  return {
    name: `${secure ? "__Secure-" : ""}${name}`,
    options: { httpOnly: true, sameSite: "lax" as const, path: "/", secure },
  };
}

export function sessionCookie() {
  return protectedCookie("authjs.session-token");
}

export function pendingSignInCookie() {
  return protectedCookie("cairn.pending-signin");
}
