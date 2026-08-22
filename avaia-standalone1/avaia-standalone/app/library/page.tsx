import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLibraryEntriesForHost, formatReason } from "@/lib/library-retrieval";
import { searchLibraryEntries } from "@/lib/library-search";
import { getOrientationForSecondaryLoss } from "@/lib/library-orientation";
import { SECONDARY_LOSSES, isValidSecondaryLoss } from "@/lib/institution";
import type { LibraryEntry } from "@/lib/library";

export const metadata = { title: "Library — AVAIA" };
export const dynamic = "force-dynamic";

/** Plain-language translation of each canonical Secondary Loss name, for
 *  a Host who doesn't yet have Library vocabulary -- presentational copy
 *  only, keyed 1:1 to the ten existing SECONDARY_LOSSES names. Not a new
 *  classification: nothing is stored against these strings, they only
 *  decide which existing loss a click means. */
const ORIENTING_PROMPTS: Record<string, string> = {
  Meaning: "What feels like it's lost its point?",
  Reality: "What's hard to fully take in or accept?",
  "Dreams / Opportunities": "What future did you have to let go of?",
  "Self-Trust": "Where do you doubt your own judgment now?",
  "Decision-Making / Boundaries": "What's hard to decide, or hard to hold the line on?",
  "Life Vision": "What did you picture for your life that's changed?",
  Connection: "Who feels distant, or hard to reach?",
  Control: "What feels like it's slipping out of your hands?",
  Identity: "Who are you, now that this has happened?",
  "Attachment / Support": "Who or what did you lean on that isn't there the same way?",
};

/** The Living Library's permanent entrance. Independently returnable --
 *  works with or without ?journey=<id>, ?q=<search>, or
 *  ?secondary_loss=<name>. ?journey, when present and it actually belongs
 *  to this Host, grounds retrieval in that Journey's own referrals (see
 *  lib/library-retrieval.ts); otherwise, and whenever there isn't enough
 *  legitimate matched evidence, a broad reviewed set is shown instead --
 *  never a fabricated personal reason. ?q, when present, switches the
 *  page into deterministic keyword search (see lib/library-search.ts)
 *  instead of retrieval. ?secondary_loss, when present and one of the ten
 *  canonical names, is the orientation layer's own entry point (see
 *  lib/library-orientation.ts): an exact published-concept match redirects
 *  straight there, otherwise matching published entries render inline. All
 *  three are the same optional-searchParam pattern already used by
 *  /journey?new=1&program=... and /unsung-heroes?path=... -- no new
 *  session state, no second persistence mechanism. Priority when more than
 *  one is present: q, then secondary_loss, then journey/broad retrieval --
 *  a Host actively searching or orienting is never silently overridden by
 *  a stale ?journey= left on the URL. */
