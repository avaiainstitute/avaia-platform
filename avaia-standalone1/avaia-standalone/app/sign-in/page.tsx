"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

/**
 * Passwordless sign-in by 6-digit code. This is NOT two-factor — there is no
 * password; the emailed code IS the whole sign-in. We use a code (not a link)
 * so the Host verifies in the SAME tab/PWA — reliable on a phone, no dependence
 * on which browser opens an email link. Once verified, the session persists, so
 * return visits are seamless.
 *
 * verify() below hard-navigates via window.location rather than next/
 * navigation's router — see the matching note in app/auth/callback/page.tsx.
 * Nav.tsx links to /journey from this very page before sign-in, so Next may
 * have already prefetched and cached the anonymous JourneyIntro render for
 * /journey client-side; router.replace()+router.refresh() is unreliable for
 * busting that specific cache entry, and a full navigation sidesteps it
 * entirely.
 */
export default function SignInPage() {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: true,
          // Without this, Supabase falls back to the dashboard's Site URL
          // for the emailed link's redirect target — which has drifted
          // before (see the earlier Supabase-project mix-up) and, when it
          // doesn't point at /auth/callback, silently strands the session
          // tokens in a URL hash no page ever reads. Making the destination
          // explicit here removes that dependency entirely.
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the code. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: "email",
      });
      if (error) throw error;
      // PROOF OF CONCEPT (gpt-iap-handoff branch only): send the Host
      // straight to the GPT handoff page, not /journey. main is unaffected.
      window.location.replace("/gpt-iap-preview");
    } catch {
      setError("That code didn't match, or it expired. Check the latest email, or send a new code.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-prose px-5 py-24">
      <p className="label mb-3">Begin the journey</p>
      <h1 className="font-serif text-4xl text-ink">Enter AVAIA</h1>

      {step === "email" ? (
        <>
          <p className="mt-4 text-lg text-muted">
            AVAIA guides one continuous, virtue-centered conversation — carried across time and
            saved to your own Workbook. Enter your email and we&rsquo;ll send you a sign-in code.
            No password — the code is all you need.
          </p>
          <form onSubmit={sendCode} className="mt-10 space-y-4">
            <label className="label block" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm placeholder:text-muted focus:border-seal"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Sending…" : "Send me a code"}
            </button>
            {error && <p className="text-sm text-[#e0857d]">{error}</p>}
          </form>
        </>
      ) : (
        <>
          <p className="mt-4 text-lg text-muted">
            We sent a 6-digit code to <span className="text-ink">{email}</span>. Enter it below to
            continue. (Check spam if it&rsquo;s not there in a minute.)
          </p>
          <form onSubmit={verify} className="mt-10 space-y-4">
            <label className="label block" htmlFor="code">Your code</label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="Enter code"
              className="w-full max-w-xs rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-center font-mono text-2xl tracking-[0.2em] text-ink outline-none backdrop-blur-sm placeholder:text-base placeholder:tracking-normal placeholder:text-muted focus:border-seal"
            />
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="submit"
                disabled={busy || code.length < 6}
                className="rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Verifying…" : "Enter"}
              </button>
              <button
                type="button"
                onClick={() => { setStep("email"); setCode(""); setError(""); }}
                className="label hover:text-seal"
              >
                Use a different email
              </button>
            </div>
            {error && <p className="text-sm text-[#e0857d]">{error}</p>}
          </form>
        </>
      )}

      <p className="mt-10 max-w-prose text-xs text-muted">
        AVAIA is not therapy, counseling, medical care, or crisis intervention. If you are in
        crisis, call or text 988 (U.S.).
      </p>
      <p className="mt-6">
        <Link href="/" className="label hover:text-seal">← Back to the institution</Link>
      </p>
    </div>
  );
}
