"use client";

import { useState } from "react";
import { DISCLAIMER } from "@/lib/safety";

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
        body: JSON.stringify({ age }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Could not save.");
      // PROOF OF CONCEPT (gpt-iap-handoff branch only): straight to the GPT
      // handoff page, not /journey. main is unaffected.
      window.location.replace("/gpt-iap-preview");
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
