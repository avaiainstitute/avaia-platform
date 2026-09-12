import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import type {
  LibrarySourceVersion,
  LibraryWork,
  LibraryPassage,
  RightsStatus,
  VerificationStatus,
} from "@/lib/library-passages";
import type { ConceptStatus } from "@/lib/library-concepts";

export const dynamic = "force-dynamic";

const RIGHTS_STATUSES: RightsStatus[] = ["unreviewed", "public_domain", "permission_granted", "licensed", "restricted"];
const VERIFICATION_STATUSES: VerificationStatus[] = ["unverified", "partially_verified", "verified"];

async function updateSourceVersion(formData: FormData) {
  "use server";
  const supabase = createClient();
  await requireAdmin(supabase, "/admin/library/people");

  const id = String(formData.get("id") ?? "");
  const version_label = String(formData.get("version_label") ?? "").trim();
  const translator_editor = String(formData.get("translator_editor") ?? "").trim();
  const publisher = String(formData.get("publisher") ?? "").trim();
  const publication_year = String(formData.get("publication_year") ?? "").trim();
  const source_url = String(formData.get("source_url") ?? "").trim();
  const archive_source = String(formData.get("archive_source") ?? "").trim();
  const rights_status = String(formData.get("rights_status") ?? "unreviewed") as RightsStatus;
  const verification_status = String(formData.get("verification_status") ?? "unverified") as VerificationStatus;
  const status = String(formData.get("status") ?? "draft") as ConceptStatus;
  if (!id || !version_label) redirect(`/admin/library/source-versions/${id}`);
  if (!RIGHTS_STATUSES.includes(rights_status) || !VERIFICATION_STATUSES.includes(verification_status)) {
    redirect(`/admin/library/source-versions/${id}`);
  }
  if (status !== "draft" && status !== "published" && status !== "archived") {
    redirect(`/admin/library/source-versions/${id}`);
  }

  await supabase
    .from("library_source_versions")
    .update({
      version_label,
      translator_editor: translator_editor || null,
      publisher: publisher || null,
      publication_year: publication_year ? Number(publication_year) : null,
      source_url: source_url || null,
      archive_source: archive_source || null,
      rights_status,
      verification_status,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  redirect(`/admin/library/source-versions/${id}?saved=1`);
}

async function createPassage(formData: FormData) {
  "use server";
  const supabase = createClient();
  await requireAdmin(supabase, "/admin/library/people");
  const sourceVersionId = String(formData.get("sourceVersionId") ?? "");
  const locator = String(formData.get("locator") ?? "").trim();
  if (!sourceVersionId || !locator) redirect(`/admin/library/source-versions/${sourceVersionId}`);

  const { data: created } = await supabase
    .from("library_passages")
    .insert({
      source_version_id: sourceVersionId,
      locator,
      rights_status: "unreviewed",
      verification_status: "unverified",
      status: "draft",
    })
    .select("id")
    .maybeSingle();
  if (created) redirect(`/admin/library/passages/${created.id}?created=1`);
  redirect(`/admin/library/source-versions/${sourceVersionId}`);
}

export default async function AdminSourceVersionEditPage({ params }: { params: { versionId: string } }) {
  const supabase = createClient();
  await requireAdmin(supabase, "/admin/library/people");

  const { data } = await supabase.from("library_source_versions").select("*").eq("id", params.versionId).maybeSingle();
  const version = data as LibrarySourceVersion | null;
  if (!version) notFound();

  const [workRes, passagesRes] = await Promise.all([
    supabase.from("library_works").select("*").eq("id", version.work_id).maybeSingle(),
    supabase.from("library_passages").select("*").eq("source_version_id", version.id).order("locator"),
  ]);
  const work = workRes.data as LibraryWork | null;
  const passages = (passagesRes.data as LibraryPassage[]) ?? [];

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <p className="mb-6">
        <Link href={`/admin/library/works/${version.work_id}`} className="label hover:text-seal">
          ← {work?.title ?? "Work"}
        </Link>
      </p>
      <p className="label mb-3">AVAIA Admin</p>
      <h1 className="font-serif text-3xl text-ink">{version.version_label}</h1>

      <form action={updateSourceVersion} className="rule-t mt-10 space-y-4 border-t border-rule pt-8">
        <input type="hidden" name="id" value={version.id} />
        <div>
          <label className="label mb-2 block" htmlFor="version_label">Version label</label>
          <input id="version_label" name="version_label" type="text" required defaultValue={version.version_label} className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal" />
        </div>
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="label mb-2 block" htmlFor="translator_editor">Translator/editor</label>
            <input id="translator_editor" name="translator_editor" type="text" defaultValue={version.translator_editor ?? ""} className="rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal" />
          </div>
          <div>
            <label className="label mb-2 block" htmlFor="publisher">Publisher</label>
            <input id="publisher" name="publisher" type="text" defaultValue={version.publisher ?? ""} className="rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal" />
          </div>
          <div>
            <label className="label mb-2 block" htmlFor="publication_year">Publication year</label>
            <input id="publication_year" name="publication_year" type="number" defaultValue={version.publication_year ?? ""} className="w-32 rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal" />
          </div>
        </div>
        <div>
          <label className="label mb-2 block" htmlFor="source_url">Source URL</label>
          <input id="source_url" name="source_url" type="url" defaultValue={version.source_url ?? ""} className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal" />
        </div>
        <div>
          <label className="label mb-2 block" htmlFor="archive_source">Archive source</label>
          <input id="archive_source" name="archive_source" type="text" defaultValue={version.archive_source ?? ""} placeholder="Where this came from, e.g. Perseus Digital Library" className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm placeholder:text-muted focus:border-seal" />
        </div>
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="label mb-2 block" htmlFor="rights_status">Rights status</label>
            <select id="rights_status" name="rights_status" defaultValue={version.rights_status} className="rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal">
              {RIGHTS_STATUSES.map((s) => (
                <option key={s} value={s} className="bg-[#05060b] text-ink">{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label mb-2 block" htmlFor="verification_status">Verification status</label>
            <select id="verification_status" name="verification_status" defaultValue={version.verification_status} className="rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal">
              {VERIFICATION_STATUSES.map((s) => (
                <option key={s} value={s} className="bg-[#05060b] text-ink">{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label mb-2 block" htmlFor="status">Status</label>
            <select id="status" name="status" defaultValue={version.status} className="rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal">
              <option value="draft" className="bg-[#05060b] text-ink">Draft</option>
              <option value="published" className="bg-[#05060b] text-ink">Published</option>
              <option value="archived" className="bg-[#05060b] text-ink">Archived</option>
            </select>
          </div>
        </div>
        <p className="text-xs text-muted">
          A passage under this version still needs its own rights/verification/publish status
          set correctly before it can reach a Host or Guide; publishing the version alone does
          not publish its passages.
        </p>
        <button type="submit" className="rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90">
          Save Source Version
        </button>
      </form>

      <section className="rule-t mt-12 border-t border-rule pt-8">
        <p className="label mb-3 text-muted">Passages</p>
        <div className="space-y-2">
          {passages.map((p) => (
            <Link
              key={p.id}
              href={`/admin/library/passages/${p.id}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-rule bg-white/[0.04] px-4 py-3 transition-colors hover:border-seal"
            >
              <p className="text-ink">{p.locator}</p>
              <span className="rounded-full border border-rule px-2.5 py-0.5 text-xs text-seal">{p.status}</span>
            </Link>
          ))}
        </div>
        <form action={createPassage} className="mt-4 flex flex-wrap gap-2">
          <input type="hidden" name="sourceVersionId" value={version.id} />
          <input name="locator" type="text" required placeholder="Locator (e.g. Book VIII.2, 1155b31)" className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-2.5 text-ink outline-none backdrop-blur-sm placeholder:text-muted focus:border-seal" />
          <button type="submit" className="shrink-0 rounded-md border border-rule px-4 py-2.5 text-sm font-medium text-ink hover:border-seal">Add Passage</button>
        </form>
      </section>
    </div>
  );
}
