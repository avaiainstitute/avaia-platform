import Link from "next/link";
import JourneyStageProgress from "@/components/JourneyStageProgress";

export const metadata = { title: "Conversations Across Time — AVAIA" };

/** Journey explanation page, part two of three. See app/journey/iap/page.tsx
 *  for the pattern this follows. See /conversations/cat for the operational
 *  manual entry. */
export default function CatJourneyPage() {
  return (
    <div className="mx-auto max-w-prose px-5 py-16">
      <JourneyStageProgress current="cat" />

      <p className="label mb-2 mt-8">Defying Grief — Understanding</p>
      <h1 className="font-serif text-4xl text-ink">Conversations Across Time</h1>
      <p className="mt-2 font-serif text-xl text-seal">You get to understand it.</p>

      <div className="mt-8 space-y-6 text-lg leading-relaxed text-ink">
        <p>
          IAP made room to say it. CAT is where what you said starts to be understood — not
          collected again, looked at more closely: how it formed, what it&rsquo;s connected to,
          and what it may still be costing you.
        </p>
      </div>

      <section className="mt-12">
        <h2 className="font-serif text-2xl text-ink">Not more information-gathering</h2>
        <p className="mt-3 text-lg leading-relaxed text-muted">
          CAT doesn&rsquo;t ask you to keep listing what&rsquo;s wrong. It already has what
          became visible in IAP. Its work is to sit with that and help you see it more clearly —
          understanding more, not gathering more.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-2xl text-ink">The weight you&rsquo;re carrying</h2>
        <p className="mt-3 text-lg leading-relaxed text-muted">
          Some of what you&rsquo;re carrying belongs to the original loss or disruption itself.
          Some of it belongs to what that loss quietly took along with it — a Secondary Loss.
          CAT helps you start to sort out which is which, and what to make of it, without
          deciding any of that in advance.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-2xl text-ink">Same thing, different intent</h2>
        <p className="mt-3 text-lg leading-relaxed text-muted">
          Two things can look almost identical on the surface and come from completely different
          places underneath. In Defying Grief, this is where the idea of <em>Audacity</em> enters
          — not one of AVAIA&rsquo;s virtues, but, as the program itself describes it, &ldquo;the
          force that makes a person insist on their own aliveness in the face of loss.&rdquo; The
          same force can look different from person to person, and CAT stays curious about how
          it&rsquo;s actually showing up for someone rather than assuming the answer in advance.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-2xl text-ink">CAT doesn&rsquo;t decide what it means</h2>
        <p className="mt-3 text-lg leading-relaxed text-muted">
          CAT doesn&rsquo;t tell you what any of this means. It creates the conditions for you
          to understand it — recognition, not a conclusion handed to you.
        </p>
      </section>

      <div className="rule-t mt-14 border-t border-rule pt-8">
        <p className="text-lg leading-relaxed text-ink">
          What became visible in IAP has now been given greater understanding. InnerCompass asks
          what that understanding makes possible.
        </p>
        <Link
          href="/journey/innercompass"
          className="mt-5 inline-block font-serif text-xl text-seal hover:underline"
        >
          Continue to InnerCompass →
        </Link>
      </div>
    </div>
  );
}
