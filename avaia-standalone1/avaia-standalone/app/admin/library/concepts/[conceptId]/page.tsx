import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import type { LibraryConcept, ConceptRelationType } from "@/lib/library-concepts";

export const dynamic = "force-dynamic";

const RELATION_TYPES: ConceptRelationType[] = ["related_to", "contrasts_with", "commonly_confused_with", "dimension_of"];

async function updateConcept(formData: FormData) {
  "use server";
  const supabase = createClient();
  await requireAdmin(supabase, "/admin/library/concepts");

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const status = String(formData.get("status") ?? "draft");
  const distinctions = String(formData.get("distinctions") ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const tensions = String(formData.get("tensions") ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const alternateTerms = String(formData.get("alternate_terms") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!id || !name) redirect(`/admin/library/concepts/${id}`);
  if (status !== "draft" && status !== "published" && status !== "archived") {
    redirect(`/admin/library/concepts/${id}`);
  }

  await supabase
    .from("library_concepts")
    .update({
      name,
      description: description || null,
      distinctions,
      tensions,
      alternate_terms: alternateTerms,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  redirect(`/admin/library/concepts/${id}?saved=1`);
}

async function addConceptRelation(formData: FormData) {
  "use server";
  const supabase = createClient();
  await requireAdmin(supabase, "/admin/library/concepts");

  const conceptId = String(formData.get("conceptId") ?? "");
  const toConceptId = String(formData.get("toConceptId") ?? "");
  const relationType = String(formData.get("relationType") ?? "related_to") as ConceptRelationType;
  if (!conceptId || !toConceptId || conceptId === toConceptId) redirect(`/admin/library/concepts/${conceptId}`);

  await supabase.from("library_concept_relations").insert({
    from_concept_id: conceptId,
    to_concept_id: toConceptId,
    relation_type: relationType,
    proposed_by: "editor",
    status: "published",
  });
  redirect(`/admin/library/concepts/${conceptId}?saved=1`);
}

async function removeConceptRelation(formData: FormData) {
  "use server";
  const supabase = createClient();
  await requireAdmin(supabase, "/admin/library/concepts");
  const conceptId = String(formData.get("conceptId") ?? "");
  const relationId = String(formData.get("relationId") ?? "");
  if (relationId) await supabase.from("library_concept_relations").delete().eq("id", relationId);
  redirect(`/admin/library/concepts/${conceptId}?saved=1`);
}

async function addEntryLink(formData: FormData) {
  "use server";
  const supabase = createClient();
  await requireAdmin(supabase, "/admin/library/concepts");
  const conceptId = String(formData.get("conceptId") ?? "");
  const entryId = String(formData.get("entryId") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!conceptId || !entryId) redirect(`/admin/library/concepts/${conceptId}`);

  await supabase.from("library_entry_concepts").insert({
    library_entry_id: entryId,
    concept_id: conceptId,
    note: note || null,
    proposed_by: "editor",
    status: "published",
  });
  redirect(`/admin/library/concepts/${conceptId}?saved=1`);
}

async function removeEntryLink(formData: FormData) {
  "use server";
  const supabase = createClient();
  await requireAdmin(supabase, "/admin/library/concepts");
  const conceptId = String(formData.get("conceptId") ?? "");
  const linkId = String(formData.get("linkId") ?? "");
  if (linkId) await supabase.from("library_entry_concepts").delete().eq("id", linkId);
  redirect(`/admin/library/concepts/${conceptId}?saved=1`);
}

async function addQuestionLink(formData: FormData) {
  "use server";
  const supabase = createClient();
  await requireAdmin(supabase, "/admin/library/concepts");
  const conceptId = String(formData.get("conceptId") ?? "");
  const questionId = String(formData.get("questionId") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!conceptId || !questionId) redirect(`/admin/library/concepts/${conceptId}`);

  await supabase.from("library_question_concepts").insert({
    question_id: questionId,
    concept_id: conceptId,
    note: note || null,
    proposed_by: "editor",
    status: "published",
  });
  redirect(`/admin/library/concepts/${conceptId}?saved=1`);
}

async function removeQuestionLink(formData: FormData) {
  "use server";
  const supabase = createClient();
  await requireAdmin(supabase, "/admin/library/concepts");
  const conceptId = String(formData.get("conceptId") ?? "");
  const linkId = String(formData.get("linkId") ?? "");
  if (linkId) await supabase.from("library_question_concepts").delete().eq("id", linkId);
  redirect(`/admin/library/concepts/${conceptId}?saved=1`);
}

export default async function AdminConceptEditPage({ params }: { params: { conceptId: string } }) {
  const supabase = createClient();
  await requireAdmin(supabase, "/admin/library/concepts");

  const { data } = await supabase.from("library_concepts").select("*").eq("id", params.conceptId).maybeSingle();
  const concept = data as LibraryConcept | null;
  if (!concept) notFound();

  const [allConcepts, allEntries, allQuestions, relations, entryLinks, questionLinks] = await Promise.all([
    supabase.from("library_concepts").select("id, name").neq("id", concept.id).order("name"),
    supabase.from("library_entries").select("id, title").order("title"),
    supabase.from("library_questions").select("id, question").order("question"),
    supabase
      .from("library_concept_relations")
      .select("*")
      .or(`from_concept_id.eq.${concept.id},to_concept_id.eq.${concept.id}`),
    supabase.from("library_entry_concepts").select("id, library_entry_id, note, status").eq("concept_id", concept.id),
    supabase.from("library_question_concepts").select("id, question_id, note, status").eq("concept_id", concept.id),
  ]);

  const conceptOptions = (allConcepts.data as { id: string; name: string }[]) ?? [];
  const entryOptions = (allEntries.data as { id: string; title: string }[]) ?? [];
  const questionOptions = (allQuestions.data as { id: string; question: string }[]) ?? [];
  const entryTitleById = new Map(entryOptions.map((e) => [e.id, e.title]));
  const questionTextById = new Map(questionOptions.map((q) => [q.id, q.question]));
  const conceptNameById = new Map(conceptOptions.map((c) => [c.id, c.name]));

  type Relation = { id: string; from_concept_id: string; to_concept_id: string; relation_type: ConceptRelationType; status: string };
  const relationRows = (relations.data as Relation[]) ?? [];
  const entryLinkRows = (entryLinks.data as { id: string; library_entry_id: string; note: string | null; status: string }[]) ?? [];
  const questionLinkRows = (questionLinks.data as { id: string; question_id: string; note: string | null; status: string }[]) ?? [];

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <p className="mb-6">
        <Link href="/admin/library/concepts" className="label hover:text-seal">
          ← Concepts
        </Link>
      </p>
      <p className="label mb-3">AVAIA Admin</p>
      <h1 className="font-serif text-4xl text-ink">{concept.name}</h1>

      <form action={updateConcept} className="rule-t mt-10 space-y-4 border-t border-rule pt-8">
        <input type="hidden" name="id" value={concept.id} />
        <div>
          <label className="label mb-2 block" htmlFor="name">Name</label>
          <input
            id="name" name="name" type="text" required defaultValue={concept.name}
            className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
          />
        </div>
        <div>
          <label className="label mb-2 block" htmlFor="description">Description</label>
          <textarea
            id="description" name="description" rows={3} defaultValue={concept.description ?? ""}
            className="w-full resize-none rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
          />
        </div>
        <div>
          <label className="label mb-2 block" htmlFor="alternate_terms">Alternate terms (comma-separated)</label>
          <input
            id="alternate_terms" name="alternate_terms" type="text"
            defaultValue={concept.alternate_terms.join(", ")}
            className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
          />
        </div>
        <div>
          <label className="label mb-2 block" htmlFor="distinctions">Distinctions worth noticing (one per line)</label>
          <textarea
            id="distinctions" name="distinctions" rows={3}
            defaultValue={concept.distinctions.filter((d): d is string => typeof d === "string").join("\n")}
            className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
          />
        </div>
        <div>
          <label className="label mb-2 block" htmlFor="tensions">Tensions worth holding (one per line)</label>
          <textarea
            id="tensions" name="tensions" rows={3}
            defaultValue={concept.tensions.filter((t): t is string => typeof t === "string").join("\n")}
            className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
          />
        </div>
        <div>
          <label className="label mb-2 block" htmlFor="status">Status</label>
          <select
            id="status" name="status" defaultValue={concept.status}
            className="rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
          >
            <option value="draft" className="bg-[#05060b] text-ink">Draft</option>
            <option value="published" className="bg-[#05060b] text-ink">Published</option>
            <option value="archived" className="bg-[#05060b] text-ink">Archived</option>
          </select>
        </div>
        <button
          type="submit"
          className="rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
        >
          Save Concept
        </button>
      </form>

      <section className="rule-t mt-12 border-t border-rule pt-8">
        <p className="label mb-3 text-muted">Related Concepts</p>
        <div className="space-y-2">
          {relationRows.map((r) => {
            const otherId = r.from_concept_id === concept.id ? r.to_concept_id : r.from_concept_id;
            const otherName = conceptNameById.get(otherId) ?? otherId;
            return (
              <div key={r.id} className="flex items-center justify-between gap-3 rounded-md border border-rule bg-white/[0.04] px-4 py-2.5">
                <p className="text-sm text-ink">{otherName} <span className="text-muted">({r.relation_type}, {r.status})</span></p>
                <form action={removeConceptRelation}>
                  <input type="hidden" name="conceptId" value={concept.id} />
                  <input type="hidden" name="relationId" value={r.id} />
                  <button type="submit" className="text-xs text-muted underline hover:text-seal">Remove</button>
                </form>
              </div>
            );
          })}
        </div>
        <form action={addConceptRelation} className="mt-4 flex flex-wrap items-center gap-2">
          <input type="hidden" name="conceptId" value={concept.id} />
          <select name="toConceptId" required className="rounded-md border border-rule bg-white/[0.04] px-3 py-2 text-sm text-ink outline-none focus:border-seal">
            <option value="" className="bg-[#05060b] text-ink">Choose a concept…</option>
            {conceptOptions.map((c) => (
              <option key={c.id} value={c.id} className="bg-[#05060b] text-ink">{c.name}</option>
            ))}
          </select>
          <select name="relationType" className="rounded-md border border-rule bg-white/[0.04] px-3 py-2 text-sm text-ink outline-none focus:border-seal">
            {RELATION_TYPES.map((t) => (
              <option key={t} value={t} className="bg-[#05060b] text-ink">{t}</option>
            ))}
          </select>
          <button type="submit" className="rounded-md border border-rule px-4 py-2 text-sm font-medium text-ink hover:border-seal">Link</button>
        </form>
      </section>

      <section className="rule-t mt-10 border-t border-rule pt-8">
        <p className="label mb-3 text-muted">Library Entries</p>
        <div className="space-y-2">
          {entryLinkRows.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-3 rounded-md border border-rule bg-white/[0.04] px-4 py-2.5">
              <p className="text-sm text-ink">{entryTitleById.get(l.library_entry_id) ?? l.library_entry_id} <span className="text-muted">({l.status})</span></p>
              <form action={removeEntryLink}>
                <input type="hidden" name="conceptId" value={concept.id} />
                <input type="hidden" name="linkId" value={l.id} />
                <button type="submit" className="text-xs text-muted underline hover:text-seal">Remove</button>
              </form>
            </div>
          ))}
        </div>
        <form action={addEntryLink} className="mt-4 flex flex-wrap items-center gap-2">
          <input type="hidden" name="conceptId" value={concept.id} />
          <select name="entryId" required className="rounded-md border border-rule bg-white/[0.04] px-3 py-2 text-sm text-ink outline-none focus:border-seal">
            <option value="" className="bg-[#05060b] text-ink">Choose an entry…</option>
            {entryOptions.map((e) => (
              <option key={e.id} value={e.id} className="bg-[#05060b] text-ink">{e.title}</option>
            ))}
          </select>
          <input name="note" type="text" placeholder="Why (optional)" className="rounded-md border border-rule bg-white/[0.04] px-3 py-2 text-sm text-ink outline-none focus:border-seal" />
          <button type="submit" className="rounded-md border border-rule px-4 py-2 text-sm font-medium text-ink hover:border-seal">Link</button>
        </form>
      </section>

      <section className="rule-t mt-10 border-t border-rule pt-8">
        <p className="label mb-3 text-muted">Questions</p>
        <div className="space-y-2">
          {questionLinkRows.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-3 rounded-md border border-rule bg-white/[0.04] px-4 py-2.5">
              <p className="text-sm text-ink">&ldquo;{questionTextById.get(l.question_id) ?? l.question_id}&rdquo; <span className="text-muted">({l.status})</span></p>
              <form action={removeQuestionLink}>
                <input type="hidden" name="conceptId" value={concept.id} />
                <input type="hidden" name="linkId" value={l.id} />
                <button type="submit" className="text-xs text-muted underline hover:text-seal">Remove</button>
              </form>
            </div>
          ))}
        </div>
        <form action={addQuestionLink} className="mt-4 flex flex-wrap items-center gap-2">
          <input type="hidden" name="conceptId" value={concept.id} />
          <select name="questionId" required className="rounded-md border border-rule bg-white/[0.04] px-3 py-2 text-sm text-ink outline-none focus:border-seal">
            <option value="" className="bg-[#05060b] text-ink">Choose a question…</option>
            {questionOptions.map((q) => (
              <option key={q.id} value={q.id} className="bg-[#05060b] text-ink">{q.question}</option>
            ))}
          </select>
          <input name="note" type="text" placeholder="Why (optional)" className="rounded-md border border-rule bg-white/[0.04] px-3 py-2 text-sm text-ink outline-none focus:border-seal" />
          <button type="submit" className="rounded-md border border-rule px-4 py-2 text-sm font-medium text-ink hover:border-seal">Link</button>
        </form>
      </section>

      <p className="mt-10 text-sm text-muted">
        Historical passages connect to this concept from the passage&rsquo;s own page, see{" "}
        <Link href="/admin/library/people" className="text-seal hover:opacity-80">People &amp; Works →</Link>.
      </p>
    </div>
  );
}
