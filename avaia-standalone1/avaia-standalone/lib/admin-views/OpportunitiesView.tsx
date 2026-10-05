import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runProspectResearch, type ProspectVertical } from "@/lib/research/prospect-research";
import {
  SCOPE_BASE,
  SCOPE_TITLE,
  parseScope,
  PROSPECT_LISTS_BY_SCOPE,
  PROSPECT_TABLE_BY_VERTICAL,
  RESEARCH_RUNNABLE_BY_SCOPE,
  type AdminScope,
} from "@/lib/admin-scope";


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

const TABLE_BY_VERTICAL = PROSPECT_TABLE_BY_VERTICAL;

// Which lists each organization sees, and which research it may run, are the boundary and
// live in lib/admin-scope.ts (PROSPECT_LISTS_BY_SCOPE, RESEARCH_RUNNABLE_BY_SCOPE) so a
// self-test can prove AVAIA never reads Pink's tables. The old mixed "partnership" research
// was stopped on 2026-10-05; Pink's list of what it already found is preserved and shown only
// in Pink's admin.
const VERTICALS_BY_SCOPE = PROSPECT_LISTS_BY_SCOPE;

const STATUSES = [
  "new", "reviewing", "contacted", "in_conversation", "active", "not_a_fit", "declined",
] as const;

