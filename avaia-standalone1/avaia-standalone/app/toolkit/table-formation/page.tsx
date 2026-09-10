import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SEATS } from "@/lib/institution";

export const metadata = { title: "Table Formation & Council, Guide Toolkit, AVAIA" };
export const dynamic = "force-dynamic";

/** Table Formation and Council are not a separate tool a Guide opens
 *  instead of a conversation, they are now live inside every adult IAP,
 *  CAT, and InnerCompass conversation (see TABLE_FORMATION_INSTRUCTIONS,
 *  lib/engine/prompts.ts), the same way Defying Grief's Audacity seat
 *  already was before this generalized the mechanism behind it. This page
 *  exists to orient a Guide to how that actually shows up, in the
 *  ordinary conversation transcript, which a facilitating Guide already
 *  sees in full (components/JourneyChat.tsx is shared by both the Host's
 *  own /journey and every Guide Toolkit session page), and to point
 *  onward to where a specific participant's Table becomes visible after
 *  the fact: Preparation, which already renders every referral field
 *  generically, Council Perspectives and Key Recognitions included, with
 *  no changes needed here to make that true. */
export default async function TableFormationPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/toolkit");

  return (
    <div>
      <p className="mb-6">
        <Link href="/toolkit" className="label hover:text-seal">
          ← Back to Dashboard
        </Link>
      </p>
      <p className="label mb-3">Core Engine</p>
      <h1 className="font-serif text-4xl text-ink">Table Formation &amp; Council</h1>
      <p className="mt-4 max-w-prose text-lg text-muted">
        The structural framework underneath every AVAIA conversation. The Host places something on
        the table; their present understanding of it is a map; seats may be recognized and offered
        to widen that map; the Host chooses their own movement from what becomes visible. This isn&rsquo;t
        a separate place to go instead of a conversation &mdash; it&rsquo;s already part of every one.
      </p>

      <div className="mt-8 rounded-lg border border-rule bg-white/[0.04] px-5 py-5">
        <p className="text-ink">
          There is nothing to configure here. A Guide facilitating IAP, Conversations Across Time,
          or InnerCompass is already seeing everything &mdash; seat offers, Council perspectives,
          the Host&rsquo;s own responses to them &mdash; in the same conversation transcript the Host
          sees. Nothing about this is a separate screen.
        </p>
      </div>

      <section className="mt-10" id="seats">
        <p className="label mb-3 text-muted">The Seats</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {SEATS.map((s) => (
            <div key={s.name} className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4">
              <p className="font-serif text-lg text-ink">{s.name}</p>
              <p className="mt-1 text-sm text-muted">{s.text}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted">
          Seats are recognized and offered when they would materially widen what the Host can see,
          never imposed. The Host may accept, decline, rename, remove, or introduce a seat of their
          own &mdash; entirely in conversation, never as a form to fill out.
        </p>
      </section>

      <section className="mt-10" id="council">
        <p className="label mb-3 text-muted">Council</p>
        <div className="rounded-lg border border-rule bg-white/[0.04] px-5 py-5">
          <p className="text-ink">
            Expands perspective while preserving the authority of the Host and the responsibility
            of the Guide. Advisory only &mdash; it never governs, and never overrides the Host.
          </p>
          <p className="mt-3 text-sm text-muted">
            You, or the Host, can ask for it directly in the conversation at any point. AVAIA may
            also offer it when another perspective seems likely to genuinely help &mdash; the Host
            can always decline. There&rsquo;s no fixed number of perspectives; sometimes one is
            enough, sometimes the territory genuinely holds several.
          </p>
        </div>
      </section>

      <section className="mt-10 rule-t border-t border-rule pt-8">
        <p className="label mb-3 text-muted">Where to see a specific participant&rsquo;s Table</p>
        <p className="max-w-prose text-muted">
          Once a seat or a Council perspective becomes visible in a conversation, it&rsquo;s carried
          forward the same way every other recognition already is &mdash; through that stage&rsquo;s
          referral. Preparation already shows this for any participant, generically, with nothing
          new to build.
        </p>
        <Link
          href="/toolkit/preparation"
          className="mt-4 inline-block rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
        >
          Open Preparation →
        </Link>
      </section>
    </div>
  );
}
