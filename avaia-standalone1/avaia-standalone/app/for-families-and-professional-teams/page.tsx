import Link from "next/link";

export const metadata = {
  title: "For Families & Professional Teams, AVAIA",
  description:
    "A distinct entrance into AVAIA for families and the professional teams around them. Three ways in, all leading into the same AVAIA.",
};

// An entrance, not a product. It orients a visitor and sends them through a doorway AVAIA already
// has: the Journey for an individual or family, and the contact form for a professional or an
// organization. It collects nothing, claims nothing beyond established AVAIA, and is deliberately
// not in the main navigation yet.

const cardClass = "flex flex-col rounded-lg border border-rule bg-white/[0.04] p-6 backdrop-blur-sm";
const primaryButton =
  "inline-block rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90";
const quietButton =
  "inline-block rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:border-seal";

export default function ForFamiliesAndProfessionalTeamsPage() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-16">
      <p className="label mb-3">An entrance into AVAIA</p>
      <h1 className="font-serif text-4xl text-ink">For Families &amp; Professional Teams</h1>

      <div className="mt-6 max-w-prose">
        <p className="font-serif text-2xl text-seal">Clarity Starts With Integrity.</p>
        <p className="mt-4 border-l-2 border-seal/50 pl-4 font-serif text-xl italic leading-relaxed text-ink">
          Responsibility remains while capacity changes.
        </p>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          AVAIA provides a solution when the problem itself cannot simply be solved.
        </p>
        <p className="mt-4 text-muted">
          This is the same AVAIA, not a separate service: a guided, virtue-centered conversation that moves from Awareness, to
          Understanding, to Agency. Choose the doorway that fits you.
        </p>
      </div>

      <section className="mt-12" aria-labelledby="three-ways-in">
        <h2 id="three-ways-in" className="font-serif text-2xl text-ink">
          Three ways in
        </h2>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className={cardClass}>
            <p className="label text-seal">Individual or family</p>
            <h3 className="mt-2 font-serif text-xl text-ink">Begin with your own story</h3>
            <p className="mt-3 flex-1 text-muted">
              The AVAIA Journey helps you see what is happening, understand it, and decide what is yours to choose.
            </p>
            <p className="mt-5">
              <Link href="/journey" className={primaryButton}>
                Begin your Journey
              </Link>
            </p>
          </div>

          <div className={cardClass}>
            <p className="label text-seal">Professional</p>
            <h3 className="mt-2 font-serif text-xl text-ink">Referring, or seeking support for, a client</h3>
            <p className="mt-3 flex-1 text-muted">
              If you are involved in a client&rsquo;s situation and think AVAIA could support them, tell us about it. AVAIA works
              alongside the professionals already involved.
            </p>
            <p className="mt-5">
              <Link href="/contact?reason=professional_referral" className={quietButton}>
                Contact us about a client
              </Link>
            </p>
          </div>

          <div className={cardClass}>
            <p className="label text-seal">Organization, employer or firm</p>
            <h3 className="mt-2 font-serif text-xl text-ink">Support for the people you serve</h3>
            <p className="mt-3 flex-1 text-muted">
              If your organization supports people through loss, transition, or complex family and business situations, tell us
              what you are looking for.
            </p>
            <p className="mt-5">
              <Link href="/contact?reason=organization" className={quietButton}>
                Contact us about your organization
              </Link>
            </p>
          </div>
        </div>
      </section>

      <section className="mt-12" aria-labelledby="keeping-track">
        <h2 id="keeping-track" className="font-serif text-2xl text-ink">
          Keeping track, and sharing only what you choose
        </h2>
        <p className="mt-3 max-w-prose text-muted">
          These are part of a signed-in Host&rsquo;s Workbook. Each one is the Host&rsquo;s own choice; AVAIA does not fill them in
          or decide anything for you.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className={cardClass}>
            <h3 className="font-serif text-xl text-ink">Coordination</h3>
            <p className="mt-3 text-muted">
              Keep track of who is doing what, and what is waiting on whom, around a decision or situation. AVAIA does not score
              it, infer anyone&rsquo;s capacity, or share it.
            </p>
          </div>
          <div className={cardClass}>
            <h3 className="font-serif text-xl text-ink">Decision &amp; Capacity Continuity</h3>
            <p className="mt-3 text-muted">
              For a decision, keep a dated record of what you said you wanted and understood, the questions you asked, and
              whether your position changed. It preserves what happened over time. AVAIA does not determine or declare anyone&rsquo;s
              legal capacity or incapacity. An entry you withdraw leaves active use but is kept, not erased.
            </p>
          </div>
          <div className={cardClass}>
            <h3 className="font-serif text-xl text-ink">Share With</h3>
            <p className="mt-3 text-muted">
              Share one item with one person you name, such as a professional or family member, as a read-only copy of exactly what
              you approved. They open a secure link; no account is needed. The link expires, 14 days by default and 30 at most, and
              you can revoke it at any time. Revoking stops future access; it does not recall what was already read, copied, saved,
              or printed. Shared Room content is not included.
            </p>
          </div>
        </div>
      </section>

      <p className="mt-12 max-w-prose text-sm text-muted">
        AVAIA is not therapy, counseling, medical care, legal advice, or crisis intervention, and it does not replace the
        professionals already involved. You remain the owner of your story and every decision you make. If you are in crisis,
        call or text 988 (U.S.).
      </p>
    </div>
  );
}
