import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  type LibraryEntry,
  type VirtueTag,
  PROGRAM_KEYS,
  PROGRAM_LABEL,
  JOURNEY_STAGES,
  JOURNEY_STAGE_LABEL,
  SECONDARY_LOSS_NAMES,
  validateVirtueTag,
} from "@/lib/library";
import { VIRTUE_FAMILIES } from "@/lib/virtues";

export const dynamic = "force-dynamic";

const EDIT_ERROR_MESSAGE: Record<string, string> = {
  missing_fields: "Title, Great Idea, and Overview are all required.",
  invalid_content_type: "Choose a valid content type.",
  invalid_status: "Choose a valid status.",
  invalid_visibility: "Choose a valid visibility.",
  invalid_virtue: "One of the virtue rows doesn't match a real Chemistry of Virtue element. Fix or clear it.",
  update_failed: "Could not save. Please try again.",
};

/** Every editable field already belongs to library_entries (Living Library
 *  audit, Section C) -- nothing invented here. Provenance (Voice -> Work ->
 *  Source Version -> Passage) stays deliberately untouched: that chain
 *  connects to Concepts, never to library_entries directly, and this pass
 *  doesn't redesign that architecture. Taxonomy fields (Secondary Losses,
 *  virtues, programs, Journey stages) are always validated against the
 *  same canonical sources every other AVAIA surface uses -- never a
 *  free-typed duplicate. */
