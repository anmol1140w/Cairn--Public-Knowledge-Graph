import type { Metadata } from "next";
import Link from "next/link";
import { PolicyPage } from "@/components/public-page";
import { BRAND } from "@/lib/brand";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: `Terms of Service — ${BRAND.name}`,
  description: "The terms for using Cairn’s evidence workspace, Google accounts, Live searches and exports.",
  alternates: { canonical: `${LEGAL.siteUrl}/terms` },
};

export default function TermsPage() {
  return (
    <PolicyPage
      activePage="terms"
      title="Terms of Service"
      intro="Cairn is a place to follow the evidence. These terms describe how you may use the service and what to expect from its sources and generated answers."
      sections={[
        {
          id: "agreement",
          title: "Using Cairn",
          content: (
            <>
              <p>These terms apply to Cairn at <a href={LEGAL.siteUrl}>cairn-pkg.vercel.app</a>. By using the service, you agree to these terms. Account registration requires explicit acceptance of these Terms of Service and acknowledgement of our <Link href="/privacy">Privacy Policy</Link>.</p>
              <p>You must be at least 13 years old and meet any higher minimum age that applies where you live. If you cannot enter this agreement yourself, use the service only with permission from a parent or guardian who can do so.</p>
            </>
          ),
        },
        {
          id: "accounts",
          title: "Accounts and acceptance",
          content: (
            <>
              <p>Demo examples are available without an account. Live search and saved investigations require Google sign-in. A new account is created only after Google verifies your identity and you accept the linked policies. Cairn stores the acceptance time and the accepted policy versions in its database.</p>
              <p>Once your acceptance has been recorded, returning sign-ins do not require the same acceptance step. Keep your Google account secure and do not use another person’s account without authorization. You are responsible for the information and requests you submit.</p>
              <p>You can stop using Cairn, sign out or delete your account through the account controls. The Privacy Policy explains what account deletion removes and which technical records may remain.</p>
            </>
          ),
        },
        {
          id: "acceptable-use",
          title: "Acceptable use",
          content: (
            <>
              <p>Use Cairn lawfully and respect other people’s rights. You must not:</p>
              <ul>
                <li>Attempt to access another user’s investigations, bypass authentication or evade usage limits.</li>
                <li>Disrupt the service, introduce malicious code or overload it with automated requests.</li>
                <li>Submit information you are not authorized to share, or use the service to harass others or infringe privacy or intellectual-property rights.</li>
                <li>Present illustrative Demo records or generated statements as verified current facts without checking their sources.</li>
              </ul>
            </>
          ),
        },
        {
          id: "evidence-and-ai",
          title: "Evidence and AI-generated content",
          content: (
            <>
              <p>Cairn organizes retrieved records and may use AI to plan searches, extract relationships and summarize evidence. Sources and generated content can be incomplete, outdated or incorrect. Confidence labels describe available support; they are not a probability of truth, hiring eligibility or a guarantee of accuracy.</p>
              <p>Check original sources, dates, quotations and uncertainty before relying on an answer. Demo examples are historical or illustrative. Stale-cache results are not represented as freshly retrieved evidence.</p>
              <p>Cairn provides information, not professional advice. In particular, job matching does not establish hiring eligibility, and patent exploration is not legal advice, a complete novelty search or a freedom-to-operate opinion.</p>
            </>
          ),
        },
        {
          id: "content-and-exports",
          title: "Your content, sources and exports",
          content: (
            <>
              <p>You retain any rights you have in the questions and optional details you submit. You permit Cairn and its service providers to process that information as needed to deliver the features you request, as described in the <Link href="/privacy">Privacy Policy</Link>.</p>
              <p>Third-party articles, papers, patent records, job listings and other source material remain subject to their owners’ rights and terms. Cairn does not grant ownership of that material. Preserve attribution and source links when using exports, and obtain any permissions required for reuse.</p>
              <p>You are responsible for where you store or share downloaded reports. Exported evidence and generated summaries do not certify the accuracy or completeness of an investigation.</p>
            </>
          ),
        },
        {
          id: "availability",
          title: "Availability and third-party services",
          content: (
            <>
              <p>Live features depend on Google authentication, search and AI providers, database availability and configured usage budgets. Requests may be limited, interrupted or return partial results. Access to a third-party source is also governed by that provider’s terms.</p>
              <p>We may change, suspend or discontinue features, or restrict access that violates these terms or interferes with the service. Continuous availability and permanent storage are not guaranteed; export important investigations if you need your own copy.</p>
            </>
          ),
        },
        {
          id: "responsibility",
          title: "Disclaimers and responsibility",
          content: (
            <>
              <p>To the extent permitted by applicable law, Cairn is provided “as is” and “as available,” without warranties of accuracy, completeness, fitness for a particular purpose or uninterrupted operation.</p>
              <p>You remain responsible for decisions made using the service. To the extent permitted by law, the Cairn project is not liable for indirect or consequential loss arising from reliance on generated answers, third-party content, service interruptions or lost investigations. These terms do not exclude rights or liabilities that cannot legally be excluded.</p>
            </>
          ),
        },
        {
          id: "changes-and-contact",
          title: "Changes and contact",
          content: (
            <>
              <p>We may update these terms as Cairn evolves. The current terms and last-updated date are published on this page. Account records retain the versions accepted during registration.</p>
              <p>Questions about the service or these terms can be directed to the maintainer through the <a href={LEGAL.contactUrl}>Cairn project repository</a>. The <Link href="/privacy">Privacy Policy</Link> describes data handling and available privacy controls.</p>
            </>
          ),
        },
      ]}
    />
  );
}
