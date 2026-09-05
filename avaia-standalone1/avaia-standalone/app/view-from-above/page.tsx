import Link from "next/link";
import { VIEW_FROM_ABOVE_CLASSES } from "@/lib/view-from-above";

export const metadata = { title: "The View from Above — AVAIA" };
export const dynamic = "force-dynamic";

/** Public front door for The View from Above collection -- ten classes
 *  built from the lessons that became visible on Bailand's Hike. Front-
 *  door language only, matching /defying-grief and /shared-room's own
 *  register. The hike origin story told here (Prologue + the opening of
 *  Chapter 1) is the only verbatim manuscript text recovered from the
 *  source archive -- see lib/view-from-above.ts's own header for the
 *  full source-discipline note. Explicitly NOT reframed as a grief
 *  collection -- the hike is the origin story; the lessons are broader. */
export default function ViewFromAbovePage() {
  return (
    <div className="mx-auto max-w-prose px-5 py-16">
      <p className="label mb-3">The View from Above</p>
      <h1 className="font-serif text-4xl text-ink leading-tight">
        Ten classes built from a mountain.
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-ink">
        In 2017, Dorian Johnson's son Bailand hiked Molly's Peak in Cub River Canyon, near
        Preston, Idaho, and didn't come home. A year later, Dorian hiked the same trail himself,
        for the first time all the way to the top. What became visible to him on that mountain —
        about meaning, reality, direction, self-trust, boundaries, belonging, connection, control,
        identity, and attachment — became the ten classes below.
      </p>
      <p className="mt-4 text-lg leading-relaxed text-ink">
        The hike is the origin story. The lessons are broader than grief — they're about how
        anyone navigates an ordinary life: entering adulthood, changing careers, building a
        family, making a hard decision, finding their values, learning to lead. You don't need to
        be grieving to take one of these classes.
      </p>

      <section className="rule-t mt-16 border-t border-rule pt-12">
        <p className="label mb-2 text-muted">Where This Comes From</p>
        <h2 className="font-serif text-2xl text-ink">The Prologue</h2>
        <div className="mt-4 space-y-4 text-muted">
          <p>
            Bailand stood on Molly's Peak looking down at the river he loved. The Cub River ran
            through the canyon near Preston, Idaho. He had so many memories of this canyon, but
            had never seen its magnificence from this vantage point.
          </p>
          <p>
            He took a seat on the highest rock he could find and brought out his phone. He had
            reception. After sending a quick text, he put his phone away to take in the tranquil
            expanse, and after a while, repeated the words from his text quietly to himself:
          </p>
          <p className="font-serif text-xl italic text-ink">
            &ldquo;This is a beast of a hike, but talk about a view.&rdquo;
          </p>
          <p>
            A year later, Dorian drove the same gravel road up Cub River Canyon to hike that trail
            himself. He'd attempted it once before, alone, a month after — raw, surreal, sacred —
            but this time he meant to go all the way to the top, the way he was sure Bailand had.
            Driving in, an ordinary road he'd once loved for fishing and hiking had become
            &ldquo;staggering mixtures of mind-altering pain,&rdquo; in his own words — and still,
            he went.
          </p>
        </div>
        <p className="mt-6 text-sm text-muted">
          This is the only part of Dorian's memoir, <em>The View from Above</em>, told here
          verbatim — his own written words, recovered directly from his manuscript. Chapters 2
          through 10 exist as a full audiobook and video series, not as text here, so the specific
          scene-by-scene story of the rest of the hike isn't retold on this page. What follows
          instead are the ten real recognitions and lessons Dorian has directly named as coming out
          of that mountain — in his own words, not further invented narrative.
        </p>

        <div className="mt-10 grid gap-6 rounded-lg border border-rule bg-white/[0.04] p-6 sm:grid-cols-[180px_1fr] sm:items-center">
          <img
            src="/books/the-view-from-above-front.jpg"
            alt="The View from Above book cover — One Father's Memoir of Grief Guided to Grace, by Dorian Johnson and Danielle Palmer"
            className="mx-auto w-full max-w-[180px] rounded-md shadow-lg sm:mx-0"
          />
          <div>
            <p className="label mb-2 text-muted">The Book This Grew From</p>
            <h3 className="font-serif text-2xl text-ink">The View from Above</h3>
            <p className="mt-1 text-sm text-muted">By Dorian Johnson, with Danielle Palmer</p>
            <p className="mt-4 text-muted">
              The Prologue above is the opening of this book — Dorian's own written account of
              Bailand's hike, and of returning a year later to climb the same trail himself. The
              ten classes on this page grew directly out of the recognitions Dorian names in it:
              what became visible to him about meaning, reality, direction, and connection, once he
              was standing where his son had stood.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a
                href="https://a.co/d/0fZ57Zi5"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
              >
                Buy on Amazon
              </a>
              <Link
                href="/books/the-view-from-above"
                className="inline-block rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
              >
                More About the Book
              </Link>
            </div>
          </div>
        </div>

        <p className="mt-6 text-sm text-muted">
          Read the book for Dorian's full account. Continue below for the ten classes it led to.
        </p>
      </section>

      <section className="rule-t mt-16 border-t border-rule pt-12">
        <p className="label mb-2 text-muted">The Climb</p>
        <h2 className="font-serif text-2xl text-ink">You begin somewhere. You see more as you go.</h2>
        <p className="mt-3 text-muted">
          Take one class. Take several. Take all ten. If you take them in order, they follow the
          shape of a climb: what does this part of the trail teach me, then what does the next part
          teach me — until, from higher up, you can see the landscape differently than you could
          from where you started. Nothing here forces a tidy ending. Some days the honest answer is
          still &ldquo;I don't know yet.&rdquo;
        </p>
      </section>

      <section className="rule-t mt-16 border-t border-rule pt-12">
        <p className="label mb-4 text-muted">The Ten Classes</p>
        <div className="space-y-3">
          {VIEW_FROM_ABOVE_CLASSES.map((c, i) => (
            <Link
              key={c.slug}
              href={`/view-from-above/${c.slug}`}
              className="block rounded-lg border border-rule bg-white/[0.04] px-5 py-4 transition-colors hover:border-seal"
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-serif text-lg text-ink">
                  {i + 1}. {c.title}
                </p>
                <span className="label shrink-0 text-muted">{c.virtueFamily}</span>
              </div>
              <p className="mt-1 text-sm text-muted">{c.humanQuestion}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="rule-t mt-16 border-t border-rule pt-12">
        <p className="text-muted">
          Each class is facilitated by a Certified AVAIA Guide, or can be taken on your own —
          reading, a recognition activity, and an optional private AVAIA conversation.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/certified-guide"
            className="inline-block rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
          >
            Learn About Certified Guides
          </Link>
          <Link
            href="/about"
            className="inline-block rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
          >
            Learn About AVAIA
          </Link>
        </div>
      </section>
    </div>
  );
}