async function updateLibraryEntry(formData: FormData) {
  "use server";
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/admin/library");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") redirect("/");

  const entryId = String(formData.get("entryId") ?? "");
  if (!entryId) redirect("/admin/library");

  const title = String(formData.get("title") ?? "").trim();
  const great_idea = String(formData.get("great_idea") ?? "").trim();
  const overview = String(formData.get("overview") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const content_type = String(formData.get("content_type") ?? "");
  const external_url = String(formData.get("external_url") ?? "").trim();
  const external_author = String(formData.get("external_author") ?? "").trim();
  const external_description = String(formData.get("external_description") ?? "").trim();
  const status = String(formData.get("status") ?? "");
  const visibility = String(formData.get("visibility") ?? "");
  const tagsRaw = String(formData.get("tags") ?? "");

  if (!title || !great_idea || !overview) {
    redirect(`/admin/library/${entryId}?editError=missing_fields`);
  }
  if (content_type !== "avaia-owned" && content_type !== "external-resource") {
    redirect(`/admin/library/${entryId}?editError=invalid_content_type`);
  }
  if (status !== "draft" && status !== "published" && status !== "archived") {
    redirect(`/admin/library/${entryId}?editError=invalid_status`);
  }
  if (visibility !== "public" && visibility !== "member") {
    redirect(`/admin/library/${entryId}?editError=invalid_visibility`);
  }

  const tags = tagsRaw.split(",").map((t) => t.trim()).filter(Boolean);

  // Every taxonomy value is re-validated server-side against its own
  // canonical source, never trusted from the posted checkbox values alone
  // -- the same discipline every prompt-composition layer in this app
  // already follows for these exact taxonomies.
  const programs = formData.getAll("programs").map(String).filter((p) => (PROGRAM_KEYS as string[]).includes(p));
  const journey_stages = formData
    .getAll("journey_stages")
    .map(String)
    .filter((s) => (JOURNEY_STAGES as string[]).includes(s));
  const secondary_losses = formData
    .getAll("secondary_losses")
    .map(String)
    .filter((s) => SECONDARY_LOSS_NAMES.includes(s));

  const virtueFamilies = formData.getAll("virtueFamily").map(String);
  const virtueElements = formData.getAll("virtueElement").map(String);
  const virtues: VirtueTag[] = [];
  for (let i = 0; i < virtueFamilies.length; i++) {
    const fam = virtueFamilies[i];
    if (!fam) continue;
    const el = virtueElements[i]?.trim() || null;
    const tag = validateVirtueTag(fam, el);
    if (!tag) redirect(`/admin/library/${entryId}?editError=invalid_virtue`);
    virtues.push(tag!);
  }

  const isExternal = content_type === "external-resource";

  const { data: updated, error } = await supabase
    .from("library_entries")
    .update({
      title,
      great_idea,
      overview,
      body: body || null,
      content_type,
      external_url: isExternal ? external_url || null : null,
      external_author: isExternal ? external_author || null : null,
      external_description: isExternal ? external_description || null : null,
      status,
      visibility,
      tags,
      programs,
      journey_stages,
      secondary_losses,
      virtues,
      editor_id: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", entryId)
    .select("id")
    .maybeSingle();

  if (error || !updated) {
    redirect(`/admin/library/${entryId}?editError=update_failed`);
  }

  redirect(`/admin/library/${entryId}?updated=1`);
}

const selectClass =
  "w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal";
const inputClass = selectClass;
const optionClass = "bg-[#05060b] text-ink";

export default async function AdminLibraryEntryPage({
  params,
  searchParams,
}: {
  params: { entryId: string };
  searchParams?: { updated?: string; created?: string; editError?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/admin/library");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") redirect("/");

  const { data: entryData } = await supabase
    .from("library_entries")
    .select("*")
    .eq("id", params.entryId)
    .maybeSingle();
  if (!entryData) notFound();
  const entry = entryData as LibraryEntry;

  const editError = searchParams?.editError ? EDIT_ERROR_MESSAGE[searchParams.editError] : null;
  const showSuccess = searchParams?.updated === "1" || searchParams?.created === "1";

  // Fixed-row virtue editor -- no dynamic add-row JS in this pass (no
  // multi-select/array-input precedent existed anywhere in this codebase
  // before this page; see the audit's admin-architecture research). Pads
  // to at least 4 rows so there's always room to add without saving first.
  const virtueRows: (VirtueTag | { family: ""; element: null })[] = [...entry.virtues];
  while (virtueRows.length < Math.max(entry.virtues.length + 2, 4)) {
    virtueRows.push({ family: "", element: null });
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <p className="mb-6">
        <Link href="/admin/library" className="label hover:text-seal">
          ← Back to Library Admin
        </Link>
      </p>
      <p className="label mb-3">AVAIA Admin</p>
      <h1 className="font-serif text-4xl text-ink">{entry.title}</h1>

      {showSuccess && (
        <p className="mt-6 rounded-md border border-seal/40 bg-seal/[0.06] px-4 py-3 text-sm text-ink">
          Saved.
        </p>
      )}
      {editError && (
        <p className="mt-6 rounded-md border border-[#e0857d]/40 bg-[#e0857d]/[0.08] px-4 py-3 text-sm text-[#e0857d]">
          {editError}
        </p>
      )}

      <form action={updateLibraryEntry} className="mt-8 space-y-8">
        <input type="hidden" name="entryId" value={entry.id} />

        <section className="rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm">
          <p className="label mb-4 text-muted">Content</p>
          <div>
            <label className="label mb-2 block" htmlFor="title">Title</label>
            <input id="title" name="title" type="text" required defaultValue={entry.title} className={inputClass} />
          </div>
          <div className="mt-4">
            <label className="label mb-2 block" htmlFor="great_idea">Great Idea</label>
            <input
              id="great_idea" name="great_idea" type="text" required defaultValue={entry.great_idea}
              className={inputClass}
            />
          </div>
          <div className="mt-4">
            <label className="label mb-2 block" htmlFor="overview">Overview</label>
            <textarea
              id="overview" name="overview" rows={2} required defaultValue={entry.overview}
              className={`${inputClass} resize-none`}
            />
          </div>
          <div className="mt-4">
            <label className="label mb-2 block" htmlFor="body">Body</label>
            <textarea
              id="body" name="body" rows={8} defaultValue={entry.body ?? ""}
              className={`${inputClass} resize-y`}
            />
          </div>
          <div className="mt-4">
            <label className="label mb-2 block" htmlFor="tags">Tags (comma-separated)</label>
            <input id="tags" name="tags" type="text" defaultValue={entry.tags.join(", ")} className={inputClass} />
          </div>
        </section>

        <section className="rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm">
          <p className="label mb-4 text-muted">Source discipline</p>
          <p className="mb-4 text-sm text-muted">
            This editor does not authorize outside material. AVAIA Library content must come only
            from the Founder-approved source corpus unless the Founder has explicitly authorized
            this specific piece of outside material.
          </p>
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="label mb-2 block" htmlFor="content_type">Content type</label>
              <select id="content_type" name="content_type" required defaultValue={entry.content_type} className={selectClass}>
                <option value="avaia-owned" className={optionClass}>AVAIA-owned</option>
                <option value="external-resource" className={optionClass}>External resource</option>
              </select>
            </div>
          </div>
          <div className="mt-4">
            <label className="label mb-2 block" htmlFor="external_author">External author (if external resource)</label>
            <input
              id="external_author" name="external_author" type="text" defaultValue={entry.external_author ?? ""}
              className={inputClass}
            />
          </div>
          <div className="mt-4">
            <label className="label mb-2 block" htmlFor="external_description">External description</label>
            <input
              id="external_description" name="external_description" type="text"
              defaultValue={entry.external_description ?? ""} className={inputClass}
            />
          </div>
          <div className="mt-4">
            <label className="label mb-2 block" htmlFor="external_url">External URL</label>
            <input
              id="external_url" name="external_url" type="url" defaultValue={entry.external_url ?? ""}
              className={inputClass}
            />
          </div>
        </section>

        <section className="rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm">
          <p className="label mb-4 text-muted">Secondary Losses</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {SECONDARY_LOSS_NAMES.map((loss) => (
              <label key={loss} className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox" name="secondary_losses" value={loss}
                  defaultChecked={entry.secondary_losses.includes(loss)}
                />
                {loss}
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm">
          <p className="label mb-4 text-muted">Virtues (Chemistry of Virtue)</p>
          <p className="mb-4 text-sm text-muted">
            Family, then optionally the specific element within it. Leave Family blank to skip a row.
          </p>
          <div className="space-y-3">
            {virtueRows.map((v, i) => (
              <div key={i} className="flex flex-wrap gap-3">
                <select name="virtueFamily" defaultValue={v.family} className="flex-1 min-w-[160px] rounded-md border border-rule bg-white/[0.04] px-4 py-2.5 text-ink outline-none backdrop-blur-sm focus:border-seal">
                  <option value="" className={optionClass}>— none —</option>
                  {VIRTUE_FAMILIES.map((f) => (
                    <option key={f.key} value={f.key} className={optionClass}>{f.name}</option>
                  ))}
                </select>
                <input
                  type="text" name="virtueElement" placeholder="Element (optional)"
                  defaultValue={v.element ?? ""}
                  className="flex-1 min-w-[160px] rounded-md border border-rule bg-white/[0.04] px-4 py-2.5 text-ink outline-none backdrop-blur-sm placeholder:text-muted focus:border-seal"
                />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm">
          <p className="label mb-4 text-muted">Journey stages &amp; Programs</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs text-muted">Journey stages</p>
              {JOURNEY_STAGES.map((s) => (
                <label key={s} className="flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" name="journey_stages" value={s} defaultChecked={entry.journey_stages.includes(s)} />
                  {JOURNEY_STAGE_LABEL[s]}
                </label>
              ))}
            </div>
            <div>
              <p className="mb-2 text-xs text-muted">Programs</p>
              {PROGRAM_KEYS.map((p) => (
                <label key={p} className="flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" name="programs" value={p} defaultChecked={entry.programs.includes(p)} />
                  {PROGRAM_LABEL[p]}
                </label>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm">
          <p className="label mb-4 text-muted">Publishing</p>
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="label mb-2 block" htmlFor="status">Status</label>
              <select id="status" name="status" required defaultValue={entry.status} className={selectClass}>
                <option value="draft" className={optionClass}>Draft</option>
                <option value="published" className={optionClass}>Published</option>
                <option value="archived" className={optionClass}>Archived</option>
              </select>
            </div>
            <div>
              <label className="label mb-2 block" htmlFor="visibility">Visibility</label>
              <select id="visibility" name="visibility" required defaultValue={entry.visibility} className={selectClass}>
                <option value="member" className={optionClass}>Member</option>
                <option value="public" className={optionClass}>Public</option>
              </select>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted">
            Draft entries are never visible to Hosts regardless of visibility — that&rsquo;s enforced
            by row-level security, not this form.
          </p>
        </section>

        <button
          type="submit"
          className="rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
        >
          Save
        </button>
      </form>
    </div>
  );
}
