import Link from "next/link";

export const metadata = { title: "Certified AVAIA Guide" };

/** Phase A of the Certified AVAIA Guide implementation -- the public
 *  doorway only. Copy is drawn directly from the approved Program
 *  Prospectus + Enrollment Guide (Working Master v0.1), condensed for a
 *  single public page rather than the full certification manual. Uses the
 *  same layout/typography conventions as every other single-purpose page
 *  (see app/membership/page.tsx, components/AboutContent.tsx) -- no new
 *  visual language introduced.
 *
 *  Deliberately does not build enrollment/payment, an interest-intake
 *  route, or a Find/Book a Guide feature -- those are later phases. The
 *  CTA reuses the existing /contact form, which already has a
 *  "Certification" reason option (components/ContactForm.tsx) -- no new
 *  infrastructure needed for a visitor to genuinely reach AVAIA about
 *  this today. */
export default function CertifiedGuidePage() {
  return (
    <div className="mx-auto max-w-prose px-5 py-16">
      <p className="label mb-3">Certified AVAIA Guide</p>
      <h1 className="font-serif text-4xl text-ink">Become a Certified AVAIA Guide</h1>
      <p className="mt-4 text-lg leading-relaxed text-ink">
        Learn how to Guide a different kind of conversation — one that helps people become more
        visible to themselves without giving away ownership of their story, meaning, or decisions.
      </p>
      <p className="mt-4 text-lg leading-relaxed text-muted">
        AVAIA Guides learn to listen adaptively, protect the Table, work with the AVAIA Journey
        and recognition systems, facilitate approved Experiences, and support agency without
        prescribing the answer.
      </p>

      <div className="mt-8">
        <Link
          href="/contact?reason=certification"
          className="inline-block rounded-md bg-seal px-6 py-3 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
        >
          I&rsquo;m Interested in Becoming a Guide
        </Link>
      </div>

      {/* A Different Kind of Guide */}
      <section className="rule-t mt-16 border-t border-rule pt-12">
        <p className="label mb-2">A Different Kind of Guide</p>
        <p className="text-lg leading-relaxed text-ink">
          AVAIA Guides are not trained to become the answer in someone else&rsquo;s life. They are
          trained to protect a conversation in which another person can become more visible to
          themselves.
        </p>
        <p className="mt-4 rounded-lg border border-seal/40 bg-seal/[0.06] px-5 py-4 font-serif text-lg leading-relaxed text-ink">
          You don&rsquo;t have to figure out how to talk to me. I&rsquo;ll figure out how to
          listen to you.
        </p>
      </section>

      {/* What an AVAIA Guide Does */}
      <section className="rule-t mt-16 border-t border-rule pt-12">
        <p className="label mb-2">What an AVAIA Guide Does</p>
        <h2 className="font-serif text-3xl text-ink">The role, in practice</h2>
        <ul className="mt-6 space-y-3">
          {[
            "Listens adaptively rather than requiring the Host to communicate in a particular way.",
            "Follows what is becoming visible without taking ownership of its meaning.",
            "Asks questions that increase visibility without steering toward a preferred answer.",
            "Protects the Host's ownership, privacy, capacity, and right to stop.",
            "Uses AVAIA's Journey, Table, Chemistry of Virtue, Secondary Losses, and approved Experiences as designed.",
            "Supports awareness, understanding, and agency without diagnosing, prescribing, or promising outcomes.",
            "Facilitates shared Experiences while preserving each person's private conversation.",
          ].map((line) => (
            <li key={line} className="flex gap-3 text-lg text-ink">
              <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-seal" />
              {line}
            </li>
          ))}
        </ul>
      </section>

      {/* The Journey a Guide learns to steward */}
      <section className="rule-t mt-16 border-t border-rule pt-12">
        <p className="label mb-2">The Journey You Learn to Guide</p>
        <p className="font-serif text-lg text-ink">
          Awareness <span className="text-muted">→</span> Understanding{" "}
          <span className="text-muted">→</span> Agency
        </p>
        <ol className="mt-6 space-y-5">
          {[
            {
              name: "Individual Awareness Profile (IAP)",
              text: "Help the Host notice what is present without forcing meaning or action.",
            },
            {
              name: "Conversations Across Time (CAT)",
              text: "Help perspectives become visible around the Host's Table without allowing any seat to own the conversation.",
            },
            {
              name: "InnerCompass",
              text: "Support discernment and chosen participation without becoming the source of the decision.",
            },
          ].map((c, i) => (
            <li key={c.name} className="flex gap-4">
              <span className="font-serif text-lg text-muted tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="font-serif text-lg text-ink">{c.name}</p>
                <p className="text-sm text-muted">{c.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-muted">
          The three conversations are connected, but each has its own purpose. A Certified Guide
          learns when to remain in a stage, when enough is enough, and how to preserve continuity
          without rushing the Host forward.
        </p>
      </section>

      {/* Guiding Without Owning the Answer */}
      <section className="rule-t mt-16 border-t border-rule pt-12">
        <p className="label mb-2">What Makes This Different</p>
        <h2 className="font-serif text-3xl text-ink">Guiding Without Owning the Answer</h2>
        <p className="mt-4 text-lg leading-relaxed text-ink">
          This is a governing competency throughout certification. A Guide must be able to notice
          deeply, reflect usefully, ask meaningful questions, and still leave authorship with the
          Host.
        </p>
        <div className="mt-6 space-y-1.5 text-lg leading-relaxed text-ink">
          <p>Perceptive without becoming certain.</p>
          <p>Helpful without becoming controlling.</p>
          <p>Curious without interrogating.</p>
          <p>Present without needing to rescue.</p>
          <p>Structured without making the Host fit the structure.</p>
          <p>Capable of recognizing clarity without converting it into prescription.</p>
        </div>
        <p className="mt-6 text-muted">
          The Host owns the Table. The Guide protects the Table, not the outcome. A seat at the
          Table creates visibility, not authority — and nothing leaves the Table unwitnessed.
        </p>
      </section>

      {/* How certification works */}
      <section className="rule-t mt-16 border-t border-rule pt-12">
        <p className="label mb-2">How Certification Works</p>
        <h2 className="font-serif text-3xl text-ink">Competency-based, not attendance-based</h2>
        <p className="mt-4 text-lg leading-relaxed text-ink">
          Certification means AVAIA has seen sufficient evidence that a candidate can steward the
          core AVAIA architecture responsibly. It does not certify charisma. It certifies
          stewardship.
        </p>
        <p className="mt-4 text-muted">The candidate pathway moves through:</p>
        <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-ink">
          <li>Orientation — what Guide permission means, and does not mean</li>
          <li>Foundations — AVAIA architecture, Journey, roles, governing distinctions</li>
          <li>Conversation Stewardship — adaptive listening, IAP/CAT/InnerCompass discipline</li>
          <li>Table Stewardship — Room, Table, seats, Witness, evidence</li>
          <li>Recognition Systems — Chemistry of Virtue and Secondary Losses</li>
          <li>Facilitation — groups, classes, Experiences, privacy, capacity</li>
          <li>Toolkit Assembly — using approved AVAIA components without redesigning them</li>
          <li>Boundary Gate — privacy, capacity, scope, non-therapy posture</li>
          <li>Practicum — real-time stewardship, observed</li>
          <li>Certification Decision — the full evidence portfolio is reviewed</li>
        </ol>
        <p className="mt-6 text-lg leading-relaxed text-ink">
          Completing coursework is not, by itself, certification. A candidate must demonstrate
          actual Guide competency — through observed practicum work — before final certification
          is granted.
        </p>
      </section>

      {/* Format & investment */}
      <section className="rule-t mt-16 border-t border-rule pt-12">
        <p className="label mb-2">Format &amp; Investment</p>
        <div className="mt-4 rounded-lg border border-rule bg-white/[0.04] px-5 py-5 backdrop-blur-sm">
          <p className="text-ink">
            <span className="font-serif text-lg">Hybrid format.</span> Core learning happens at
            your own pace; live sessions are used for teaching where needed, practice, feedback,
            boundary work, and practicum.
          </p>
          <p className="mt-4 text-ink">
            <span className="font-serif text-lg">$4,500.</span> The current program investment.
            Payment may be made in full, or through an installment arrangement — reach out to ask
            about current options.
          </p>
        </div>
      </section>

      {/* What certification unlocks / does not unlock */}
      <section className="rule-t mt-16 border-t border-rule pt-12">
        <p className="label mb-2">What Certification Unlocks</p>
        <ul className="mt-4 space-y-2 text-ink">
          {[
            "Facilitating the core IAP → CAT → InnerCompass Journey, within your active permissions.",
            "Facilitating approved general AVAIA classes and Experiences.",
            "Using Guide-only Toolkit materials and facilitation plans.",
            "Supporting private Journey periods inside approved group Experiences, without taking ownership of private content.",
          ].map((line) => (
            <li key={line} className="flex gap-3">
              <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-seal" />
              {line}
            </li>
          ))}
        </ul>

        <p className="label mb-2 mt-10">What It Does Not Unlock</p>
        <ul className="mt-4 space-y-2 text-muted">
          {[
            "Automatic access to anyone's private AVAIA conversations or Workbook.",
            "Authority to diagnose, treat, prescribe, or present AVAIA as therapy.",
            "Authority to decide what a Host should do.",
            "Youth Guide facilitation — this remains on hold, pending separate guardian-consent architecture.",
            "Complex Event Lead, Guide Trainer, or Faculty authority.",
            "Automatic permission for every AVAIA Experience, audience, or format.",
          ].map((line) => (
            <li key={line} className="flex gap-3">
              <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted" />
              {line}
            </li>
          ))}
        </ul>
      </section>

      {/* Who this is for */}
      <section className="rule-t mt-16 border-t border-rule pt-12">
        <p className="label mb-2">Who This Is For</p>
        <p className="mt-4 text-lg leading-relaxed text-ink">
          The strongest candidates are not necessarily the people with the most credentials or the
          loudest presence. They are people willing to become disciplined stewards of another
          person&rsquo;s ownership.
        </p>
        <div className="mt-6 space-y-1.5 text-lg leading-relaxed text-ink">
          <p>People who work with individuals, families, groups, organizations, or communities.</p>
          <p>People who can remain curious when they do not know the answer.</p>
          <p>People willing to be corrected.</p>
          <p>People capable of respecting privacy and capacity.</p>
          <p>People who can use structure without becoming rigid.</p>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="rule-t mt-16 border-t border-rule pt-12">
        <p className="font-serif text-xl text-ink">
          My certification does not make me the authority over your life. It makes me responsible
          for how I steward the conversation.
        </p>
        <div className="mt-8">
          <Link
            href="/contact?reason=certification"
            className="inline-block rounded-md bg-seal px-6 py-3 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
          >
            I&rsquo;m Interested in Becoming a Guide
          </Link>
        </div>
      </section>
    </div>
  );
}
