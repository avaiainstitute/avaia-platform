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
// Both real sign-in paths peek at it: verify() in app/sign-in/page.tsx (the
// code the Host types), and finish() in app/auth/callback/page.tsx (if they
// click a link in the email instead). Neither one clears it, because a
// first-time Host still has to pass through /welcome's consent form before
// really landing anywhere -- ConsentForm is the one that actually consumes
// it, since it's the genuine last stop. A returning, already-consented Host
// never hits /welcome, so nothing ever consumes the value for them; it just
// sits harmlessly in sessionStorage until overwritten or the tab closes.

const KEY = "avaia_post_signin_redirect";

// Fixed allowlist -- this value ends up driving a same-origin navigation,
// so it's validated rather than trusted, the same posture used for
// Stripe's returnTo in app/api/stripe/checkout/route.ts.
const ALLOWED = [
  "/journey",
  "/defying-grief",
  "/unsung-heroes?path=i_saw_someone",
  "/toolkit",
  "/library",
  "/workbook",
  "/shared-with-me",
  "/youth",
];

export function setPostSignInRedirect(path: string) {
  if (typeof window === "undefined" || !ALLOWED.includes(path)) return;
  try {
    window.sessionStorage.setItem(KEY, path);
  } catch {
    // Storage can be unavailable (private browsing, etc.) -- falling back
    // to the default destination is a fine, harmless outcome.
  }
}

/** Reads the stored destination without clearing it -- a first-time Host
 *  may still have to pass through /welcome's consent form between signing
 *  in and actually landing on this destination, so the value has to survive
 *  that extra hop. Used by verify() and finish(), which may or may not be
 *  the last stop. Defaults to /journey. */
export function peekPostSignInRedirect(): string {
  if (typeof window === "undefined") return "/journey";
  try {
    const value = window.sessionStorage.getItem(KEY);
    return value && ALLOWED.includes(value) ? value : "/journey";
  } catch {
    return "/journey";
  }
}

/** Reads and clears the stored destination -- read-once. Used by ConsentForm,
 *  the genuine last stop for a first-time Host. */
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
