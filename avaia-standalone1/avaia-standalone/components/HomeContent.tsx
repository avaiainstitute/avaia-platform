import Link from "next/link";

/**
 * The public homepage — the front porch, not the whole house. Deliberately
 * answers only "what might my experience here be like," never "here is
 * everything AVAIA contains" (that's /about's job now). No card grids, no
 * feature list, no institutional teaching (Awareness/Understanding/Agency,
 * IAP/CAT/InnerCompass, Secondary Losses, Chemistry, Library, Workbook,
 * Guide/Host/Witness, GIVE Method, Constitution, Defying Grief, Unsung
 * Heroes) — those stay one click away, reachable only through the existing
 * Nav and /about, exactly as they already are. Both CTAs into the Journey
 * reuse the same already-correct entry point the previous homepage used
 * (plain /journey, prefetch={false} — see the comment on that Link below);
 * nothing about the Journey/auth/consent flow changes here.
 */
export default function HomeContent() {
  return (
    <div className="mx-auto max-w-prose px-5 py-20">
      {/* ---------------------------------------------------------------
          Hero
      --------------------------------------------------------------- */}
      <p className="label mb-2 text-2xl">AVAIA</p>
      <p className="mb-3 text-xs text-muted">pronounced uh-VAY-uh</p>
      <p className="font-cinzel text-sm uppercase tracking-[0.2em] text-phoenix">
        Clarity Starts With Integrity.
      </p>

      <h1 className="mt-6 font-serif text-4xl leading-tight text-ink sm:text-5xl">
        Sometimes you don&rsquo;t need someone to tell you what to do.
      </h1>

      <div className="mt-6 space-y-1.5 text-lg leading-relaxed text-ink">
        <p>Sometimes you need a place to say what you have not been able to say.</p>
        <p>To think out loud.</p>
        <p>To bring the parts that don&rsquo;t quite fit together yet.</p>
        <p>To ask questions you may not have answers for.</p>
        <p>To be uncertain without being rushed toward certainty.</p>
      </div>

      <p className="mt-5 text-lg leading-relaxed text-ink">
        And to discover what becomes visible when you finally have room for the whole
        conversation.
      </p>

      <p className="mt-6 font-serif text-xl text-seal">AVAIA is a place for that conversation.</p>

      <div className="mt-10 flex flex-wrap items-center gap-4">
        {/* Primary entry point — same already-correct target the previous
            homepage used. prefetch={false} keeps this a real request rather
            than caching a signed-out render (see components/Nav.tsx). */}
        <Link
          href="/journey"
          prefetch={false}
          className="inline-block rounded-md bg-seal px-6 py-3 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
        >
          Begin the Journey
        </Link>
        <Link
          href="/about"
          className="inline-block rounded-md border border-rule px-6 py-3 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
        >
          Learn About AVAIA
        </Link>
      </div>

      {/* ---------------------------------------------------------------
          You don't have to know where this is going.
      --------------------------------------------------------------- */}
      <section className="mt-24">
        <h2 className="font-serif text-2xl text-ink">
          You don&rsquo;t have to know where this is going.
        </h2>
        <div className="mt-5 space-y-1.5 text-lg leading-relaxed text-ink">
          <p>You can come with a decision you cannot seem to make.</p>
          <p>A relationship you are trying to understand.</p>
          <p>A loss that changed more than you expected.</p>
          <p>A question about who you are or where your life is going.</p>
          <p>Something you cannot quite put into words.</p>
          <p>Or simply the sense that there is more to the story than you have been able to see.</p>
        </div>
        <p className="mt-5 text-lg leading-relaxed text-muted">You don&rsquo;t need to organize it first.</p>
        <p className="mt-1 font-serif text-lg text-ink">Bring what is present.</p>
      </section>

      {/* ---------------------------------------------------------------
          You get to bring the whole conversation.
      --------------------------------------------------------------- */}
      <section className="mt-24">
        <h2 className="font-serif text-2xl text-ink">You get to bring the whole conversation.</h2>
        <p className="mt-5 text-lg leading-relaxed text-muted">
          AVAIA won&rsquo;t decide what your experience means before you have had the opportunity
          to explore it. It won&rsquo;t require you to arrive with a goal. And it won&rsquo;t
          assume that understanding something means you already know what to do about it.
        </p>
        <p className="mt-5 text-lg leading-relaxed text-ink">Instead, the conversation begins with you.</p>
        <div className="mt-5 space-y-1.5 text-lg leading-relaxed text-ink">
          <p>What you notice.</p>
          <p>What matters to you.</p>
          <p>What you hope for.</p>
          <p>What you fear.</p>
          <p>What you question.</p>
          <p>What doesn&rsquo;t make sense yet.</p>
        </div>
        <p className="mt-5 text-lg leading-relaxed text-ink">
          And sometimes, what you hadn&rsquo;t realized was connected until you heard yourself
          say it.
        </p>
      </section>

      {/* ---------------------------------------------------------------
          You are not coming here to be examined.
      --------------------------------------------------------------- */}
      <section className="mt-24">
        <h2 className="font-serif text-2xl text-ink">You are not coming here to be examined.</h2>
        <p className="mt-5 text-lg leading-relaxed text-muted">
          You are entrusting AVAIA with whatever you choose to bring.
        </p>
        <p className="mt-5 text-lg leading-relaxed text-ink">
          You remain the owner of your story. You remain the owner of your decisions.
        </p>
        <div className="mt-5 space-y-1.5 text-lg leading-relaxed text-ink">
          <p>You can slow down.</p>
          <p>You can change direction.</p>
          <p>You can say, &ldquo;That&rsquo;s not quite what I mean.&rdquo;</p>
          <p>You can sit with something without resolving it.</p>
          <p>And you can decide when you are ready to continue.</p>
        </div>
      </section>

      {/* ---------------------------------------------------------------
          One conversation can lead to another.
      --------------------------------------------------------------- */}
      <section className="mt-24">
        <h2 className="font-serif text-2xl text-ink">One conversation can lead to another.</h2>
        <div className="mt-5 space-y-1.5 text-lg leading-relaxed text-ink">
          <p>Something becomes visible.</p>
          <p>You begin to understand it differently.</p>
          <p>Another question appears.</p>
          <p>A connection you hadn&rsquo;t noticed becomes clearer.</p>
        </div>
        <p className="mt-5 text-lg leading-relaxed text-muted">
          And eventually, you may find yourself asking a different kind of question:
        </p>
        <p className="mt-4 font-serif text-xl text-seal">
          Given what I understand now, how do I choose to participate in my life?
        </p>
        <p className="mt-5 text-lg leading-relaxed text-ink">You don&rsquo;t have to start there.</p>
        <p className="mt-1 text-lg leading-relaxed text-ink">You only have to start where you are.</p>
      </section>

      {/* ---------------------------------------------------------------
          Final CTA
      --------------------------------------------------------------- */}
      <section className="mt-28 border-t border-rule pt-16">
        <h2 className="font-serif text-3xl text-ink">Come sit down.</h2>
        <div className="mt-5 space-y-1.5 text-lg leading-relaxed text-ink">
          <p>You don&rsquo;t need the right words.</p>
          <p>You don&rsquo;t need the answer.</p>
          <p>You don&rsquo;t need to know where the conversation will lead.</p>
        </div>
        <p className="mt-5 font-serif text-xl text-ink">You just need somewhere to begin.</p>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link
            href="/journey"
            prefetch={false}
            className="inline-block rounded-md bg-seal px-6 py-3 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
          >
            Start Your Individual Awareness Profile
          </Link>
          <Link
            href="/about"
            className="inline-block rounded-md border border-rule px-6 py-3 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
          >
            Learn About AVAIA
          </Link>
        </div>
        <p className="mt-3 text-sm text-muted">It&rsquo;s free to begin.</p>
      </section>
    </div>
  );
}
