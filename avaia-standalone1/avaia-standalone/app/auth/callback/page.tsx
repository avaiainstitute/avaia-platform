"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { peekPostSignInRedirect } from "@/lib/post-signin-redirect";

/**
 * Magic-link landing. Establishes the session from the sign-in link, then
 * forwards into the journey.
 *
 * We do NOT call setSession()/exchangeCodeForSession() ourselves *up front*.
 * createBrowserClient() (lib/supabase/client.ts) forces detectSessionInUrl:
 * true and cannot be configured otherwise — merely constructing the client
 * (here, or in SupabaseSessionSync in the root layout, which mounts on every
 * page including this one) already triggers Supabase's own automatic
 * exchange of whatever's in the URL (hash tokens or a PKCE ?code=) the
 * moment it runs. Calling exchangeCodeForSession() ourselves at the same
 * time would race that automatic one for the SAME single-use code/verifier
 * — and reliably lose, since Supabase deletes the PKCE verifier the instant
 * either attempt redeems (or fails to redeem) the code. That race was the
 * actual cause of "PKCE code verifier not found in storage": not a missing
 * or misplaced cookie, but the cookie being consumed out from under us by
 * our own duplicate exchange attempt. So we only ever *observe* for the
 * session the automatic exchange produces at first, and only fall back to
 * an explicit exchangeCodeForSession() call ourselves (below, for the
 * ?code= case) after a multi-second delay with nothing having landed --
 * late enough that a still-in-flight automatic attempt is very unlikely,
 * never as a simultaneous duplicate.
 *
 * finish() uses a hard window.location navigation, not next/navigation's
 * router. Nav.tsx links to /journey from every page, including pre-auth ones
 * like /sign-in — Next prefetches those on viewport/hover by default, caching
 * the anonymous JourneyIntro render for /journey in the client-side Router
 * Cache well before sign-in happens. router.replace()+router.refresh() back
 * to back in the same tick is a known-unreliable combination for busting that
 * specific cache entry (export const dynamic = "force-dynamic" only affects
 * server-side rendering — it does nothing to the client cache). A full
 * browser navigation bypasses that cache entirely: the server sees a fresh
 * request with whatever cookie now exists, no client-side caching layer
 * involved at all.
 */
export default function AuthCallbackPage() {
  const [status, setStatus] = useState<"working" | "error">("working");
  const [detail, setDetail] = useState("");

  useEffect(() => {
    const rawHash = window.location.hash.replace(/^#/, "");
    const rawSearch = window.location.search.replace(/^\?/, "");
    const supabase = createClient();

    // GoTrue includes `type` alongside the tokens (e.g. "email_change",
    // "magiclink", "signup"). Read it once, up front, since the hash is
    // otherwise only inspected for an error below.
    const type =
      new URLSearchParams(rawHash).get("type") || new URLSearchParams(rawSearch).get("type");

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      // The Free IAP "save your progress" email attachment is the one
      // flow through this page that isn't a normal sign-in -- send it
      // back to the Journey with an explicit "saved" acknowledgment
      // instead of wherever peekPostSignInRedirect() would otherwise
      // send a signed-in visitor.
      if (type?.startsWith("email_change")) {
        window.location.replace("/journey?saved=1");
        return;
      }
      window.location.replace(peekPostSignInRedirect());
    };
    const fail = (msg: string) => {
      if (done) return;
      done = true;
      setDetail(msg);
      setStatus("error");
    };

    (async () => {
      try {
        const hp = new URLSearchParams(rawHash);
        const sp = new URLSearchParams(rawSearch);

        // An explicit error from Supabase (expired / already used / denied) —
        // just reading query/hash params, no exchange involved.
        const err =
          hp.get("error_description") ||
          hp.get("error") ||
          sp.get("error_description") ||
          sp.get("error");
        if (err) return fail(err.replace(/\+/g, " "));

        // No explicit error, and there's something to redeem (hash tokens or
        // a code) — the client's automatic detectSessionInUrl handling is
        // already processing it as of the createClient() call above. Wait
        // for it to land rather than attempting our own parallel exchange.
        const { data } = await supabase.auth.getSession();
        if (data.session) return finish();

        // Not filtered to a specific event name: the event fired for an
        // email-change confirmation isn't reliably documented (SIGNED_IN
        // vs USER_UPDATED are both plausible depending on flow), so this
        // finishes on any event that comes with a session rather than
        // gambling on one exact name.
        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
          if (session) finish();
        });

        const code = sp.get("code");
        if (code) {
          // A PKCE ?code= link (email-change confirmation links look like
          // this). Give the automatic detectSessionInUrl exchange a head
          // start -- only attempt our own exchange if nothing has landed
          // after a few seconds, so this never races the automatic one for
          // the same single-use code (see the file-level comment above on
          // why a simultaneous duplicate attempt reliably loses that race).
          setTimeout(async () => {
            if (done) return;
            const { data: exchanged, error: exchangeError } =
              await supabase.auth.exchangeCodeForSession(code);
            if (done) return;
            if (exchanged.session) return finish();
            sub.subscription.unsubscribe();
            fail(exchangeError?.message ?? "We couldn't find valid sign-in details in that link.");
          }, 3000);
        } else {
          setTimeout(() => {
            sub.subscription.unsubscribe();
            fail("We couldn't find valid sign-in details in that link.");
          }, 8000);
        }
      } catch (e) {
        fail(e instanceof Error ? e.message : "Something went wrong signing you in.");
      }
    })();
  }, []);

  return (
    <div className="mx-auto max-w-prose px-5 py-24 text-center">
      {status === "working" ? (
        <>
          <p className="label mb-3">One moment</p>
          <h1 className="font-serif text-3xl text-ink">Signing you in…</h1>
          <p className="mt-4 text-muted">Bringing you into your journey.</p>
        </>
      ) : (
        <>
          <h1 className="font-serif text-3xl text-ink">That link didn&rsquo;t take</h1>
          <p className="mt-4 text-muted">
            The sign-in link may have expired or already been used. Sign-in links work once and
            only for a short time — let&rsquo;s send a fresh one and use it right away.
          </p>
          {detail && (
            <p className="mt-3 text-xs text-muted/70">Details: {detail}</p>
          )}
          <Link
            href="/sign-in"
            className="mt-8 inline-block rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
          >
            Send a fresh link
          </Link>
        </>
      )}
    </div>
  );
}
