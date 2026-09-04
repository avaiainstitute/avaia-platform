"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { setPostSignInRedirect, peekPostSignInRedirect } from "@/lib/post-signin-redirect";

/**
 * Three sign-in modes, one page:
 *
 * "password" (default) -- ordinary email+password, for a returning member
 * who has already set one (see /account). Supabase's email provider
 * (external_email_enabled, confirmed live in the project config) supports
 * password and OTP against the exact same account -- this isn't a second
 * auth system, just a second way in for the same Host identity.
 *
 * "code" -- the original, unchanged passwordless flow: an 8-digit code
 * emailed and verified in the same tab. Still the way a brand-new Host
 * gets in the door (shouldCreateUser: true below), and stays available
 * indefinitely for anyone who prefers it or hasn't set a password yet --
 * this is not being removed, only no longer the sole option.
 *
 * "forgot" -- sends a Supabase-native recovery link (resetPasswordForEmail),
 * landing on /auth/callback (type=recovery) and forwarding to
 * /reset-password. No custom token/storage of any kind.
 *
 * signInWithPassword() failing is deliberately never distinguished from
 * "no password set yet" vs. "wrong password" in the UI -- Supabase itself
 * doesn't distinguish them (both return the same generic invalid-credentials
 * error), and telling them apart here would mean guessing at whether an
 * email has an account, the exact enumeration risk resetPasswordForEmail's
 * own generic response already avoids below.
 *
 * verify()/sendReset() below hard-navigate or otherwise avoid the Next
 * router where they change auth state, matching the existing note on why
 * (Nav.tsx prefetches /journey from this very page before sign-in, caching
 * the anonymous render; only a full navigation reliably busts that cache).
 */
export default function SignInPage() {
  const [mode, setMode] = useState<"password" | "code" | "forgot">("password");
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

  // Captures ?from=/defying-grief (or similar) the moment this page loads,
  // so it survives all the way through to verify()/signInWithPassword() or
  // /auth/callback's finish() below -- see lib/post-signin-redirect.ts for
  // why this uses sessionStorage rather than threading it through the
  // Supabase-facing URL.
  useEffect(() => {
    const from = new URLSearchParams(window.location.search).get("from");
    if (from) setPostSignInRedirect(from);
  }, []);

  function switchMode(next: "password" | "code" | "forgot") {
    setMode(next);
    setStep("email");
    setError("");
    setForgotSent(false);
  }

  async function signInPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      window.location.replace(peekPostSignInRedirect());
    } catch {
      setError(
        "That email and password didn't match. If you haven't set a password yet, use “Email me a sign-in code” instead, or reset your password below."
      );
      setBusy(false);
    }
  }

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        // ?flow=recovery is AVAIA's own signal, not Supabase's -- see the
        // matching comment in app/auth/callback/page.tsx on why: the
        // actual recovery email link is a PKCE ?code= link with no type=
        // param at all (confirmed live against a real production email),
        // so relying on GoTrue's own `type` alone silently sent a Host to
        // their ordinary Journey instead of /reset-password.
        redirectTo: `${window.location.origin}/auth/callback?flow=recovery`,
      });
      if (error) throw error;
      setForgotSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send a reset link. Please try again.");
    } finally {
      setBusy(false);
    }
  }

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
      window.location.replace(peekPostSignInRedirect());
    } catch {
      setError("That code didn't match, or it expired. Check the latest email, or send a new code.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-prose px-5 py-24">
      <p className="label mb-3">Welcome back</p>
      <h1 className="font-serif text-4xl text-ink">Enter AVAIA</h1>

      {mode === "password" && (
        <>
          <p className="mt-4 text-lg text-muted">
            AVAIA guides one continuous, virtue-centered conversation — carried across time and
            saved to your own Workbook. Sign in with your email and password.
          </p>
          <form onSubmit={signInPassword} className="mt-10 space-y-4">
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
            <label className="label block" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm placeholder:text-muted focus:border-seal"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Signing in…" : "Sign In"}
            </button>
            {error && <p className="text-sm text-[#e0857d]">{error}</p>}
            <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2">
              <button type="button" onClick={() => switchMode("forgot")} className="label hover:text-seal">
                Forgot password?
              </button>
              <button type="button" onClick={() => switchMode("code")} className="label hover:text-seal">
                Email me a sign-in code
              </button>
            </div>
          </form>
        </>
      )}

      {mode === "forgot" && (
        <>
          {!forgotSent ? (
            <>
              <p className="mt-4 text-lg text-muted">
                Enter your email and we&rsquo;ll send you a link to set a new password.
              </p>
              <form onSubmit={sendReset} className="mt-10 space-y-4">
                <label className="label block" htmlFor="forgot-email">Email</label>
                <input
                  id="forgot-email"
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
                  {busy ? "Sending…" : "Send reset link"}
                </button>
                {error && <p className="text-sm text-[#e0857d]">{error}</p>}
              </form>
            </>
          ) : (
            <p className="mt-4 text-lg text-muted">
              If <span className="text-ink">{email}</span> has an AVAIA account, a password reset
              link is on its way. Open it on this device to set a new password.
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
            <button type="button" onClick={() => switchMode("password")} className="label hover:text-seal">
              ← Back to sign in
            </button>
            <button type="button" onClick={() => switchMode("code")} className="label hover:text-seal">
              Email me a sign-in code instead
            </button>
          </div>
        </>
      )}

      {mode === "code" && (
        step === "email" ? (
          <>
            <p className="mt-4 text-lg text-muted">
              Enter your email and we&rsquo;ll send you a sign-in code. No password — the code is
              all you need.
            </p>
            <form onSubmit={sendCode} className="mt-10 space-y-4">
              <label className="label block" htmlFor="code-email">Email</label>
              <input
                id="code-email"
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
            <p className="mt-6">
              <button type="button" onClick={() => switchMode("password")} className="label hover:text-seal">
                ← Back to sign in with a password
              </button>
            </p>
          </>
        ) : (
          <>
            <p className="mt-4 text-lg text-muted">
              We sent an 8-digit code to <span className="text-ink">{email}</span>. Enter it below
              to continue. (Check spam if it&rsquo;s not there in a minute.)
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
        )
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
