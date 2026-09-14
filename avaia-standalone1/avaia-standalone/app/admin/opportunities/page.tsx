import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runProspectResearch, type ProspectVertical } from "@/lib/research/prospect-research";

export const metadata = { title: "Opportunities, AVAIA Admin" };
export const dynamic = "force-dynamic";

// Agents 3 (Partnership), 4 (Donor & Sponsor), and 8 (Programs &
// Experiences) outbound research -- one consolidated list so Dorian never
// has to hunt through three separate places for "what did research find."
// Read/write on pink_partnership_prospects, pink_donor_prospects, and
// avaia_experience_prospects deliberately goes through createAdminClient()
// rather than the signed-in admin's own RLS-bound client: unlike
// guide_candidates (which has its own "admin all" RLS policy, see
// app/admin/guide-candidates/page.tsx), these tables intentionally carry
// ZERO RLS policies for any role (service-role only, the same posture
// every pink_ table has had since migration 0063) -- so the admin-role
// check below, performed BEFORE the admin client is ever touched, is the
// actual enforcement for this page, exactly like every cron route's
// isAuthorizedCronRequest check already is for its own tables.

const TABLE_BY_VERTICAL = {
  partnership: "pink_partnership_prospects",
  donor: "pink_donor_prospects",
  program: "avaia_experience_prospects",
} as const;

const STATUSES = [
  "new", "reviewing", "contacted", "in_conversation", "active", "not_a_fit", "declined",
] as const;

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/admin/opportunities");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/");
}

