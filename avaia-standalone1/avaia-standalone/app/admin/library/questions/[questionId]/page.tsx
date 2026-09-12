import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import type { LibraryQuestion } from "@/lib/library-concepts";

export const dynamic = "force-dynamic";

async function updateQuestion(formData: FormData) {
  "use server";
  const supabase = createClient();
  await requireAdmin(supabase, "/admin/library/questions");

  const id = String(formData.get("id") ?? "");
  const question = String(formData.get("question") ?? "").trim();
  const status = String(formData.get("status") ?? "draft");
  if (!id || !question) redirect(`/admin/library/questions/${id}`);
  if (status !== "draft" && status !== "published" && status !== "archived") {
    redirect(`/admin/library/questions/${id}`);
  }

  await supabase
    .from("library_questions")
    .update({ question, status, updated_at: new Date().toISOString() })
    .eq("id", id);
  redirect(`/admin/library/questions/${id}?saved=1`);
}

async function addConceptLink(formData: FormData) {
  "use server";
  const supabase = createClient();
  await requireAdmin(supabase, "/admin/library/questions");
  const questionId = String(formData.get("questionId") ?? "");
  const conceptId = String(formData.get("conceptId") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!questionId || !conceptId) redirect(`/admin/library/questions/${questionId}`);

  await supabase.from("library_question_concepts").insert({
    question_id: questionId,
    concept_id: conceptId,
    note: note || null,
    proposed_by: "editor",
    status: "published",
  });
  redirect(`/admin/library/questions/${questionId}?saved=1`);
}

async function removeConceptLink(formData: FormData) {
  "use server";
  const supabase = createClient();
  await requireAdmin(supabase, "/admin/library/questions");
  const questionId = String(formData.get("questionId") ?? "");
  const linkId = String(formData.get("linkId") ?? "");
  if (linkId) await supabase.from("library_question_concepts").delete().eq("id", linkId);
  redirect(`/admin/library/questions/${questionId}?saved=1`);
}

async function addEntryLink(formData: FormData) {
  "use server";
  const supabase = createClient();
  await requireAdmin(supabase, "/admin/library/questions");
  const questionId = String(formData.get("questionId") ?? "");
  const entryId = String(formData.get("entryId") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!questionId || !entryId) redirect(`/admin/library/questions/${questionId}`);

  await supabase.from("library_entry_questions").insert({
    library_entry_id: entryId,
    question_id: questionId,
    note: note || null,
    proposed_by: "editor",
    status: "published",
  });
  redirect(`/admin/library/questions/${questionId}?saved=1`);
}

async function removeEntryLink(formData: FormData) {
  "use server";
  const supabase = createClient();
  await requireAdmin(supabase, "/admin/library/questions");
  const questionId = String(formData.get("questionId") ?? "");
  const linkId = String(formData.get("linkId") ?? "");
  if (linkId) await supabase.from("library_entry_questions").delete().eq("id", linkId);
  redirect(`/admin/library/questions/${questionId}?saved=1`);
}

export default async function AdminQuestionEditPage({ params }: { params: { questionId: string } }) {
  const supabase = createClient();
  await requireAdmin(supabase, "/admin/library/questions");

  const { data } = await supabase.from("library_questions").select("*").eq("id", params.questionId).maybeSingle();
  const question = data as LibraryQuestion | null;
  if (!question) notFound();

  const [concepts, entries, conceptLinks, entryLinks] = await Promise.all([
    supabase.from("library_concepts").select("id, name").order("name"),
    supabase.from("library_entries").select("id, title").order("title"),
    supabase.from("library_question_concepts").select("id, concept_id, note, status").eq("question_id", question.id),
    supabase.from("library_entry_questions").select("id, library_entry_id, note, status").eq("question_id", question.id),
  ]);

  const conceptOptions = (concepts.data as { id: string; name: string }[]) ?? [];
  const entryOptions = (entries.data as { id: string; title: string }[]) ?? [];
  const conceptNameById = new Map(conceptOptions.map((c) => [c.id, c.name]));
  const entryTitleById = new Map(entryOptions.map((e) => [e.id, e.title]));
  const conceptLinkRows = (conceptLinks.data as { id: string; concept_id: string; note: string | null; status: string }[]) ?? [];
  const entryLinkRows = (entryLinks.data as { id: string; library_entry_id: string; note: string | null; status: string }[]) ?? [];

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <p className="mb-6">
        <Link href="/admin/library/questions" className="label hover:text-seal">
          ← Questions
        </Link>
      </p>
      <p className="label mb-3">AVAIA Admin</p>
      <h1 className="font-serif text-2xl text-ink">&ldquo;{question.question}&rdquo;</h1>

      <form action={updateQuestion} className="rule-t mt-10 space-y-4 border-t border-rule pt-8">
        <input type="hidden" name="id" value={question.id} />
        <div>
          <label className="label mb-2 block" htmlFor="question">Question</label>
          <textarea
            id="question" name="question" rows={2} required defaultValue={question.question}
            className="w-full resize-none rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
          />
        </div>
        <div>
          <label className="label mb-2 block" htmlFor="status">Status</label>
          <select
            id="status" name="status" defaultValue={question.status}
            className="rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
          >
            <option value="draft" className="bg-[#05060b] text-ink">Draft</option>
            <option value="published" className="bg-[#05060b] text-ink">Published</option>
            <option value="archived" className="bg-[#05060b] text-ink">Archived</option>
          </select>
        </div>
        <button type="submit" className="rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90">
          Save Question
        </button>
      </form>

      <section className="rule-t mt-12 border-t border-rule pt-8">
        <p className="label mb-3 text-muted">Concepts</p>
        <div className="space-y-2">
          {conceptLinkRows.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-3 rounded-md border border-rule bg-white/[0.04] px-4 py-2.5">
              <p className="text-sm text-ink">{conceptNameById.get(l.concept_id) ?? l.concept_id} <span className="text-muted">({l.status})</span></p>
              <form action={removeConceptLink}>
                <input type="hidden" name="questionId" value={question.id} />
                <input type="hidden" name="linkId" value={l.id} />
                <button type="submit" className="text-xs text-muted underline hover:text-seal">Remove</button>
              </form>
            </div>
          ))}
        </div>
        <form action={addConceptLink} className="mt-4 flex flex-wrap items-center gap-2">
          <input type="hidden" name="questionId" value={question.id} />
          <select name="conceptId" required className="rounded-md border border-rule bg-white/[0.04] px-3 py-2 text-sm text-ink outline-none focus:border-seal">
            <option value="" className="bg-[#05060b] text-ink">Choose a concept…</option>
            {conceptOptions.map((c) => (
              <option key={c.id} value={c.id} className="bg-[#05060b] text-ink">{c.name}</option>
            ))}
          </select>
          <input name="note" type="text" placeholder="Why (optional)" className="rounded-md border border-rule bg-white/[0.04] px-3 py-2 text-sm text-ink outline-none focus:border-seal" />
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
                <input type="hidden" name="questionId" value={question.id} />
                <input type="hidden" name="linkId" value={l.id} />
                <button type="submit" className="text-xs text-muted underline hover:text-seal">Remove</button>
              </form>
            </div>
          ))}
        </div>
        <form action={addEntryLink} className="mt-4 flex flex-wrap items-center gap-2">
          <input type="hidden" name="questionId" value={question.id} />
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
    </div>
  );
}
