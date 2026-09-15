import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { VIRTUES, VIRTUE_FAMILIES } from "@/lib/virtues";
import { getViewFromAboveClass } from "@/lib/view-from-above";
import type { LibraryEntry } from "@/lib/library";
import { getConcept } from "@/lib/library-concepts";
import { isMember } from "@/lib/membership";

// Resolves a Host's entry point into a private AVAIA conversation,
// "I clicked this specific Chemistry element" or "I just took this
// specific View From Above class", into structured context the IAP
// engine can use to open naturally. `source`/`key` come from a URL
// query string a Host clicked through on (see app/chemistry/page.tsx,
// app/chemistry/family/page.tsx, app/view-from-above/[slug]/page.tsx),
// which is untrusted input, this function is the one place that
// input is resolved against AVAIA's own canonical data (lib/virtues.ts,
// lib/view-from-above.ts) rather than ever being used directly. An
// unrecognized key returns null (no origin context at all) rather than
// inventing or passing through anything, fails closed, never fails
// open into fabricated content.

export type OriginContext =
  | {
      source: "chemistry" | "view-from-above" | "library";
      label: string; // the element name, class title, or Library entry/concept title
      family: string; // Virtue Family display name, or "Library"
      definition: string; // canonical element definition, class human question, or Library excerpt
    }
  // A Host intentionally bringing one of their own Journal entries into a
  // new IAP conversation ("Bring to a Conversation" on a journal entry --
  // see app/workbook/journal/[entryId]/page.tsx). Deliberately a different
  // shape than the three above: a journal entry has no canonical
  // family/definition of its own, it's the Host's own words, in full. Only
  // ever resolved through the Host's own RLS-scoped client below, so this
  // can never resolve someone else's private entry.
  | { source: "journal"; content: string; createdAt: string };

/** `key` for source="library" is prefixed ("entry:<uuid>" or
 *  "concept:<uuid>") since a Host can bring either into a conversation
 *  (see app/library/[entryId]/page.tsx and
 *  app/library/concepts/[conceptId]/page.tsx's "Bring Into My
 *  Conversation" buttons). Needs a database lookup, unlike the other two
 *  sources' static in-memory data, so this is the one branch that uses
 *  `supabase`/`viewerId` at all; both are optional precisely because
 *  every other caller/source never needed them. A member-only entry
 *  resolves to null for a non-member exactly like a direct entry-page
 *  visit would, fails closed rather than leaking member content through
 *  a side door. */
export async function resolveOriginContext(
  source: string | undefined,
  key: string | undefined,
  supabase?: SupabaseClient,
  viewerId?: string
): Promise<OriginContext | null> {
  if (!source || !key) return null;

  if (source === "chemistry") {
    const virtue = VIRTUES.find((v) => v.name.toLowerCase() === key.toLowerCase());
    if (!virtue) return null;
    const family = VIRTUE_FAMILIES.find((f) => f.key === virtue.family);
    if (!family) return null;
    return {
      source: "chemistry",
      label: virtue.name,
      family: family.name,
      definition: virtue.definition,
    };
  }

  if (source === "view-from-above") {
    const cls = getViewFromAboveClass(key);
    if (!cls) return null;
    return {
      source: "view-from-above",
      label: cls.title,
      family: cls.virtueFamily,
      definition: cls.humanQuestion,
    };
  }

  if (source === "library" && supabase) {
    const [kind, id] = key.split(":");
    if (kind === "entry" && id) {
      const { data } = await supabase
        .from("library_entries")
        .select("*")
        .eq("id", id)
        .eq("status", "published")
        .maybeSingle();
      const entry = data as LibraryEntry | null;
      if (!entry) return null;
      if (entry.visibility === "member" && !(viewerId && (await isMember(supabase, viewerId)))) return null;
      return {
        source: "library",
        label: entry.title,
        family: entry.great_idea,
        definition: entry.overview,
      };
    }
    if (kind === "concept" && id) {
      const concept = await getConcept(supabase, id);
      if (!concept) return null;
      return {
        source: "library",
        label: concept.name,
        family: "Library Concept",
        definition: concept.description ?? concept.name,
      };
    }
    return null;
  }

  // Journal -> Conversation, entirely Host-initiated (an explicit "Bring
  // to a Conversation" click on one of their own entries, never anything
  // automatic). `key` is the journal entry's own id. Requires both
  // supabase and viewerId, unlike chemistry/view-from-above's public
  // canonical data -- there is nothing to resolve without an authenticated
  // owner. RLS on journal_entries (self-only) already guarantees this
  // query returns nothing for an entry that isn't viewerId's own; the
  // explicit host_id check below is only a second, defensive guard, same
  // style as the library branch above.
  if (source === "journal" && supabase && viewerId) {
    const { data } = await supabase.from("journal_entries").select("*").eq("id", key).maybeSingle();
    if (!data || data.host_id !== viewerId) return null;
    return { source: "journal", content: data.content as string, createdAt: data.created_at as string };
  }

  return null;
}
