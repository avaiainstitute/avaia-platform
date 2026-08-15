import Link from "next/link";
import JourneyStageProgress from "@/components/JourneyStageProgress";

export const metadata = { title: "InnerCompass — AVAIA" };

/** Journey explanation page, part three of three. See
 *  app/journey/iap/page.tsx for the pattern this follows. See
 *  /conversations/innercompass for the operational manual entry. */
export default function InnerCompassJourneyPage() {
  return (
    <div className="mx-auto max-w-prose px-5 py-16">
      <JourneyStageProgress current="innercompass" />

      <p className="label mb-2 mt-8">The AVAIA Journey — Part Three</p>
      <h1 className="font-serif text-4xl text-ink">InnerCompass</h1>
      <p className="mt-2 font-serif text-xl text-seal">
        You get to decide what belongs to you from here.
      </p>

      <div className="mt-8 space-y-6 text-lg leading-relaxed text-ink">
        <p>InnerCompass asks what that understanding makes possible.</p>
        <p>
          The question changes here. It&rsquo;s no longer <em>what happened</em>, or{" "}
          <em>what does it mean</em> — it&rsquo;s <em>what does this understanding allow me to
          do now?</em>
        </p>
      </div>

      <section className="mt-12">
        <h2 className="font-serif text-2xl text-ink">Not a decision machine</h2>
        <p className="mt-3 text-lg leading-relaxed text-muted">
          InnerCompass doesn&rsquo;t tell you what&rsquo;s correct or hand you an answer. It
          helps you understand why you&rsquo;re drawn toward a particular direction, what&rsquo;s
          actually influencing that pull, what capacities and virtues are already available to
          you, what&rsquo;s still in the way — and, maybe most importantly, whether the direction
          in front of you actually belongs to you.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-2xl text-ink">Whose decision is it, really</h2>
        <p className="mt-3 text-lg leading-relaxed text-muted">
          Fear, guilt, shame, other people&rsquo;s expectations, or what somebody else wants for
          you can all shape a decision, sometimes without you noticing. That doesn&rsquo;t
          automatically make a decision wrong — but it helps to know which influences are
          actually present. InnerCompass brings them into view, so that whatever you choose is
          chosen with open eyes, not simply inherited from whichever voice happened to be
          loudest.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-2xl text-ink">A concrete example</h2>
        <p className="mt-3 text-lg leading-relaxed text-muted">
          In AVAIA&rsquo;s Defying Grief program specifically, this is where two forms of the
          same audacity meet. The Audacity of Grief is the stubbornness that keeps a person
          showing up inside loss, even when nothing about it has resolved. The Audacity of
          Happiness is the nerve it takes to hope again, to dream something for yourself again,
          to laugh without it meaning you&rsquo;ve forgotten. Someone may choose to stay with the
          Audacity of Grief. They may move toward the Audacity of Happiness. AVAIA doesn&rsquo;t
          prescribe either one — it only helps make sure the choice is actually theirs.
        </p>
        <p className="mt-3 text-sm text-muted">
          (Again, a Defying Grief example, not something every InnerCompass conversation walks
          through.)
        </p>
      </section>

      <div className="rule-t mt-14 border-t border-rule pt-8">
        <p className="text-lg leading-relaxed text-ink">
          Awareness. Understanding. Agency. You said it. You came to understand it more deeply.
          Now you get to decide what belongs to you from here.
        </p>
        <Link
          href="/journey"
          prefetch={false}
          className="mt-5 inline-block font-serif text-xl text-seal hover:underline"
        >
          Return to the Journey →
        </Link>
      </div>
    </div>
  );
}
