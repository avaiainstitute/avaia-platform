import Link from "next/link";
import {
  CONSTITUTION_PREAMBLE,
  GIVE_METHOD,
  OPERATING_PRINCIPLES,
  JOURNEY_MOVEMENTS,
  conversation,
} from "@/lib/institution";

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

// The three Host-facing conversations, in order -- Preparation is
// deliberately excluded (it's a Guide-only step before the Host ever
// arrives), matching what a Host actually experiences as "the Journey."
// Looked up against the real CONVERSATIONS array so text stays verbatim.
const HOST_JOURNEY_STAGE_SLUGS = ["iap", "cat", "innercompass"] as const;
const hostJourneyStages = HOST_JOURNEY_STAGE_SLUGS.map((slug) => conversation(slug)).filter(
  (c): c is NonNullable<typeof c> => Boolean(c)
);

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
        <p className="mt-3 text-sm text-muted">
          It&rsquo;s free to begin — this is Defying Grief, AVAIA&rsquo;s current program.
        </p>
      </div>

      {/* The Name -- pronunciation + etymology discipline. AVAIA is
          genuinely not an acronym; some name sources associate "Avaia"
          with Greek origin / "one of a kind" / the word avos, but that
          etymology isn't established well enough to state as linguistic
          fact, so this uses only AVAIA's own truthful explanation of why
          the name was chosen -- not a claim about where it historically
          comes from. */}
      <section id="name" className="rule-t mt-16 scroll-mt-24 border-t border-rule pt-12">
        <p className="label mb-2">The Name</p>
        <h2 className="font-serif text-3xl text-ink">AVAIA</h2>
        <p className="mt-1 text-muted">pronounced uh-VAY-uh</p>
        <p className="mt-4 text-lg leading-relaxed text-ink">
          AVAIA is not an acronym. The name was chosen for its association with being one of a
          kind — a fitting expression of a belief at the heart of the Institute: no two people,
          stories, relationships, losses, or conversations are exactly alike.
        </p>
        <p className="mt-4 text-lg leading-relaxed text-ink">
          That is why AVAIA does not begin by deciding where your conversation should go. It
          begins by listening to the person having it.
        </p>
      </section>

      {/* How This Works -- who/what a visitor is actually talking to, why
          that differs from a general-purpose AI chatbot, and who created
          AVAIA. Deliberately does not position this as "AVAIA has better
          AI" or disparage general-purpose AI -- the distinction drawn here
          is architectural (what AVAIA is designed to do), not a claim about
          the underlying technology. Founder identification and "what
          stands behind the method" use only what's verifiably true today
          (Dorian Johnson as founder; the Constitution, Journey
          architecture, and certification standards that already exist) --
          no credentials, efficacy claims, or research/clinical validation
          are stated, because none exist in AVAIA's own governing
          materials. */}
      <section id="how-it-works" className="rule-t mt-16 scroll-mt-24 border-t border-rule pt-12">
        <p className="label mb-2">How This Works</p>
        <h2 className="font-serif text-3xl text-ink">What You&rsquo;re Actually Talking To</h2>
        <p className="mt-4 text-lg leading-relaxed text-ink">
          An AVAIA conversation is AI-supported. When you begin a Journey on your own, you are
          not speaking with a staff member, a clinician, or a Certified Guide — a Guide is only
          ever present when one has been specifically arranged, never automatically. AVAIA is
          not therapy, counseling, or crisis care.
        </p>
        <p className="mt-4 text-lg leading-relaxed text-ink">
          General-purpose AI is designed to answer many kinds of questions. AVAIA is designed to
          steward one particular kind of conversation. The underlying technology alone is not
          AVAIA — AVAIA is the conversational architecture, the governing standards, and the
          deliberate response discipline built around it: it does not rush toward solving,
          diagnosing, or prescribing what something means. It follows what you&rsquo;re saying
          rather than funneling it toward a conclusion, allows correction and uncertainty,
          respects your capacity, and preserves continuity from one conversation to the next.
        </p>
        <p className="mt-4 text-lg leading-relaxed text-ink">
          Much of that design is about what the technology is taught not to take from the
          conversation: your meaning, your authorship, and your ownership of what comes next.
        </p>
        <p className="mt-4 text-lg leading-relaxed text-ink">
          AVAIA was founded by Dorian Johnson, and is governed by a written{" "}
          <Link href="/institution" className="text-seal hover:underline">
            Constitution
          </Link>
          , a defined Journey architecture, and professional standards for anyone{" "}
          <Link href="/certified-guide" className="text-seal hover:underline">
            certified to steward an AVAIA conversation
          </Link>
          .
        </p>
      </section>

      {/* The Roadmap -- the missing piece this renovation adds. The public
          shape of the Journey: the three movements (JOURNEY_MOVEMENTS) and
          the three conversations that carry them (CONVERSATIONS, filtered to
          what a Host actually experiences). JOURNEY_MOVEMENTS' third entry
          was renamed from "Discernment" to "Agency" in the canonical
          terminology reconciliation -- this page reads the array directly,
          so no separate change was needed here. Discernment remains the
          (correctly distinct) process InnerCompass practices to strengthen
          Agency -- see INNERCOMPASS_DISCERNMENT_FUNCTION in
          lib/engine/prompts.ts, untouched by that reconciliation. */}
      <section id="roadmap" className="rule-t mt-16 scroll-mt-24 border-t border-rule pt-12">
        <p className="label mb-2">The Roadmap</p>
        <h2 className="font-serif text-3xl text-ink">The Shape of the Journey</h2>
        <p className="mt-3 text-muted">
          Every AVAIA Journey moves through the same three movements, carried by three
          conversations.
        </p>

        <p className="mt-8 font-serif text-lg text-ink">
          {JOURNEY_MOVEMENTS.map((m) => m.name).join(" → ")}
        </p>
        <ol className="mt-4 space-y-4">
          {JOURNEY_MOVEMENTS.map((m, i) => (
            <li key={m.name} className="flex gap-4">
              <span className="font-serif text-lg text-muted tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="font-serif text-lg text-ink">{m.name}</p>
                <p className="text-sm text-muted">{m.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-10 font-serif text-lg text-ink">
          {hostJourneyStages.map((c) => c.name).join(" → ")}
        </p>
        <ol className="mt-4 space-y-4">
          {hostJourneyStages.map((c, i) => (
            <li key={c.slug} className="flex gap-4">
              <span className="font-serif text-lg text-muted tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="font-serif text-lg text-ink">
                  {c.name}
                  {c.abbr ? <span className="text-muted"> ({c.abbr})</span> : null}
                </p>
                <p className="text-sm text-muted">{c.purpose}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-10 rounded-lg border border-rule bg-white/[0.04] px-5 py-5 backdrop-blur-sm">
          <p className="text-lg leading-relaxed text-ink">
            The Host owns their story, meaning, decisions, and participation. The Guide protects
            the process, not the outcome.
          </p>
        </div>
      </section>

      {/* Beyond the Conversation -- restrained pointer to how the Workbook,
          Living Library, Programs, and Institution relate to the Journey
          above. One line each, existing routes only -- no new pages, no
          feature-card grid. The Institution is deliberately not re-linked
          here; the existing "Go deeper" link below stays the one place for
          that. */}
      <section id="beyond" className="rule-t mt-16 scroll-mt-24 border-t border-rule pt-12">
        <p className="label mb-2">Beyond the Conversation</p>
        <h2 className="font-serif text-3xl text-ink">What Carries the Journey Forward</h2>
        <p className="mt-3 text-muted">
          A few things sit around every AVAIA Journey, without being another conversation to
          have.
        </p>
        <ul className="mt-6 space-y-3">
          <li>
            <Link href="/workbook" className="text-ink hover:text-seal">
              The Workbook
            </Link>
            <span className="text-muted">
              {" "}
              — everything that became visible along the way, kept in one place you can return
              to.
            </span>
          </li>
          <li>
            <Link href="/library" className="text-ink hover:text-seal">
              The Living Library
            </Link>
            <span className="text-muted">
              {" "}
              — reflections and questions to explore on your own, between or beyond
              conversations.
            </span>
          </li>
          <li>
            <span className="text-ink">Programs</span>
            <span className="text-muted"> — the same Journey, shaped for a specific path. </span>
            <Link href="/defying-grief" className="text-ink hover:text-seal">
              Defying Grief
            </Link>
            <span className="text-muted"> is AVAIA&rsquo;s flagship — for adults, and, separately, for young people.</span>
          </li>
          <li>
            <Link href="/chemistry" className="text-ink hover:text-seal">
              The Chemistry of Virtue
            </Link>
            <span className="text-muted">
              {" "}
              — 123 elements of virtue a conversation may recognize in what you&rsquo;ve already
              said or done, never assigned to you as a guess.
            </span>
          </li>
          <li>
            <Link href="/signature" className="text-ink hover:text-seal">
              Your Virtue Signature
            </Link>
            <span className="text-muted">
              {" "}
              — a living record of what you choose to keep, built from what became visible along
              the way. Others can offer evidence; only you decide what belongs in it.
            </span>
          </li>
          <li>
            <span className="text-ink">The Institution</span>
            <span className="text-muted">
              {" "}
              — the Constitution and governance that keep all of it consistent, covered further
              below.
            </span>
          </li>
        </ul>
      </section>

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

      {/* Secondary Losses — upgraded from a Go-deeper bullet to its own
          modest callout, since it's substantive (and now central to how
          Defying Grief explains itself), not just a footer reference.
          Sized to stay clearly secondary to the primary CTA above. */}
      <section className="rule-t mt-16 scroll-mt-24 border-t border-rule pt-12">
        <p className="label mb-2 text-muted">A Closer Look</p>
        <div className="rounded-lg border border-rule bg-white/[0.04] px-5 py-5 backdrop-blur-sm">
          <p className="font-serif text-xl text-ink">The Secondary Loss Engine</p>
          <p className="mt-2 text-muted">
            A loss rarely takes only the one thing it&rsquo;s named for. What it quietly takes
            alongside it — meaning, trust, connection, a piece of your own identity — can
            affect more than what was directly taken.
          </p>
          <Link
            href="/secondary-loss"
            className="mt-3 inline-block rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
          >
            Explore the Secondary Loss Engine →
          </Link>
        </div>
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
        </ul>
      </section>
    </div>
  );
}
