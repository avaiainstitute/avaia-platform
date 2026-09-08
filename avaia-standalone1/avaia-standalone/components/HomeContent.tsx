import Link from "next/link";

/**
 * The public homepage — the front door, not a table of contents. Answers
 * only "what might my experience here be like" and "where do I start."
 * Deliberately carries no Journey architecture, Workbook, Chemistry,
 * Secondary Losses, GIVE, Guide/Host/Witness, or institutional explanation
 * -- those stay one click away via /about and the existing Nav, exactly as
 * they already are. The "What Still Needs to Be Said" block below is a
 * deliberately quiet second doorway, visually secondary to the primary
 * invitation and IAP entry point above it.
 */
export default function HomeContent() {
  return (
    <div className="mx-auto max-w-prose px-5 py-20">
      {/* ---------------------------------------------------------------
          Identity
      --------------------------------------------------------------- */}
      <p className="label mb-2" style={{ fontSize: "1.5rem" }}>AVAIA</p>
      <p className="mb-3 text-xs text-muted">pronounced uh-VAY-uh</p>
      <p className="font-cinzel text-sm uppercase tracking-[0.2em] text-phoenix">
        Clarity Starts With Integrity.
      </p>

      {/* ---------------------------------------------------------------
          Principal copy — exact, approved text
      --------------------------------------------------------------- */}
      <p className="mt-8 text-lg leading-relaxed text-ink">
        Sometimes you don&rsquo;t need someone to tell you what to do. You need a place to say
        what you have not been able to say, to think out loud, ask questions you may not have
        answers for, and bring the parts that do not quite fit together yet. You might come with
        a decision you cannot seem to make, a relationship you are trying to understand, a loss
        that changed more than you expected, a question about who you are or where your life is
        going, or simply the sense that there is more to the story than you have been able to
        see. You do not need to organize it first, have the right words, or know where the
        conversation is going. Bring what is present. You get to bring the whole conversation.
      </p>

      <p className="mt-6 text-lg leading-relaxed text-ink">
        AVAIA begins with you, what you notice, what matters, what you hope for, what you fear,
        what you question, and what does not make sense yet. You are not coming here to be
        examined. You are entrusting AVAIA with whatever you choose to bring, and you remain the
        owner of your story and your decisions. You can slow down, change direction, sit with
        something without resolving it, or discover a connection you had not seen until you
        heard yourself say it. One conversation may lead to another, and what becomes visible may
        change what you understand and the questions you ask next. You do not need to start with
        an answer. Come sit down. You only have to start where you are.
      </p>

      {/* ---------------------------------------------------------------
          Primary CTAs
      --------------------------------------------------------------- */}
      <div className="mt-10 flex flex-wrap items-center gap-4">
        <Link
          href="/journey"
          prefetch={false}
          className="inline-block rounded-md bg-seal px-6 py-3 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
        >
          Start Your Individual Awareness Profile
        </Link>
        <Link
          href="/defying-grief"
          prefetch={false}
          className="inline-block rounded-md border border-rule px-6 py-3 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
        >
          Learn More About Defying Grief
        </Link>
      </div>
      <p className="mt-3 text-sm text-muted">It&rsquo;s free to begin.</p>

      {/* ---------------------------------------------------------------
          Second doorway — quiet, secondary. No further explanation beyond
          the approved description; the feature explains itself once someone
          arrives.
      --------------------------------------------------------------- */}
      <section className="mt-24 border-t border-rule pt-12">
        <h2 className="font-serif text-xl text-ink">What Still Needs to Be Said</h2>
        <p className="mt-4 text-muted">
          Sometimes there are words you still need to say to someone you cannot have the
          conversation with. Someone who died. Someone who is no longer part of your life.
          Someone you cannot speak to right now. This is a private place to say what has remained
          unsaid, without needing to explain it, resolve it, or decide what comes next.
        </p>
        <div className="mt-5">
          <Link
            href="/still-needs-to-be-said"
            prefetch={false}
            className="inline-block rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
          >
            Say What Still Needs to Be Said
          </Link>
        </div>
      </section>
    </div>
  );
}
