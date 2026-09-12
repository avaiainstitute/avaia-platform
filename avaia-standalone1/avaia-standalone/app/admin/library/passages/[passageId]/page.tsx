import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import type { LibraryPassage, LibrarySourceVersion, LibraryWork, RightsStatus, VerificationStatus } from "@/lib/library-passages";

export const dynamic = "force-dynamic";

const RIGHTS_STATUSES: RightsStatus[] = ["unreviewed", "public_domain", "permission_granted", "licensed", "restricted"];
const VERIFICATION_STATUSES: VerificationStatus[] = ["unverified", "partially_verified", "verified"];

/** The one place a passage's exact_text (verbatim quotation) and
 *  avaia_paraphrase (AVAIA's own explanation) are edited, deliberately
 *  kept as two separate fields, never merged, matching the discipline
 *  already demonstrated in the existing Aristotle/Plato/MLK/Oprah/Tao Te
 *  Ching records this admin surface was built to make manageable
 *  without SQL. Publishing here does NOT check rights/verification
 *  status and block it -- the work order is explicit that the admin's
 *  own judgment governs, not a hard rule -- but the form surfaces a
 *  clear warning rather than a silent, easy-to-miss default, so nothing
 *  currently-withheld becomes visible by accident. */
async function updatePassage(formData: FormData) {
  "use server";
  const supabase = createClient();
  await requireAdmin(supabase, "/admin/library/people");

  const id = String(formData.get("id") ?? "");
  const locator = String(formData.get("locator") ?? "").trim();
  const exact_text = String(formData.get("exact_text") ?? "").trim();
  const avaia_paraphrase = String(formData.get("avaia_paraphrase") ?? "").trim();
  const context_note = String(formData.get("context_note") ?? "").trim();
  const rights_status = String(formData.get("rights_status") ?? "unreviewed") as RightsStatus;
  const verification_status = String(formData.get("verification_status") ?? "unverified") as VerificationStatus;
  const status = String(formData.get("status") ?? "draft");
  if (!id || !locator) redirect(`/admin/library/passages/${id}`);
  if (!RIGHTS_STATUSES.includes(rights_status) || !VERIFICATION_STATUSES.includes(verification_status)) {
    redirect(`/admin/library/passages/${id}`);
  }
  if (status !== "draft" && status !== "published" && status !== "archived") redirect(`/admin/library/passages/${id}`);

  await supabase
    .from("library_passages")
    .update({
      locator,
      exact_text: exact_text || null,
      avaia_paraphrase: avaia_paraphrase || null,
      context_note: context_note || null,
      rights_status,
      verification_status,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  redirect(`/admin/library/passages/${id}?saved=1`);
}

async function addConceptLink(formData: FormData) {
  "use server";
  const supabase = createClient();
  await requireAdmin(supabase, "/admin/library/people");
  const passageId = String(formData.get("passageId") ?? "");
  const conceptId = String(formData.get("conceptId") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!passageId || !conceptId) redirect(`/admin/library/passages/${passageId}`);

  await supabase.from("library_passage_concepts").insert({
    passage_id: passageId,
    concept_id: conceptId,
    note: note || null,
    proposed_by: "editor",
    status: "published",
  });
  redirect(`/admin/library/passages/${passageId}?saved=1`);
}

async function removeConceptLink(formData: FormData) {
  "use server";
  const supabase = createClient();
  await requireAdmin(supabase, "/admin/library/people");
  const passageId = String(formData.get("passageId") ?? "");
  const linkId = String(formData.get("linkId") ?? "");
  if (linkId) await supabase.from("library_passage_concepts").delete().eq("id", linkId);
  redirect(`/admin/library/passages/${passageId}?saved=1`);
}

export default async function AdminPassageEditPage({ params }: { params: { passageId: string } }) {
  const supabase = createClient();
  await requireAdmin(supabase, "/admin/library/people");

  const { data } = await supabase.from("library_passages").select("*").eq("id", params.passageId).maybeSingle();
  const passage = data as LibraryPassage | null;
  if (!passage) notFound();

  const [versionRes, conceptsRes, linksRes] = await Promise.all([
    supabase.from("library_source_versions").select("*").eq("id", passage.source_version_id).maybeSingle(),
    supabase.from("library_concepts").select("id, name").order("name"),
    supabase.from("library_passage_concepts").select("id, concept_id, note, status").eq("passage_id", passage.id),
  ]);
  const version = versionRes.data as LibrarySourceVersion | null;
  const work = version
    ? ((await supabase.from("library_works").select("*").eq("id", version.work_id).maybeSingle()).data as LibraryWork | null)
    : null;
  const conceptOptions = (conceptsRes.data as { id: string; name: string }[]) ?? [];
  const conceptNameById = new Map(conceptOptions.map((c) => [c.id, c.name]));
  const linkRows = (linksRes.data as { id: string; concept_id: string; note: string | null; status: string }[]) ?? [];

  const notReadyToPublish = passage.verification_status !== "verified" || passage.rights_status === "restricted" || passage.rights_status === "unreviewed";

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <p className="mb-6">
        <Link href={`/admin/library/source-versions/${passage.source_version_id}`} className="label hover:text-seal">
          ← {version?.version_label ?? "Source Version"}
        </Link>
      </p>
      <p className="label mb-3">AVAIA Admin</p>
      <h1 className="font-serif text-2xl text-ink">{work?.title ? `${work.title}, ` : ""}{passage.locator}</h1>

      <form action={updatePassage} className="rule-t mt-10 space-y-4 border-t border-rule pt-8">
        <input type="hidden" name="id" value={passage.id} />
        <div>
          <label className="label mb-2 block" htmlFor="locator">Locator</label>
          <input id="locator" name="locator" type="text" required defaultValue={passage.locator} className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal" />
        </div>
        <div>
          <label className="label mb-2 block" htmlFor="exact_text">Exact quotation</label>
          <textarea id="exact_text" name="exact_text" rows={3} defaultValue={passage.exact_text ?? ""} placeholder="The verbatim source text, only if you can confirm it word-for-word" className="w-full resize-none rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm placeholder:text-muted focus:border-seal" />
        </div>
        <div>
          <label className="label mb-2 block" htmlFor="avaia_paraphrase">AVAIA paraphrase</label>
          <textarea id="avaia_paraphrase" name="avaia_paraphrase" rows={3} defaultValue={passage.avaia_paraphrase ?? ""} placeholder="AVAIA's own explanation, kept separate from the quotation above" className="w-full resize-none rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm placeholder:text-muted focus:border-seal" />
        </div>
        <div>
          <label className="label mb-2 block" htmlFor="context_note">Context note</label>
          <textarea id="context_note" name="context_note" rows={2} defaultValue={passage.context_note ?? ""} placeholder="Editorial context about the passage itself, e.g. what it's useful for or a caution about it" className="w-full resize-none rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm placeholder:text-muted focus:border-seal" />
        </div>
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="label mb-2 block" htmlFor="rights_status">Rights status</label>
            <select id="rights_status" name="rights_status" defaultValue={passage.rights_status} className="rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal">
              {RIGHTS_STATUSES.map((s) => (
                <option key={s} value={s} className="bg-[#05060b] text-ink">{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label mb-2 block" htmlFor="verification_status">Verification status</label>
            <select id="verification_status" name="verification_status" defaultValue={passage.verification_status} className="rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal">
              {VERIFICATION_STATUSES.map((s) => (
                <option key={s} value={s} className="bg-[#05060b] text-ink">{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label mb-2 block" htmlFor="status">Status</label>
            <select id="status" name="status" defaultValue={passage.status} className="rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal">
              <option value="draft" className="bg-[#05060b] text-ink">Draft</option>
              <option value="published" className="bg-[#05060b] text-ink">Published</option>
              <option value="archived" className="bg-[#05060b] text-ink">Archived</option>
            </select>
          </div>
        </div>
        {notReadyToPublish && passage.status !== "published" && (
          <p className="rounded-md border border-[#e0857d]/40 bg-[#e0857d]/[0.08] px-4 py-3 text-sm text-[#e0857d]">
            This passage is not yet verified, or its rights status is unreviewed or restricted.
            Publishing it makes it visible to every Host and Guide, the same editorial bar
            already held for Aristotle&rsquo;s published passages. Confirm rights and
            verification before publishing.
          </p>
        )}
        <button type="submit" className="rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90">
          Save Passage
        </button>
      </form>

      <section className="rule-t mt-12 border-t border-rule pt-8">
        <p className="label mb-3 text-muted">Concepts</p>
        <div className="space-y-2">
          {linkRows.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-3 rounded-md border border-rule bg-white/[0.04] px-4 py-2.5">
              <p className="text-sm text-ink">{conceptNameById.get(l.concept_id) ?? l.concept_id} <span className="text-muted">({l.status})</span></p>
              <form action={removeConceptLink}>
                <input type="hidden" name="passageId" value={passage.id} />
                <input type="hidden" name="linkId" value={l.id} />
                <button type="submit" className="text-xs text-muted underline hover:text-seal">Remove</button>
              </form>
            </div>
          ))}
        </div>
        <form action={addConceptLink} className="mt-4 flex flex-wrap items-center gap-2">
          <input type="hidden" name="passageId" value={passage.id} />
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
    </div>
  );
}
