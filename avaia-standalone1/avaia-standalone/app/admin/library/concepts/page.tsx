import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import type { LibraryConcept } from "@/lib/library-concepts";

export const metadata = { title: "Concepts, AVAIA Admin" };
export const dynamic = "force-dynamic";

const CREATE_ERROR_MESSAGE: Record<string, string> = {
  missing_fields: "Name is required.",
  insert_failed: "Could not create the concept. It may already exist.",
};

/** Phase 4 of the Library completion work: before this, all 9 concepts
 *  were created by direct SQL, there was no admin route at all. Mirrors
 *  app/admin/library/page.tsx's own create-then-edit pattern exactly:
 *  always created as draft, everything else (description, distinctions,
 *  tensions, relationships, publishing) happens on the concept's own
 *  edit page. */
async function createConcept(formData: FormData) {
  "use server";
  const supabase = createClient();
  await requireAdmin(supabase, "/admin/library/concepts");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect("/admin/library/concepts?createError=missing_fields");

  const { data: created, error } = await supabase
    .from("library_concepts")
    .insert({ name, status: "draft" })
    .select("id")
    .maybeSingle();
  if (error || !created) redirect("/admin/library/concepts?createError=insert_failed");

  redirect(`/admin/library/concepts/${created!.id}?created=1`);
}

export default async function AdminConceptsPage({
  searchParams,
}: {
  searchParams?: { createError?: string };
}) {
  const supabase = createClient();
  await requireAdmin(supabase, "/admin/library/concepts");

  const { data } = await supabase.from("library_concepts").select("*").order("name", { ascending: true });
  const concepts = (data as LibraryConcept[]) ?? [];
  const createError = searchParams?.createError ? CREATE_ERROR_MESSAGE[searchParams.createError] : null;

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <p className="mb-6">
        <Link href="/admin/library" className="label hover:text-seal">
          ← Library Entries
        </Link>
      </p>
      <p className="label mb-3">AVAIA Admin</p>
      <h1 className="font-serif text-4xl text-ink">Concepts</h1>
      <p className="mt-4 text-lg text-muted">
        The Library&rsquo;s cross-reference layer. A concept connects to entries, questions, and
        historical passages from its own page.
      </p>

      {createError && (
        <p className="mt-6 rounded-md border border-[#e0857d]/40 bg-[#e0857d]/[0.08] px-4 py-3 text-sm text-[#e0857d]">
          {createError}
        </p>
      )}

      <section className="rule-t mt-10 border-t border-rule pt-8">
        <p className="label mb-3 text-muted">Create Concept</p>
        <form action={createConcept} className="flex gap-2">
          <input
            name="name"
            type="text"
            required
            placeholder="Concept name"
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
        <p className="label mb-3 text-muted">{concepts.length} {concepts.length === 1 ? "concept" : "concepts"}</p>
        <div className="space-y-2">
          {concepts.map((c) => (
            <Link
              key={c.id}
              href={`/admin/library/concepts/${c.id}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-rule bg-white/[0.04] px-4 py-3 transition-colors hover:border-seal"
            >
              <p className="text-ink">{c.name}</p>
              <span className="rounded-full border border-rule px-2.5 py-0.5 text-xs text-seal">{c.status}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
