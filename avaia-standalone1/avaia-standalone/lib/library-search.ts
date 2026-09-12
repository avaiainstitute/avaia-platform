import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LibraryEntry } from "./library";
import type { LibraryConcept, LibraryQuestion } from "./library-concepts";

/** Deterministic, in-app keyword search across published entries, no
 *  vector/embedding search, and deliberately not built on Supabase's
 *  .or()/.ilike() with the raw query string interpolated into a
 *  PostgREST filter expression, which would risk breaking (or, worse,
 *  altering) the filter if the Host's search text contains characters
 *  PostgREST's filter syntax treats specially (commas, parentheses,
 *  periods). At the Library's current scale, a handful of entries,
 *  fetching all published rows and matching in plain TypeScript is both
 *  the safest and the simplest option, the same reasoning already applied
 *  to retrieval in lib/library-retrieval.ts. A proper Postgres full-text
 *  search index is the natural next step once the Library is too large
 *  for this to stay cheap; deliberately deferred until then.
 *
 *  Searches title, great_idea, overview, body, external_author,
 *  external_description, tags, and secondary_losses. Does NOT search
 *  concepts or questions yet, there is no published concept/question
 *  content to search (see lib/library-concepts.ts), and wiring that in
 *  now would test nothing real. */
export async function searchLibraryEntries(
  supabase: SupabaseClient,
  query: string,
  viewerIsMember: boolean
): Promise<LibraryEntry[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const { data } = await supabase
    .from("library_entries")
    .select("*")
    .eq("status", "published")
    .limit(500);
  // visibility: 'member' entries are excluded here, not just left to the
  // caller, every path that can return a LibraryEntry to a Host filters
  // this itself, so there's no single call site whose omission would leak
  // member content.
  const published = ((data as LibraryEntry[]) ?? []).filter(
    (e) => viewerIsMember || e.visibility === "public"
  );

  const matches = published.filter((entry) => {
    const haystack = [
      entry.title,
      entry.great_idea,
      entry.overview,
      entry.body,
      entry.external_author,
      entry.external_description,
      ...entry.tags,
      ...entry.secondary_losses,
    ]
      .filter((v): v is string => typeof v === "string")
      .join(" \n ")
      .toLowerCase();
    return haystack.includes(q);
  });

  return matches.slice(0, 20);
}

export type LibrarySearchResult =
  | { kind: "entry"; entry: LibraryEntry }
  | { kind: "concept"; concept: LibraryConcept }
  | { kind: "question"; question: LibraryQuestion };

/** Phase 2 of the Library completion work: search now reaches published
 *  concepts and questions too, not just entries, the exact gap the
 *  audit found (real published content existed that the search box
 *  simply never looked at). Same fetch-all-then-filter-in-TS approach as
 *  searchLibraryEntries, for the same reason (current scale, safety from
 *  PostgREST filter-string injection); same 'published'-only floor, a
 *  draft concept or question is never returned here regardless of who is
 *  searching, search draws from the same published set a signed-in Host
 *  or Guide can already reach by browsing. Entries are ranked first
 *  (they're what most searches are actually after), then concepts, then
 *  questions, each internally in whatever order the query returned. */
export async function searchLibrary(
  supabase: SupabaseClient,
  query: string,
  viewerIsMember: boolean
): Promise<LibrarySearchResult[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const [entries, conceptsRes, questionsRes] = await Promise.all([
    searchLibraryEntries(supabase, query, viewerIsMember),
    supabase.from("library_concepts").select("*").eq("status", "published"),
    supabase.from("library_questions").select("*").eq("status", "published"),
  ]);

  const concepts = ((conceptsRes.data as LibraryConcept[]) ?? []).filter((c) => {
    const haystack = [c.name, c.description ?? "", ...c.alternate_terms].join(" \n ").toLowerCase();
    return haystack.includes(q);
  });

  const questions = ((questionsRes.data as LibraryQuestion[]) ?? []).filter((qq) =>
    qq.question.toLowerCase().includes(q)
  );

  return [
    ...entries.map((entry): LibrarySearchResult => ({ kind: "entry", entry })),
    ...concepts.slice(0, 10).map((concept): LibrarySearchResult => ({ kind: "concept", concept })),
    ...questions.slice(0, 10).map((question): LibrarySearchResult => ({ kind: "question", question })),
  ];
}
