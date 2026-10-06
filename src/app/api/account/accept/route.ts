import { NextRequest, NextResponse } from "next/server";
import { authenticationConfigured } from "@/server/auth";
import { pendingSignInCookie, sessionCookie } from "@/server/auth-cookies";
import { acceptLegalConsent, ConsentError, discardPendingSignIn, getConsentContext, validConsentCsrf } from "@/server/legal-consent";

export const runtime = "nodejs";

function redirectTo(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.url), { status: 303, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!authenticationConfigured()) return redirectTo(request, "/signin?error=unavailable");
  // Acceptance is an authenticated browser POST, never an OAuth query parameter.
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return NextResponse.json({ error: "Submit acceptance from Cairn’s sign-in page." }, { status: 403 });
  if (!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded"))
    return NextResponse.json({ error: "Use the policy acceptance form." }, { status: 415 });
  const body = await request.text();
  if (Buffer.byteLength(body) > 8192) return NextResponse.json({ error: "This request is too large." }, { status: 413 });
  const form = new URLSearchParams(body);
  try {
    const context = await getConsentContext();
    if (!context) return redirectTo(request, "/signin?error=expired");
    const csrf = form.get("csrf") ?? "";
    if (!validConsentCsrf(context, csrf))
      return NextResponse.json({ error: "The acceptance request could not be verified." }, { status: 403 });

    const pendingCookie = pendingSignInCookie();
    if (form.get("decision") === "cancel") {
      if (context.kind === "pending") await discardPendingSignIn(context.token);
      const response = redirectTo(request, "/");
      response.cookies.set(pendingCookie.name, "", { ...pendingCookie.options, maxAge: 0 });
      return response;
    }
    const session = await acceptLegalConsent(context, {
      accepted: form.get("accepted") === "yes" && form.get("decision") === "accept",
      termsVersion: form.get("termsVersion") ?? "",
      privacyVersion: form.get("privacyVersion") ?? "",
      csrf,
    });
    const response = redirectTo(request, "/");
    if (session) {
      const cookie = sessionCookie();
      response.cookies.set(cookie.name, session.sessionToken, { ...cookie.options, expires: session.expires });
    }
    response.cookies.set(pendingCookie.name, "", { ...pendingCookie.options, maxAge: 0 });
    return response;
  } catch (error) {
    if (error instanceof ConsentError) {
      return redirectTo(request, error.code === "expired" ? "/signin?error=expired" : `/auth/consent?error=${error.code}`);
    }
    return redirectTo(request, "/auth/consent?error=unavailable");
  }
}
