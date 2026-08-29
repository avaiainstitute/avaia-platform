import MembershipCheckoutButton from "@/components/MembershipCheckoutButton";

export const metadata = { title: "AVAIA Membership" };

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
 *  regardless of what any page passes in. */
export default function MembershipPage({
  searchParams,
}: {
  searchParams?: { returnTo?: string };
}) {
  const returnTo = searchParams?.returnTo;

  return (
    <div className="mx-auto max-w-prose px-5 py-16">
      <p className="label mb-3">AVAIA Membership</p>
      <h1 className="font-serif text-4xl text-ink">AVAIA Membership</h1>
      <p className="mt-4 text-lg leading-relaxed text-ink">
        Your free Individual Awareness Profile is one conversation.
      </p>
      <p className="mt-4 text-lg leading-relaxed text-ink">
        Membership gives you a continuing place in AVAIA — to continue your Journey, return for
        future conversations, preserve what you discover, and access the tools and resources that
        support what comes next.
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
              text: "Explore and save AVAIA Library material connected to understanding, virtue, disruption, restoration, and intentional participation.",
            },
            {
              title: "Chemistry of Virtue",
              text: "Explore AVAIA's 10 Virtue Families and 123 elements.",
            },
            {
              title: "Secondary Losses",
              text: "Explore AVAIA's framework for recognizing what else can be affected after disruption or loss.",
            },
            {
              title: "Unsung Heroes",
              text: "Explore and recognize how virtue becomes visible through everyday actions in ourselves and others.",
            },
          ].map((item) => (
            <li key={item.title}>
              <p className="font-serif text-lg text-ink">{item.title}</p>
              <p className="mt-1 text-sm text-muted">{item.text}</p>
            </li>
          ))}
        </ol>

        <div className="mt-10 rounded-lg border border-rule bg-white/[0.04] px-5 py-5 backdrop-blur-sm">
          <p className="text-sm text-muted">
            AVAIA Membership will continue to grow as new member tools and experiences are
            released.
          </p>
        </div>
      </section>

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
    </div>
  );
}
