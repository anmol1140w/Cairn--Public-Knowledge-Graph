import type { Metadata } from "next";
import Link from "next/link";
import { PublicPage } from "@/components/public-page";
import { BRAND } from "@/lib/brand";
import { authenticationConfigured } from "@/server/auth";
import { googleSignIn } from "./actions";

export const metadata: Metadata = {
  title: `Sign in — ${BRAND.name}`,
  robots: { index: false, follow: false },
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const configured = authenticationConfigured();
  return (
    <PublicPage className="auth-page">
      <section className="auth-card" aria-labelledby="signin-heading">
        <span className="eyebrow">Your evidence workspace</span>
        <h1 id="signin-heading">Welcome to {BRAND.name}</h1>
        <p>Sign in with Google to use Live sources and save investigations to your account.</p>
        {error && (
          <p className="auth-error" role="alert">
            {error === "expired"
              ? "Your sign-in request expired. Continue with Google to try again."
              : "Sign-in could not be completed. Please try again."}
          </p>
        )}
        {configured ? (
          <form action={googleSignIn}>
            <button className="primary-button full-width" type="submit">Continue with Google</button>
          </form>
        ) : (
          <p className="auth-error">Google sign-in is not configured on this server. Demo examples are available.</p>
        )}
        <p className="policy-reference">New here? After Google verifies your identity, we’ll ask you to accept our <Link href="/terms">Terms of Service</Link> and acknowledge our <Link href="/privacy">Privacy Policy</Link> before creating an account. Returning users who have already accepted can sign in directly.</p>
        <p><Link href="/">Explore Demo without an account</Link></p>
      </section>
    </PublicPage>
  );
}
