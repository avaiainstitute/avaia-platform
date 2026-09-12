import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import type { LibraryWork, LibraryPerson, LibrarySourceVersion } from "@/lib/library-passages";

export const dynamic = "force-dynamic";

async function updateWork(formData: FormData) {
  "use server";
  const supabase = createClient();
  await requireAdmin(supabase, "/admin/library/people");

  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const original_date_text = String(formData.get("original_date_text") ?? "").trim();
  const work_type = String(formData.get("work_type") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const status = String(formData.get("status") ?? "draft");
  if (!id || !title) redirect(`/admin/library/works/${id}`);
  if (status !== "draft" && status !== "published" && status !== "archived") redirect(`/admin/library/works/${id}`);

  await supabase
    .from("library_works")
    .update({
      title,
      original_date_text: original_date_text || null,
      work_type: work_type || null,
      description: description || null,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  redirect(`/admin/library/works/${id}?saved=1`);
}

async function createSourceVersion(formData: FormData) {
  "use server";
  const supabase = createClient();
  await requireAdmin(supabase, "/admin/library/people");
  const workId = String(formData.get("workId") ?? "");
  const version_label = String(formData.get("version_label") ?? "").trim();
  if (!workId || !version_label) redirect(`/admin/library/works/${workId}`);

  const { data: created } = await supabase
    .from("library_source_versions")
    .insert({
      work_id: workId,
      version_label,
      rights_status: "unreviewed",
      verification_status: "unverified",
      status: "draft",
    })
    .select("id")
    .maybeSingle();
  if (created) redirect(`/admin/library/source-versions/${created.id}?created=1`);
  redirect(`/admin/library/works/${workId}`);
}

export default async function AdminWorkEditPage({ params }: { params: { workId: string } }) {
  const supabase = createClient();
  await requireAdmin(supabase, "/admin/library/people");

  const { data } = await supabase.from("library_works").select("*").eq("id", params.workId).maybeSingle();
  const work = data as LibraryWork | null;
  if (!work) notFound();

  const [personRes, versionsRes] = await Promise.all([
    supabase.from("library_people").select("*").eq("id", work.person_id).maybeSingle(),
    supabase.from("library_source_versions").select("*").eq("work_id", work.id).order("version_label"),
  ]);
  const person = personRes.data as LibraryPerson | null;
  const versions = (versionsRes.data as LibrarySourceVersion[]) ?? [];

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <p className="mb-6">
        <Link href={`/admin/library/people/${work.person_id}`} className="label hover:text-seal">
          ← {person?.canonical_name ?? "Person"}
        </Link>
      </p>
      <p className="label mb-3">AVAIA Admin</p>
      <h1 className="font-serif text-4xl text-ink">{work.title}</h1>

      <form action={updateWork} className="rule-t mt-10 space-y-4 border-t border-rule pt-8">
        <input type="hidden" name="id" value={work.id} />
        <div>
          <label className="label mb-2 block" htmlFor="title">Title</label>
          <input id="title" name="title" type="text" required defaultValue={work.title} className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal" />
        </div>
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="label mb-2 block" htmlFor="work_type">Type</label>
            <input id="work_type" name="work_type" type="text" defaultValue={work.work_type ?? ""} className="rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal" />
          </div>
          <div>
            <label className="label mb-2 block" htmlFor="original_date_text">Original date</label>
            <input id="original_date_text" name="original_date_text" type="text" defaultValue={work.original_date_text ?? ""} placeholder="e.g. c. 350 BCE" className="rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm placeholder:text-muted focus:border-seal" />
          </div>
        </div>
        <div>
          <label className="label mb-2 block" htmlFor="description">Description</label>
          <textarea id="description" name="description" rows={3} defaultValue={work.description ?? ""} className="w-full resize-none rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal" />
        </div>
        <div>
          <label className="label mb-2 block" htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={work.status} className="rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal">
            <option value="draft" className="bg-[#05060b] text-ink">Draft</option>
            <option value="published" className="bg-[#05060b] text-ink">Published</option>
            <option value="archived" className="bg-[#05060b] text-ink">Archived</option>
          </select>
        </div>
        <button type="submit" className="rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90">
          Save Work
        </button>
      </form>

      <section className="rule-t mt-12 border-t border-rule pt-8">
        <p className="label mb-3 text-muted">Source Versions</p>
        <div className="space-y-2">
          {versions.map((v) => (
            <Link
              key={v.id}
              href={`/admin/library/source-versions/${v.id}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-rule bg-white/[0.04] px-4 py-3 transition-colors hover:border-seal"
            >
              <p className="text-ink">{v.version_label}</p>
              <span className="rounded-full border border-rule px-2.5 py-0.5 text-xs text-seal">{v.status}</span>
            </Link>
          ))}
        </div>
        <form action={createSourceVersion} className="mt-4 flex flex-wrap gap-2">
          <input type="hidden" name="workId" value={work.id} />
          <input name="version_label" type="text" required placeholder="Version label (e.g. translator/publisher)" className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-2.5 text-ink outline-none backdrop-blur-sm placeholder:text-muted focus:border-seal" />
          <button type="submit" className="shrink-0 rounded-md border border-rule px-4 py-2.5 text-sm font-medium text-ink hover:border-seal">Add Version</button>
        </form>
      </section>
    </div>
  );
}
