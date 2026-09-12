import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import type { LibraryPerson, LibraryWork } from "@/lib/library-passages";

export const dynamic = "force-dynamic";

async function updatePerson(formData: FormData) {
  "use server";
  const supabase = createClient();
  await requireAdmin(supabase, "/admin/library/people");

  const id = String(formData.get("id") ?? "");
  const canonical_name = String(formData.get("canonical_name") ?? "").trim();
  const disambiguation = String(formData.get("disambiguation") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const birth_year = String(formData.get("birth_year") ?? "").trim();
  const death_year = String(formData.get("death_year") ?? "").trim();
  const status = String(formData.get("status") ?? "draft");
  if (!id || !canonical_name) redirect(`/admin/library/people/${id}`);
  if (status !== "draft" && status !== "published" && status !== "archived") {
    redirect(`/admin/library/people/${id}`);
  }

  await supabase
    .from("library_people")
    .update({
      canonical_name,
      disambiguation: disambiguation || null,
      description: description || null,
      birth_year: birth_year ? Number(birth_year) : null,
      death_year: death_year ? Number(death_year) : null,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  redirect(`/admin/library/people/${id}?saved=1`);
}

async function createWork(formData: FormData) {
  "use server";
  const supabase = createClient();
  await requireAdmin(supabase, "/admin/library/people");
  const personId = String(formData.get("personId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const work_type = String(formData.get("work_type") ?? "").trim();
  if (!personId || !title) redirect(`/admin/library/people/${personId}`);

  const { data: created } = await supabase
    .from("library_works")
    .insert({ person_id: personId, title, work_type: work_type || null, status: "draft" })
    .select("id")
    .maybeSingle();
  if (created) redirect(`/admin/library/works/${created.id}?created=1`);
  redirect(`/admin/library/people/${personId}`);
}

export default async function AdminPersonEditPage({ params }: { params: { personId: string } }) {
  const supabase = createClient();
  await requireAdmin(supabase, "/admin/library/people");

  const { data } = await supabase.from("library_people").select("*").eq("id", params.personId).maybeSingle();
  const person = data as LibraryPerson | null;
  if (!person) notFound();

  const { data: worksData } = await supabase.from("library_works").select("*").eq("person_id", person.id).order("title");
  const works = (worksData as LibraryWork[]) ?? [];

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <p className="mb-6">
        <Link href="/admin/library/people" className="label hover:text-seal">
          ← People &amp; Works
        </Link>
      </p>
      <p className="label mb-3">AVAIA Admin</p>
      <h1 className="font-serif text-4xl text-ink">{person.canonical_name}</h1>

      <form action={updatePerson} className="rule-t mt-10 space-y-4 border-t border-rule pt-8">
        <input type="hidden" name="id" value={person.id} />
        <div>
          <label className="label mb-2 block" htmlFor="canonical_name">Canonical name</label>
          <input
            id="canonical_name" name="canonical_name" type="text" required defaultValue={person.canonical_name}
            className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
          />
        </div>
        <div>
          <label className="label mb-2 block" htmlFor="disambiguation">Disambiguation</label>
          <input
            id="disambiguation" name="disambiguation" type="text" defaultValue={person.disambiguation ?? ""}
            placeholder="e.g. philosopher, to distinguish from another person of the same name"
            className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm placeholder:text-muted focus:border-seal"
          />
        </div>
        <div>
          <label className="label mb-2 block" htmlFor="description">Description</label>
          <textarea
            id="description" name="description" rows={3} defaultValue={person.description ?? ""}
            className="w-full resize-none rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
          />
        </div>
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="label mb-2 block" htmlFor="birth_year">Birth year</label>
            <input
              id="birth_year" name="birth_year" type="number" defaultValue={person.birth_year ?? ""}
              className="w-40 rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
            />
          </div>
          <div>
            <label className="label mb-2 block" htmlFor="death_year">Death year</label>
            <input
              id="death_year" name="death_year" type="number" defaultValue={person.death_year ?? ""}
              className="w-40 rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
            />
          </div>
        </div>
        <div>
          <label className="label mb-2 block" htmlFor="status">Status</label>
          <select
            id="status" name="status" defaultValue={person.status}
            className="rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
          >
            <option value="draft" className="bg-[#05060b] text-ink">Draft</option>
            <option value="published" className="bg-[#05060b] text-ink">Published</option>
            <option value="archived" className="bg-[#05060b] text-ink">Archived</option>
          </select>
          <p className="mt-2 text-xs text-muted">
            Published here only makes this person&rsquo;s own record visible. A quotation still
            needs its own Work, Source Version, and Passage each published in turn before any
            Host or Guide can see it.
          </p>
        </div>
        <button type="submit" className="rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90">
          Save Person
        </button>
      </form>

      <section className="rule-t mt-12 border-t border-rule pt-8">
        <p className="label mb-3 text-muted">Works</p>
        <div className="space-y-2">
          {works.map((w) => (
            <Link
              key={w.id}
              href={`/admin/library/works/${w.id}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-rule bg-white/[0.04] px-4 py-3 transition-colors hover:border-seal"
            >
              <p className="text-ink">{w.title}</p>
              <span className="rounded-full border border-rule px-2.5 py-0.5 text-xs text-seal">{w.status}</span>
            </Link>
          ))}
        </div>
        <form action={createWork} className="mt-4 flex flex-wrap gap-2">
          <input type="hidden" name="personId" value={person.id} />
          <input name="title" type="text" required placeholder="Work title" className="rounded-md border border-rule bg-white/[0.04] px-4 py-2.5 text-ink outline-none backdrop-blur-sm placeholder:text-muted focus:border-seal" />
          <input name="work_type" type="text" placeholder="Type (e.g. philosophical work, speech)" className="rounded-md border border-rule bg-white/[0.04] px-4 py-2.5 text-ink outline-none backdrop-blur-sm placeholder:text-muted focus:border-seal" />
          <button type="submit" className="rounded-md border border-rule px-4 py-2.5 text-sm font-medium text-ink hover:border-seal">Add Work</button>
        </form>
      </section>
    </div>
  );
}
