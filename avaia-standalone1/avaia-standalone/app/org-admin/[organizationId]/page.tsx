import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isOrganizationAdmin,
  listGuidesConnectedToOrganization,
  listExplicitlyConnectedGuideIds,
  logOrganizationAdminAction,
} from "@/lib/organization-admin";
import { isToolkitAuthorized } from "@/lib/guide";
import { isParticipantClearedToParticipate, getConsentStatusForParticipant } from "@/lib/guardian-consent";

export const metadata = { title: "Organization Dashboard — AVAIA" };
export const dynamic = "force-dynamic";

const PROGRAM_STATUSES = ["planning", "active", "complete", "archived"] as const;

/** Bounded "manage" for V1: an Organization Administrator may change an
 *  existing program's operational status, not create a brand-new program
 *  from scratch (that still requires picking an owning Guide, which
 *  belongs to the Guide's own "Create Program" flow -- see the final
 *  report for why this line was drawn here). Re-verifies organization
 *  admin authorization AND that the program actually belongs to this
 *  organization server-side, never trusting the form alone. */
async function changeProgramStatus(formData: FormData) {
  "use server";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/org-admin");

  const organizationId = String(formData.get("organizationId") ?? "");
  const programId = String(formData.get("programId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!(await isOrganizationAdmin(supabase, user.id, organizationId))) notFound();
  if (!PROGRAM_STATUSES.includes(status as any)) redirect(`/org-admin/${organizationId}`);

  const admin = createAdminClient();
  const { data: program } = await admin
    .from("youth_programs")
    .select("id, organization_id")
    .eq("id", programId)
    .maybeSingle();
  if (!program || program.organization_id !== organizationId) notFound();

  await admin.from("youth_programs").update({ status }).eq("id", programId);
  await logOrganizationAdminAction(admin, {
    organizationId,
    actorId: user.id,
    action: "program_status_changed",
    programId,
    detail: `status -> ${status}`,
  });

  redirect(`/org-admin/${organizationId}`);
}

/** Connects an already-Toolkit-authorized Guide to this organization,
 *  independent of program history (V1.1 -- see migration 0048's own
 *  header for why this exists). Re-verifies Organization Administrator
 *  authorization for THIS organization, finds the target account by
 *  email (same page-through-listUsers pattern used in
 *  app/admin/organization-admins/page.tsx), and re-verifies server-side
 *  that the target actually holds active Toolkit platform authorization
 *  -- an Organization Administrator can only connect a Guide who is
 *  already, independently, an authorized AVAIA Guide; this action never
 *  grants Toolkit authorization itself. Writing to organization_guides
 *  grants nothing beyond making this Guide id appear in
 *  listGuidesConnectedToOrganization()'s result -- no
 *  conversation/message/referral/recognition/Signature/Preparation table
 *  is touched here or anywhere in this action. */
async function connectGuide(formData: FormData) {
  "use server";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/org-admin");

  const organizationId = String(formData.get("organizationId") ?? "");
  if (!(await isOrganizationAdmin(supabase, user.id, organizationId))) notFound();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) {
    redirect(`/org-admin/${organizationId}?error=${encodeURIComponent("Enter the Guide's account email.")}`);
  }

  const admin = createAdminClient();
  let targetId: string | null = null;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data) break;
    const match = data.users.find((u) => u.email?.toLowerCase() === email);
    if (match) {
      targetId = match.id;
      break;
    }
    if (data.users.length < 1000) break;
  }
  if (!targetId) {
    redirect(`/org-admin/${organizationId}?error=${encodeURIComponent("No AVAIA account found for that email.")}`);
  }

  if (!(await isToolkitAuthorized(admin, targetId as string))) {
    redirect(
      `/org-admin/${organizationId}?error=${encodeURIComponent(
        "That account is not a currently toolkit-authorized AVAIA Guide."
      )}`
    );
  }

  await admin.from("organization_guides").upsert(
    {
      organization_id: organizationId,
      guide_id: targetId,
      status: "connected",
      connected_by: user.id,
      connected_at: new Date().toISOString(),
      status_changed_by: user.id,
      status_changed_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,guide_id" }
  );
  await logOrganizationAdminAction(admin, {
    organizationId,
    actorId: user.id,
    action: "guide_connected",
    guideId: targetId,
  });

  redirect(`/org-admin/${organizationId}?connected=1`);
}

/** Removes a Guide from the "available for new assignment" list for this
 *  organization -- never touches any assignment already made
 *  (guide_participants.guide_id is untouched), so any participant this
 *  Guide is already facilitating here keeps that Guide with full
 *  continuity, exactly as if nothing happened. Only meaningful for a
 *  Guide connected via the explicit organization_guides path; a Guide
 *  who is listed here purely because they've run a program in this
 *  organization has no row here to disconnect (the roster UI only offers
 *  this control for the former -- see listExplicitlyConnectedGuideIds). */
