import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EntryCard, SearchResultCard } from "@/app/library/page";
import { searchLibrary } from "@/lib/library-search";
import { getOrientationForSecondaryLoss } from "@/lib/library-orientation";
import { getLibraryEntriesForVirtue } from "@/lib/library-retrieval";
import { SECONDARY_LOSSES, isValidSecondaryLoss } from "@/lib/institution";
import { VIRTUE_FAMILIES, type VirtueFamilyKey } from "@/lib/virtues";
import type { LibraryEntry } from "@/lib/library";

export const metadata = { title: "Library, Guide Toolkit, AVAIA" };
export const dynamic = "force-dynamic";

/** The Guide's own research experience (Phase 3 of the Library
 *  completion work). Deliberately not a second Library: every result
 *  here links straight into the same /library/[entryId] and
 *  /library/concepts/[conceptId] pages a Host uses, this page only adds
 *  the facets a Guide actually needs to find something -- search,
 *  Secondary Loss, Virtue Family, or a plain concept index -- before
 *  reading it there. A Guide's own "library entries guide read" RLS
 *  policy already grants published-entry access regardless of
 *  visibility, so every lookup below passes viewerIsMember=true rather
 *  than checking membership, which has nothing to do with why a Guide
 *  is authorized to research. Nothing here reaches a Host's private
 *  conversation, Workbook, or Shared Room material, this is read access
 *  to AVAIA's own published Library, the same boundary Guides already
 *  have everywhere else in the Toolkit. */
export default async function ToolkitLibraryPage({
  searchParams,
}: {
  searchParams?: { q?: string; secondary_loss?: string; family?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/toolkit");

  const query = searchParams?.q?.trim() ?? "";
  const searchResults = query ? await searchLibrary(supabase, query, true) : null;

  const lossParam = searchParams?.secondary_loss?.trim() ?? "";
  const orientation =
    !searchResults && lossParam && isValidSecondaryLoss(lossParam)
      ? await getOrientationForSecondaryLoss(supabase, lossParam, true)
      : null;
  if (orientation?.concept) redirect(`/library/concepts/${orientation.concept.id}`);

  const familyParam = searchParams?.family?.trim() ?? "";
  const family = VIRTUE_FAMILIES.find((f) => f.key === familyParam) ?? null;
  const virtueEntries: LibraryEntry[] =
    !searchResults && !orientation && family
      ? await getLibraryEntriesForVirtue(supabase, family.key as VirtueFamilyKey, null, true)
      : [];

  let recent: LibraryEntry[] = [];
  if (!searchResults && !orientation && !family) {
    const { data } = await supabase
      .from("library_entries")
      .select("*")
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(10);
    recent = (data as LibraryEntry[]) ?? [];
  }

  return (
    <div>
      <p className="mb-6">
        <Link href="/toolkit" className="label hover:text-seal">
          ← Back to Dashboard
        </Link>
      </p>
      <p className="label mb-3">Library</p>
      <h1 className="font-serif text-4xl text-ink">AVAIA Library</h1>
      <p className="mt-4 text-lg text-muted">
        Research entries, concepts, questions, and historical material, on your own or
        alongside a Host&rsquo;s conversation. This is AVAIA&rsquo;s own published research,
        never a Host&rsquo;s private material.
      </p>

      <form action="/toolkit/library" method="get" className="mt-8 flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="Search entries, concepts, and questions…"
          className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-2.5 text-ink outline-none backdrop-blur-sm placeholder:text-muted focus:border-seal"
        />
        <button
          type="submit"
          className="shrink-0 rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
        >
          Search
        </button>
      </form>

      <p className="mt-4 flex flex-wrap gap-4 text-sm">
        <Link href="/library/concepts" className="text-muted hover:text-seal">
          Browse all Concepts →
        </Link>
      </p>

      {!searchResults && !orientation && !family && (
        <>
          <div className="mt-10">
            <p className="label mb-3 text-muted">Browse by Secondary Loss</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {SECONDARY_LOSSES.map((s) => (
                <Link
                  key={s.loss}
                  href={`/toolkit/library?secondary_loss=${encodeURIComponent(s.loss)}`}
                  className="rounded-md border border-rule bg-white/[0.04] px-4 py-2.5 text-sm text-ink transition-colors hover:border-seal"
                >
                  {s.loss}
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-10">
            <p className="label mb-3 text-muted">Browse by Virtue Family</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {VIRTUE_FAMILIES.map((f) => (
                <Link
                  key={f.key}
                  href={`/toolkit/library?family=${encodeURIComponent(f.key)}`}
                  className="rounded-md border border-rule bg-white/[0.04] px-4 py-2.5 text-sm text-ink transition-colors hover:border-seal"
                >
                  {f.name}
                </Link>
              ))}
            </div>
          </div>
        </>
      )}

      {searchResults ? (
        <>
          <p className="mt-8 text-sm text-muted">
            {searchResults.length === 0
              ? `Nothing found for "${query}".`
              : `${searchResults.length} result${searchResults.length === 1 ? "" : "s"} for "${query}".`}
          </p>
          <p className="mt-2">
            <Link href="/toolkit/library" className="text-sm text-muted hover:text-seal">
              ← Clear search
            </Link>
          </p>
          {searchResults.length > 0 && (
            <div className="mt-6 space-y-3">
              {searchResults.map((r, i) => (
                <SearchResultCard key={`${r.kind}-${i}`} result={r} />
              ))}
            </div>
          )}
        </>
      ) : orientation ? (
        <>
          <p className="mt-8 text-sm text-muted">
            {orientation.entries.length === 0
              ? `Nothing published yet for ${orientation.loss.loss}.`
              : `Entries touching ${orientation.loss.loss}.`}
          </p>
          <p className="mt-2">
            <Link href="/toolkit/library" className="text-sm text-muted hover:text-seal">
              ← Back
            </Link>
          </p>
          {orientation.entries.length > 0 && (
            <div className="mt-6 space-y-3">
              {orientation.entries.map((entry) => (
                <EntryCard key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </>
      ) : family ? (
        <>
          <p className="mt-8 text-sm text-muted">
            {virtueEntries.length === 0
              ? `Nothing published yet for ${family.name}.`
              : `Entries touching ${family.name}.`}
          </p>
          <p className="mt-2">
            <Link href="/toolkit/library" className="text-sm text-muted hover:text-seal">
              ← Back
            </Link>
          </p>
          {virtueEntries.length > 0 && (
            <div className="mt-6 space-y-3">
              {virtueEntries.map((entry) => (
                <EntryCard key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="mt-10">
          <p className="label mb-3 text-muted">Recently published</p>
          {recent.length === 0 ? (
            <p className="text-muted">Nothing published yet.</p>
          ) : (
            <div className="space-y-3">
              {recent.map((entry) => (
                <EntryCard key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
