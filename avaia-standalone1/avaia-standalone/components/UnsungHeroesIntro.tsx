"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/** Shown to visitors who aren't signed in. A client component (not the
 *  server page's default) only so it can check for a Virtue Formula the
 *  visitor stashed on the Chemistry of Virtue page before signing in --
 *  when present, the sign-in link carries a ?from= so they land straight
 *  back in the "I saw someone" path afterward, instead of the general
 *  Unsung Heroes picker. See UnsungHeroesChat's own read of the same key
 *  for the other half of this handoff. */
export default function UnsungHeroesIntro() {
  const [signInHref, setSignInHref] = useState("/sign-in");

  useEffect(() => {
    try {
      if (sessionStorage.getItem("avaia:formula-focus")) {
        setSignInHref(`/sign-in?from=${encodeURIComponent("/unsung-heroes?path=i_saw_someone")}`);
      }
    } catch {
      /* storage unavailable -- the default sign-in link is a fine fallback */
    }
  }, []);

  return (
    <div className="mx-auto max-w-prose px-5 py-20">
      <p className="label mb-3">Unsung Heroes</p>
      <h1 className="font-serif text-4xl text-ink">You noticed something real</h1>
      <p className="mt-4 text-lg text-muted">
        A short, guided conversation to help you name a quiet act of virtue — one you witnessed,
        one you received, or one you&rsquo;re hoping to grow into.
      </p>
      <div className="mt-8">
        <Link
          href={signInHref}
          className="rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
        >
          Sign in to begin
        </Link>
      </div>
    </div>
  );
}
