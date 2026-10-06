import Link from "next/link";
import type { ReactNode } from "react";
import { BRAND } from "@/lib/brand";
import { LEGAL } from "@/lib/legal";
import { BrandMark } from "./brand-mark";

export function PublicPage({
  children,
  activePage,
  className = "",
}: {
  children: ReactNode;
  activePage?: "privacy" | "terms";
  className?: string;
}) {
  return (
    <div className="public-page">
      <a className="skip-link" href="#public-content">
        Skip to content
      </a>
      <header className="public-header">
        <Link href="/" className="brand" aria-label={`${BRAND.name} home`}>
          <BrandMark />
          <span>
            {BRAND.name}
            <span className="brand-secondary">{BRAND.tagline}</span>
          </span>
        </Link>
        <nav className="public-links" aria-label="Legal pages">
          <Link href="/privacy" aria-current={activePage === "privacy" ? "page" : undefined}>
            Privacy
          </Link>
          <Link href="/terms" aria-current={activePage === "terms" ? "page" : undefined}>
            Terms
          </Link>
          <Link href="/" className="secondary-button">
            Open workspace
          </Link>
        </nav>
      </header>
      <main id="public-content" className={`public-main ${className}`}>
        {children}
      </main>
      <footer className="public-footer">
        <span>{BRAND.name} · {BRAND.tagline}</span>
        <nav className="public-links" aria-label="Footer links">
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms of Service</Link>
          <a href={LEGAL.contactUrl}>Project &amp; contact</a>
        </nav>
      </footer>
    </div>
  );
}

export function PolicyPage({
  title,
  intro,
  activePage,
  sections,
}: {
  title: string;
  intro: string;
  activePage: "privacy" | "terms";
  sections: { id: string; title: string; content: ReactNode }[];
}) {
  return (
    <PublicPage activePage={activePage}>
      <div className="policy-heading">
        <span className="eyebrow">{BRAND.name} · Our policies</span>
        <h1>{title}</h1>
        <p className="policy-updated">
          Last updated: <time dateTime={LEGAL.updatedAt}>{LEGAL.updatedLabel}</time>
        </p>
        <p className="policy-intro">{intro}</p>
      </div>
      <div className="policy-grid">
        <aside className="policy-contents">
          <nav aria-label="On this page">
            <h2>On this page</h2>
            <ol>
              {sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`}>{section.title}</a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>
        <article className="policy-article" aria-label={title}>
          {sections.map((section, index) => (
            <section key={section.id} id={section.id} className="policy-section" aria-labelledby={`${section.id}-heading`}>
              <h2 id={`${section.id}-heading`}>{index + 1}. {section.title}</h2>
              {section.content}
            </section>
          ))}
        </article>
      </div>
    </PublicPage>
  );
}