async function updateProspect(formData: FormData) {
  "use server";
  await requireAdmin();

  const vertical = String(formData.get("vertical") ?? "") as ProspectVertical;
  const table = TABLE_BY_VERTICAL[vertical];
  if (!table) redirect("/admin/opportunities?error=invalid");

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const dorianContacted = formData.get("dorianContacted") === "on";
  const followUpNotes = String(formData.get("followUpNotes") ?? "").trim();
  const nextFollowUpAtRaw = String(formData.get("nextFollowUpAt") ?? "").trim();
  if (!id || !STATUSES.includes(status as (typeof STATUSES)[number])) {
    redirect("/admin/opportunities?error=invalid");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from(table)
    .update({
      status,
      dorian_contacted: dorianContacted,
      follow_up_notes: followUpNotes || null,
      next_follow_up_at: nextFollowUpAtRaw ? new Date(nextFollowUpAtRaw).toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    console.error("Admin opportunities: update failed:", error.message);
    redirect("/admin/opportunities?error=update_failed");
  }

  redirect("/admin/opportunities?updated=1");
}

async function runResearchNow(formData: FormData) {
  "use server";
  await requireAdmin();

  const vertical = String(formData.get("vertical") ?? "") as ProspectVertical;
  if (!TABLE_BY_VERTICAL[vertical]) redirect("/admin/opportunities?error=invalid");

  try {
    const result = await runProspectResearch(vertical, 5);
    redirect(`/admin/opportunities?researched=${vertical}&inserted=${result.inserted}`);
  } catch (e) {
    console.error("Admin opportunities: manual research run failed:", e);
    redirect("/admin/opportunities?error=research_failed");
  }
}

function ProspectSection({
  title,
  vertical,
  description,
  prospects,
}: {
  title: string;
  vertical: ProspectVertical;
  description: string;
  prospects: Array<{
    id: string;
    organization_name: string;
    organization_type: string | null;
    location: string | null;
    website: string | null;
    contact_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    why_relevant: string | null;
    status: string;
    dorian_contacted: boolean;
    next_follow_up_at: string | null;
    follow_up_notes: string | null;
    relevance?: string | null;
    relevant_experience?: string | null;
  }>;
}) {
  return (
    <section className="rule-t mt-14 border-t border-rule pt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="label mb-1 text-muted">{title}</p>
          <p className="text-sm text-muted">{description}</p>
        </div>
        <form action={runResearchNow}>
          <input type="hidden" name="vertical" value={vertical} />
          <button
            type="submit"
            className="rounded-md border border-rule px-4 py-2 text-sm text-ink transition-colors hover:border-seal"
          >
            Run research now
          </button>
        </form>
      </div>

      {prospects.length === 0 ? (
        <p className="mt-6 text-muted">No prospects yet. Run research, or add findings manually.</p>
      ) : (
        <div className="mt-6 space-y-3">
          {prospects.map((p) => (
            <details key={p.id} className="rounded-lg border border-rule bg-white/[0.04] px-4 py-3">
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3">
                <span className="text-ink">
                  {p.organization_name}
                  {p.organization_type ? (
                    <span className="ml-2 text-xs text-muted">({p.organization_type.replace(/_/g, " ")})</span>
                  ) : null}
                </span>
                <span className="label text-seal">{p.status.replace(/_/g, " ")}</span>
              </summary>
              <div className="mt-3 space-y-1 text-sm text-muted">
                {p.location && <p>Location: {p.location}</p>}
                {p.website && (
                  <p>
                    Website:{" "}
                    <a href={p.website} target="_blank" rel="noreferrer" className="underline">
                      {p.website}
                    </a>
                  </p>
                )}
                {p.contact_name && <p>Contact: {p.contact_name}</p>}
                {p.contact_email && <p>Email: {p.contact_email}</p>}
                {p.contact_phone && <p>Phone: {p.contact_phone}</p>}
                {p.relevance && <p>Relevant to: {p.relevance}</p>}
                {p.relevant_experience && <p>Best-fit Experience: {p.relevant_experience.replace(/_/g, " ")}</p>}
                {p.why_relevant && <p>Why it may fit: {p.why_relevant}</p>}
                {p.follow_up_notes && <p>Notes: {p.follow_up_notes}</p>}
                {p.next_follow_up_at && (
                  <p>Follow up by: {new Date(p.next_follow_up_at).toLocaleDateString()}</p>
                )}
              </div>

              <form action={updateProspect} className="mt-4 flex flex-wrap items-end gap-3">
                <input type="hidden" name="vertical" value={vertical} />
                <input type="hidden" name="id" value={p.id} />
                <div>
                  <label className="label mb-1 block text-xs">Status</label>
                  <select
                    name="status"
                    defaultValue={p.status}
                    className="rounded-md border border-rule bg-white/[0.04] px-3 py-2 text-sm text-ink"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s} className="bg-[#05060b] text-ink">
                        {s.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-2 pb-2 text-sm text-ink">
                  <input type="checkbox" name="dorianContacted" defaultChecked={p.dorian_contacted} />
                  Contacted
                </label>
                <div>
                  <label className="label mb-1 block text-xs">Follow up by</label>
                  <input
                    type="date"
                    name="nextFollowUpAt"
                    defaultValue={p.next_follow_up_at ? p.next_follow_up_at.slice(0, 10) : ""}
                    className="rounded-md border border-rule bg-white/[0.04] px-3 py-2 text-sm text-ink"
                  />
                </div>
                <div className="flex-1 min-w-[180px]">
                  <label className="label mb-1 block text-xs">Notes</label>
                  <input
                    type="text"
                    name="followUpNotes"
                    defaultValue={p.follow_up_notes ?? ""}
                    className="w-full rounded-md border border-rule bg-white/[0.04] px-3 py-2 text-sm text-ink"
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
  );
}

export default async function AdminOpportunitiesPage({
  searchParams,
}: {
  searchParams: { error?: string; updated?: string; researched?: string; inserted?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/admin/opportunities");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/");

  const admin = createAdminClient();
  const [{ data: partnerships }, { data: donors }, { data: programs }] = await Promise.all([
    admin
      .from("pink_partnership_prospects")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
    admin.from("pink_donor_prospects").select("*").order("created_at", { ascending: false }).limit(100),
    admin.from("avaia_experience_prospects").select("*").order("created_at", { ascending: false }).limit(100),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-5 py-16">
      <p className="mb-6">
        <Link href="/admin" className="label hover:text-seal">
          ← Back to Admin
        </Link>
      </p>
      <p className="label mb-3">AVAIA + Pink Shoelace Admin</p>
      <h1 className="font-serif text-4xl text-ink">Opportunities</h1>
      <p className="mt-4 text-lg text-muted">
        Organizations research has found, or you&rsquo;ve added, as possible partnership, donor/sponsor,
        or Programs &amp; Experiences opportunities. Nothing here has been contacted automatically --
        research only ever discovers and describes, you decide who to reach out to and how.
      </p>

      {searchParams?.error && (
        <p className="mt-6 rounded-md border border-[#e0857d]/40 bg-[#e0857d]/[0.08] px-4 py-3 text-sm text-[#e0857d]">
          Something went wrong. Please try again.
        </p>
      )}
      {searchParams?.updated && (
        <p className="mt-6 rounded-md border border-seal/40 bg-seal/[0.06] px-4 py-3 text-sm text-ink">Saved.</p>
      )}
      {searchParams?.researched && (
        <p className="mt-6 rounded-md border border-seal/40 bg-seal/[0.06] px-4 py-3 text-sm text-ink">
          Research run for {searchParams.researched}: {searchParams.inserted ?? 0} new prospect(s) added.
        </p>
      )}

      <ProspectSection
        title="Partnership Prospects (Agent 3)"
        vertical="partnership"
        description="Schools, businesses, hospices, funeral homes, community and youth organizations, conferences, and employers relevant to Pink Shoelace and/or AVAIA."
        prospects={partnerships ?? []}
      />
      <ProspectSection
        title="Donor & Sponsor Prospects (Agent 4)"
        vertical="donor"
        description="Legitimate potential sponsors/supporters aligned with the Pink Shoelace Foundation's mission."
        prospects={donors ?? []}
      />
      <ProspectSection
        title="Programs & Experiences Prospects (Agent 8)"
        vertical="program"
        description="Organizations, conferences, schools, businesses, and communities where an established AVAIA Program or Experience could fit."
        prospects={programs ?? []}
      />
    </div>
  );
}
