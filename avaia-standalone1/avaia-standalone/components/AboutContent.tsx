import { GIVE_METHOD } from "@/lib/institution";

/**
 * The public About page, answers "what is AVAIA," in ordinary language.
 * Deliberately does not function as a directory of every AVAIA system,
 * program, tool, or internal structure, that material still exists
 * (Journey architecture, Workbook, Living Library, Programs, Chemistry,
 * Virtue Signature, Host/Guide/Witness, the five Operating Principles, the
 * Institution/Constitution) but is no longer displayed here. It's reachable
 * through its own pages (e.g. /chemistry, /defying-grief) or, for
 * governance material, not exposed on the public site at all. The GIVE
 * Method section below is a deliberate, temporary exception, the Guide
 * Toolkit currently links here (lib/toolkit.ts's "give" entry, /about#give)
 * and that dependency is not being touched in this pass.
 */
export default function AboutContent() {
  return (
    <div className="mx-auto max-w-prose px-5 py-16">
      <p className="label mb-3">About AVAIA</p>
      <h1 className="font-serif text-4xl text-ink">An institution for guided conversations.</h1>
      <p className="mt-1 text-muted">pronounced uh-VAY-uh</p>

      <p className="mt-6 text-lg leading-relaxed text-ink">
        AVAIA exists to help individuals, relationships, families, and communities move from
        disruption toward understanding, from understanding toward restoration, and from
        restoration toward intentional participation in life. It is grounded in the belief that
        lasting restoration begins with understanding, that people flourish through meaningful
        relationships, the practice of virtue, and intentional participation, and that every
        individual possesses inherent worth, dignity, and the capacity for continued growth.
        AVAIA is not an acronym. Its name reflects something at the heart of the Institute: no
        two people, stories, relationships, losses, or conversations are exactly alike. That is
        why AVAIA does not begin by deciding where your conversation should go. It begins by
        listening to the person having it.
      </p>

      <p className="mt-6 text-lg leading-relaxed text-ink">
        An AVAIA conversation is AI-supported, but the technology alone is not AVAIA. AVAIA is
        the conversational architecture, governing standards, and deliberate response discipline
        built around it. It follows what you are saying rather than rushing to solve, diagnose,
        prescribe, or decide what your experience means. It allows correction and uncertainty,
        respects your capacity, preserves continuity, and protects your authorship and ownership
        of what comes next. When you begin a Journey on your own, you are not speaking with a
        staff member, clinician, or Certified Guide. A Guide is present only when specifically
        arranged. AVAIA is not therapy, counseling, or crisis care. Founded by Dorian Johnson,
        AVAIA is governed by a written Constitution, a defined Journey architecture, and
        professional standards for those certified to steward AVAIA conversations.
      </p>

      {/* GIVE Method, left exactly in place; the Guide Toolkit links here
          directly (/about#give). Not touched or reconsidered in this pass. */}
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
    </div>
  );
}
