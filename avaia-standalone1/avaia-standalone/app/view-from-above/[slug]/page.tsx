import Link from "next/link";
import { notFound } from "next/navigation";
import { VIEW_FROM_ABOVE_CLASSES, getViewFromAboveClass } from "@/lib/view-from-above";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return VIEW_FROM_ABOVE_CLASSES.map((c) => ({ slug: c.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const cls = getViewFromAboveClass(params.slug);
  return { title: cls ? `${cls.title} — View From Above — AVAIA` : "View From Above — AVAIA" };
}

/** Self-directed member page for one View From Above class. Public
 *  content (matching /defying-grief's own posture -- the teaching itself
 *  requires no membership); the "Continue in a private AVAIA conversation"
 *  CTA below leads to the ordinary /journey flow, where the existing
 *  membership gate (beyond the free IAP) already applies unchanged -- no
 *  new gate is added here. This page and lib/view-from-above.ts carry the
 *  same factual content as this class's Guide-facing Experience
 *  (app/toolkit/experiences/[id], via ViewFromAboveClass.tsx), written in
 *  front-door register instead of facilitator register -- see
 *  lib/view-from-above.ts's header for why this is a separate hardcoded
 *  layer rather than a database read. */
export default function ViewFromAboveClassPage({ params }: { params: { slug: string } }) {
  const cls = getViewFromAboveClass(params.slug);
  if (!cls) notFound();

  const index = VIEW_FROM_ABOVE_CLASSES.findIndex((c) => c.slug === params.slug);
  const prev = index > 0 ? VIEW_FROM_ABOVE_CLASSES[index - 1] : null;
  const next = index < VIEW_FROM_ABOVE_CLASSES.length - 1 ? VIEW_FROM_ABOVE_CLASSES[index + 1] : null;

  return (
    <div className="mx-auto max-w-prose px-5 py-16">
      <p className="mb-6">
        <Link href="/view-from-above" className="label hover:text-seal">
          ← View From Above
        </Link>
      </p>

      <p className="label mb-3">
        View From Above — Class {index + 1} of {VIEW_FROM_ABOVE_CLASSES.length}
      </p>
      <h1 className="font-serif text-4xl text-ink leading-tight">{cls.title}</h1>
      <p className="mt-3 font-serif text-xl italic text-ink">{cls.humanQuestion}</p>
      <p className="mt-4 text-lg leading-relaxed text-ink">{cls.whatItIs}</p>

      <section className="rule-t mt-14 border-t border-rule pt-10">
        <p className="label mb-2 text-muted">What This Class Teaches</p>
        <p className="text-muted">{cls.whatItTeaches}</p>
      </section>

      <section className="rule-t mt-10 border-t border-rule pt-10">
        <p className="label mb-2 text-muted">The Hike Lesson</p>
        <div className="rounded-lg border border-seal/40 bg-seal/[0.06] px-5 py-5">
          <p className="font-serif text-lg text-ink">&ldquo;{cls.dorianLesson}&rdquo;</p>
          <p className="mt-3 text-xs text-muted">{cls.hikeLessonSourceNote}</p>
        </div>
      </section>

      <section className="rule-t mt-10 border-t border-rule pt-10">
        <p className="label mb-2 text-muted">The Virtue Family — {cls.virtueFamily}</p>
        <p className="text-muted">
          Every person already carries {cls.virtueFamily}, whether or not it feels awake right
          now. This class doesn't ask you to acquire it — it asks what {cls.virtueFamily} can help
          you notice.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {cls.virtueElements.map((el) => (
            <span key={el} className="rounded-md border border-rule px-3 py-1 text-sm text-ink">
              {el}
            </span>
          ))}
        </div>
        <p className="label mt-6 mb-2 text-muted">What It Can Look Like</p>
        <ul className="list-disc space-y-2 pl-5 text-muted">
          {cls.virtueLooksLike.map((v, i) => (
            <li key={i}>{v}</li>
          ))}
        </ul>
      </section>

      <section className="rule-t mt-10 border-t border-rule pt-10">
        <p className="label mb-4 text-muted">Personal Recognition</p>
        <p className="text-sm text-muted">
          Nothing here has to be shared with anyone. These are just for you.
        </p>
        <div className="mt-5 space-y-5">
          {cls.personalRecognition.map((p, i) => (
            <div key={i}>
              <p className="font-serif text-lg text-ink">{p.prompt}</p>
              <p className="mt-1 text-sm text-muted">{p.helper}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rule-t mt-10 border-t border-rule pt-10">
        <p className="label mb-2 text-muted">Chemistry Recognition</p>
        <p className="text-muted">{cls.chemistryActivity}</p>
      </section>

      <section className="rule-t mt-10 border-t border-rule pt-10">
        <p className="label mb-2 text-muted">Practice</p>
        <p className="text-muted">{cls.practice}</p>
      </section>

      <section className="rule-t mt-10 border-t border-rule pt-10">
        <p className="label mb-2 text-muted">What Becomes Possible</p>
        <p className="text-muted">{cls.whatBecomesPossible}</p>
      </section>

      <section className="rule-t mt-12 border-t border-rule pt-10">
        <p className="text-muted">
          Whatever this class brought up for you — a recognition, a question, something you
          disagree with, something you're still turning over — take it into a private AVAIA
          conversation, in your own words, at your own pace, kept entirely yours.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/journey?origin=view-from-above&key=${encodeURIComponent(cls.slug)}`}
            className="inline-block rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
          >
            Have a Private Conversation About This Class
          </Link>
          <Link
            href="/certified-guide"
            className="inline-block rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
          >
            Take This With a Certified Guide
          </Link>
        </div>
      </section>

      <nav className="rule-t mt-14 flex items-center justify-between border-t border-rule pt-8 text-sm">
        {prev ? (
          <Link href={`/view-from-above/${prev.slug}`} className="text-muted hover:text-seal">
            ← {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={`/view-from-above/${next.slug}`} className="text-muted hover:text-seal">
            {next.title} →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}
