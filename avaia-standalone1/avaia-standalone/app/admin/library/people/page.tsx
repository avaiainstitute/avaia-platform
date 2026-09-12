import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import type { LibraryPerson } from "@/lib/library-passages";

export const metadata = { title: "People & Works, AVAIA Admin" };
export const dynamic = "force-dynamic";

/** Phase 4/5 of the Library completion work: the admin entry point for
 *  the historical-provenance chain (Person -> Work -> Source Version ->
 *  Passage). Uniqueness on (canonical_name, disambiguation) is enforced
 *  at the database level (0016_library_provenance.sql), a duplicate
 *  "Aristotle" surfaces as a plain insert error, not a silent no-op. */
async function createPerson(formData: FormData) {
  "use server";
  const supabase = createClient();
  await requireAdmin(supabase, "/admin/library/people");

  const canonical_name = String(formData.get("canonical_name") ?? "").trim();
  const disambiguation = String(formData.get("disambiguation") ?? "").trim();
  if (!canonical_name) redirect("/admin/library/people?createError=1");

  const { data: created, error } = await supabase
    .from("library_people")
    .insert({ canonical_name, disambiguation: disambiguation || null, status: "draft" })
    .select("id")
    .maybeSingle();
  if (error || !created) redirect("/admin/library/people?createError=1");

  redirect(`/admin/library/people/${created!.id}?created=1`);
}

export default async function AdminPeoplePage({
  searchParams,
}: {
  searchParams?: { createError?: string };
}) {
  const supabase = createClient();
  await requireAdmin(supabase, "/admin/library/people");

  const { data } = await supabase.from("library_people").select("*").order("canonical_name");
  const people = (data as LibraryPerson[]) ?? [];

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <p className="mb-6">
        <Link href="/admin/library" className="label hover:text-seal">
          ← Library Entries
        </Link>
      </p>
      <p className="label mb-3">AVAIA Admin</p>
      <h1 className="font-serif text-4xl text-ink">People &amp; Works</h1>
      <p className="mt-4 text-lg text-muted">
        The historical-provenance chain: a Person&rsquo;s Works, each Work&rsquo;s Source
        Versions, and each Version&rsquo;s Passages.
      </p>

      {searchParams?.createError && (
        <p className="mt-6 rounded-md border border-[#e0857d]/40 bg-[#e0857d]/[0.08] px-4 py-3 text-sm text-[#e0857d]">
          Could not create that person. A name is required, and the same name with the same
          disambiguation can only exist once.
        </p>
      )}

      <section className="rule-t mt-10 border-t border-rule pt-8">
        <p className="label mb-3 text-muted">Add Person</p>
        <form action={createPerson} className="flex flex-wrap gap-2">
          <input
            name="canonical_name" type="text" required placeholder="Canonical name"
            className="rounded-md border border-rule bg-white/[0.04] px-4 py-2.5 text-ink outline-none backdrop-blur-sm placeholder:text-muted focus:border-seal"
          />
          <input
            name="disambiguation" type="text" placeholder="Disambiguation (optional)"
            className="rounded-md border border-rule bg-white/[0.04] px-4 py-2.5 text-ink outline-none backdrop-blur-sm placeholder:text-muted focus:border-seal"
          />
          <button type="submit" className="rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90">
            Add
          </button>
        </form>
      </section>

      <section className="rule-t mt-10 border-t border-rule pt-8">
        <p className="label mb-3 text-muted">{people.length} {people.length === 1 ? "person" : "people"}</p>
        <div className="space-y-2">
          {people.map((p) => (
            <Link
              key={p.id}
              href={`/admin/library/people/${p.id}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-rule bg-white/[0.04] px-4 py-3 transition-colors hover:border-seal"
            >
              <p className="text-ink">{p.canonical_name}{p.disambiguation ? ` (${p.disambiguation})` : ""}</p>
              <span className="rounded-full border border-rule px-2.5 py-0.5 text-xs text-seal">{p.status}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