async function disconnectGuide(formData: FormData) {
  "use server";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/org-admin");

  const organizationId = String(formData.get("organizationId") ?? "");
  const guideId = String(formData.get("guideId") ?? "");
  if (!(await isOrganizationAdmin(supabase, user.id, organizationId))) notFound();

  const admin = createAdminClient();
  await admin
    .from("organization_guides")
    .update({ status: "disconnected", status_changed_by: user.id, status_changed_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("guide_id", guideId);
  await logOrganizationAdminAction(admin, {
    organizationId,
    actorId: user.id,
    action: "guide_disconnected",
    guideId,
  });

  redirect(`/org-admin/${organizationId}?disconnected=1`);
}

export default async function OrgAdminOrganizationPage({
  params,
  searchParams,
}: {
  params: { organizationId: string };
  searchParams?: { error?: string; connected?: string; disconnected?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/org-admin");

  if (!(await isOrganizationAdmin(supabase, user.id, params.organizationId))) notFound();

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("id, name, org_type")
    .eq("id", params.organizationId)
    .maybeSingle();
  if (!org) notFound();

  const { data: programs } = await admin
    .from("youth_programs")
    .select("id, name, delivery_context, delivery_format, status, guide_id, created_at")
    .eq("organization_id", params.organizationId)
    .order("created_at", { ascending: false });

  const guideIds = await listGuidesConnectedToOrganization(admin, params.organizationId);
  const explicitlyConnectedGuideIds = await listExplicitlyConnectedGuideIds(admin, params.organizationId);
  const guideEmailById = new Map<string, string>();
  for (const gid of guideIds) {
    const { data: u } = await admin.auth.admin.getUserById(gid);
    guideEmailById.set(gid, u?.user?.email ?? gid);
  }

  // Recent activity -- uses the caller's own RLS-scoped client (the
  // "organization admin actions org admin read" policy already scopes
  // this correctly), not the admin client, since this is exactly the
  // shape that policy exists to serve.
  const { data: recentActions } = await supabase
    .from("organization_admin_actions")
    .select("id, action, detail, created_at, actor_id")
    .eq("organization_id", params.organizationId)
    .order("created_at", { ascending: false })
    .limit(20);

  // Operational roster counts per program -- never story content. Same
  // consent/clearance resolution every other AVAIA surface already uses
  // (getConsentStatusForParticipant / isParticipantClearedToParticipate),
  // just run here with the admin client since this crosses Guide-
  // ownership boundaries by design.
  const programSummaries = await Promise.all(
    (programs ?? []).map(async (p) => {
      const { data: regs } = await admin
        .from("youth_program_participants")
        .select("participant_id")
        .eq("program_id", p.id)
        .eq("registration_status", "registered");
      const participantIds = (regs ?? []).map((r) => r.participant_id as string);
      const { data: bands } = participantIds.length
        ? await admin.from("guide_participants").select("id, developmental_band").in("id", participantIds)
        : { data: [] };
      const bandById = new Map((bands ?? []).map((b) => [b.id as string, b.developmental_band as string | null]));
      let cleared = 0;
      let awaitingConsent = 0;
      for (const pid of participantIds) {
        // Adult participants (no developmental_band) have no guardian-
        // consent gate at all -- always cleared, never "awaiting" (see
        // the matching comment on the roster page for why this branch
        // exists).
        if (!bandById.get(pid)) {
          cleared++;
          continue;
        }
        const [isCleared, consent] = await Promise.all([
          isParticipantClearedToParticipate(admin, pid),
          getConsentStatusForParticipant(admin, pid),
        ]);
        if (isCleared) cleared++;
        if (consent.status === "none" || consent.status === "pending") awaitingConsent++;
      }
      return {
        program: p,
        total: participantIds.length,
        cleared,
        awaitingConsent,
        guideEmail: guideEmailById.get(p.guide_id) ?? p.guide_id,
      };
    })
  );

  const totalParticipants = programSummaries.reduce((n, s) => n + s.total, 0);
  const totalCleared = programSummaries.reduce((n, s) => n + s.cleared, 0);

  return (
    <div className="mx-auto max-w-4xl px-5 py-16">
      <p className="mb-6">
        <Link href="/org-admin" className="label hover:text-seal">
          ← My Organizations
        </Link>
      </p>
      <p className="label mb-3">Organization Administration</p>
      <h1 className="font-serif text-4xl text-ink">{org.name}</h1>
      <p className="mt-3 rounded-md border border-seal/40 bg-seal/[0.06] px-4 py-3 text-sm text-ink">
        You can administer participation here &mdash; private AVAIA conversations remain with the
        Host and their authorized AVAIA Guide.
      </p>

      {searchParams?.connected && (
        <p className="mt-6 rounded-md border border-seal/40 bg-seal/[0.06] px-4 py-3 text-sm text-ink">
          Guide connected. They are now available for program/participant assignment here.
        </p>
      )}
      {searchParams?.disconnected && (
        <p className="mt-6 rounded-md border border-seal/40 bg-seal/[0.06] px-4 py-3 text-sm text-ink">
          Guide disconnected. Any participant they already facilitate here is unaffected.
        </p>
      )}
      {searchParams?.error && (
        <p className="mt-6 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {searchParams.error}
        </p>
      )}

      <div className="mt-8 grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-rule bg-white/[0.04] px-4 py-3">
          <p className="label text-muted">Programs</p>
          <p className="mt-1 font-serif text-2xl text-ink">{programs?.length ?? 0}</p>
        </div>
        <div className="rounded-lg border border-rule bg-white/[0.04] px-4 py-3">
          <p className="label text-muted">Guides</p>
          <p className="mt-1 font-serif text-2xl text-ink">{guideIds.length}</p>
        </div>
        <div className="rounded-lg border border-rule bg-white/[0.04] px-4 py-3">
          <p className="label text-muted">Enrolled</p>
          <p className="mt-1 font-serif text-2xl text-ink">{totalParticipants}</p>
        </div>
        <div className="rounded-lg border border-rule bg-white/[0.04] px-4 py-3">
          <p className="label text-muted">Cleared</p>
          <p className="mt-1 font-serif text-2xl text-ink">{totalCleared}</p>
        </div>
      </div>

      <section className="mt-10">
        <p className="label mb-3 text-muted">Programs</p>
        {programSummaries.length === 0 ? (
          <p className="text-muted">No programs yet.</p>
        ) : (
          <div className="space-y-3">
            {programSummaries.map(({ program, total, cleared, awaitingConsent, guideEmail }) => (
              <div key={program.id} className="rounded-lg border border-rule bg-white/[0.04] p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/org-admin/${org.id}/programs/${program.id}`}
                    className="font-serif text-lg text-ink hover:text-seal"
                  >
                    {program.name}
                  </Link>
                  <form action={changeProgramStatus} className="flex items-center gap-2">
                    <input type="hidden" name="organizationId" value={org.id} />
                    <input type="hidden" name="programId" value={program.id} />
                    <select
                      name="status"
                      defaultValue={program.status}
                      className="rounded-md border border-rule bg-white/[0.04] px-2 py-1 text-xs text-ink outline-none focus:border-seal"
                    >
                      {PROGRAM_STATUSES.map((s) => (
                        <option key={s} value={s} className="bg-[#05060b]">
                          {s}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="rounded-md border border-rule px-3 py-1 text-xs text-ink transition-colors hover:border-seal"
                    >
                      Update
                    </button>
                  </form>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {program.delivery_format ?? "Format not set"} · Guide: {guideEmail}
                </p>
                <p className="mt-2 text-sm text-ink">
                  {total} enrolled · {cleared} cleared · {awaitingConsent} awaiting consent
                </p>
                <Link
                  href={`/org-admin/${org.id}/programs/${program.id}`}
                  className="mt-2 inline-block text-sm text-ink underline decoration-rule underline-offset-2 hover:text-seal"
                >
                  View roster →
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <p className="label mb-3 text-muted">Guides connected to this organization</p>
        {guideIds.length === 0 ? (
          <p className="text-muted">None yet.</p>
        ) : (
          <ul className="space-y-2">
            {guideIds.map((gid) => (
              <li key={gid} className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink">
                <span>{guideEmailById.get(gid) ?? gid}</span>
                {explicitlyConnectedGuideIds.has(gid) && (
                  <form action={disconnectGuide}>
                    <input type="hidden" name="organizationId" value={org.id} />
                    <input type="hidden" name="guideId" value={gid} />
                    <button
                      type="submit"
                      className="rounded-md border border-rule px-2 py-1 text-xs text-muted transition-colors hover:border-red-500/60 hover:text-red-300"
                    >
                      Disconnect
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}

        <form action={connectGuide} className="mt-4 flex flex-wrap items-center gap-2">
          <input type="hidden" name="organizationId" value={org.id} />
          <input
            name="email"
            type="email"
            required
            placeholder="Guide's account email"
            className="rounded-md border border-rule bg-white/[0.04] px-3 py-1.5 text-sm text-ink outline-none focus:border-seal"
          />
          <button
            type="submit"
            className="rounded-md border border-rule px-3 py-1.5 text-xs text-ink transition-colors hover:border-seal"
          >
            Connect a Guide
          </button>
        </form>
        <p className="mt-2 text-xs text-muted">
          Connecting only makes an already-authorized AVAIA Guide available for assignment here. It never grants
          access to any Host, participant, or conversation on its own.
        </p>
      </section>

      <section className="mt-10">
        <p className="label mb-3 text-muted">Recent activity</p>
        {(recentActions ?? []).length === 0 ? (
          <p className="text-muted">Nothing recorded yet.</p>
        ) : (
          <ul className="space-y-1 text-xs text-muted">
            {(recentActions ?? []).map((a) => (
              <li key={a.id}>
                {new Date(a.created_at).toLocaleString()} · {a.action}
                {a.detail ? ` (${a.detail})` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
