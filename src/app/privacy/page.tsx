import type { Metadata } from "next";
import Link from "next/link";
import { PolicyPage } from "@/components/public-page";
import { BRAND } from "@/lib/brand";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: `Privacy Policy — ${BRAND.name}`,
  description: "How Cairn handles Google sign-in, searches, optional profile details, cookies and account deletion.",
  alternates: { canonical: `${LEGAL.siteUrl}/privacy` },
};

export default function PrivacyPage() {
  return (
    <PolicyPage
      activePage="privacy"
      title="Privacy Policy"
      intro="Your account, your questions, and your choices. This policy explains what Cairn processes when you explore evidence, sign in, or use Live search."
      sections={[
        {
          id: "scope",
          title: "About this policy",
          content: (
            <>
              <p>This policy applies to Cairn at <a href={LEGAL.siteUrl}>cairn-pkg.vercel.app</a>. Cairn helps you explore research, jobs, news and patents using source-linked evidence.</p>
              <p>You can use curated Demo examples without an account. Live search and saved investigations require Google sign-in. Before a new Cairn account is created, you must accept the <Link href="/terms">Terms of Service</Link> and acknowledge this Privacy Policy. We record the acceptance time and both policy versions with your account.</p>
            </>
          ),
        },
        {
          id: "information",
          title: "Information we process",
          content: (
            <ul>
              <li><strong>Account information:</strong> your Google account identifier, name, email address and profile image, along with authentication and session records. Cairn does not receive your Google password or request access to Gmail, Drive or contacts.</li>
              <li><strong>Search information:</strong> your questions, selected source families, search settings, retrieved source records and generated investigations. Live query text and request-accounting records are stored even when an optional profile is not saved.</li>
              <li><strong>Optional details:</strong> information you choose to enter, such as skills, experience, research interests, locations or a claim to investigate. These details are optional.</li>
              <li><strong>Technical information:</strong> hosting and infrastructure providers may process IP addresses, browser information, request times and diagnostic logs to deliver and secure the service.</li>
              <li><strong>Pending sign-in:</strong> for an account that has not accepted the policies, we temporarily hold the Google-verified basic profile so you can finish registration. This step does not create a Cairn account or a signed-in session. The pending request expires after ten minutes.</li>
            </ul>
          ),
        },
        {
          id: "use-and-providers",
          title: "How information is used and shared",
          content: (
            <>
              <p>We use information to authenticate you, retrieve and explain evidence, save investigations when permitted, enforce usage limits and operate the service. Cairn does not sell personal information or use it for advertising.</p>
              <ul>
                <li><strong>Google</strong> verifies your identity during sign-in. See <a href="https://policies.google.com/privacy">Google’s Privacy Policy</a>.</li>
                <li><strong>SerpApi</strong> receives relevant search terms and parameters, which can include topics, roles, locations, dates and keywords derived from your question and selected details. See <a href="https://serpapi.com/privacy">SerpApi’s Privacy Policy</a>.</li>
                <li><strong>Ollama</strong>, when AI processing is available, receives your question and selected mode details for planning, and source excerpts for extraction and synthesis. Account email addresses and authentication tokens are not automatically added to these prompts. See <a href="https://ollama.com/privacy">Ollama’s Privacy Policy</a>.</li>
                <li><strong>Vercel and database infrastructure</strong> process information needed to host the application and store its records. See <a href="https://vercel.com/legal/privacy-policy">Vercel’s Privacy Policy</a>.</li>
              </ul>
              <p>These providers apply their own processing and retention policies and may process information outside your country. Visiting an original source also subjects that visit to the source website’s policies.</p>
            </>
          ),
        },
        {
          id: "browser-storage",
          title: "Cookies, local details and résumé import",
          content: (
            <>
              <p>Cairn uses essential authentication cookies to complete Google sign-in and keep you signed in. Account sessions are configured to last up to 30 days, subject to renewal or sign-out. A short-lived, protected cookie connects a pending sign-in to its acceptance form.</p>
              <p>Theme, display preferences and onboarding progress are stored in your browser’s local storage. Optional profile details use session storage for the current tab. You can remove these details with <strong>Clear my details</strong> or clear site data through your browser.</p>
              <p>Plain-text résumé import reads the file in your browser; the résumé file is not uploaded. Skills you review and apply become optional profile details and can be sent with a subsequent Live search.</p>
              <p>Curated Demo searches make no search-provider or AI-model requests. Loading the website still involves the hosting service, and the workspace can check account and service status.</p>
            </>
          ),
        },
        {
          id: "retention",
          title: "Saving, retention and deletion",
          content: (
            <>
              <p>Ordinary Live investigations can be saved to your account. If you add optional profile details without selecting <strong>Save with this investigation</strong>, Cairn skips persistent processing checkpoints, model/source-response caches and the final investigation snapshot for that search. The original question and request accounting remain stored; personal information included directly in your question is part of that record.</p>
              <p>Account and investigation records have no automatic time-based deletion schedule. You can export your evidence and use the account menu’s <strong>Delete account</strong> action to remove your active account, sign-in sessions and account-owned investigation, query and request records.</p>
              <p>Shared source/model caches, public evidence records, processing checkpoints, infrastructure logs and backups are separate records and may remain after account deletion. Cache expiry determines reuse, rather than guaranteeing erasure. Deletion does not remove exported files from your device, browser storage or information already processed by third-party providers.</p>
            </>
          ),
        },
        {
          id: "choices-and-security",
          title: "Your choices and security",
          content: (
            <>
              <p>You can use Demo without signing in, skip optional details, decline to save a profile, clear local details, sign out or delete your account. You can also manage Cairn’s Google connection in your <a href="https://myaccount.google.com/connections">Google account settings</a>.</p>
              <p>Production sign-in uses protected cookies and OAuth verification, and saved investigations are restricted to their owning account. No online service can guarantee absolute security. Avoid including sensitive information that is unnecessary for your investigation.</p>
              <p>Cairn is not directed to children under 13. For access, correction or deletion questions that cannot be resolved through the available controls, contact the <a href={LEGAL.contactUrl}>Cairn project maintainer</a>.</p>
            </>
          ),
        },
        {
          id: "updates-and-contact",
          title: "Updates and contact",
          content: (
            <>
              <p>We may update this policy as the service changes. The current policy and its last-updated date are published here. Your account retains the versions you accepted at registration; routine sign-ins do not ask you to accept them again.</p>
              <p>For questions about this policy, use the contact options available through the <a href={LEGAL.contactUrl}>Cairn project repository</a>. Do not include account credentials or private search details in a public issue.</p>
            </>
          ),
        },
      ]}
    />
  );
}
