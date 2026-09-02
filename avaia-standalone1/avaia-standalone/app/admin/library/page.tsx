import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Library — AVAIA Admin" };
export const dynamic = "force-dynamic";

const CREATE_ERROR_MESSAGE: Record<string, string> = {
  missing_fields: "Title, Great Idea, and Overview are all required.",
  invalid_content_type: "Choose a valid content type.",
  invalid_visibility: "Choose a valid visibility.",
  insert_failed: "Could not create the entry. Please try again.",
};

/** Smallest safe editorial surface for library_entries (Living Library
 *  audit, Section T -- no admin UI existed at all before this). Every
 *  other Library table (concepts, provenance, junctions) is out of scope
 *  for this pass -- see the migration/report for the full boundary. */
async function createLibraryEntry(formData: FormData) {
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

  const title = String(formData.get("title") ?? "").trim();
  const great_idea = String(formData.get("great_idea") ?? "").trim();
  const overview = String(formData.get("overview") ?? "").trim();
  const content_type = String(formData.get("content_type") ?? "");
  const visibility = String(formData.get("visibility") ?? "member");

  if (!title || !great_idea || !overview) {
    redirect("/admin/library?createError=missing_fields");
  }
  if (content_type !== "avaia-owned" && content_type !== "external-resource") {
    redirect("/admin/library?createError=invalid_content_type");
  }
  if (visibility !== "public" && visibility !== "member") {
    redirect("/admin/library?createError=invalid_visibility");
  }

  // Always draft on creation -- explicit publication is a separate,
  // deliberate step on the entry's own edit page, never automatic.
  const { data: created, error } = await supabase
    .from("library_entries")
    .insert({ title, great_idea, overview, content_type, visibility, status: "draft", editor_id: user.id })
    .select("id")
    .maybeSingle();

  if (error || !created) {
    redirect("/admin/library?createError=insert_failed");
  }

  redirect(`/admin/library/${created!.id}?created=1`);
}

type ListRow = {
  id: string;
  title: string;
  status: "draft" | "published" | "archived";
  visibility: "public" | "member";
  content_type: "avaia-owned" | "external-resource";
  secondary_losses: string[];
  programs: string[];
  virtues: unknown[];
  updated_at: string;
};

