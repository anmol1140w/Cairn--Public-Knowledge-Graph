import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PublicPage } from "@/components/public-page";
import { ConsentForm } from "@/components/consent-form";
import { BRAND } from "@/lib/brand";
import { authenticationConfigured } from "@/server/auth";
import { consentCsrfToken, getConsentContext } from "@/server/legal-consent";

export const metadata: Metadata = {
  title: `Complete sign-in — ${BRAND.name}`,
  robots: { index: false, follow: false },
};

const ERRORS: Record<string, string> = {
  required: "Please accept the Terms of Service and acknowledge the Privacy Policy to continue.",
  updated: "The policies were updated while this page was open. Review the current links before accepting.",
  conflict: "This email is associated with a different sign-in identity. Please use the Google account originally linked to Cairn.",
  unavailable: "We couldn’t save your acceptance. Please try again.",
};

export default async function ConsentPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (!authenticationConfigured()) redirect("/signin");
  const context = await getConsentContext();
  if (!context) redirect("/signin?error=expired");
  if (context.kind === "account" && context.accepted) redirect("/");
  const { error } = await searchParams;
  return (
    <PublicPage className="auth-page">
      <section className="auth-card" aria-labelledby="consent-heading">
        <span className="eyebrow">One last step</span>
        <h1 id="consent-heading">Review and accept</h1>
        <p>Please review our policies before continuing. New accounts are created only after acceptance; existing accounts complete this step just once.</p>
        <div className="consent-account">
          <strong>{context.name ?? "Your Google account"}</strong>
          <span>{context.email}</span>
        </div>
        {error && ERRORS[error] && <p className="auth-error" role="alert">{ERRORS[error]}</p>}
        <ConsentForm csrf={consentCsrfToken(context)} />
        <p id="consent-note">Your acceptance date and policy versions are recorded with your account. You won’t be asked again on later sign-ins, including on another device.</p>
      </section>
    </PublicPage>
  );
}
