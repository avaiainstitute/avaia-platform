import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isOrganizationAdmin,
  listGuidesConnectedToOrganization,
  logOrganizationAdminAction,
} from "@/lib/organization-admin";
import { isParticipantClearedToParticipate, getConsentStatusForParticipant } from "@/lib/guardian-consent";

export const metadata = { title: "Program Roster — Organization Administration — AVAIA" };
export const dynamic = "force-dynamic";

/** Reassigns a participant to a different Guide -- the Organization
 *  Administrator version of the Platform Admin tool (app/admin/
 *  reassign-participant), reusing the exact same guide_id-update
 *  mechanism, scoped two ways the platform-wide version isn't: the
 *  participant must actually be registered in a program under THIS
 *  organization, and the target Guide must actually be "connected" to
 *  this same organization (has run a program here) -- never any
 *  toolkit-authorized Guide platform-wide. This is the only path that
 *  changes who facilitates a participant; it never grants the
 *  Organization Administrator Guide access, and never touches
 *  conversations/messages/referrals/recognitions/virtue_signature_entries
 *  -- only guide_participants.guide_id. */
async function assignGuide(formData: FormData) {
  "use server";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/org-admin");

  const organizationId = String(formData.get("organizationId") ?? "");
  const programId = String(formData.get("programId") ?? "");
  const participantId = String(formData.get("participantId") ?? "");
  const newGuideId = String(formData.get("newGuideId") ?? "");
  if (!(await isOrganizationAdmin(supabase, user.id, organizationId))) notFound();
  if (!participantId || !newGuideId) redirect(`/org-admin/${organizationId}/programs/${programId}`);

  const admin = createAdminClient();

  const { data: program } = await admin
    .from("youth_programs")
    .select("id, organization_id")
    .eq("id", programId)
    .maybeSingle();
  if (!program || program.organization_id !== organizationId) notFound();

  const { data: registration } = await admin
    .from("youth_program_participants")
    .select("id")
    .eq("program_id", programId)
    .eq("participant_id", participantId)
    .eq("registration_status", "registered")
    .maybeSingle();
  if (!registration) notFound();

  const connectedGuides = await listGuidesConnectedToOrganization(admin, organizationId);
  if (!connectedGuides.includes(newGuideId)) {
    redirect(
      `/org-admin/${organizationId}/programs/${programId}?error=${encodeURIComponent("That Guide isn't connected to this organization.")}`
    );
  }

  const { data: oldParticipant } = await admin
    .from("guide_participants")
    .select("guide_id")
    .eq("id", participantId)
    .maybeSingle();

  await admin.from("guide_participants").update({ guide_id: newGuideId }).eq("id", participantId);
  await logOrganizationAdminAction(admin, {
    organizationId,
    actorId: user.id,
    action: "guide_assigned",
    programId,
    participantId,
    guideId: newGuideId,
    detail: `from ${oldParticipant?.guide_id ?? "unknown"}`,
  });

  redirect(`/org-admin/${organizationId}/programs/${programId}?assigned=1`);
}

/** Removes a participant's registration from THIS program only -- the
 *  same registration_status='removed' correction a Guide's own roster
 *  page already uses, never a delete. Does not touch the participant
 *  record, any session, referral, consent, or Signature entry. */
async function removeRegistration(formData: FormData) {
  "use server";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/org-admin");

  const organizationId = String(formData.get("organizationId") ?? "");
  const programId = String(formData.get("programId") ?? "");
  const participantId = String(formData.get("participantId") ?? "");
  if (!(await isOrganizationAdmin(supabase, user.id, organizationId))) notFound();

  const admin = createAdminClient();
  const { data: program } = await admin
    .from("youth_programs")
    .select("id, organization_id")
    .eq("id", programId)
    .maybeSingle();
  if (!program || program.organization_id !== organizationId) notFound();

  await admin
    .from("youth_program_participants")
    .update({ registration_status: "removed" })
    .eq("program_id", programId)
    .eq("participant_id", participantId);
  await logOrganizationAdminAction(admin, {
    organizationId,
    actorId: user.id,
    action: "participant_removed",
    programId,
    participantId,
  });

  redirect(`/org-admin/${organizationId}/programs/${programId}`);
}

