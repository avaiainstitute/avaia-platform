"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// Mirrors the four labels in lib/engine/prompts.ts's UNSUNG_HEROES_PATH_LABEL,
// duplicated here as plain strings rather than imported -- that module has
// `import "server-only"` and can't be pulled into a client component.
// Illustrative only on this page; the real, functional picker (keyed by
// UnsungHeroesPath) still only renders once signed in, on this same route.
const EXAMPLE_PATHS = [
  "I saw someone doing something good",
  "Someone recognized me",
  "Something difficult happened",
  "I want to grow",
];

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

      <div className="rule-t mt-14 border-t border-rule pt-8">
        <p className="label mb-2 text-muted">Why this exists</p>
        <p className="text-ink">
          Most people who go unacknowledged aren&rsquo;t missing virtue — they&rsquo;re missing
          a witness. Unsung Heroes exists so that when you notice something real in someone
          else — courage, patience, integrity, kindness, whatever it was — there&rsquo;s
          somewhere to say so, and somewhere for it to be kept.
        </p>

        <p className="label mb-2 mt-8 text-muted">How this connects to Chemistry of Virtue</p>
        <p className="text-ink">
          <Link
            href="/chemistry"
            className="underline decoration-rule underline-offset-2 hover:text-seal"
          >
            Chemistry of Virtue
          </Link>{" "}
          helps you understand virtue — the families, the elements, how they combine. Unsung
          Heroes is the other half: where you learn to recognize those same elements alive in
          someone else, not just on a chart.
        </p>

        <p className="label mb-3 mt-8 text-muted">A few reasons people arrive here</p>
        <ul className="space-y-2">
          {EXAMPLE_PATHS.map((p) => (
            <li key={p} className="flex gap-3 text-ink">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-seal" aria-hidden />
              <span>{p}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-muted">
          Whichever one fits, a short guided conversation helps you name what happened and, if
          you choose, record it.
        </p>
      </div>

      <div className="mt-10">
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
