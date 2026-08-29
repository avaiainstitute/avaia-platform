"use client";

import { useRouter } from "next/navigation";

/** What this link actually does (verified against app/journey/page.tsx's
 *  ?new=1 handler): generates and stores a Guide's Record for the current
 *  active conversation (lib/engine/referral-generation.ts's
 *  generateGuidesRecord -- the same content-generation normal completion
 *  uses, just without advanceToNextStage, so no CAT/next-stage conversation
 *  is created), preserves its messages, and starts a brand-new Journey with
 *  a fresh IAP -- never just "another conversation" inside the current one.
 *  The confirmation exists so a Host can't trigger that by a single
 *  accidental click on what used to read as a harmless label. router.push
 *  (not a hard nav) matches the plain next/link this replaces -- nothing
 *  about the underlying ?new=1 route/behavior changes. */
export default function StartNewJourneyLink({ href }: { href: string }) {
  const router = useRouter();

  function handleClick() {
    const ok = window.confirm(
      "Start a new Journey?\n\n" +
        "Your current conversation will be closed and preserved in your Workbook with its " +
        "Guide's Record. A new Journey will begin with a new Individual Awareness Profile."
    );
    if (ok) router.push(href);
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