export default async function AdminLibraryPage({
  searchParams,
}: {
  searchParams?: { status?: string; visibility?: string; q?: string; createError?: string };
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

  const statusFilter = searchParams?.status ?? "";
  const visibilityFilter = searchParams?.visibility ?? "";
  const q = searchParams?.q?.trim() ?? "";

  let query = supabase
    .from("library_entries")
    .select("id, title, status, visibility, content_type, secondary_losses, programs, virtues, updated_at")
    .order("updated_at", { ascending: false });

  if (statusFilter === "draft" || statusFilter === "published" || statusFilter === "archived") {
    query = query.eq("status", statusFilter);
  }
  if (visibilityFilter === "public" || visibilityFilter === "member") {
    query = query.eq("visibility", visibilityFilter);
  }
  if (q) {
    query = query.ilike("title", `%${q}%`);
  }

  const { data: entriesData } = await query;
  const entries = (entriesData as ListRow[]) ?? [];

  const createError = searchParams?.createError ? CREATE_ERROR_MESSAGE[searchParams.createError] : null;

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <p className="label mb-3">AVAIA Admin</p>
      <h1 className="font-serif text-4xl text-ink">Library</h1>
      <p className="mt-4 text-lg text-muted">
        Every entry currently in production was added by direct SQL, outside version control. This
        is the smallest safe surface to create and edit entries without that — it does not manage
        Concepts, Provenance, or any other Library table.
      </p>

      {createError && (
        <p className="mt-6 rounded-md border border-[#e0857d]/40 bg-[#e0857d]/[0.08] px-4 py-3 text-sm text-[#e0857d]">
          {createError}
        </p>
      )}

      <section className="rule-t mt-10 border-t border-rule pt-8">
        <p className="label mb-3 text-muted">Filter</p>
        <form action="/admin/library" method="get" className="flex flex-wrap gap-3">
          <select
            name="status"
            defaultValue={statusFilter}
            className="rounded-md border border-rule bg-white/[0.04] px-4 py-2.5 text-ink outline-none backdrop-blur-sm focus:border-seal"
          >
            <option value="" className="bg-[#05060b] text-ink">All statuses</option>
            <option value="draft" className="bg-[#05060b] text-ink">Draft</option>
            <option value="published" className="bg-[#05060b] text-ink">Published</option>
            <option value="archived" className="bg-[#05060b] text-ink">Archived</option>
          </select>
          <select
            name="visibility"
            defaultValue={visibilityFilter}
            className="rounded-md border border-rule bg-white/[0.04] px-4 py-2.5 text-ink outline-none backdrop-blur-sm focus:border-seal"
          >
            <option value="" className="bg-[#05060b] text-ink">All visibility</option>
            <option value="public" className="bg-[#05060b] text-ink">Public</option>
            <option value="member" className="bg-[#05060b] text-ink">Member</option>
          </select>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search title…"
            className="flex-1 min-w-[180px] rounded-md border border-rule bg-white/[0.04] px-4 py-2.5 text-ink outline-none backdrop-blur-sm placeholder:text-muted focus:border-seal"
          />
          <button
            type="submit"
            className="rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
          >
            Apply
          </button>
        </form>
      </section>

      <section className="rule-t mt-10 border-t border-rule pt-8">
        <p className="label mb-3 text-muted">Create Library Entry</p>
        <form
          action={createLibraryEntry}
          className="rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm"
        >
          <div>
            <label className="label mb-2 block" htmlFor="title">Title</label>
            <input
              id="title" name="title" type="text" required
              className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
            />
          </div>
          <div className="mt-4">
            <label className="label mb-2 block" htmlFor="great_idea">Great Idea</label>
            <input
              id="great_idea" name="great_idea" type="text" required
              className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
            />
          </div>
          <div className="mt-4">
            <label className="label mb-2 block" htmlFor="overview">Overview</label>
            <textarea
              id="overview" name="overview" rows={2} required
              className="w-full resize-none rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-4">
            <div>
              <label className="label mb-2 block" htmlFor="content_type">Content type</label>
              <select
                id="content_type" name="content_type" required defaultValue="avaia-owned"
                className="rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
              >
                <option value="avaia-owned" className="bg-[#05060b] text-ink">AVAIA-owned</option>
                <option value="external-resource" className="bg-[#05060b] text-ink">External resource</option>
              </select>
            </div>
            <div>
              <label className="label mb-2 block" htmlFor="visibility">Visibility</label>
              <select
                id="visibility" name="visibility" required defaultValue="member"
                className="rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
              >
                <option value="member" className="bg-[#05060b] text-ink">Member</option>
                <option value="public" className="bg-[#05060b] text-ink">Public</option>
              </select>
            </div>
          </div>
          <p className="mt-4 text-sm text-muted">
            Created as Draft. Body, tags, virtues, Secondary Losses, and publishing all happen on
            the entry&rsquo;s own page after creation.
          </p>
          <button
            type="submit"
            className="mt-4 rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
          >
            Create Library Entry
          </button>
        </form>
      </section>

      <section className="rule-t mt-14 border-t border-rule pt-8">
        <p className="label mb-3 text-muted">{entries.length} {entries.length === 1 ? "entry" : "entries"}</p>
        {entries.length === 0 ? (
          <p className="text-muted">No entries match this filter.</p>
        ) : (
          <div className="space-y-2">
            {entries.map((e) => (
              <Link
                key={e.id}
                href={`/admin/library/${e.id}`}
                className="block rounded-lg border border-rule bg-white/[0.04] px-4 py-3 transition-colors hover:border-seal"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-ink">{e.title}</p>
                  <span className="label text-muted">{new Date(e.updated_at).toLocaleDateString()}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="rounded-full border border-rule px-2.5 py-0.5 text-xs text-seal">{e.status}</span>
                  <span className="rounded-full border border-rule px-2.5 py-0.5 text-xs text-muted">{e.visibility}</span>
                  <span className="rounded-full border border-rule px-2.5 py-0.5 text-xs text-muted">{e.content_type}</span>
                  {e.secondary_losses.length > 0 && (
                    <span className="rounded-full border border-rule px-2.5 py-0.5 text-xs text-muted">
                      {e.secondary_losses.length} loss{e.secondary_losses.length === 1 ? "" : "es"}
                    </span>
                  )}
                  {e.virtues.length > 0 && (
                    <span className="rounded-full border border-rule px-2.5 py-0.5 text-xs text-muted">
                      {e.virtues.length} virtue{e.virtues.length === 1 ? "" : "s"}
                    </span>
                  )}
                  {e.programs.length > 0 && (
                    <span className="rounded-full border border-rule px-2.5 py-0.5 text-xs text-muted">
                      {e.programs.join(", ")}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
