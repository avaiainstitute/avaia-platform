import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EntryCard } from "@/app/library/page";
import {
  getConcept,
  getQuestionsForConcept,
  getEntriesForConcept,
  getRelatedConcepts,
  type LibraryConcept,
  type LibraryConceptRelation,
} from "@/lib/library-concepts";
import { getPassagesForConcept, type HistoricalPassage } from "@/lib/library-passages";

export const dynamic = "force-dynamic";

/** Plain-language rendering of one concept relation from the CURRENT
 *  concept's point of view -- direction matters only for dimension_of
 *  (from = dimension/part, to = larger concept/whole; see
 *  0015_library_concepts.sql). getRelatedConcepts labels direction as
 *  "from" when the current concept was the row's from_concept_id (so it
 *  is the part) and "to" when the current concept was to_concept_id (so
 *  it is the whole) -- everything else (related_to/contrasts_with/
 *  commonly_confused_with) reads the same regardless of direction. */
function describeRelation(
  currentName: string,
  r: { concept: LibraryConcept; relation: LibraryConceptRelation; direction: "from" | "to" }
): string {
  const other = r.concept.name;
  if (r.relation.relation_type === "dimension_of") {
    return r.direction === "from" ? `${currentName} is a dimension of ${other}` : `${other} is a dimension of ${currentName}`;
  }
  if (r.relation.relation_type === "contrasts_with") return `Contrasts with ${other}`;
  if (r.relation.relation_type === "commonly_confused_with") return `Commonly confused with ${other}`;
  return `Related to ${other}`;
}

/** One historical source, attributed -- never voiced. The AVAIA-authored
 *  paraphrase is the primary content (it's the one field guaranteed
 *  publishable regardless of quotation rights); exact_text renders only
 *  when actually populated, as a clearly secondary, separately-set-off
 *  quotation, not the headline. No "At This Table" framing and no
 *  generated Then/Across Time/Now content -- this renders only what's
 *  already stored, nothing synthesized here. */
function HistoricalVoiceCard({ item }: { item: HistoricalPassage }) {
  const { person, work, sourceVersion, passage, note } = item;
  const personLabel = person.disambiguation
    ? `${person.canonical_name} (${person.disambiguation})`
    : person.canonical_name;

  return (
    <div className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4 backdrop-blur-sm">
      <p className="font-serif text-lg text-ink">{personLabel}</p>
      <p className="mt-1 text-sm text-muted">
        {work.title} · {passage.locator}
      </p>
      {(sourceVersion.version_label || sourceVersion.translator_editor) && (
        <p className="text-xs text-muted">
          {sourceVersion.version_label}
          {sourceVersion.translator_editor ? ` · trans. ${sourceVersion.translator_editor}` : ""}
        </p>
      )}

      {passage.avaia_paraphrase && <p className="mt-3 text-ink">{passage.avaia_paraphrase}</p>}

      {passage.exact_text && (
        <blockquote className="mt-3 border-l-2 border-seal/50 pl-4 font-serif italic leading-relaxed text-ink">
          &ldquo;{passage.exact_text}&rdquo;
        </blockquote>
      )}

      {passage.context_note && <p className="mt-3 text-sm text-muted">{passage.context_note}</p>}
      {note && <p className="mt-2 text-xs text-muted">{note}</p>}

      {sourceVersion.source_url && (
        <a
          href={sourceVersion.source_url}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-3 inline-block text-sm text-seal underline decoration-rule underline-offset-2"
        >
          View the source →
        </a>
      )}
    </div>
  );
}

/** A published concept's neighborhood -- generated entirely from
 *  published graph data (library_concepts/library_questions/
 *  library_entries and the published rows of their junction tables), not
 *  hard-coded per concept. This is the reusable presentation pattern for
 *  every future published Great Idea, not a one-off Connection page.
 *
 *  Draft/proposed material never reaches this page in two independent
 *  ways: RLS grants read access only to status = 'published' rows on
 *  every one of these tables, and every helper in lib/library-concepts.ts
 *  filters status = 'published' explicitly on top of that. A concept id
 *  that resolves to a draft (or doesn't exist) 404s via getConcept's own
 *  published-only lookup, the same way a draft/archived Library Entry
 *  already 404s on its own detail page.
 *
 *  Questions come only from library_question_concepts (a question
 *  editorially placed in this concept's own neighborhood) -- never
 *  derived by walking Concept -> Entries -> Entry Questions, which is a
 *  different relationship (a question a specific entry happens to
 *  touch) and would silently blend the two. */
export default async function ConceptPage({ params }: { params: { conceptId: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?from=/library/concepts/${params.conceptId}`);

  const concept = await getConcept(supabase, params.conceptId);
  if (!concept) notFound();

  const [questions, entries, related, historicalPassages] = await Promise.all([
    getQuestionsForConcept(supabase, concept.id),
    getEntriesForConcept(supabase, concept.id),
    getRelatedConcepts(supabase, concept.id),
    getPassagesForConcept(supabase, concept.id),
  ]);

  const distinctions = concept.distinctions.filter((d): d is string => typeof d === "string");
  const tensions = concept.tensions.filter((t): t is string => typeof t === "string");

  return (
    <div className="mx-auto max-w-prose px-5 py-16">
      <p className="mb-6">
        <Link href="/library" className="label hover:text-seal">
          ← Back to the Library
        </Link>
      </p>

      <p className="label mb-3">Library</p>
      <h1 className="font-serif text-4xl text-ink">{concept.name}</h1>
      {concept.description && (
        <p className="mt-4 text-lg leading-relaxed text-ink">{concept.description}</p>
      )}

      {distinctions.length > 0 && (
        <div className="mt-8">
          <p className="label mb-2 text-muted">Distinctions worth noticing</p>
          <p className="mb-3 text-sm text-muted">
            Perspectives to consider, not a description of what you meant.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-ink">
            {distinctions.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
      )}

      {tensions.length > 0 && (
        <div className="mt-8">
          <p className="label mb-2 text-muted">Tensions worth holding</p>
          <ul className="list-disc space-y-1 pl-5 text-ink">
            {tensions.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      {questions.length > 0 && (
        <div className="mt-8">
          <p className="label mb-2 text-muted">Questions in this neighborhood</p>
          <ul className="space-y-1">
            {questions.map(({ question }) => (
              <li key={question.id} className="text-sm italic text-ink">
                &ldquo;{question.question}&rdquo;
              </li>
            ))}
          </ul>
        </div>
      )}

      {entries.length > 0 && (
        <div className="mt-8">
          <p className="label mb-2 text-muted">Library entries</p>
          <div className="space-y-3">
            {entries.map(({ entry }) => (
              <EntryCard key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      )}

      {historicalPassages.length > 0 && (
        <div className="mt-8">
          <p className="label mb-2 text-muted">Historical voices</p>
          <div className="space-y-3">
            {historicalPassages.map((item) => (
              <HistoricalVoiceCard key={item.passage.id} item={item} />
            ))}
          </div>
        </div>
      )}

      {related.length > 0 && (
        <div className="mt-8">
          <p className="label mb-2 text-muted">Related ideas</p>
          <div className="flex flex-wrap gap-2">
            {related.map((r) => (
              <Link
                key={r.relation.id}
                href={`/library/concepts/${r.concept.id}`}
                className="rounded-full border border-rule px-3 py-0.5 text-xs text-ink transition-colors hover:border-seal"
                title={describeRelation(concept.name, r)}
              >
                {r.concept.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
