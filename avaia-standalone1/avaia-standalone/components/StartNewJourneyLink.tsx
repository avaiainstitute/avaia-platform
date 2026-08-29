"use client";

/** What this link actually does (verified against app/journey/page.tsx's
 *  ?new=1 handler): generates and stores a Guide's Record for the current
 *  active conversation (lib/engine/referral-generation.ts's
 *  generateGuidesRecord -- the same content-generation normal completion
 *  uses, just without advanceToNextStage, so no CAT/next-stage conversation
 *  is created), preserves its messages, and starts a brand-new Journey with
 *  a fresh IAP -- never just "another conversation" inside the current one.
 *  The confirmation exists so a Host can't trigger that by a single
 *  accidental click on what used to read as a harmless label.
 *
 *  window.location.replace, not router.push -- a soft client-side
 *  navigation to the same pathname (/journey, just with ?new=1) can be
 *  served from Next's client Router Cache instead of actually reaching the
 *  server branch that does the work, exactly the stale-page failure mode
 *  SignOutButton.tsx and ConsentForm.tsx already navigate around the same
 *  way. This guarantees a real request, every time. Nothing about the
 *  underlying ?new=1 route/behavior changes. */
export default function StartNewJourneyLink({ href }: { href: string }) {
  function handleClick() {
    const ok = window.confirm(
      "Start a new Journey?\n\n" +
        "Your current conversation will be closed and preserved in your Workbook with its " +
        "Guide's Record. A new Journey will begin with a new Individual Awareness Profile."
    );
    if (ok) window.location.replace(href);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="font-sans text-xs uppercase tracking-wide text-muted transition-colors hover:text-seal"
    >
      Start a New Journey
    </button>
  );
}
