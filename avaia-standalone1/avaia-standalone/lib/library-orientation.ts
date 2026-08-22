import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SECONDARY_LOSSES, type SecondaryLoss } from "./institution";
import type { LibraryEntry } from "./library";
import type { LibraryConcept } from "./library-concepts";

// The Library's orientation layer -- lets a Host begin from one of the
// ten canonical Secondary Losses (already the AVAIA-wide vocabulary for
// naming a lived experience; see SECONDARY_LOSSES in lib/institution.ts
// and its existing rendering at app/secondary-loss/page.tsx) instead of
// already knowing a Library term. Composes two signals, both direct:
//   1. A published library_concepts row with the same name (Connection,
//      today) -- definitive, so its neighborhood page is the answer.
//   2. Published entries tagged directly via library_entries.secondary_losses.
// Deliberately does NOT fall back to entries whose virtues[].family
// matches the loss's canonical healingFamily -- that historical
// Secondary Loss <-> Virtue lineage may remain a possible editorial/
// retrieval lens elsewhere, but is not used as an automatic public
// routing rule here (see the Library/Secondary-Loss/Chemistry
// reconciliation). Only a loss's own recorded secondary_losses tag
// counts, matching the same boundary now enforced on /secondary-loss
// and /chemistry. No new taxonomy, no new concept rows, no schema
// change. Fetch-all-then-filter-in-TS, matching the established pattern
// in lib/library-search.ts and lib/library-retrieval.ts at the
// Library's current scale.

export type SecondaryLossOrientation = {
  loss: SecondaryLoss;
  /** Definitive match -- when present, entries is always empty; the
   *  concept's own neighborhood page (questions/entries/historical
   *  voices/related ideas) is the complete answer. */
  concept: LibraryConcept | null;
  entries: LibraryEntry[];
};

/** Resolves one canonical Secondary Loss name to whatever published
 *  Library content already corresponds to it. Returns null only if
 *  `lossName` isn't one of the ten canonical names -- callers should
 *  validate with isValidSecondaryLoss first for anything URL-supplied. */
export async function getOrientationForSecondaryLoss(
  supabase: SupabaseClient,
  lossName: string
): Promise<SecondaryLossOrientation | null> {
  const loss = SECONDARY_LOSSES.find(
    (s) => s.loss.toLowerCase() === lossName.trim().toLowerCase()
  );
  if (!loss) return null;

  const { data: conceptsData } = await supabase
    .from("library_concepts")
    .select("*")
    .eq("status", "published");
  const concepts = (conceptsData as LibraryConcept[]) ?? [];
  const concept =
    concepts.find((c) => c.name.toLowerCase() === loss.loss.toLowerCase()) ?? null;

  if (concept) return { loss, concept, entries: [] };

  const { data: entriesData } = await supabase
    .from("library_entries")
    .select("*")
    .eq("status", "published")
    .limit(500);
  const published = (entriesData as LibraryEntry[]) ?? [];

  const entries = published.filter((entry) =>
    entry.secondary_losses.some((l) => l.toLowerCase() === loss.loss.toLowerCase())
  );

  return { loss, concept: null, entries };
}
