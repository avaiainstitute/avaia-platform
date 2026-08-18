import Link from "next/link";

/**
 * The public homepage — deliberately minimal. Answers exactly three
 * questions: what is this, why might I care, where do I start. Everything
 * else AVAIA has to say lives one click away on /about, which now carries
 * the institutional substance this page used to share verbatim with it.
 * The opening line below is the first sentence of the Constitution
 * preamble (lib/institution.ts's CONSTITUTION_PREAMBLE) reused as-is;
 * /about keeps the full two-sentence preamble as its deeper opening.
 */
export default function HomeContent() {
  return (
    <div className="mx-auto max-w-prose px-5 py-16">
      <p className="label mb-3">AVAIA</p>
      <h1 className="font-serif text-4xl text-ink">One conversation, carried across time.</h1>
      <p className="mt-4 text-lg leading-relaxed text-ink">
        AVAIA exists to help individuals, relationships, families, and communities move from
        disruption toward understanding, from understanding toward restoration, and from
        restoration toward intentional participation in life.
      </p>
      {/* Primary entry point. Any element can occupy this spot as long as it
          keeps the href — this is meant to also work as a clickable image
          CTA (e.g. the "I hope you heal..." visual), not only this button. */}
      <div className="mt-8">
        <Link
          href="/journey"
          prefetch={false}
          className="inline-block rounded-md bg-seal px-6 py-3 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
        >
          Start Your Individual Awareness Profile
        </Link>
        <p className="mt-3 text-sm text-muted">It&rsquo;s free to begin.</p>
      </div>

      {/* What can I do here beyond the free IAP itself. */}
      <section className="mt-14">
        <p className="label mb-4 text-muted">Or, before you begin</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/defying-grief"
            className="rounded-lg border border-rule bg-white/[0.04] backdrop-blur-sm px-5 py-4 transition-colors hover:border-seal"
          >
            <p className="font-serif text-lg text-ink">Defying Grief</p>
            <p className="mt-1 text-sm text-muted">
              AVAIA&rsquo;s flagship program — a guided journey through loss, built on the same
              free Individual Awareness Profile.
            </p>
          </Link>
          <Link
            href="/chemistry"
            className="rounded-lg border border-rule bg-white/[0.04] backdrop-blur-sm px-5 py-4 transition-colors hover:border-seal"
          >
            <p className="font-serif text-lg text-ink">Chemistry of Virtue</p>
            <p className="mt-1 text-sm text-muted">
              The 123 elements every AVAIA conversation works with, and how they combine.
            </p>
          </Link>
        </div>
      </section>

      <p className="mt-14 text-sm">
        <Link href="/about" className="text-muted hover:text-seal">
          Want to understand AVAIA more deeply? →
        </Link>
      </p>
    </div>
  );
}
