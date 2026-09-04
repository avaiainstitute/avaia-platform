"use client";

import { useState } from "react";
import { DISCLAIMER } from "@/lib/safety";
import { consumePostSignInRedirect } from "@/lib/post-signin-redirect";

/**
 * The disclaimer + eligibility gate. Records consent, then enters the journey.
 *
 * Hard-navigates via window.location rather than next/navigation's router —
 * see the matching note in app/auth/callback/page.tsx and app/sign-in/page.tsx.
 * Same reasoning applies here: a soft client-side navigation right after an
 * auth-state-changing write is exactly the pattern that's caused stale-page
 * problems elsewhere in this app.
 */
export default function ConsentForm({
  origin,
  originKey,
}: {
  /** Chemistry/View From Above origin context carried from /journey through
   *  this consent step (see app/journey/page.tsx's own comment on why the
   *  hop needs this explicitly) -- only ever present for a genuinely
   *  first-time Host, since a returning Host never reaches /welcome. */
  origin?: string;
  originKey?: string;
} = {}) {
  const [age, setAge] = useState<"" | "adult" | "minor">("");
  const [understood, setUnderstood] = useState(false);
  // Only required, and only meaningful, when age === "minor" -- see the
  // governing guardian-consent decision: a real, named, contactable
  // guardian record replaces the old bare self-attestation checkbox.
  // lib/guardian-consent.ts's disclosure text (shown below) is what this
  // name/email actually consents to.
  const [guardianName, setGuardianName] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  // Fully separate from `understood` above -- optional, off by default,
  // never required for canSubmit. See app/api/consent/route.ts for how the
  // two are kept apart in storage too.
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const canSubmit =
    understood && age !== "" && (age !== "minor" || (guardianName.trim() !== "" && guardianEmail.trim() !== ""));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          age,
          marketingConsent,
          ...(age === "minor" ? { guardianName: guardianName.trim(), guardianEmail: guardianEmail.trim() } : {}),
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Could not save.");
      const dest = consumePostSignInRedirect();
      // Defying Grief specifically skips the extra click of landing on that
      // page and having to press "I'm Still Here" a second time -- see the
      // autostart handling in app/defying-grief/page.tsx. The plain /journey
      // destination gets the same treatment now that IAP orientation lives
      // here on the consent screen: ?enter=1 skips the now-redundant
      // JourneyIntro gate (app/journey/page.tsx) and lands directly in the
      // conversation. Every other destination (library, workbook, toolkit,
      // youth, etc.) is untouched.
      const journeyDest =
        dest === "/journey" && origin && originKey
          ? `/journey?enter=1&origin=${encodeURIComponent(origin)}&key=${encodeURIComponent(originKey)}`
          : "/journey?enter=1";
      window.location.replace(
        dest === "/defying-grief" ? "/defying-grief?autostart=1" : dest === "/journey" ? journeyDest : dest
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8">
      <div className="rounded-lg border border-rule bg-white/[0.04] p-6 text-ink backdrop-blur-sm">
        <p className="leading-relaxed">{DISCLAIMER}</p>
      </div>

      <fieldset className="mt-8">
        <legend className="label mb-3">Before you begin</legend>
        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-rule bg-white/[0.03] px-4 py-3">
          <input
            type="radio"
            name="age"
            className="mt-1"
            checked={age === "adult"}
            onChange={() => setAge("adult")}
          />
          <span className="text-ink">I am 18 or older.</span>
        </label>
        <label className="mt-2 flex cursor-pointer items-start gap-3 rounded-md border border-rule bg-white/[0.03] px-4 py-3">
          <input
            type="radio"
            name="age"
            className="mt-1"
            checked={age === "minor"}
            onChange={() => setAge("minor")}
          />
          <span className="text-ink">
            I am under 18 and have the involvement and consent of a parent,
            guardian, or sponsoring organization.
          </span>
        </label>
      </fieldset>

      {age === "minor" && (
        <div className="mt-5 rounded-lg border border-rule bg-white/[0.03] p-5">
          <p className="label mb-3">Parent or guardian</p>
          <p className="mb-4 text-sm text-muted">
            AVAIA keeps a record of who gave permission for your participation. This authorizes
            your participation only -- it does not give your parent or guardian access to what you
            say privately in your own AVAIA conversations.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label mb-2 block" htmlFor="guardianName">
                Parent/guardian name
              </label>
              <input
                id="guardianName"
                type="text"
                required
                value={guardianName}
                onChange={(e) => setGuardianName(e.target.value)}
                className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
              />
            </div>
            <div>
              <label className="label mb-2 block" htmlFor="guardianEmail">
                Parent/guardian email
              </label>
              <input
                id="guardianEmail"
                type="email"
                required
                value={guardianEmail}
                onChange={(e) => setGuardianEmail(e.target.value)}
                className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
              />
            </div>
          </div>
        </div>
      )}

      <label className="mt-6 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-1"
          checked={understood}
          onChange={(e) => setUnderstood(e.target.checked)}
        />
        <span className="text-ink">
          I have read and understand the above, and I understand that I remain
          the owner of my story and every decision I make.
        </span>
      </label>

      {/* Deliberately separate from the required consent above -- its own
          quieter styling, explicitly optional, off by default, and never
          part of canSubmit. This isn't a second thing to agree to in order
          to begin; it's a fully independent, skippable choice. */}
      <label className="mt-5 flex cursor-pointer items-start gap-3 border-t border-rule pt-5 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={marketingConsent}
          onChange={(e) => setMarketingConsent(e.target.checked)}
        />
        <span className="text-muted">
          <span className="text-ink">Keep me connected with AVAIA</span> (optional) — send me
          occasional updates about programs, classes, resources, workshops, and opportunities.
        </span>
      </label>

      <button
        type="submit"
        disabled={!canSubmit || submitting}
        className="mt-8 rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Entering…" : "I agree — begin"}
      </button>
      {error && <p className="mt-3 text-sm text-[#e0857d]">{error}</p>}
    </form>
  );
}
