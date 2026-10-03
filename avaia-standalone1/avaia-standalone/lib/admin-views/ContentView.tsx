import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SCOPE_BASE, SCOPE_TITLE, parseScope, type AdminScope } from "@/lib/admin-scope";


// Agent 9 (Communications & Content), operational foundation only. This is
// a planning/tracking tool Dorian curates himself -- there is no automated
// content generation and no read access anywhere in this codebase from
// avaia_content_items into any private table. Dorian is the only source of
// rows here, and only from material he has already decided is public or
// approved (source_reference is a free-text note for where an idea came
// from, never a link into private data). Same admin-role-gated-then-
// service-role posture as /admin/opportunities and /admin/programs, for
// the same reason (zero RLS policies on this table for any signed-in role).

const CONTENT_TYPES = ["social_post", "announcement", "pr_media", "other"] as const;
const PLATFORMS = ["instagram", "facebook", "linkedin", "tiktok", "website", "email", "press", "other"] as const;
const RELATED_TO_AVAIA = [
  "defying_grief", "youth_defying_grief", "workshops_and_speaking", "chemistry_of_virtue",
  "unsung_heroes", "view_from_above", "other",
] as const;
const RELATED_TO_PINK = ["pink_shoelace_general", "pink_participation"] as const;
const STATUSES = ["idea", "draft", "waiting_for_approval", "approved", "scheduled", "published", "archived"] as const;

const relatedOptionsFor = (scope: AdminScope): readonly string[] => (scope === "pink" ? RELATED_TO_PINK : RELATED_TO_AVAIA);

