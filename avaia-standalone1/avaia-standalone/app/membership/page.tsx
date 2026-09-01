import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isMember as checkIsMember } from "@/lib/membership";
import MembershipCheckoutButton from "@/components/MembershipCheckoutButton";

export const metadata = { title: "AVAIA Membership" };
export const dynamic = "force-dynamic";

/** Public home for membership pricing -- separated out from the Journey
 *  gate (app/journey/page.tsx's MembershipGate) so "continue the Journey"
 *  and "choose a plan" are two different moments, and so future
 *  membership types (Family, etc. -- not built here) have a natural home
 *  that isn't the Journey gate itself. Reuses MembershipCheckoutButton
 *  exactly as the gate already does -- no new Stripe code, no new price
 *  resolution, no schema change.
 *
 *  `returnTo` carries the gate's own returnTo prop forward as a query
 *  param (see MembershipGate's "Continue with Membership" link) so a
 *  Host who arrived from /defying-grief still lands back there after
 *  checkout, exactly as before this page existed. This page does no
 *  validation on it itself -- /api/stripe/checkout already validates
 *  returnTo against a fixed allowlist before using it for anything,
 *  regardless of what any page passes in.
 *
 *  Member-aware: an already-active member sees a plain acknowledgment and
 *  links to existing routes instead of purchase buttons -- reusing the
 *  same isMember() check every other gate on the site already uses, no
 *  new membership-status concept. Signed-out visitors and signed-in
 *  non-members see the exact same sales copy as before. */
export default async function MembershipPage({
  searchParams,
}: {
  searchParams?: { returnTo?: string };
}) {
  const returnTo = searchParams?.returnTo;
  // Same membership, same price, same Stripe flow -- only the copy below
  // acknowledges the Host arrived from Defying Grief, using the returnTo
  // value already carried here from the gate. No program-specific pricing
  // or entitlement logic.
  const isDefyingGrief = returnTo === "/defying-grief";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isMember = user ? await checkIsMember(supabase, user.id) : false;

  return (
    <div className="mx-auto max-w-prose px-5 py-16">
      <p className="label mb-3">AVAIA Membership</p>
      <h1 className="font-serif text-4xl text-ink">AVAIA Membership</h1>
      <p className="mt-4 text-lg leading-relaxed text-ink">
        {isDefyingGrief
          ? "Your free Individual Awareness Profile was the beginning of Defying Grief."
          : "Your free Individual Awareness Profile is one conversation."}
      </p>
      <p className="mt-4 text-lg leading-relaxed text-ink">
        {isDefyingGrief
          ? "Membership continues your Defying Grief Journey into Conversations Across Time and InnerCompass, and keeps continuity through your Workbook and AVAIA's other resources."
          : "Membership gives you a continuing place in AVAIA — to continue your Journey, return for future conversations, preserve what you discover, and access the tools and resources that support what comes next."}
      </p>

      <section className="rule-t mt-16 border-t border-rule pt-12">
        <p className="label mb-2">What Membership Includes</p>
        <h2 className="font-serif text-3xl text-ink">A continuing place in AVAIA</h2>

        <ol className="mt-8 space-y-5">
          {[
            {
              title: "The Complete AVAIA Journey",
              text: "Continue from the Individual Awareness Profile into Conversations Across Time and InnerCompass.",
            },
            {
              title: "Future Conversations",
              text: "Return to AVAIA when something new happens, a decision arises, a relationship changes, or there is something you want to understand.",
            },
            {
              title: "Your AVAIA Workbook",
              text: "Preserve what becomes visible across conversations so important understanding does not simply disappear when a conversation ends.",
            },
            {
              title: "Conversation Continuity",
              text: "Carry forward what has already become visible rather than continually starting over.",
            },
            {
              title: "The Living Library",
              text: "Full member access to AVAIA Library material connected to understanding, virtue, disruption, restoration, and intentional participation.",
            },
            {
              title: "Unsung Heroes",
              text: "Recognize how virtue becomes visible through everyday actions in yourself and others.",
            },
          ].map((item) => (
            <li key={item.title}>
              <p className="font-serif text-lg text-ink">{item.title}</p>
              <p className="mt-1 text-sm text-muted">{item.text}</p>
            </li>
          ))}
        </ol>

        <p className="mt-8 text-sm text-muted">
          Chemistry of Virtue and Secondary Losses are AVAIA resources available to everyone —
          they don&rsquo;t require membership.
        </p>

        <div className="mt-10 rounded-lg border border-rule bg-white/[0.04] px-5 py-5 backdrop-blur-sm">
          <p className="text-sm text-muted">
            AVAIA Membership will continue to grow as new member tools and experiences are
            released.
          </p>
        </div>
      </section>

      {isMember ? (
        <section className="rule-t mt-16 border-t border-rule pt-12">
          <p className="label mb-2">Individual Membership</p>
          <h2 className="font-serif text-3xl text-ink">You&rsquo;re an AVAIA Member.</h2>
          <p className="mt-3 text-lg text-muted">Start with what brought you here.</p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/journey"
              prefetch={false}
              className="inline-block rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
            >
              Continue My Journey
            </Link>
            <Link
              href="/workbook"
              prefetch={false}
              className="inline-block rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-semibold text-ink transition-colors hover:border-seal"
            >
              Open My Workbook
            </Link>
            <Link
              href="/library"
              prefetch={false}
              className="inline-block rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-semibold text-ink transition-colors hover:border-seal"
            >
              Explore the Living Library
            </Link>
            <Link
              href="/unsung-heroes"
              prefetch={false}
              className="inline-block rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-semibold text-ink transition-colors hover:border-seal"
            >
              Unsung Heroes
            </Link>
          </div>
        </section>
      ) : (
        <section className="rule-t mt-16 border-t border-rule pt-12">
          <p className="label mb-2">Individual Membership</p>
          <h2 className="font-serif text-3xl text-ink">Individual AVAIA Membership</h2>
          <p className="mt-3 text-lg text-muted">$19/month or $190/year</p>

          <div className="mt-8 flex flex-wrap items-start gap-6">
            <MembershipCheckoutButton
              returnTo={returnTo}
              plan="monthly"
              label="Choose Monthly — $19/month"
            />
            <div>
              <MembershipCheckoutButton
                returnTo={returnTo}
                plan="annual"
                label="Choose Annual — $190/year"
              />
              <p className="mt-2 text-sm text-muted">Save $38 with annual membership.</p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
