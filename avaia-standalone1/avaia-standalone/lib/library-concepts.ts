import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LibraryEntry } from "./library";

// Types and read-only data access for the Living Library's concept/
// cross-reference foundation (see 0015_library_concepts.sql). Every read
// filters status = 'published' explicitly, on top of RLS already
// enforcing the same thing -- matching the existing pattern in
// app/toolkit/library/page.tsx. A function here returning an empty
// result means either nothing published exists yet for that concept/
// entry/question, or (for most of the Library's history so far) nothing
// has been wired to read it -- not necessarily that the underlying data
// is missing.
//
// Deliberately two-step (fetch the junction rows, then batch-fetch the
// referenced rows by id, then join in TypeScript) rather than a
// PostgREST embedded-resource select -- the same pattern already proven
// in getParticipantHistory (lib/guide.ts) and getLibraryEntriesForHost
// (lib/library-retrieval.ts). library_concept_relations has two foreign
// keys into library_concepts (from_concept_id, to_concept_id), which
// would need a disambiguating embedded-select hint tied to Postgres's
// auto-generated constraint name -- not worth the fragility when a plain
// second query is just as simple and easy to verify by reading it.

export type ConceptStatus = "draft" | "published" | "archived";
export type ProposedBy = "editor" | "model";
export type JunctionStatus = "proposed" | "published";
// Deliberately excludes anything implying historical development, source/
// work lineage, or authorship -- the Person/Work/Version/Fragment
// provenance layer is intentionally deferred, and a concept-to-concept
// edge is the wrong place for it to arrive prematurely.
export type ConceptRelationType =
  | "related_to"
  | "contrasts_with"
  | "commonly_confused_with"
  | "dimension_of";

export type LibraryConcept = {
  id: string;
  name: string;
  description: string | null;
  alternate_terms: string[];
  /** Small, freeform, extensible -- not a canonical ontology. Shape is
   *  intentionally loose ({label, note} or plain strings) until real
   *  editorial content settles what's actually useful. */
  distinctions: unknown[];
  tensions: unknown[];
  status: ConceptStatus;
  editor_id: string | null;
  created_at: string;
  updated_at: string;
};

export type LibraryQuestion = {
  id: string;
  question: string;
  status: ConceptStatus;
  editor_id: string | null;
  created_at: string;
  updated_at: string;
};

export type LibraryConceptRelation = {
  id: string;
  from_concept_id: string;
  to_concept_id: string;
  relation_type: ConceptRelationType;
  note: string | null;
  proposed_by: ProposedBy;
  status: JunctionStatus;
};

/** Concepts a specific Library Entry is connected to, with the editorial
 *  reason for each connection. Only ever published rows -- a "proposed"
 *  (model-suggested, not yet reviewed) connection never reaches a Host,
 *  by RLS as well as this explicit filter. */
export async function getConceptsForEntry(
  supabase: SupabaseClient,
  libraryEntryId: string
): Promise<Array<{ concept: LibraryConcept; note: string | null }>> {
  const { data: links } = await supabase
    .from("library_entry_concepts")
    .select("concept_id, note")
    .eq("library_entry_id", libraryEntryId)
    .eq("status", "published");
  const rows = (links as { concept_id: string; note: string | null }[]) ?? [];
  if (rows.length === 0) return [];

  const { data: concepts } = await supabase
    .from("library_concepts")
    .select("*")
    .in("id", rows.map((r) => r.concept_id))
    .eq("status", "published");
  const byId = new Map(((concepts as LibraryConcept[]) ?? []).map((c) => [c.id, c]));

  return rows
    .filter((r) => byId.has(r.concept_id))
    .map((r) => ({ concept: byId.get(r.concept_id)!, note: r.note }));
}

/** Questions a specific Library Entry addresses. */
export async function getQuestionsForEntry(
  supabase: SupabaseClient,
  libraryEntryId: string
): Promise<Array<{ question: LibraryQuestion; note: string | null }>> {
  const { data: links } = await supabase
    .from("library_entry_questions")
    .select("question_id, note")
    .eq("library_entry_id", libraryEntryId)
    .eq("status", "published");
  const rows = (links as { question_id: string; note: string | null }[]) ?? [];
  if (rows.length === 0) return [];

  const { data: questions } = await supabase
    .from("library_questions")
    .select("*")
    .in("id", rows.map((r) => r.question_id))
    .eq("status", "published");
  const byId = new Map(((questions as LibraryQuestion[]) ?? []).map((q) => [q.id, q]));

  return rows
    .filter((r) => byId.has(r.question_id))
    .map((r) => ({ question: byId.get(r.question_id)!, note: r.note }));
}

/** Other concepts directly related to a given concept, in either
 *  direction -- the relation itself stays directional (from_concept_id/
 *  to_concept_id/relation_type preserved) so a caller can render "X is a
 *  dimension of Y" correctly either way round. */
