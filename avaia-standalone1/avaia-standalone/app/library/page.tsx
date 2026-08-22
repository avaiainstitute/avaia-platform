import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLibraryEntriesForHost, formatReason } from "@/lib/library-retrieval";
import { searchLibraryEntries } from "@/lib/library-search";
import type { LibraryEntry } from "@/lib/library";

export const metadata = { title: "Library — AVAIA" };
export const dynamic = "force-dynamic";

/** The Living Library's permanent entrance. Independently returnable --
 *  works with or without ?journey=<id> or ?q=<search>. ?journey, when
 *  present and it actually belongs to this Host, grounds retrieval in
 *  that Journey's own referrals (see lib/library-retrieval.ts); otherwise,
 *  and whenever there isn't enough legitimate matched evidence, a broad
 *  reviewed set is shown instead -- never a fabricated personal reason.
 *  ?q, when present, switches the page into deterministic keyword search
 *  (see lib/library-search.ts) instead of retrieval. Both are the same
 *  optional-searchParam pattern already used by /journey?new=1&program=...
 *  and /unsung-heroes?path=... -- no new session state, no second
 *  persistence mechanism. */
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
  searchParams?: { journey?: string; q?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?from=/library`);

  const query = searchParams?.q?.trim() ?? "";
  const searchResults = query ? await searchLibraryEntries(supabase, query) : null;

  // Search takes priority when present -- retrieval only runs when the
  // Host isn't actively searching, so a search never gets silently
  // overridden by a stale ?journey= param from the same URL.
  const result = searchResults ? null : await getLibraryEntriesForHost(supabase, user.id, searchParams?.journey ?? null);

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <p className="label mb-3">Library</p>
      <h1 className="font-serif text-4xl text-ink">The AVAIA Library</h1>

      <form action="/library" method="get" className="mt-6 flex gap-2">
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
