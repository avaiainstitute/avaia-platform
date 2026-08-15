import Link from "next/link";
import JourneyStageProgress from "@/components/JourneyStageProgress";

export const metadata = { title: "Individual Awareness Profile — AVAIA" };

/** Journey explanation page, part one of three. Why this stage exists and
 *  what it means for the Host -- not an instruction page, not how the AI
 *  works. See /conversations/iap for the operational manual entry. */
export default function IapJourneyPage() {
  return (
    <div className="mx-auto max-w-prose px-5 py-16">
      <JourneyStageProgress current="iap" />

      <p className="label mb-2 mt-8">The AVAIA Journey — Part One</p>
      <h1 className="font-serif text-4xl text-ink">Individual Awareness Profile</h1>
      <p className="mt-2 font-serif text-xl text-seal">You get to say it.</p>

      <div className="mt-8 space-y-6 text-lg leading-relaxed text-ink">
        <p>
          You&rsquo;ve probably seen the videos — someone walks up to a stranger, hands them a
          flower and a note. The note says something like, <em>I hope you heal from all the
          things you don&rsquo;t ever talk about.</em>
        </p>
        <p>This is the place you get to talk about them.</p>
        <p>That&rsquo;s the whole reason the Individual Awareness Profile exists.</p>
      </div>

      <section className="mt-12">
        <h2 className="font-serif text-2xl text-ink">What IAP actually does</h2>
        <p className="mt-3 text-lg leading-relaxed text-muted">
          IAP isn&rsquo;t here to diagnose you, solve anything, or decide what your experiences
          mean. It gives you room to say what you&rsquo;ve been carrying, in your own words, at
          your own pace — and it helps make visible what can be genuinely hard to see while
          you&rsquo;re still living inside it: what happened, who&rsquo;s involved, what&rsquo;s
          in tension, what&rsquo;s still strong in you, the patterns that keep showing up,
          what&rsquo;s been lost.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-2xl text-ink">
          Why something can keep hurting long after it happened
        </h2>
        <p className="mt-3 text-lg leading-relaxed text-muted">
          Loss rarely takes only one thing. A single disruption can quietly take meaning along
          with it, or a sense of what&rsquo;s real, or dreams and opportunities that were never
          going to happen now, or trust in your own judgment, or your footing in the decisions
          and boundaries that used to feel simple, or a clear sense of where your life was
          headed, or connection, or a sense of control, or a piece of your own identity, or the
          attachment and support you used to be able to count on.
        </p>
        <p className="mt-3 text-lg leading-relaxed text-muted">
          Those are Secondary Losses — real, even when nobody ever names them out loud. IAP
          helps you start to see which ones are actually present for you.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-2xl text-ink">You decide what enters the room</h2>
        <p className="mt-3 text-lg leading-relaxed text-muted">
          AVAIA doesn&rsquo;t need you to disclose everything to participate. You decide what
          comes into this conversation. Whatever you choose to bring is listened to carefully
          and carried forward with you — it&rsquo;s never something you have to hand over just
          to be allowed to continue.
        </p>
      </section>

      <div className="rule-t mt-14 border-t border-rule pt-8">
        <p className="text-lg leading-relaxed text-ink">
          What becomes visible here doesn&rsquo;t disappear once the conversation ends. It goes
          with you — into Conversations Across Time, where it starts to be understood.
        </p>
        <Link
          href="/journey/cat"
          className="mt-5 inline-block font-serif text-xl text-seal hover:underline"
        >
          Continue to Conversations Across Time →
        </Link>
      </div>
    </div>
  );
}
