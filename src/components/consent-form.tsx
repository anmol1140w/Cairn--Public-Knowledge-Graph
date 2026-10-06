"use client";

import Link from "next/link";
import { useState } from "react";
import { LEGAL } from "@/lib/legal";

export function ConsentForm({ csrf }: { csrf: string }) {
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  return (
    <div className="consent-form">
      <form method="post" action="/api/account/accept" onSubmit={() => setSubmitting(true)}>
        <input type="hidden" name="csrf" value={csrf} />
        <input type="hidden" name="decision" value="accept" />
        <input type="hidden" name="termsVersion" value={LEGAL.termsVersion} />
        <input type="hidden" name="privacyVersion" value={LEGAL.privacyVersion} />
        <label className="consent-check">
          <input
            type="checkbox"
            name="accepted"
            value="yes"
            required
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
            aria-describedby="consent-note"
          />
          <span>
            I agree to the <Link href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</Link>
            {" "}and acknowledge the <Link href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</Link>.
          </span>
        </label>
        <div className="consent-actions">
          <button className="primary-button full-width" type="submit" disabled={!accepted || submitting}>
            {submitting ? "Continuing…" : "Accept and continue"}
          </button>
        </div>
      </form>
      <form method="post" action="/api/account/accept" className="consent-cancel">
        <input type="hidden" name="csrf" value={csrf} />
        <input type="hidden" name="decision" value="cancel" />
        <button className="secondary-button full-width" type="submit" disabled={submitting}>
          Cancel and use Demo
        </button>
      </form>
    </div>
  );
}
