import {
  CONSTITUTION_PREAMBLE,
  CONSTITUTION_ARTICLES,
  CONSTITUTION_CLOSING,
  OPERATING_PRINCIPLES,
  COMPONENT_RELATIONSHIPS,
  GOVERNANCE,
} from "@/lib/institution";

export const metadata = { title: "The Institution — AVAIA" };

/**
 * The deeper institutional/reference page -- the full Constitution, all 18
 * Operating Principles, Component Relationships, and Governance policy. The
 * GIVE Method and Host/Guide/Witness live on /about instead (About's job is
 * to explain AVAIA as an institute/approach with real substance; this page
 * is the full governing document underneath that). Follows the same
 * progressive-disclosure pattern as /chemistry, /secondary-loss, /reports,
 * and /conversations/[slug]: a complete reference, not a top-nav item.
 */
export default function InstitutionPage() {
  return (
    <div className="mx-auto max-w-prose px-5 py-16">
      <p className="label mb-3">Reference</p>
      <h1 className="font-serif text-4xl text-ink">The Institution</h1>
      <p className="mt-4 text-lg leading-relaxed text-muted">
        AVAIA&rsquo;s full governing material — the Constitution, the operating principles, how
        its components relate, and the policy that governs its own development. None of this is
        required reading to begin a conversation; it&rsquo;s here for anyone who wants to
        understand the architecture underneath it.
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

      {/* Fundamental Operating Principles */}
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
    </div>
  );
}
