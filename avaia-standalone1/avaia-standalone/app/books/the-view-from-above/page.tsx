export const metadata = { title: "The View From Above — AVAIA" };

const AMAZON_URL = "https://a.co/d/0fZ57Zi5";

const BUY_BUTTON_CLASSES =
  "inline-block rounded-md bg-seal px-6 py-3 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90";

export default function TheViewFromAbovePage() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-16">
      {/* Hero — the one deliberate departure from the site's usual single
          column, so the cover gets real visual weight. Same type/color/
          button tokens as everywhere else, not a new aesthetic. */}
      <div className="grid gap-8 sm:grid-cols-[240px_1fr] sm:items-center">
        <img
          src="/books/the-view-from-above-front.jpg"
          alt="The View From Above book cover — One Father's Memoir of Grief Guided to Grace, by Dorian Johnson and Danielle Palmer"
          className="w-full max-w-[240px] rounded-lg shadow-lg mx-auto sm:mx-0"
        />
        <div>
          <p className="label mb-3">The View From Above</p>
          <h1 className="font-serif text-4xl text-ink leading-tight">
            Before there was AVAIA, there was a story.
          </h1>
          <p className="mt-4 text-muted">
            <em>The View From Above: One Father&rsquo;s Memoir of Grief Guided to Grace</em> —
            by Dorian Johnson and Danielle Palmer
          </p>
          <div className="mt-6">
            <a href={AMAZON_URL} target="_blank" rel="noopener noreferrer" className={BUY_BUTTON_CLASSES}>
              Buy on Amazon
            </a>
          </div>
        </div>
      </div>

      {/* Where part of the journey began */}
      <section className="rule-t mt-16 max-w-prose border-t border-rule pt-12">
        <p className="label mb-2 text-muted">Where part of the journey began</p>
        <p className="text-lg leading-relaxed text-ink">
          Before AVAIA had a name, before its conversations and systems existed in their present
          form, there was a father, a son named Bailand, and a mountain trail that would never
          mean the same thing again. <em>The View From Above</em> is part of that beginning: an
          early telling of the same search for understanding, healing, and perspective that
          would, years later, become AVAIA.
        </p>
      </section>

      {/* About the book — with the back cover inset here, as part of the
          story, not treated as a second product image. */}
      <section className="rule-t mt-16 max-w-prose border-t border-rule pt-12">
        <p className="label mb-2 text-muted">About the Book</p>
        <p className="text-lg leading-relaxed text-ink">
          On May 25, 2017, Dorian Johnson&rsquo;s son Bailand hiked up Molly&rsquo;s Peak in Cub
          River Canyon, near Preston, Idaho. He did not return. <em>The View From Above</em> is
          Dorian&rsquo;s account of that loss, and of returning a year later to hike the same
          trail as a memorial. Co-written with Danielle Palmer, it follows his restorative
          process through grief — not toward resolution, but toward grace — and the role virtue
          played in that healing. Published in 2021, it&rsquo;s available in paperback and
          audiobook.
        </p>
        <figure className="mt-8 max-w-xs">
          <img
            src="/books/the-view-from-above-back.jpg"
            alt="Back cover of The View From Above, featuring the book's synopsis"
            className="w-full rounded-lg shadow-md"
          />
          <figcaption className="mt-2 text-sm text-muted">
            The back cover of <em>The View From Above</em>.
          </figcaption>
        </figure>
      </section>

      {/* Why it is here */}
      <section className="rule-t mt-16 max-w-prose border-t border-rule pt-12">
        <p className="label mb-2 text-muted">Why It Is Here</p>
        <p className="text-lg leading-relaxed text-ink">
          AVAIA did not begin as an idea for a website or an artificial-intelligence system. Its
          roots are personal. <em>The View From Above</em> represents an earlier part of that
          journey — part of the experience, questioning, reflection, and search for perspective
          that preceded what AVAIA would eventually become.
        </p>
        <p className="mt-4 text-muted">
          The Chemistry of Virtue existed then too, in an early form — the same idea of virtues
          working together like elements on a table, years before AVAIA gave it the shape it has
          today. AVAIA itself did not exist yet. What it would become grew out of roots like this
          one.
        </p>
        <p className="mt-4 text-muted">
          This isn&rsquo;t the story of AVAIA. But it is part of the story of where AVAIA came
          from.
        </p>
      </section>

      {/* Second purchase action, before the closing quote. */}
      <div className="mt-16 max-w-prose">
        <a href={AMAZON_URL} target="_blank" rel="noopener noreferrer" className={BUY_BUTTON_CLASSES}>
          Buy on Amazon
        </a>
      </div>

      {/* Closing — Bailand's own words. Nothing follows this. */}
      <div className="rule-t mt-16 max-w-prose border-t border-rule pt-12 text-center">
        <p className="font-serif text-2xl italic leading-relaxed text-ink">
          &ldquo;This is a beast of a hike, but talk about a view!&rdquo;
        </p>
        <p className="mt-3 label text-muted">— Bailand&rsquo;s final text to his father</p>
      </div>
    </div>
  );
}
