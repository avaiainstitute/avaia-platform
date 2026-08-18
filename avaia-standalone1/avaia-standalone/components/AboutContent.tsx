import Link from "next/link";
import { CONSTITUTION_PREAMBLE, GIVE_METHOD, OPERATING_PRINCIPLES } from "@/lib/institution";

/**
 * The public About page — the deeper explanation of AVAIA as an institute
 * and an approach: the philosophy, the GIVE Method, Host/Guide/Witness, and
 * what makes it different. Distinct from the homepage (components/
 * HomeContent.tsx), which is deliberately minimal and owns the "where do I
 * start" job -- About's job is "explain," not "convert," so it carries more
 * substance but stays organized under clear sections rather than one long
 * scroll. The full governing material (Constitution articles, all 18
 * principles, governance policy) lives one tier deeper, at /institution,
 * following the same progressive-disclosure pattern used by /chemistry,
 * /secondary-loss, /reports, and /conversations/[slug].
 */

// The five principles selected to represent "what makes AVAIA different" on
// this page -- titles only, looked up against the real OPERATING_PRINCIPLES
// array so the text stays verbatim and in sync with the source of truth.
const FEATURED_PRINCIPLE_TITLES = [
  "Understanding Before Action",
  "Discernment Over Prescription",
  "Relationships Require Mutual Participation",
  "Virtue Provides Direction",
  "Integrity Without Outcome Control",
];
const featuredPrinciples = FEATURED_PRINCIPLE_TITLES.map((title) =>
  OPERATING_PRINCIPLES.find((p) => p.title === title)
).filter((p): p is NonNullable<typeof p> => Boolean(p));

export default function AboutContent() {
  return (
    <div className="mx-auto max-w-prose px-5 py-16">
      <p className="label mb-3">About AVAIA</p>
      <h1 className="font-serif text-4xl text-ink">An institution for guided conversations.</h1>
      <p className="mt-4 text-lg leading-relaxed text-ink">{CONSTITUTION_PREAMBLE}</p>

      {/* Primary CTA -- moved up from the bottom of the page and upsized to
          match Home's treatment. About's job is still to explain, not just
          convert, but a visitor reading this far shouldn't have to scroll
          past GIVE/Roles/Principles/Go-deeper to find how to actually begin. */}
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

      {/* GIVE Method */}
      <section id="give" className="rule-t mt-16 scroll-mt-24 border-t border-rule pt-12">
        <p className="label mb-2">The Method</p>
        <h2 className="font-serif text-3xl text-ink">The GIVE Method</h2>
        <p className="mt-1 font-serif text-lg text-muted">{GIVE_METHOD.name}</p>
        <p className="mt-4 leading-relaxed text-ink">{GIVE_METHOD.purpose}</p>
        <div className="mt-6 space-y-4">
          {GIVE_METHOD.components.map((comp) => (
            <div key={comp.letter} className="flex gap-4">
              <span className="font-serif text-4xl leading-none text-seal">{comp.letter}</span>
              <div>
                <p className="font-serif text-lg text-ink">{comp.label}</p>
                <p className="text-ink">{comp.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Host, Guide, Witness */}
      <section id="roles" className="rule-t mt-16 scroll-mt-24 border-t border-rule pt-12">
        <p className="label mb-2">The Roles</p>
        <h2 className="font-serif text-3xl text-ink">Host, Guide, Witness</h2>
        <p className="mt-3 text-muted">Every AVAIA conversation holds to the same three roles.</p>
        <div className="mt-6 space-y-4">
          <div className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4 backdrop-blur-sm">
            <p className="font-serif text-lg text-seal">The Host owns the table.</p>
            <p className="mt-1 text-sm text-muted">
              You own your story, your pace, and every decision along the way.
            </p>
          </div>
          <div className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4 backdrop-blur-sm">
            <p className="font-serif text-lg text-seal">The Guide protects the table.</p>
            <p className="mt-1 text-sm text-muted">
              The Guide facilitates understanding — never diagnosing, prescribing, or deciding for
              you.
            </p>
          </div>
          <div className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4 backdrop-blur-sm">
            <p className="font-serif text-lg text-seal">The Witness preserves the journey.</p>
            <p className="mt-1 text-sm text-muted">
              What becomes visible is remembered and carried forward, so you don&rsquo;t have to
              start over each time.
            </p>
          </div>
        </div>
      </section>

      {/* What Makes AVAIA Different */}
      <section id="principles" className="rule-t mt-16 scroll-mt-24 border-t border-rule pt-12">
        <p className="label mb-2">The Foundation</p>
        <h2 className="font-serif text-3xl text-ink">What Makes AVAIA Different</h2>
        <ol className="mt-6 space-y-4">
          {featuredPrinciples.map((p, i) => (
            <li key={p.title} className="flex gap-4">
              <span className="font-serif text-lg text-muted tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="font-serif text-lg text-ink">{p.title}</p>
                <p className="text-sm text-muted">{p.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Go deeper — quiet reference links, not primary actions. The depth
          of AVAIA becomes available as a visitor wants it, not before. */}
      <section className="rule-t mt-16 scroll-mt-24 border-t border-rule pt-12">
        <p className="label mb-3 text-muted">Go deeper</p>
        <ul className="space-y-2">
          <li>
            <Link href="/institution" className="text-ink hover:text-seal">
              The Institution — the full Constitution, principles, and governance behind AVAIA →
            </Link>
          </li>
          <li>
            <Link href="/secondary-loss" className="text-ink hover:text-seal">
              The Secondary Loss Engine — why a loss can affect more than what was directly taken →
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
