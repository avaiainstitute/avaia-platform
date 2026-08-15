import Link from "next/link";
import {
  CONSTITUTION_PREAMBLE,
  CONSTITUTION_ARTICLES,
  CONSTITUTION_CLOSING,
  GIVE_METHOD,
  OPERATING_PRINCIPLES,
  JOURNEY_ARC,
  JOURNEY_MOVEMENTS,
  CONVERSATION_WORKS,
  COMPONENT_RELATIONSHIPS,
  GOVERNANCE,
} from "@/lib/institution";

/**
 * The institution's governing content — Constitution, GIVE Method, Journey, how
 * the conversation works, operating principles, component relationships, and
 * governance policy. Rendered by /about (canonical) and by the site root, so
 * there is only one copy of it.
 */
// The three Journey explanation pages, in JOURNEY_ARC/JOURNEY_MOVEMENTS
// order -- used to link the matching badge/card below without altering
// either constant's own text.
const JOURNEY_STEP_HREF: Record<string, string> = {
  Awareness: "/journey/iap",
  Understanding: "/journey/cat",
  Agency: "/journey/innercompass",
  Discernment: "/journey/innercompass",
};

export default function AboutContent() {
  return (
    <div className="mx-auto max-w-prose px-5 py-16">
      <p className="label mb-3">About AVAIA</p>
      <h1 className="font-serif text-4xl text-ink">
        An institution for guided conversations
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-muted">
        One conversation, carried across time — held so that a person is seen,
        understanding comes before action, and the Host owns every decision.
        Everything that governs AVAIA is gathered here: the Constitution, the GIVE
        Method, the Journey, how the conversation works, the operating principles,
        how the components relate, and the policy that governs its development.
      </p>

      {/* Preamble */}
      <section id="constitution" className="mt-10 scroll-mt-24">
        <p className="label mb-2">Preamble</p>
        <p className="text-lg leading-relaxed text-ink">{CONSTITUTION_PREAMBLE}</p>
      </section>

      {/* Articles */}
      <section className="mt-12 space-y-8">
        {CONSTITUTION_ARTICLES.map((a) => (
          <div key={a.n}>
            <p className="font-serif text-xl text-seal">
              Article {a.n} — {a.title}
            </p>
            <p className="mt-2 leading-relaxed text-ink">{a.text}</p>
          </div>
        ))}
      </section>

      <p className="mt-10 border-l-4 border-rule pl-5 font-serif text-lg italic text-muted">
        {CONSTITUTION_CLOSING}
      </p>

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

      {/* Journey */}
      <section id="journey" className="rule-t mt-16 scroll-mt-24 border-t border-rule pt-12">
        <p className="label mb-2">The Arc</p>
        <h2 className="font-serif text-3xl text-ink">The AVAIA Journey</h2>
        <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-2">
          {JOURNEY_ARC.map((step, i) => {
            const href = JOURNEY_STEP_HREF[step];
            return (
              <span key={step} className="flex items-center gap-2">
                {href ? (
                  <Link
                    href={href}
                    className="rounded-full border border-rule bg-white/[0.04] backdrop-blur-sm px-3 py-1 text-sm text-ink transition-colors hover:border-seal hover:text-seal"
                  >
                    {step}
                  </Link>
                ) : (
                  <span className="rounded-full border border-rule bg-white/[0.04] backdrop-blur-sm px-3 py-1 text-sm text-ink">
                    {step}
                  </span>
                )}
                {i < JOURNEY_ARC.length - 1 && <span className="text-muted">→</span>}
              </span>
            );
          })}
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {JOURNEY_MOVEMENTS.map((m) => {
            const href = JOURNEY_STEP_HREF[m.name];
            const card = (
              <>
                <p className="font-serif text-lg text-seal">{m.name}</p>
                <p className="mt-1 text-sm text-muted">{m.text}</p>
              </>
            );
            return href ? (
              <Link
                key={m.name}
                href={href}
                className="rounded-lg border border-rule bg-white/[0.04] backdrop-blur-sm px-5 py-4 transition-colors hover:border-seal"
              >
                {card}
              </Link>
            ) : (
              <div key={m.name} className="rounded-lg border border-rule bg-white/[0.04] backdrop-blur-sm px-5 py-4">
                {card}
              </div>
            );
          })}
        </div>
      </section>

      {/* How the AVAIA Conversation Works */}
      <section id="how" className="rule-t mt-16 scroll-mt-24 border-t border-rule pt-12">
        <p className="label mb-2">The Experience</p>
        <h2 className="font-serif text-3xl text-ink">How the AVAIA Conversation Works</h2>
        <p className="mt-4 leading-relaxed text-ink">{CONVERSATION_WORKS.intro}</p>
        <div className="mt-6 space-y-4">
          {CONVERSATION_WORKS.roles.map((r) => (
            <div key={r.name} className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4 backdrop-blur-sm">
              <p className="font-serif text-lg text-seal">{r.name}</p>
              <p className="mt-1 text-sm text-muted">{r.text}</p>
            </div>
          ))}
        </div>
        <p className="label mb-2 mt-8">Operating Principles of the Conversation</p>
        <ul className="space-y-2">
          {CONVERSATION_WORKS.principles.map((p) => (
            <li key={p} className="flex gap-3 leading-relaxed text-ink">
              <span className="text-seal">—</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Principles */}
      <section id="principles" className="rule-t mt-16 scroll-mt-24 border-t border-rule pt-12">
        <p className="label mb-2">The Foundation</p>
        <h2 className="font-serif text-3xl text-ink">Fundamental Operating Principles</h2>
        <ol className="mt-6 space-y-4">
          {OPERATING_PRINCIPLES.map((p, i) => (
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

      {/* Relationship Between All Components */}
      <section id="components" className="rule-t mt-16 scroll-mt-24 border-t border-rule pt-12">
        <p className="label mb-2">The Integration</p>
        <h2 className="font-serif text-3xl text-ink">Relationship Between All Components</h2>
        <p className="mt-4 leading-relaxed text-ink">{COMPONENT_RELATIONSHIPS.intro}</p>
        <div className="mt-6 space-y-4">
          {COMPONENT_RELATIONSHIPS.relationships.map((r) => (
            <div key={r.name} className="flex gap-4">
              <p className="w-40 shrink-0 font-serif text-lg text-seal">{r.name}</p>
              <p className="text-sm text-muted">{r.text}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 border-l-4 border-rule pl-5 font-serif text-lg italic text-muted">
          {COMPONENT_RELATIONSHIPS.integration}
        </p>
      </section>

      {/* Governance & Future Development Policy */}
      <section id="governance" className="rule-t mt-16 scroll-mt-24 border-t border-rule pt-12">
        <p className="label mb-2">The Stewardship</p>
        <h2 className="font-serif text-3xl text-ink">Governance &amp; Future Development Policy</h2>
        <p className="mt-4 leading-relaxed text-ink">{GOVERNANCE.intro}</p>
        <ol className="mt-6 space-y-4">
          {GOVERNANCE.standards.map((s, i) => (
            <li key={s.title} className="flex gap-4">
              <span className="font-serif text-lg text-muted tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="font-serif text-lg text-ink">{s.title}</p>
                <p className="text-sm text-muted">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-8 border-l-4 border-rule pl-5 font-serif text-lg italic text-muted">
          {GOVERNANCE.commitment}
        </p>
      </section>

      {/* Start the journey */}
      <section className="rule-t mt-16 border-t border-rule pt-12 text-center">
        <h2 className="font-serif text-3xl text-ink">Ready to begin?</h2>
        <p className="mx-auto mt-3 max-w-prose text-muted">
          The journey moves from awareness to understanding to a clear next
          step — one conversation, carried across time, with everything saved so
          you can return.
        </p>
        <Link
          href="/journey"
          prefetch={false}
          className="mt-7 inline-block rounded-md bg-seal px-6 py-3 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
        >
          Start the journey
        </Link>
      </section>
    </div>
  );
}
