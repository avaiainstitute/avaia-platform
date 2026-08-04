"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Magic-link landing. Establishes the session from the sign-in link, then
 * forwards into the journey.
 *
 * We do NOT call setSession()/exchangeCodeForSession() ourselves here.
 * createBrowserClient() (lib/supabase/client.ts) forces detectSessionInUrl:
 * true and cannot be configured otherwise — merely constructing the client
 * (here, or in SupabaseSessionSync in the root layout, which mounts on every
 * page including this one) already triggers Supabase's own automatic
 * exchange of whatever's in the URL (hash tokens or a PKCE ?code=) the
 * moment it runs. A second, manual exchange call here would race that
 * automatic one for the SAME single-use code/verifier — and reliably lose,
 * since Supabase deletes the PKCE verifier the instant either attempt
 * redeems (or fails to redeem) the code. That race was the actual cause of
 * "PKCE code verifier not found in storage": not a missing or misplaced
 * cookie, but the cookie being consumed out from under us by our own
 * duplicate exchange attempt. So we only ever *observe* for the session the
 * automatic exchange produces, never redeem the code ourselves.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"working" | "error">("working");
  const [detail, setDetail] = useState("");

  useEffect(() => {
    const rawHash = window.location.hash.replace(/^#/, "");
    const rawSearch = window.location.search.replace(/^\?/, "");
    const supabase = createClient();

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      router.replace("/journey");
      router.refresh();
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

        const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === "SIGNED_IN" && session) finish();
        });
        setTimeout(() => {
          sub.subscription.unsubscribe();
          fail("We couldn't find valid sign-in details in that link.");
        }, 8000);
      } catch (e) {
        fail(e instanceof Error ? e.message : "Something went wrong signing you in.");
      }
    })();
  }, [router]);

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
