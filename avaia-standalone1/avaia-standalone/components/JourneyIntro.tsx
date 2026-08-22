import Link from "next/link";
import type { Stage } from "@/lib/engine/prompts";

/**
 * The general-program counterpart to DefyingGriefCrossing -- shown at the
 * exact same moment (a stage's conversation exists with only its seeded
 * opening message, before the Host has sent anything), using the exact same
 * mechanism (Link to /journey?enter=1, which app/journey/page.tsx already
 * uses to skip back past any crossing screen into the real chat). Where
 * DefyingGriefCrossing only ever covers defying-grief's CAT/InnerCompass
 * entries, this fills every OTHER first-entry moment -- every program's
 * first IAP message, and general program's CAT/InnerCompass entries -- which
 * previously had no orientation at all; a brand-new Host was dropped
 * straight into an empty chat with only a stage label above it.
 *
 * Deliberately distributes the Journey's own explanatory copy across the
 * three stages' own first moments rather than the About page's approach of
 * explaining all three movements together up front -- consistent with
 * "experience before explanation": a Host meets each movement when they
 * actually arrive at it, not as a lecture before they've done anything.
 * Ownership is stated once, here at the very beginning (Awareness); the
 * Workbook/Continuity note is stated once, at the end (Agency) -- neither is
 * repeated at every stage, and once a Host sends their first message this
 * screen never shows again for that stage, exactly like DefyingGriefCrossing.
 */
export default function JourneyIntro({ stage }: { stage: Stage }) {
  if (stage === "iap") {
    return (
      <div className="mt-8">
        <p className="label mb-2">The AVAIA Journey</p>
        <p className="font-serif text-lg text-ink">
          Awareness <span className="text-muted">→</span> Understanding{" "}
          <span className="text-muted">→</span> Agency
        </p>
        <p className="mt-4 text-muted">
          The Journey moves through three connected conversations. They aren&rsquo;t three
          unrelated products — they&rsquo;re three movements within one continuing conversation.
        </p>

        <p className="label mb-2 mt-10">1 — Awareness</p>
        <h2 className="font-serif text-3xl text-ink">Individual Awareness Profile</h2>
        <p className="mt-2 font-serif text-lg italic text-muted">What became visible?</p>
        <p className="mt-4 text-lg leading-relaxed text-ink">
          The Individual Awareness Profile is where the Journey begins. You can bring what is
          present without needing to organize it first, explain it perfectly, or know where the
          conversation is going.
        </p>
        <p className="mt-4 text-lg leading-relaxed text-ink">
          Its purpose is not to diagnose, evaluate, or tell you what your experience means. It
          creates room for more of your experience to become visible.
        </p>

        <div className="mt-8 rounded-lg border border-rule bg-white/[0.04] px-5 py-5 backdrop-blur-sm">
          <p className="leading-relaxed text-ink">
            You remain the owner of your story, meaning, decisions, and participation throughout
            the Journey. AVAIA protects the conditions for awareness, understanding, and
            discernment. It does not determine the outcome for you.
          </p>
        </div>

        <div className="mt-8">
          <Link
            href="/journey?enter=1"
            className="inline-block rounded-md bg-seal px-6 py-3 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
          >
            Begin
          </Link>
        </div>
      </div>
    );
  }

  if (stage === "cat") {
    return (
      <div className="mt-8">
        <p className="label mb-2">2 — Understanding</p>
        <h2 className="font-serif text-3xl text-ink">Conversations Across Time</h2>
        <p className="mt-2 font-serif text-lg italic text-muted">
          How do the different parts of what became visible become understandable together?
        </p>
        <p className="mt-4 text-lg leading-relaxed text-ink">
          Conversations Across Time begins from what emerged during the Individual Awareness
          Profile. Experiences, relationships, responsibilities, hopes, fears, losses,
          perspectives, questions, and tensions may begin to be understood together rather than
          separately.
        </p>
        <p className="mt-4 text-lg leading-relaxed text-ink">
          The purpose is not forced agreement. The purpose is not to rush toward a decision. The
          purpose is greater understanding.
        </p>

        <div className="mt-8">
          <Link
            href="/journey?enter=1"
            className="inline-block rounded-md bg-seal px-6 py-3 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
          >
            Continue
          </Link>
        </div>
      </div>
    );
  }

  // stage === "innercompass"
  return (
    <div className="mt-8">
      <p className="label mb-2">3 — Agency</p>
      <h2 className="font-serif text-3xl text-ink">InnerCompass</h2>
      <p className="mt-2 font-serif text-lg italic text-muted">
        Given what I now understand, how do I choose to participate?
      </p>
      <p className="mt-4 text-lg leading-relaxed text-ink">
        InnerCompass begins from the understanding developed through the earlier conversations.
        It helps you discern:
      </p>
      <ul className="mt-4 space-y-3">
        {[
          "What belongs to your responsibility.",
          "What belongs to your choice.",
          "What does not belong to your control.",
          "How you want to participate with integrity.",
        ].map((line) => (
          <li key={line} className="flex gap-3 text-lg text-ink">
            <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-seal" />
            {line}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-lg leading-relaxed text-ink">
        InnerCompass does not make the decision for you. Discernment strengthens agency. You
        remain the owner of your direction.
      </p>

      <div className="mt-8 rounded-lg border border-rule bg-white/[0.04] px-5 py-5 backdrop-blur-sm">
        <p className="leading-relaxed text-ink">
          You don&rsquo;t have to begin again. What became visible and understood during the
          Journey can be carried forward through the Workbook — future conversations can build
          from what has already become visible, rather than requiring you to reconstruct your
          story every time.
        </p>
      </div>

      <div className="mt-8">
        <Link
          href="/journey?enter=1"
          className="inline-block rounded-md bg-seal px-6 py-3 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
        >
          Continue
        </Link>
      </div>
    </div>
  );
}