async function requireAdmin(scope: AdminScope) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?from=${SCOPE_BASE[scope]}/content`);
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/");
}

async function addContentItem(formData: FormData) {
  "use server";
  const scope = parseScope(formData.get("scope"));
  const base = SCOPE_BASE[scope];
  await requireAdmin(scope);

  const title = String(formData.get("title") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  if (!title || !summary) redirect(`${base}/content?error=missing_fields`);

  const contentType = String(formData.get("contentType") ?? "social_post");
  const platform = String(formData.get("platform") ?? "") || null;
  const relatedTo = String(formData.get("relatedTo") ?? "") || null;
  const sourceReference = String(formData.get("sourceReference") ?? "").trim() || null;

  const admin = createAdminClient();
  const { error } = await admin.from("avaia_content_items").insert({
    title,
    summary,
    content_type: CONTENT_TYPES.includes(contentType as (typeof CONTENT_TYPES)[number]) ? contentType : "social_post",
    platform: PLATFORMS.includes(platform as (typeof PLATFORMS)[number]) ? platform : null,
    related_to: relatedOptionsFor(scope).includes(relatedTo as never) ? relatedTo : scope === "pink" ? "pink_shoelace_general" : null,
    source_reference: sourceReference,
  });
  if (error) {
    console.error("Admin content: insert failed:", error.message);
    redirect(`${base}/content?error=insert_failed`);
  }
  redirect(`${base}/content?added=1`);
}

async function updateContentItem(formData: FormData) {
  "use server";
  const scope = parseScope(formData.get("scope"));
  const base = SCOPE_BASE[scope];
  await requireAdmin(scope);

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const scheduledForRaw = String(formData.get("scheduledFor") ?? "").trim();
  if (!id || !STATUSES.includes(status as (typeof STATUSES)[number])) {
    redirect(`${base}/content?error=invalid`);
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("avaia_content_items")
    .update({
      status,
      scheduled_for: scheduledForRaw ? new Date(scheduledForRaw).toISOString() : null,
      published_at: status === "published" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    console.error("Admin content: update failed:", error.message);
    redirect(`${base}/content?error=update_failed`);
  }
  redirect(`${base}/content?updated=1`);
}

export default async function ContentView({
  scope,
  searchParams,
}: {
  scope: AdminScope;
  searchParams: { error?: string; added?: string; updated?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?from=${SCOPE_BASE[scope]}/content`);
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/");

  const admin = createAdminClient();
  const { data: items } = await admin
    .from("avaia_content_items")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(150);
  // Each organization sees only its own content plans (Pink items are tagged pink_*).
  const scopedItems = (items ?? []).filter((it) => (scope === "pink" ? String(it.related_to ?? "").startsWith("pink_") : !String(it.related_to ?? "").startsWith("pink_")));

  const fieldClass = "w-full rounded-md border border-rule bg-white/[0.04] px-3 py-2 text-sm text-ink";

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <p className="mb-6">
        <Link href={SCOPE_BASE[scope]} className="label hover:text-seal">
          ← Back to {scope === "pink" ? "Pink Shoelace Foundation Admin" : "Admin"}
        </Link>
      </p>
      <p className="label mb-3">{SCOPE_TITLE[scope]}</p>
      <h1 className="font-serif text-4xl text-ink">Communications & Content</h1>
      <p className="mt-4 text-lg text-muted">
        Plan social posts, announcements, and PR/media opportunities from material you&rsquo;ve
        already decided is public or approved. Nothing here is pulled automatically from private
        Host, Workbook, Unsung Heroes, Shared Room, or youth material -- add ideas here yourself.
      </p>

      {searchParams?.error && (
        <p className="mt-6 rounded-md border border-[#e0857d]/40 bg-[#e0857d]/[0.08] px-4 py-3 text-sm text-[#e0857d]">
          Something went wrong. Please check the required fields and try again.
        </p>
      )}
      {(searchParams?.added || searchParams?.updated) && (
        <p className="mt-6 rounded-md border border-seal/40 bg-seal/[0.06] px-4 py-3 text-sm text-ink">Saved.</p>
      )}

      <section className="rule-t mt-10 border-t border-rule pt-8">
        <p className="label mb-3 text-muted">Add an Idea</p>
        <form action={addContentItem} className="space-y-3 rounded-lg border border-rule bg-white/[0.04] p-5">
          <input type="hidden" name="scope" value={scope} />
          <div>
            <label className="label mb-1 block text-xs">Title</label>
            <input name="title" required className={fieldClass} />
          </div>
          <div>
            <label className="label mb-1 block text-xs">Idea / Draft</label>
            <textarea name="summary" required rows={4} className={`${fieldClass} resize-none`} />
          </div>
          <div className="flex flex-wrap gap-3">
            <div>
              <label className="label mb-1 block text-xs">Type</label>
              <select name="contentType" defaultValue="social_post" className={fieldClass}>
                {CONTENT_TYPES.map((t) => (
                  <option key={t} value={t} className="bg-[#05060b] text-ink">
                    {t.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label mb-1 block text-xs">Platform</label>
              <select name="platform" defaultValue="" className={fieldClass}>
                <option value="" className="bg-[#05060b] text-ink">
                  --
                </option>
                {PLATFORMS.map((p) => (
                  <option key={p} value={p} className="bg-[#05060b] text-ink">
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label mb-1 block text-xs">Related to</label>
              <select name="relatedTo" defaultValue="" className={fieldClass}>
                <option value="" className="bg-[#05060b] text-ink">
                  --
                </option>
                {relatedOptionsFor(scope).map((r) => (
                  <option key={r} value={r} className="bg-[#05060b] text-ink">
                    {r.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label mb-1 block text-xs">Source (where this material is already public/approved)</label>
            <input name="sourceReference" className={fieldClass} />
          </div>
          <button
            type="submit"
            className="rounded-md bg-seal px-5 py-2.5 text-sm font-semibold text-[#05060b] hover:opacity-90"
          >
            Add
          </button>
        </form>
      </section>

      <section className="rule-t mt-14 border-t border-rule pt-8">
        <p className="label mb-3 text-muted">Planning Board</p>
        {scopedItems.length === 0 ? (
          <p className="text-muted">Nothing planned yet.</p>
        ) : (
          <div className="space-y-3">
            {scopedItems.map((it) => (
              <details key={it.id} id={it.id} className="rounded-lg border border-rule bg-white/[0.04] px-4 py-3">
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3">
                  <span className="text-ink">{it.title}</span>
                  <span className="label text-seal">{it.status.replace(/_/g, " ")}</span>
                </summary>
                <div className="mt-3 space-y-1 text-sm text-muted">
                  <p style={{ whiteSpace: "pre-wrap" }}>{it.summary}</p>
                  <p>
                    {it.content_type.replace(/_/g, " ")}
                    {it.platform ? ` · ${it.platform}` : ""}
                    {it.related_to ? ` · ${it.related_to.replace(/_/g, " ")}` : ""}
                  </p>
                  {it.source_reference && <p>Source: {it.source_reference}</p>}
                  {it.scheduled_for && <p>Scheduled: {new Date(it.scheduled_for).toLocaleString()}</p>}
                </div>
                <form action={updateContentItem} className="mt-4 flex flex-wrap items-end gap-3">
                  <input type="hidden" name="scope" value={scope} />
                  <input type="hidden" name="id" value={it.id} />
                  <div>
                    <label className="label mb-1 block text-xs">Status</label>
                    <select name="status" defaultValue={it.status} className={fieldClass}>
                      {STATUSES.map((s) => (
                        <option key={s} value={s} className="bg-[#05060b] text-ink">
                          {s.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label mb-1 block text-xs">Scheduled for</label>
                    <input
                      type="datetime-local"
                      name="scheduledFor"
                      defaultValue={it.scheduled_for ? it.scheduled_for.slice(0, 16) : ""}
                      className={fieldClass}
                    />
                  </div>
                  <button
                    type="submit"
                    className="rounded-md bg-seal px-4 py-2 text-sm font-semibold text-[#05060b] hover:opacity-90"
                  >
                    Save
                  </button>
                </form>
              </details>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
