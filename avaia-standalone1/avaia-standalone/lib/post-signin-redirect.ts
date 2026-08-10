"use client";

// Where to send a Host after they finish signing in, when they arrived at
// /sign-in from somewhere other than the default (e.g. Defying Grief's
// Threshold screen). Deliberately does NOT touch emailRedirectTo or any
// Supabase-facing URL — that class of change has repeatedly caused Supabase
// to fall back to its dashboard Site URL when the resulting URL didn't
// exactly match its Redirect URLs allowlist. This only ever reads/writes
// the browser's own sessionStorage, entirely on AVAIA's side, so it can't
// trigger that failure mode.
//
// Both real sign-in paths use it: verify() in app/sign-in/page.tsx (the
// code the Host types), and finish() in app/auth/callback/page.tsx (if they
// click a link in the email instead) -- whichever one actually completes
// the sign-in reads the same stored value.

const KEY = "avaia_post_signin_redirect";

// Fixed allowlist -- this value ends up driving a same-origin navigation,
// so it's validated rather than trusted, the same posture used for
// Stripe's returnTo in app/api/stripe/checkout/route.ts.
const ALLOWED = ["/journey", "/defying-grief"];

export function setPostSignInRedirect(path: string) {
  if (typeof window === "undefined" || !ALLOWED.includes(path)) return;
  try {
    window.sessionStorage.setItem(KEY, path);
  } catch {
    // Storage can be unavailable (private browsing, etc.) -- falling back
    // to the default destination is a fine, harmless outcome.
  }
}

/** Reads and clears the stored destination -- read-once, so a later sign-in
 *  from the same browser doesn't reuse a stale value. Defaults to /journey. */
export function consumePostSignInRedirect(): string {
  if (typeof window === "undefined") return "/journey";
  try {
    const value = window.sessionStorage.getItem(KEY);
    window.sessionStorage.removeItem(KEY);
    return value && ALLOWED.includes(value) ? value : "/journey";
  } catch {
    return "/journey";
  }
}
