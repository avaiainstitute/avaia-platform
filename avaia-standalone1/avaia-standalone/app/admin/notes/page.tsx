import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import NoteCapture from "@/components/NoteCapture";

export const metadata = { title: "Ideas, Decisions & Follow-ups, AVAIA Admin" };
export const dynamic = "force-dynamic";

// Founder Idea Catcher, Decision Keeper, Follow-up Memory, and
// After-Meeting Capture (Round 4, Group 1, items 2-5). One admin page,
// four clearly-distinguished kinds (see founder_notes.kind in migration
// 0073) -- an idea is never treated as a decision, and neither is ever
// treated as an approved, implemented change. Same admin-role-gated-then-
// service-role posture as every other Round 3/4 admin page, for the same
// reason: founder_notes carries zero RLS policies for any signed-in role.

const KIND_LABEL: Record<string, string> = {
  idea: "Idea",
  decision: "Decision",
  follow_up: "Follow-up",
  meeting_note: "Meeting Note",
};

const STATUSES = ["open", "in_progress", "done", "archived"] as const;

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/admin/notes");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/");
}

async function saveFounderNote(formData: FormData) {
  "use server";
  await requireAdmin();

  const kind = String(formData.get("kind") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!["idea", "decision", "follow_up", "meeting_note"].includes(kind) || !title || !body) {
    redirect("/admin/notes?error=missing_fields");
  }

  const category = String(formData.get("category") ?? "") || null;
  const personName = String(formData.get("personName") ?? "").trim() || null;
  const organizationName = String(formData.get("organizationName") ?? "").trim() || null;
  const followUpDate = String(formData.get("followUpDate") ?? "").trim() || null;
  const nextAction = String(formData.get("nextAction") ?? "").trim() || null;
  const relatedExperience = String(formData.get("relatedExperience") ?? "").trim() || null;
  const decisionAffectedArea = String(formData.get("decisionAffectedArea") ?? "").trim() || null;
  const decisionImplementationStatus = String(formData.get("decisionImplementationStatus") ?? "").trim() || null;
  const source = String(formData.get("source") ?? "typed") === "ai_assisted" ? "ai_assisted" : "typed";

  const admin = createAdminClient();
  const { error } = await admin.from("founder_notes").insert({
    kind,
    title,
    body,
    category,
    person_name: kind === "follow_up" || kind === "meeting_note" ? personName : null,
    organization_name: kind === "follow_up" || kind === "meeting_note" ? organizationName : null,
    follow_up_date: kind === "follow_up" || kind === "meeting_note" ? followUpDate : null,
    next_action: kind === "follow_up" || kind === "meeting_note" ? nextAction : null,
    related_experience: kind === "follow_up" || kind === "meeting_note" ? relatedExperience : null,
    decision_affected_area: kind === "decision" ? decisionAffectedArea : null,
    decision_implementation_status: kind === "decision" ? decisionImplementationStatus : null,
    source,
  });
  if (error) {
    console.error("Founder notes: insert failed:", error.message);
    redirect("/admin/notes?error=insert_failed");
  }
  redirect("/admin/notes?added=1");
}

async function updateNoteStatus(formData: FormData) {
  "use server";
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !STATUSES.includes(status as (typeof STATUSES)[number])) {
    redirect("/admin/notes?error=invalid");
  }
  const admin = createAdminClient();
  const { error } = await admin.from("founder_notes").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) {
    console.error("Founder notes: update failed:", error.message);
    redirect("/admin/notes?error=update_failed");
  }
  redirect("/admin/notes?updated=1");
}

export default async function AdminNotesPage({
  searchParams,
}: {
  searchParams: { error?: string; added?: string; updated?: string; kind?: string };
}) {
  await requireAdmin();

  const admin = createAdminClient();
  const filterKind = searchParams?.kind;
  let query = admin.from("founder_notes").select("*").order("created_at", { ascending: false }).limit(150);
  if (filterKind && ["idea", "decision", "follow_up", "meeting_note"].includes(filterKind)) {
    query = query.eq("kind", filterKind);
  }
  const { data: notes } = await query;

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <p className="mb-6">
        <Link href="/admin" className="label hover:text-seal">
          ← Back to Admin
        </Link>
      </p>
      <p className="label mb-3">AVAIA + Pink Shoelace Admin</p>
      <h1 className="font-serif text-4xl text-ink">Ideas, Decisions & Follow-ups</h1>
      <p className="mt-4 text-lg text-muted">
        Capture something once, in your own words, so it isn&rsquo;t lost. An idea is never treated
        as a decision, and a decision is never treated as an implemented change -- nothing here
        builds, publishes, or certifies anything on its own.
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
        <p className="label mb-3 text-muted">Capture Something</p>
        <NoteCapture saveAction={saveFounderNote} />
      </section>

      <section className="rule-t mt-14 border-t border-rule pt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="label text-muted">Everything Recorded</p>
          <div className="flex flex-wrap gap-2 text-xs">
            <Link href="/admin/notes" className={`rounded-md border px-2 py-1 ${!filterKind ? "border-seal text-ink" : "border-rule text-muted"}`}>
              All
            </Link>
            {Object.entries(KIND_LABEL).map(([k, label]) => (
              <Link
                key={k}
                href={`/admin/notes?kind=${k}`}
                className={`rounded-md border px-2 py-1 ${filterKind === k ? "border-seal text-ink" : "border-rule text-muted"}`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        {!notes || notes.length === 0 ? (
          <p className="mt-6 text-muted">Nothing recorded yet.</p>
        ) : (
          <div className="mt-6 space-y-3">
            {notes.map((n) => (
              <details key={n.id} className="rounded-lg border border-rule bg-white/[0.04] px-4 py-3">
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3">
                  <span className="text-ink">
                    <span className="label mr-2 text-seal">{KIND_LABEL[n.kind] ?? n.kind}</span>
                    {n.title}
                  </span>
                  <span className="label text-muted">{n.status.replace(/_/g, " ")}</span>
                </summary>
                <div className="mt-3 space-y-1 text-sm text-muted">
                  <p style={{ whiteSpace: "pre-wrap" }}>{n.body}</p>
                  {n.category && <p>Category: {n.category.replace(/_/g, " ")}</p>}
                  {(n.person_name || n.organization_name) && (
                    <p>
                      {[n.person_name, n.organization_name].filter(Boolean).join(" -- ")}
                    </p>
                  )}
                  {n.follow_up_date && <p>Follow up: {new Date(n.follow_up_date).toLocaleDateString()}</p>}
                  {n.next_action && <p>Next action: {n.next_action}</p>}
                  {n.decision_affected_area && <p>Affects: {n.decision_affected_area}</p>}
                  {n.decision_implementation_status && (
                    <p>Implementation: {n.decision_implementation_status.replace(/_/g, " ")}</p>
                  )}
                  <p>Recorded {new Date(n.created_at).toLocaleString()}{n.source === "ai_assisted" ? " -- AI-assisted, reviewed by you" : ""}</p>
                </div>
                <form action={updateNoteStatus} className="mt-4 flex items-center gap-3">
                  <input type="hidden" name="id" value={n.id} />
                  <select
                    name="status"
                    defaultValue={n.status}
                    className="rounded-md border border-rule bg-white/[0.04] px-3 py-2 text-sm text-ink"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s} className="bg-[#05060b] text-ink">
                        {s.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
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
