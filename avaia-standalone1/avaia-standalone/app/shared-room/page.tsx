import Link from "next/link";

export const metadata = { title: "The Shared Room — AVAIA" };
export const dynamic = "force-dynamic";

/** Public front door for the Shared Room capability -- built and live
 *  this session, previously unexplained anywhere on the public site. Front-
 *  door language only: no RLS, no auth-identity mechanics, no database
 *  terms. The technical "how" lives in the codebase/internal audit
 *  documentation, not here -- this page answers what/does/becomes-possible,
 *  matching the register every other public AVAIA page already uses. */
export default function SharedRoomPage() {
  return (
    <div className="mx-auto max-w-prose px-5 py-16">
      <p className="label mb-3">A Shared Room</p>
      <h1 className="font-serif text-4xl text-ink">More than one person. One Table.</h1>
      <p className="mt-4 text-lg leading-relaxed text-ink">
        A way for more than one person to participate in the same AVAIA conversation, while each
        person keeps full ownership of their own experience. Not a group chat, and not one shared
        account speaking for everyone — a Room where every voice stays its own.
      </p>

      <section className="rule-t mt-16 border-t border-rule pt-12">
        <p className="label mb-2">What It Is</p>
        <h2 className="font-serif text-2xl text-ink">A Room is not the people in it.</h2>
        <p className="mt-3 text-muted">
          A Shared Room is what a conversation becomes when more than one person brings something
          real to the same Table — a family, a couple, a parent and a teenager, business partners,
          a team. Each person is still their own Host, with their own story. Nobody&rsquo;s account
          of things becomes the official one just because more than one person agrees with it.
        </p>
      </section>

      <section className="rule-t mt-12 border-t border-rule pt-10">
        <p className="label mb-2">What It Does</p>
        <h2 className="font-serif text-2xl text-ink">Shared where it&rsquo;s shared. Private where it&rsquo;s private.</h2>
        <p className="mt-3 text-muted">
          Multiple people can be in the same conversation at once, each heard and addressed as
          themselves. At any point, a participant can step into genuinely private processing of
          their own — a real, protected space, not just a quieter corner of the same room. Nothing
          from that private space returns to the Room automatically. When they&rsquo;re ready, they
          choose exactly what — if anything — comes back, in their own words.
        </p>
        <div className="mt-6 rounded-lg border border-seal/40 bg-seal/[0.06] px-5 py-5">
          <p className="font-serif text-lg text-ink">Private means private unless you choose to share it.</p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>Any participant can step into private processing at any time.</li>
            <li>The person facilitating the Room cannot read that private material by default.</li>
            <li>No other participant can read it.</li>
            <li>Nothing returns to the shared Room automatically.</li>
            <li>The participant alone decides what, if anything, comes back — and in their own words.</li>
          </ul>
        </div>
      </section>

      <section className="rule-t mt-12 border-t border-rule pt-10">
        <p className="label mb-2">What Becomes Possible</p>
        <h2 className="font-serif text-2xl text-ink">Visibility, without requiring agreement.</h2>
        <p className="mt-3 text-muted">
          Families, relationships, teams, organizations, and communities can become more visible to
          one another — without needing to agree, without a majority overruling one person, without
          anyone being pressured to disclose something they&rsquo;d rather keep private, and without
          one account being declared the true one. A Room can end with real understanding and real
          disagreement both still present — that&rsquo;s not a failure of the conversation. Sometimes
          it&rsquo;s the most honest place it could have landed.
        </p>
      </section>

      <section className="rule-t mt-12 border-t border-rule pt-10">
        <p className="label mb-2">In Practice</p>
        <div className="mt-4 space-y-6">
          <div>
            <p className="font-serif text-lg text-ink">A family</p>
            <p className="mt-1 text-sm text-muted">
              Siblings caring for an aging parent in very different ways can each be heard fully,
              without one form of care being ranked above the other.
            </p>
          </div>
          <div>
            <p className="font-serif text-lg text-ink">A relationship</p>
            <p className="mt-1 text-sm text-muted">
              Two people with different memories of the same event can each say what actually
              happened for them, without either account being declared the real one.
            </p>
          </div>
          <div>
            <p className="font-serif text-lg text-ink">A parent and a teenager</p>
            <p className="mt-1 text-sm text-muted">
              A parent&rsquo;s authority to decide and a teenager&rsquo;s own experience of that
              decision can both be held as real, at the same time, without either one erasing the
              other.
            </p>
          </div>
          <div>
            <p className="font-serif text-lg text-ink">Business partners</p>
            <p className="mt-1 text-sm text-muted">
              Two people with genuinely different instincts about risk can each be understood on
              their own terms, without one instinct being labeled brave and the other afraid.
            </p>
          </div>
          <div>
            <p className="font-serif text-lg text-ink">A team or a community</p>
            <p className="mt-1 text-sm text-muted">
              A group can move toward a shared purpose while everyone keeps their own perspective,
              experience, and private life genuinely their own.
            </p>
          </div>
        </div>
      </section>

      <section className="rule-t mt-12 border-t border-rule pt-10">
        <p className="text-muted">
          A Shared Room is facilitated by a Certified AVAIA Guide, using the same Awareness →
          Understanding → Agency Journey that carries every AVAIA conversation, individual or
          shared.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/certified-guide"
            className="inline-block rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
          >
            Learn About Certified Guides
          </Link>
          <Link
            href="/about"
            className="inline-block rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
          >
            Learn About AVAIA
          </Link>
        </div>
      </section>
    </div>
  );
}