async function requireAdmin(scope: AdminScope) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?from=${SCOPE_BASE[scope]}/opportunities`);
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/");
}

async function updateProspect(formData: FormData) {
  "use server";
  const scope = parseScope(formData.get("scope"));
  const base = SCOPE_BASE[scope];
  await requireAdmin(scope);

  const vertical = String(formData.get("vertical") ?? "") as ProspectVertical;
  const table = TABLE_BY_VERTICAL[vertical];
  if (!table || !VERTICALS_BY_SCOPE[scope].includes(vertical)) redirect(`${base}/opportunities?error=invalid`);

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const dorianContacted = formData.get("dorianContacted") === "on";
  const followUpNotes = String(formData.get("followUpNotes") ?? "").trim();
  const nextFollowUpAtRaw = String(formData.get("nextFollowUpAt") ?? "").trim();
  if (!id || !STATUSES.includes(status as (typeof STATUSES)[number])) {
    redirect(`${base}/opportunities?error=invalid`);
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
    redirect(`${base}/opportunities?error=update_failed`);
  }

  redirect(`${base}/opportunities?updated=1`);
}

async function runResearchNow(formData: FormData) {
  "use server";
  const scope = parseScope(formData.get("scope"));
  const base = SCOPE_BASE[scope];
  await requireAdmin(scope);

  const vertical = String(formData.get("vertical") ?? "") as ProspectVertical;
  if (!TABLE_BY_VERTICAL[vertical] || !RESEARCH_RUNNABLE_BY_SCOPE[scope].includes(vertical)) redirect(`${base}/opportunities?error=invalid`);

  try {
    const result = await runProspectResearch(vertical, 5);
    redirect(`${base}/opportunities?researched=${vertical}&inserted=${result.inserted}`);
  } catch (e) {
    console.error("Admin opportunities: manual research run failed:", e);
    redirect(`${base}/opportunities?error=research_failed`);
  }
}

function ProspectSection({
  scope,
  title,
  vertical,
  description,
  prospects,
  canRunResearch,
}: {
  scope: AdminScope;
  title: string;
  vertical: ProspectVertical;
  description: string;
  canRunResearch: boolean;
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
    application_deadline?: string | null;
  }>;
}) {
  return (
    <section className="rule-t mt-14 border-t border-rule pt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="label mb-1 text-muted">{title}</p>
          <p className="text-sm text-muted">{description}</p>
        </div>
        {canRunResearch && (
          <form action={runResearchNow}>
            <input type="hidden" name="scope" value={scope} />
            <input type="hidden" name="vertical" value={vertical} />
            <button
              type="submit"
              className="rounded-md border border-rule px-4 py-2 text-sm text-ink transition-colors hover:border-seal"
            >
              Run research now
            </button>
          </form>
        )}
      </div>

      {prospects.length === 0 ? (
        <p className="mt-6 text-muted">No prospects yet.</p>
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
                {p.application_deadline && (
                  <p>Application/submission deadline: {new Date(p.application_deadline).toLocaleDateString()}</p>
                )}
                {p.why_relevant && <p>Why it may fit: {p.why_relevant}</p>}
                {p.follow_up_notes && <p>Notes: {p.follow_up_notes}</p>}
                {p.next_follow_up_at && (
                  <p>Follow up by: {new Date(p.next_follow_up_at).toLocaleDateString()}</p>
                )}
              </div>

              <form action={updateProspect} className="mt-4 flex flex-wrap items-end gap-3">
                <input type="hidden" name="scope" value={scope} />
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

export default async function OpportunitiesView({
  scope,
  searchParams,
}: {
  scope: AdminScope;
  searchParams: { error?: string; updated?: string; researched?: string; inserted?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?from=${SCOPE_BASE[scope]}/opportunities`);
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/");

  const admin = createAdminClient();
  const isPink = scope === "pink";
  // Only Pink's admin ever reads Pink's tables. Rows the old mixed research tagged as AVAIA-only
  // stay preserved in the table and are shown to neither organization.
  const [{ data: partnerships }, { data: donors }, { data: programs }, { data: speaking }] = await Promise.all([
    isPink
      ? admin
          .from("pink_partnership_prospects")
          .select("*")
          .in("relevance", ["pink", "both"])
          .order("created_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] as never[] }),
    isPink
      ? admin.from("pink_donor_prospects").select("*").order("created_at", { ascending: false }).limit(100)
      : Promise.resolve({ data: [] as never[] }),
    isPink
      ? Promise.resolve({ data: [] as never[] })
      : admin.from("avaia_experience_prospects").select("*").order("created_at", { ascending: false }).limit(100),
    isPink
      ? Promise.resolve({ data: [] as never[] })
      : admin.from("avaia_speaking_opportunities").select("*").order("created_at", { ascending: false }).limit(100),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-5 py-16">
      <p className="mb-6">
        <Link href={SCOPE_BASE[scope]} className="label hover:text-seal">
          ← Back to {isPink ? "Pink Shoelace Foundation Admin" : "Admin"}
        </Link>
      </p>
      <p className="label mb-3">{SCOPE_TITLE[scope]}</p>
      <h1 className="font-serif text-4xl text-ink">Opportunities</h1>
      <p className="mt-4 text-lg text-muted">
        {isPink
          ? "Organizations research has found, or you\u2019ve added, as possible partnership or donor/sponsor opportunities for the Pink Shoelace Foundation. "
          : "Organizations research has found, or you\u2019ve added, as possible partnership, speaking, or Programs & Experiences opportunities for AVAIA. "}
        Nothing here has been contacted automatically -- research only ever discovers and describes, you decide who to
        reach out to and how.
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

      {isPink && (
        <ProspectSection
          scope={scope}
          title="Partnership Prospects (preserved)"
          vertical="partnership"
          description="What the earlier research found. That research mixed two organizations in one search and was stopped on 2026-10-05; nothing new is added to this list. Everything here is AI-found and unverified."
          prospects={partnerships ?? []}
          canRunResearch={false}
        />
      )}
      {isPink && (
        <ProspectSection
          scope={scope}
          title="Donor & Sponsor Prospects (Agent 4)"
          vertical="donor"
          description="Potential sponsors/supporters the research found for the Pink Shoelace Foundation's mission. AI-found and unverified; a person decides whether anyone is contacted."
          prospects={donors ?? []}
          canRunResearch={RESEARCH_RUNNABLE_BY_SCOPE.pink.includes("donor")}
        />
      )}
      {!isPink && (
        <>
          <ProspectSection
            scope={scope}
            title="Programs & Experiences Prospects (Agent 8)"
            vertical="program"
            description="Organizations, conferences, schools, businesses, and communities where an established AVAIA Program or Experience could fit."
            prospects={programs ?? []}
            canRunResearch
          />
          <ProspectSection
            scope={scope}
            title="Speaking & Conference Opportunities (Opportunity Finder)"
            vertical="speaking"
            description="Real, currently-open speaking, presenting, or media opportunities for AVAIA."
            prospects={speaking ?? []}
            canRunResearch
          />
        </>
      )}
    </div>
  );
}
