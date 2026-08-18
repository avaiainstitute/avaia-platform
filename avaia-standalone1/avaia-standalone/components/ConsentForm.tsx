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
export default function ConsentForm() {
  const [age, setAge] = useState<"" | "adult" | "minor">("");
  const [understood, setUnderstood] = useState(false);
  // Fully separate from `understood` above -- optional, off by default,
  // never required for canSubmit. See app/api/consent/route.ts for how the
  // two are kept apart in storage too.
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = understood && age !== "";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ age, marketingConsent }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Could not save.");
      const dest = consumePostSignInRedirect();
      // Defying Grief specifically skips the extra click of landing on that
      // page and having to press "I'm Still Here" a second time -- see the
      // autostart handling in app/defying-grief/page.tsx. /journey has no
      // equivalent extra click to skip (its first question already renders
      // inline, no button needed), so it's left exactly as it was.
      window.location.replace(dest === "/defying-grief" ? "/defying-grief?autostart=1" : dest);
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
