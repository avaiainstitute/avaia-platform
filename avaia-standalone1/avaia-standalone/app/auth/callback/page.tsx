"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Magic-link landing. Establishes the session from the sign-in link, then
 * forwards into the journey.
 *
 * We read the link explicitly rather than relying only on the client's
 * auto-detection: implicit links carry the session in the URL hash
 * (#access_token=…&refresh_token=…) — we set the session from those directly;
 * PKCE links carry a ?code= we exchange. Any Supabase error (expired or
 * already-used link) is surfaced verbatim instead of a blind timeout.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"working" | "error">("working");
  const [detail, setDetail] = useState("");

  useEffect(() => {
    // Capture the URL BEFORE creating the client — auto-detection may strip the
    // hash as soon as the client initializes.
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

        // An explicit error from Supabase (expired / already used / denied).
        const err =
          hp.get("error_description") ||
          hp.get("error") ||
          sp.get("error_description") ||
          sp.get("error");
        if (err) return fail(err.replace(/\+/g, " "));

        // Implicit flow — tokens in the hash. Set the session directly.
        const access_token = hp.get("access_token");
        const refresh_token = hp.get("refresh_token");
        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) return fail(error.message);
          return finish();
        }

        // PKCE flow — a code in the query string.
        const code = sp.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) return fail(error.message);
          return finish();
        }

        // The client may have already parsed and cleared the hash — check for a
        // session, then wait briefly for the auth event as a last resort.
        const { data } = await supabase.auth.getSession();
        if (data.session) return finish();

        const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
          if (session) finish();
        });
        setTimeout(() => {
          sub.subscription.unsubscribe();
          fail("We couldn't find valid sign-in details in that link.");
        }, 6000);
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