export function EntryCard({ entry, reasons }: { entry: LibraryEntry; reasons?: string[] }) {
  return (
    <Link
      href={`/library/${entry.id}`}
      className="block rounded-lg border border-rule bg-white/[0.04] px-5 py-4 backdrop-blur-sm transition-colors hover:border-seal"
    >
      <p className="font-serif text-lg text-ink">{entry.title}</p>
      <p className="mt-1 text-sm text-muted">{entry.overview}</p>
      {reasons && reasons.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {reasons.map((r, i) => (
            <span key={i} className="rounded-full border border-rule px-3 py-0.5 text-xs text-muted">
              {r}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams?: { journey?: string; q?: string; secondary_loss?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?from=/library`);

  const query = searchParams?.q?.trim() ?? "";
  const searchResults = query ? await searchLibraryEntries(supabase, query) : null;

  const lossParam = searchParams?.secondary_loss?.trim() ?? "";
  const orientation =
    !searchResults && lossParam && isValidSecondaryLoss(lossParam)
      ? await getOrientationForSecondaryLoss(supabase, lossParam)
      : null;

  // A definitive concept match (Connection, today) is the answer -- its
  // own neighborhood page already covers entries/questions/historical
  // voices, so there's nothing further to render here.
  if (orientation?.concept) {
    redirect(`/library/concepts/${orientation.concept.id}`);
  }

  // Search, then a chosen Secondary Loss, then Journey/broad retrieval --
  // each active mode fully owns the results area so none silently blends
  // with or gets overridden by a stale param left on the same URL.
  const result =
    searchResults || orientation
      ? null
      : await getLibraryEntriesForHost(supabase, user.id, searchParams?.journey ?? null);

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <p className="label mb-3">Library</p>
      <h1 className="font-serif text-4xl text-ink">The AVAIA Library</h1>

      <p className="mt-4 max-w-prose text-lg text-muted">
        The Living Library continues the conversation. It connects your questions and
        experiences to relevant AVAIA material — Secondary Losses, virtues, reflections,
        historical voices, works, research, and related ideas. It doesn&rsquo;t reinterpret or
        rewrite your Journey.
      </p>

      <div className="mt-10">
        <p className="label mb-1 text-muted">Not sure where to start?</p>
        <p className="mb-2 text-sm text-muted">Begin with what&rsquo;s present for you.</p>
        <p className="mb-4 max-w-prose text-sm text-muted">
          These are doorways for exploration, not diagnoses. AVAIA isn&rsquo;t determining which
          of these applies to you — if something below sounds like part of what you&rsquo;re
          carrying, it may be worth exploring further.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {SECONDARY_LOSSES.map((s) => (
            <Link
              key={s.loss}
              href={`/library?secondary_loss=${encodeURIComponent(s.loss)}`}
              className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4 backdrop-blur-sm transition-colors hover:border-seal"
            >
              <p className="font-serif text-lg text-ink">{ORIENTING_PROMPTS[s.loss]}</p>
              <p className="label mt-1 text-muted">{s.loss}</p>
            </Link>
          ))}
        </div>
      </div>

      <form action="/library" method="get" className="mt-10 flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="Search the Library…"
          className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-2.5 text-ink outline-none backdrop-blur-sm placeholder:text-muted focus:border-seal"
        />
        <button
          type="submit"
          className="shrink-0 rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
        >
          Search
        </button>
      </form>

      {searchResults ? (
        <>
          <p className="mt-6 text-sm text-muted">
            {searchResults.length === 0
              ? `Nothing found for "${query}".`
              : `${searchResults.length} result${searchResults.length === 1 ? "" : "s"} for "${query}".`}
          </p>
          <p className="mt-2">
            <Link href="/library" className="text-sm text-muted hover:text-seal">
              ← Clear search
            </Link>
          </p>
        </>
      ) : orientation ? (
        <>
          <p className="mt-6 text-sm text-muted">
            {orientation.entries.length === 0
              ? `Nothing published yet for ${orientation.loss.loss}.`
              : `Entries touching ${orientation.loss.loss}.`}
          </p>
          <p className="mt-2">
            <Link href="/library" className="text-sm text-muted hover:text-seal">
              ← Back to the Library
            </Link>
          </p>
        </>
      ) : result?.mode === "personalized" ? (
        <p className="mt-4 text-lg text-muted">
          Because of what became visible in your Journey, these are worth a look.
        </p>
      ) : result?.journeyId ? (
        <p className="mt-4 text-lg text-muted">
          There wasn&rsquo;t enough from that Journey yet to personalize this safely — here&rsquo;s
          the reviewed Library instead.
        </p>
      ) : (
        <p className="mt-4 text-lg text-muted">
          A place to keep exploring, on your own or from where a Journey left off.
        </p>
      )}

      <p className="mt-6">
        <Link href="/library/mine" className="text-sm text-muted hover:text-seal">
          My Library →
        </Link>
      </p>

      {searchResults ? (
        searchResults.length > 0 && (
          <div className="mt-10 space-y-3">
            {searchResults.map((entry) => (
              <EntryCard key={entry.id} entry={entry} />
            ))}
          </div>
        )
      ) : orientation ? (
        orientation.entries.length > 0 && (
          <div className="mt-10 space-y-3">
            {orientation.entries.map((entry) => (
              <EntryCard key={entry.id} entry={entry} />
            ))}
          </div>
        )
      ) : result && result.entries.length === 0 ? (
        <p className="mt-12 text-muted">Nothing published yet.</p>
      ) : (
        result && (
          <div className="mt-10 space-y-3">
            {result.entries.map(({ entry, reasons }) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                reasons={reasons.length > 0 ? reasons.map(formatReason) : undefined}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
}
