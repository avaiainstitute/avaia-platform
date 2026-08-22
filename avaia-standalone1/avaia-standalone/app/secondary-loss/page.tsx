import Link from "next/link";
import { SECONDARY_LOSSES } from "@/lib/institution";

export const metadata = { title: "Secondary Loss — AVAIA" };

// Short, plain-language recognition line per canonical loss -- not a
// definition, not clinical, tentative by design (no card asserts anything
// about the visitor). Keyed to SECONDARY_LOSSES' own loss names so a typo
// here fails loudly (undefined) rather than silently mismatching.
const RECOGNITION_LINE: Record<string, string> = {
  Meaning: "How life makes sense may be affected.",
  Reality: "What feels real, or trustworthy, may shift.",
  "Dreams / Opportunities": "The future you imagined may need to change.",
  "Self-Trust": "How much you trust your own judgment may be shaken.",
  "Decision-Making / Boundaries": "Making decisions or holding boundaries may feel harder.",
  "Life Vision": "The life you thought you were building may look different now.",
  Connection: "Connection with others may feel different.",
  Control: "Your sense of control may feel different.",
  Identity: "Who you understand yourself to be may be in question.",
  "Attachment / Support": "Where you find support and attachment may have changed.",
};

export default function SecondaryLossPage() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-16">
      <p className="label mb-3">Core Engine</p>
      <h1 className="font-serif text-4xl text-ink">The Secondary Loss Engine</h1>

      <p className="mt-4 max-w-prose text-lg text-muted">
        When something is taken, the primary loss is usually seen at once. The secondary losses
        often remain hidden — and that is frequently where the pain lives. Bringing them into
        view increases understanding and opens the way to restoration.
      </p>

      <p className="mt-4 max-w-prose text-muted">
        A Secondary Loss is not necessarily another event. It&rsquo;s what else may have been
        disrupted alongside the one you can already name — how life makes sense, what feels
        real, the future you imagined, how much you trust yourself, your ability to decide or
        hold boundaries, the life you thought you were building, connection with others, your
        sense of control, who you understand yourself to be, or where support now lives.
      </p>

      <p className="mt-4 max-w-prose text-muted">
        These are doorways for recognition, not a diagnosis. AVAIA never looks at what happened
        to you and declares which of these you have. A Secondary Loss becomes meaningful only
        when your own experience supports it — something below may be present, may be worth
        exploring, or may simply help name part of what you&rsquo;re carrying. Nothing here is a
        claim about you.
      </p>

      <div className="mt-12 grid gap-3 sm:grid-cols-2">
        {SECONDARY_LOSSES.map((s) => (
          <div
            key={s.loss}
            className="rounded-lg border border-rule bg-white/[0.04] backdrop-blur-sm px-5 py-4"
          >
            <p className="label text-muted">Loss of</p>
            <p className="font-serif text-lg text-ink">{s.loss}</p>
            <p className="mt-1 text-sm text-muted">{RECOGNITION_LINE[s.loss]}</p>
          </div>
        ))}
      </div>

      <div className="mt-12 max-w-prose">
        <p className="text-muted">
          Chemistry of Virtue may later offer language for how you choose to participate — it is
          not an automatic remedy for any Secondary Loss, and nothing here pairs a specific loss
          to a specific virtue.
        </p>
        <Link
          href="/chemistry"
          className="mt-3 inline-block rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
        >
          Explore the Chemistry of Virtue →
        </Link>
        <p className="mt-6 text-muted">
          Deeper exploration of any of this — reflections, questions, other voices who&rsquo;ve
          written about it — belongs in the Living Library.
        </p>
        <Link
          href="/library"
          className="mt-3 inline-block rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
        >
          Visit the Living Library →
        </Link>
      </div>

      <div className="mt-12 max-w-prose rule-t border-t border-rule pt-8">
        <p className="text-lg leading-relaxed text-ink">
          You do not need to know which of these applies before you begin. The Journey may help
          something become visible that was difficult to name beforehand — Secondary Losses can
          support understanding once they&rsquo;re relevant, not before.
        </p>
        <div className="mt-6">
          <Link
            href="/journey"
            prefetch={false}
            className="inline-block rounded-md bg-seal px-6 py-3 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
          >
            Begin the Journey
          </Link>
        </div>
      </div>
    </div>
  );
}
