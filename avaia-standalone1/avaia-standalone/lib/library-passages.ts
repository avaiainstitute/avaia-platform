import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConceptStatus, ProposedBy, JunctionStatus } from "./library-concepts";

// Minimum historical provenance layer (see 0016_library_provenance.sql).
// Fully separate from library_entries -- a passage connects to a concept
// through its own chain (Person -> Work -> Source Version -> Passage ->
// Passage<->Concept), never through library_entries or
// library_entry_concepts. Same two-step (junction rows filtered
// published, then batch-fetch targets filtered published) pattern as
// lib/library-concepts.ts, extended one link further at each step of the
// chain -- passage -> source version -> work -> person -- so a broken or
// since-unpublished link anywhere in the chain drops that passage from
// the result rather than rendering a partial/inconsistent provenance.

export type RightsStatus = "unreviewed" | "public_domain" | "permission_granted" | "licensed" | "restricted";
export type VerificationStatus = "unverified" | "partially_verified" | "verified";

export type LibraryPerson = {
  id: string;
  canonical_name: string;
  disambiguation: string | null;
  birth_year: number | null;
  death_year: number | null;
  description: string | null;
  status: ConceptStatus;
  created_at: string;
  updated_at: string;
};

export type LibraryWork = {
  id: string;
  person_id: string;
  title: string;
  original_date_text: string | null;
  work_type: string | null;
  description: string | null;
  status: ConceptStatus;
  created_at: string;
  updated_at: string;
};

export type LibrarySourceVersion = {
  id: string;
  work_id: string;
  version_label: string;
  translator_editor: string | null;
  publisher: string | null;
  publication_year: number | null;
  source_url: string | null;
  archive_source: string | null;
  rights_status: RightsStatus;
  verification_status: VerificationStatus;
  status: ConceptStatus;
  created_at: string;
  updated_at: string;
};

export type LibraryPassage = {
  id: string;
  source_version_id: string;
  locator: string;
  exact_text: string | null;
  avaia_paraphrase: string | null;
  context_note: string | null;
  verification_status: VerificationStatus;
  rights_status: RightsStatus;
  status: ConceptStatus;
  created_at: string;
  updated_at: string;
};

export type LibraryPassageConcept = {
  id: string;
  passage_id: string;
  concept_id: string;
  note: string | null;
  proposed_by: ProposedBy;
  status: JunctionStatus;
};

/** The full, un-collapsed provenance chain for one passage, as connected
 *  to a concept -- person, work, and source version are kept as separate
 *  fields rather than flattened into one display string, so the caller
 *  decides how to present attribution (the concept page renders them as
 *  distinct labeled pieces, per the "do not make the historical author
 *  speak to the Host" discipline: this is metadata about a source, not a
 *  simulated voice). */
export type HistoricalPassage = {
  passage: LibraryPassage;
  sourceVersion: LibrarySourceVersion;
  work: LibraryWork;
  person: LibraryPerson;
  /** From the passage<->concept junction -- why this passage belongs in
   *  this concept's neighborhood, editorial content, distinct from
   *  passage.context_note (which is about the passage itself). */
  note: string | null;
};

/** Published passages connected to a concept, with their full provenance
 *  chain resolved. Every level (junction, passage, source version, work,
 *  person) is filtered to status = 'published' explicitly, on top of RLS
 *  already enforcing the same thing on all five tables -- matching the
 *  discipline already established in lib/library-concepts.ts. Returns an
 *  empty array whenever nothing published exists yet, which is the
 *  correct, expected result today: no historical content has been
 *  seeded. */
export async function getPassagesForConcept(
  supabase: SupabaseClient,
  conceptId: string
): Promise<HistoricalPassage[]> {
  const { data: links } = await supabase
    .from("library_passage_concepts")
    .select("passage_id, note")
    .eq("concept_id", conceptId)
    .eq("status", "published");
  const linkRows = (links as { passage_id: string; note: string | null }[]) ?? [];
  if (linkRows.length === 0) return [];

  const { data: passagesData } = await supabase
    .from("library_passages")
    .select("*")
    .in("id", linkRows.map((r) => r.passage_id))
    .eq("status", "published");
  const passages = (passagesData as LibraryPassage[]) ?? [];
  if (passages.length === 0) return [];
  const passageById = new Map(passages.map((p) => [p.id, p]));

  const sourceVersionIds = [...new Set(passages.map((p) => p.source_version_id))];
  const { data: sourceVersionsData } = await supabase
    .from("library_source_versions")
    .select("*")
    .in("id", sourceVersionIds)
    .eq("status", "published");
  const sourceVersions = (sourceVersionsData as LibrarySourceVersion[]) ?? [];
  if (sourceVersions.length === 0) return [];
  const sourceVersionById = new Map(sourceVersions.map((v) => [v.id, v]));

  const workIds = [...new Set(sourceVersions.map((v) => v.work_id))];
  const { data: worksData } = await supabase
    .from("library_works")
    .select("*")
    .in("id", workIds)
    .eq("status", "published");
  const works = (worksData as LibraryWork[]) ?? [];
  if (works.length === 0) return [];
  const workById = new Map(works.map((w) => [w.id, w]));

  const personIds = [...new Set(works.map((w) => w.person_id))];
  const { data: peopleData } = await supabase
    .from("library_people")
    .select("*")
    .in("id", personIds)
    .eq("status", "published");
  const people = (peopleData as LibraryPerson[]) ?? [];
  if (people.length === 0) return [];
  const personById = new Map(people.map((p) => [p.id, p]));

  const results: HistoricalPassage[] = [];
  for (const link of linkRows) {
    const passage = passageById.get(link.passage_id);
    if (!passage) continue;
    const sourceVersion = sourceVersionById.get(passage.source_version_id);
    if (!sourceVersion) continue;
    const work = workById.get(sourceVersion.work_id);
    if (!work) continue;
    const person = personById.get(work.person_id);
    if (!person) continue;
    results.push({ passage, sourceVersion, work, person, note: link.note });
  }
  return results;
}
