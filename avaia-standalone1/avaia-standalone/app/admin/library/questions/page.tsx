import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import type { LibraryQuestion } from "@/lib/library-concepts";

export const metadata = { title: "Questions, AVAIA Admin" };
export const dynamic = "force-dynamic";

async function createQuestion(formData: FormData) {
  "use server";
  const supabase = createClient();
  await requireAdmin(supabase, "/admin/library/questions");

  const question = String(formData.get("question") ?? "").trim();
  if (!question) redirect("/admin/library/questions?createError=1");

  const { data: created, error } = await supabase
    .from("library_questions")
    .insert({ question, status: "draft" })
    .select("id")
    .maybeSingle();
  if (error || !created) redirect("/admin/library/questions?createError=1");

  redirect(`/admin/library/questions/${created!.id}?created=1`);
}

export default async function AdminQuestionsPage({
  searchParams,
}: {
  searchParams?: { createError?: string };
}) {
  const supabase = createClient();
  await requireAdmin(supabase, "/admin/library/questions");

  const { data } = await supabase.from("library_questions").select("*").order("created_at", { ascending: false });
  const questions = (data as LibraryQuestion[]) ?? [];

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <p className="mb-6">
        <Link href="/admin/library" className="label hover:text-seal">
          ← Library Entries
        </Link>
      </p>
      <p className="label mb-3">AVAIA Admin</p>
      <h1 className="font-serif text-4xl text-ink">Questions</h1>

      {searchParams?.createError && (
        <p className="mt-6 rounded-md border border-[#e0857d]/40 bg-[#e0857d]/[0.08] px-4 py-3 text-sm text-[#e0857d]">
          The question text is required.
        </p>
      )}

      <section className="rule-t mt-10 border-t border-rule pt-8">
        <p className="label mb-3 text-muted">Create Question</p>
        <form action={createQuestion} className="flex gap-2">
          <input
            name="question"
            type="text"
            required
            placeholder="A question worth carrying…"
            className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-2.5 text-ink outline-none backdrop-blur-sm placeholder:text-muted focus:border-seal"
          />
          <button
            type="submit"
            className="shrink-0 rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
          >
            Create
          </button>
        </form>
      </section>

      <section className="rule-t mt-10 border-t border-rule pt-8">
        <p className="label mb-3 text-muted">{questions.length} {questions.length === 1 ? "question" : "questions"}</p>
        <div className="space-y-2">
          {questions.map((q) => (
            <Link
              key={q.id}
              href={`/admin/library/questions/${q.id}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-rule bg-white/[0.04] px-4 py-3 transition-colors hover:border-seal"
            >
              <p className="text-ink">&ldquo;{q.question}&rdquo;</p>
              <span className="shrink-0 rounded-full border border-rule px-2.5 py-0.5 text-xs text-seal">{q.status}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