export default async function OrgAdminProgramPage({
  params,
  searchParams,
}: {
  params: { organizationId: string; programId: string };
  searchParams?: { error?: string; assigned?: string };
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
    .select("id, name")
    .eq("id", params.organizationId)
    .maybeSingle();
  if (!org) notFound();

  const { data: program } = await admin
    .from("youth_programs")
    .select("id, name, organization_id, status")
    .eq("id", params.programId)
    .maybeSingle();
  if (!program || program.organization_id !== params.organizationId) notFound();

  const { data: regs } = await admin
    .from("youth_program_participants")
    .select("participant_id")
    .eq("program_id", program.id)
    .eq("registration_status", "registered");
  const participantIds = (regs ?? []).map((r) => r.participant_id as string);

  const { data: participantsRaw } = participantIds.length
    ? await admin
        .from("guide_participants")
        .select("id, name, developmental_band, guide_id")
        .in("id", participantIds)
    : { data: [] };

  const guideIds = await listGuidesConnectedToOrganization(admin, params.organizationId);
  // Also resolve each roster participant's actual current guide_id, even
  // if that Guide has since been disconnected from the organization (or
  // was never "connected" by either definition -- e.g. reassigned here
  // from outside this org by a Platform Admin). Continuity display, not
  // an access grant: a disconnected Guide keeps facilitating whoever
  // they were already assigned to, and this roster should still show
  // that Guide's email rather than falling back to a raw id.
  const currentFacilitatingGuideIds = new Set(
    (participantsRaw ?? []).map((p) => p.guide_id as string).filter(Boolean)
  );
  const allGuideIdsToResolve = new Set([...guideIds, ...currentFacilitatingGuideIds]);
  const guideEmailById = new Map<string, string>();
  for (const gid of allGuideIdsToResolve) {
    const { data: u } = await admin.auth.admin.getUserById(gid);
    guideEmailById.set(gid, u?.user?.email ?? gid);
  }

  // isParticipantClearedToParticipate/getConsentStatusForParticipant are
  // Youth-specific gates (they require a developmental_band on record --
  // see their own comments in lib/guardian-consent.ts); an Adult
  // organizational program has no guardian-consent concept at all, so an
  // adult participant is simply always cleared, with no consent/assent
  // status to show. Checked here rather than assumed, so Adult
  // organizations (item 15) don't silently show every participant as
  // "Not cleared."
  const roster = await Promise.all(
    (participantsRaw ?? []).map(async (p) => {
      if (!p.developmental_band) {
        return { participant: p, cleared: true, consent: null as null };
      }
      const [cleared, consent] = await Promise.all([
        isParticipantClearedToParticipate(admin, p.id),
        getConsentStatusForParticipant(admin, p.id),
      ]);
      return { participant: p, cleared, consent };
    })
  );

  return (
    <div className="mx-auto max-w-4xl px-5 py-16">
      <p className="mb-6">
        <Link href={`/org-admin/${org.id}`} className="label hover:text-seal">
          ← {org.name}
        </Link>
      </p>
      <p className="label mb-3">Organization Administration</p>
      <h1 className="font-serif text-4xl text-ink">{program.name}</h1>
      <p className="mt-2 text-muted">Status: {program.status}</p>

      {searchParams?.assigned && (
        <p className="mt-6 rounded-md border border-seal/40 bg-seal/[0.06] px-4 py-3 text-sm text-ink">Assigned.</p>
      )}
      {searchParams?.error && (
        <p className="mt-6 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {searchParams.error}
        </p>
      )}

      <section className="mt-8">
        <p className="label mb-3 text-muted">Roster ({roster.length})</p>
        {roster.length === 0 ? (
          <p className="text-muted">No participants registered.</p>
        ) : (
          <div className="space-y-3">
            {roster.map(({ participant, cleared, consent }) => (
              <div key={participant.id} className="rounded-lg border border-rule bg-white/[0.04] p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-ink">
                    {participant.name}
                    {participant.developmental_band && (
                      <span className="ml-2 rounded-full border border-seal/40 bg-seal/[0.08] px-2 py-0.5 align-middle text-xs text-ink">
                        Youth · {participant.developmental_band}
                      </span>
                    )}
                  </p>
                  <span
                    className={
                      "rounded-full border px-2 py-0.5 text-xs " +
                      (cleared ? "border-seal/40 bg-seal/[0.08] text-ink" : "border-rule text-muted")
                    }
                  >
                    {cleared ? "Cleared" : "Not cleared"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {consent && (
                    <>
                      Guardian consent:{" "}
                      {consent.status === "none"
                        ? "Not started"
                        : consent.status === "pending"
                          ? "Waiting on guardian"
                          : consent.status === "active"
                            ? "Confirmed"
                            : "Revoked"}
                      {` · Youth assent: ${consent.assentConfirmed ? "Confirmed" : "Not yet"}`}
                      {" · "}
                    </>
                  )}
                  Currently facilitated by {guideEmailById.get(participant.guide_id) ?? participant.guide_id}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <form action={assignGuide} className="flex items-center gap-2">
                    <input type="hidden" name="organizationId" value={org.id} />
                    <input type="hidden" name="programId" value={program.id} />
                    <input type="hidden" name="participantId" value={participant.id} />
                    <select
                      name="newGuideId"
                      required
                      className="rounded-md border border-rule bg-white/[0.04] px-3 py-1.5 text-xs text-ink outline-none focus:border-seal"
                    >
                      <option value="" className="bg-[#05060b]">
                        — Assign to Guide —
                      </option>
                      {guideIds
                        .filter((gid) => gid !== participant.guide_id)
                        .map((gid) => (
                          <option key={gid} value={gid} className="bg-[#05060b]">
                            {guideEmailById.get(gid) ?? gid}
                          </option>
                        ))}
                    </select>
                    <button
                      type="submit"
                      className="rounded-md border border-rule px-3 py-1.5 text-xs text-ink transition-colors hover:border-seal"
                    >
                      Assign
                    </button>
                  </form>
                  <form action={removeRegistration}>
                    <input type="hidden" name="organizationId" value={org.id} />
                    <input type="hidden" name="programId" value={program.id} />
                    <input type="hidden" name="participantId" value={participant.id} />
                    <button
                      type="submit"
                      className="rounded-md border border-rule px-3 py-1.5 text-xs text-muted transition-colors hover:border-red-500/60 hover:text-red-300"
                    >
                      Remove from program
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