export async function getRelatedConcepts(
  supabase: SupabaseClient,
  conceptId: string
): Promise<Array<{ concept: LibraryConcept; relation: LibraryConceptRelation; direction: "from" | "to" }>> {
  const [outgoing, incoming] = await Promise.all([
    supabase
      .from("library_concept_relations")
      .select("*")
      .eq("from_concept_id", conceptId)
      .eq("status", "published"),
    supabase
      .from("library_concept_relations")
      .select("*")
      .eq("to_concept_id", conceptId)
      .eq("status", "published"),
  ]);

  const outRows = (outgoing.data as LibraryConceptRelation[]) ?? [];
  const inRows = (incoming.data as LibraryConceptRelation[]) ?? [];
  const otherIds = [...new Set([...outRows.map((r) => r.to_concept_id), ...inRows.map((r) => r.from_concept_id)])];
  if (otherIds.length === 0) return [];

  const { data: concepts } = await supabase
    .from("library_concepts")
    .select("*")
    .in("id", otherIds)
    .eq("status", "published");
  const byId = new Map(((concepts as LibraryConcept[]) ?? []).map((c) => [c.id, c]));

  const out = outRows
    .filter((r) => byId.has(r.to_concept_id))
    .map((r) => ({ concept: byId.get(r.to_concept_id)!, relation: r, direction: "from" as const }));
  const inc = inRows
    .filter((r) => byId.has(r.from_concept_id))
    .map((r) => ({ concept: byId.get(r.from_concept_id)!, relation: r, direction: "to" as const }));

  return [...out, ...inc];
}

/** Concepts a given question raises/touches. */
export async function getConceptsForQuestion(
  supabase: SupabaseClient,
  questionId: string
): Promise<Array<{ concept: LibraryConcept; note: string | null }>> {
  const { data: links } = await supabase
    .from("library_question_concepts")
    .select("concept_id, note")
    .eq("question_id", questionId)
    .eq("status", "published");
  const rows = (links as { concept_id: string; note: string | null }[]) ?? [];
  if (rows.length === 0) return [];

  const { data: concepts } = await supabase
    .from("library_concepts")
    .select("*")
    .in("id", rows.map((r) => r.concept_id))
    .eq("status", "published");
  const byId = new Map(((concepts as LibraryConcept[]) ?? []).map((c) => [c.id, c]));

  return rows
    .filter((r) => byId.has(r.concept_id))
    .map((r) => ({ concept: byId.get(r.concept_id)!, note: r.note }));
}

/** A single published concept by id, or null if it doesn't exist or
 *  isn't published -- the same "not found or not yours to see" shape
 *  every other Library detail lookup already uses (e.g. the entry detail
 *  page's own `.eq("status", "published").maybeSingle()`). */
export async function getConcept(
  supabase: SupabaseClient,
  conceptId: string
): Promise<LibraryConcept | null> {
  const { data } = await supabase
    .from("library_concepts")
    .select("*")
    .eq("id", conceptId)
    .eq("status", "published")
    .maybeSingle();
  return (data as LibraryConcept) ?? null;
}

/** Questions directly connected to a concept through library_question_concepts
 *  -- a question belonging in this concept's own exploration neighborhood.
 *  Deliberately NOT derived by walking Concept -> Entries -> Entry
 *  Questions; that's a different relationship (a question a specific
 *  entry happens to touch), and conflating the two would make a concept
 *  page show questions no one ever reviewed as belonging to the concept
 *  itself. */
export async function getQuestionsForConcept(
  supabase: SupabaseClient,
  conceptId: string
): Promise<Array<{ question: LibraryQuestion; note: string | null }>> {
  const { data: links } = await supabase
    .from("library_question_concepts")
    .select("question_id, note")
    .eq("concept_id", conceptId)
    .eq("status", "published");
  const rows = (links as { question_id: string; note: string | null }[]) ?? [];
  if (rows.length === 0) return [];

  const { data: questions } = await supabase
    .from("library_questions")
    .select("*")
    .in("id", rows.map((r) => r.question_id))
    .eq("status", "published");
  const byId = new Map(((questions as LibraryQuestion[]) ?? []).map((q) => [q.id, q]));

  return rows
    .filter((r) => byId.has(r.question_id))
    .map((r) => ({ question: byId.get(r.question_id)!, note: r.note }));
}

/** Library Entries directly connected to a concept through
 *  library_entry_concepts -- the reverse of getConceptsForEntry. The only
 *  function in this file that returns LibraryEntry rows (concepts and
 *  questions have no visibility tiering of their own), so it's the one
 *  place here that needs the same public/member filter already applied in
 *  lib/library-search.ts, lib/library-retrieval.ts, and
 *  lib/library-orientation.ts -- otherwise a concept's neighborhood page
 *  would leak member-only entries to a non-member. */
export async function getEntriesForConcept(
  supabase: SupabaseClient,
  conceptId: string,
  viewerIsMember: boolean
): Promise<Array<{ entry: LibraryEntry; note: string | null }>> {
  const { data: links } = await supabase
    .from("library_entry_concepts")
    .select("library_entry_id, note")
    .eq("concept_id", conceptId)
    .eq("status", "published");
  const rows = (links as { library_entry_id: string; note: string | null }[]) ?? [];
  if (rows.length === 0) return [];

  const { data: entries } = await supabase
    .from("library_entries")
    .select("*")
    .in("id", rows.map((r) => r.library_entry_id))
    .eq("status", "published");
  const byId = new Map(
    ((entries as LibraryEntry[]) ?? [])
      .filter((e) => viewerIsMember || e.visibility === "public")
      .map((e) => [e.id, e])
  );

  return rows
    .filter((r) => byId.has(r.library_entry_id))
    .map((r) => ({ entry: byId.get(r.library_entry_id)!, note: r.note }));
}
