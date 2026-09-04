"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

/**
 * Reached only from a Supabase recovery link (see app/auth/callback/
 * page.tsx's type==="recovery" branch), which has already established a
 * real session for the account before redirecting here -- there is no
 * separate recovery token or storage of any kind on AVAIA's side. Setting
 * the new password is just supabase.auth.updateUser({ password }) against
 * that session; Supabase's own auth store handles hashing and storage, and
 * this page never sees or holds the old password (updateUser needs none --
 * the active session already proves identity, the same way it does for a
 * Host setting their first password from /account).
 *
 * If someone lands here without a session (link expired/already used, or
 * they navigated here directly), sends them back to /sign-in's forgot-
 * password mode rather than showing a broken form.
 */
export default function ResetPasswordPage() {
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
      setChecking(false);
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Your password needs to be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Those passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't set your password. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-prose px-5 py-24">
      <p className="label mb-3">Account</p>
      <h1 className="font-serif text-4xl text-ink">Set a New Password</h1>

      {checking ? (
        <p className="mt-6 text-muted">One moment…</p>
      ) : !hasSession ? (
        <>
          <p className="mt-4 text-lg text-muted">
            This link has expired or was already used. Request a fresh one to set a new password.
          </p>
          <Link
            href="/sign-in"
            className="mt-8 inline-block rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
          >
            Back to sign in
          </Link>
        </>
      ) : done ? (
        <>
          <p className="mt-4 text-lg text-muted">
            Your password is set. You can sign in with it any time — or keep using an emailed code
            if you prefer.
          </p>
          <Link
            href="/journey"
            className="mt-8 inline-block rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
          >
            Continue to AVAIA
          </Link>
        </>
      ) : (
        <>
          <p className="mt-4 text-lg text-muted">Choose a new password for your AVAIA account.</p>
          <form onSubmit={submit} className="mt-10 space-y-4">
            <label className="label block" htmlFor="password">New password</label>
            <input
              id="password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm placeholder:text-muted focus:border-seal"
            />
            <label className="label block" htmlFor="confirm">Confirm password</label>
            <input
              id="confirm"
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Saving…" : "Set Password"}
            </button>
            {error && <p className="text-sm text-[#e0857d]">{error}</p>}
          </form>
        </>
      )}
    </div>
  );
}
