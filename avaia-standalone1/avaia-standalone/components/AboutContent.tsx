import Link from "next/link";
import { CONSTITUTION_PREAMBLE, GIVE_METHOD, OPERATING_PRINCIPLES } from "@/lib/institution";

/**
 * The public About page — orients a visitor to what AVAIA is, why it exists,
 * what makes it different, how it works, and where to go next. Deliberately
 * NOT the institution's full governing material -- that lives at /institution
 * (Constitution, all 18 principles, component relationships, governance
 * policy), following the same progressive-disclosure pattern already used by
 * /chemistry, /secondary-loss, /reports, and /conversations/[slug]. Rendered
 * by /about (canonical) and by the site root, so there is only one copy.
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
      <h1 className="font-serif text-4xl text-ink">One conversation, carried across time.</h1>
      <p className="mt-4 text-lg leading-relaxed text-ink">{CONSTITUTION_PREAMBLE}</p>
      <div className="mt-8">
        <Link
          href="/journey"
          prefetch={false}
          className="inline-block rounded-md bg-seal px-6 py-3 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
        >
          Begin the journey
        </Link>
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

      {/* The AVAIA Journey */}
      <section id="journey" className="rule-t mt-16 scroll-mt-24 border-t border-rule pt-12">
        <p className="label mb-2">The Arc</p>
        <h2 className="font-serif text-3xl text-ink">The AVAIA Journey</h2>
        <p className="mt-3 text-muted">
          One journey, three parts. Each has its own page — read what it means, or begin now.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Link
            href="/journey/iap"
            className="rounded-lg border border-rule bg-white/[0.04] backdrop-blur-sm px-5 py-4 transition-colors hover:border-seal"
          >
            <p className="label text-muted">Awareness</p>
            <p className="mt-1 font-serif text-lg text-ink">Individual Awareness Profile</p>
            <p className="mt-1 text-sm text-muted">You get to say it.</p>
          </Link>
          <Link
            href="/journey/cat"
            className="rounded-lg border border-rule bg-white/[0.04] backdrop-blur-sm px-5 py-4 transition-colors hover:border-seal"
          >
            <p className="label text-muted">Understanding</p>
            <p className="mt-1 font-serif text-lg text-ink">Conversations Across Time</p>
            <p className="mt-1 text-sm text-muted">You get to understand it.</p>
          </Link>
          <Link
            href="/journey/innercompass"
            className="rounded-lg border border-rule bg-white/[0.04] backdrop-blur-sm px-5 py-4 transition-colors hover:border-seal"
          >
            <p className="label text-muted">Agency</p>
            <p className="mt-1 font-serif text-lg text-ink">InnerCompass</p>
            <p className="mt-1 text-sm text-muted">You get to decide what belongs to you from here.</p>
          </Link>
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

      {/* Explore AVAIA */}
      <section id="explore" className="rule-t mt-16 scroll-mt-24 border-t border-rule pt-12">
        <p className="label mb-2">Go Deeper</p>
        <h2 className="font-serif text-3xl text-ink">Explore AVAIA</h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            href="/journey"
            prefetch={false}
            className="rounded-lg border border-rule bg-white/[0.04] backdrop-blur-sm px-5 py-4 transition-colors hover:border-seal"
          >
            <p className="font-serif text-lg text-ink">The Journey</p>
            <p className="mt-1 text-sm text-muted">Begin — or continue — the conversation itself.</p>
          </Link>
          <Link
            href="/chemistry"
            className="rounded-lg border border-rule bg-white/[0.04] backdrop-blur-sm px-5 py-4 transition-colors hover:border-seal"
          >
            <p className="font-serif text-lg text-ink">Chemistry of Virtue</p>
            <p className="mt-1 text-sm text-muted">
              The 123 elements a conversation works with, and how they combine.
            </p>
          </Link>
          <Link
            href="/secondary-loss"
            className="rounded-lg border border-rule bg-white/[0.04] backdrop-blur-sm px-5 py-4 transition-colors hover:border-seal"
          >
            <p className="font-serif text-lg text-ink">The Secondary Loss Engine</p>
            <p className="mt-1 text-sm text-muted">
              Why a loss can affect more than what was directly taken.
            </p>
          </Link>
          <Link
            href="/defying-grief"
            className="rounded-lg border border-rule bg-white/[0.04] backdrop-blur-sm px-5 py-4 transition-colors hover:border-seal"
          >
            <p className="font-serif text-lg text-ink">Defying Grief</p>
            <p className="mt-1 text-sm text-muted">AVAIA&rsquo;s flagship grief program.</p>
          </Link>
          <Link
            href="/workbook"
            prefetch={false}
            className="rounded-lg border border-rule bg-white/[0.04] backdrop-blur-sm px-5 py-4 transition-colors hover:border-seal"
          >
            <p className="font-serif text-lg text-ink">Your Workbook</p>
            <p className="mt-1 text-sm text-muted">The living record of your own AVAIA journey.</p>
          </Link>
          <Link
            href="/institution"
            className="rounded-lg border border-rule bg-white/[0.02] backdrop-blur-sm px-5 py-4 transition-colors hover:border-seal"
          >
            <p className="font-serif text-ink">The Institution</p>
            <p className="mt-1 text-sm text-muted">
              The full Constitution, principles, and governance behind AVAIA — for anyone who
              wants to go deeper.
            </p>
          </Link>
        </div>
      </section>
    </div>
  );
}
